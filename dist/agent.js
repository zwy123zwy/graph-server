import { ChatOllama } from "@langchain/ollama";
import { MessagesAnnotation, StateGraph } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ollamaConfig } from "./config.js";
import { HumanMessage, AIMessage, SystemMessage, } from "@langchain/core/messages";
import { webSearchTool } from "./tools/web-search.js";
import { readPdfTool } from "./tools/read-pdf.js";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { pruneUploadsLru } from "./lib/uploads-lru.js";
const UPLOAD_DIR = "uploads";
/** 把消息里带 base64 的 PDF file 块落盘，替换为只含路径的 text，避免 prompt 超长（Ollama context limit） */
async function replacePdfBase64WithPath(messages) {
    const dir = path.join(process.cwd(), UPLOAD_DIR);
    await mkdir(dir, { recursive: true });
    const result = [];
    for (const msg of messages) {
        if (!msg || typeof msg !== "object" || !("content" in msg) || !("_getType" in msg)) {
            result.push(msg);
            continue;
        }
        const msgType = msg._getType();
        if (msgType !== "human" && msgType !== "generic") {
            result.push(msg);
            continue;
        }
        const content = msg.content;
        if (typeof content === "string" || !Array.isArray(content)) {
            result.push(msg);
            continue;
        }
        const newContent = [];
        let changed = false;
        for (const block of content) {
            if (block && typeof block === "object" && "type" in block && block.type === "file") {
                const b = block;
                let base64 = typeof b.data === "string" ? b.data : "";
                if (!base64 && b.file && typeof b.file === "object")
                    base64 = typeof b.file.data === "string" ? b.file.data : "";
                const mime = (typeof b.mimeType === "string" ? b.mimeType : "application/pdf");
                if (base64 && /pdf/i.test(mime)) {
                    const buf = Buffer.from(base64, "base64");
                    const name = `${Date.now()}-${randomBytes(4).toString("hex")}.pdf`;
                    const savedPath = path.join(dir, name);
                    await writeFile(savedPath, buf);
                    await pruneUploadsLru(dir);
                    const absolutePath = path.resolve(savedPath);
                    newContent.push({ type: "text", text: `【用户上传了 PDF，已保存在服务器】请立即调用 read_pdf 工具，传入参数 path 为下面这个路径（不要用 url），再根据工具返回的文本回答用户。\npath: ${absolutePath}` });
                    changed = true;
                    continue;
                }
            }
            newContent.push(block);
        }
        if (changed)
            result.push(new HumanMessage({ content: newContent }));
        else
            result.push(msg);
    }
    return result;
}
const tools = [webSearchTool, readPdfTool];
const toolNode = new ToolNode(tools);
const model = new ChatOllama({
    model: ollamaConfig.model,
    baseUrl: ollamaConfig.baseUrl,
    temperature: 0.7,
    // maxRetries: 2,
});
const modelWithTools = model.bindTools(tools);
/** 将 type 为 "image" / "file" 的内容块转为 Ollama 支持的格式，避免 Unsupported content type。
 * 前端约定（stream.submit 的 HumanMessage.content）：
 * - 图片：{ type: "image", mimeType: "image/png", data: "<纯 base64>", metadata?: { name } }
 * - PDF：{ type: "file", mimeType: "application/pdf", data: "<纯 base64>", metadata?: { filename } }
 * 即 data 均为无 "data:xxx;base64," 前缀的 base64 字符串。
 * 若块缺少有效 data/url（如历史消息被截断、只存引用），转为占位 text，避免前端 "No data found for file"。 */
function normalizeContentBlock(block) {
    if (!block || typeof block !== "object" || !("type" in block))
        return block;
    const b = block;
    const blockType = b.type;
    // image → image_url（Ollama 只认 text / image_url）
    if (blockType === "image") {
        let url = "";
        if (typeof b.image === "string")
            url = b.image;
        else if (b.image && typeof b.image === "object" && typeof b.image.url === "string")
            url = b.image.url;
        else if (typeof b.url === "string")
            url = b.url;
        else if (typeof b.data === "string" && b.data.length > 0) {
            const mime = (typeof b.mimeType === "string" ? b.mimeType : "image/png");
            url = `data:${mime};base64,${b.data}`; // 前端传的是纯 base64，此处拼成 data URL
        }
        if (url)
            return { type: "image_url", image_url: url };
        return { type: "text", text: "【图片（无数据，已跳过）】" };
    }
    // file → 图片则 image_url，否则 text（PDF 等可让模型用 read_pdf）
    if (blockType === "file") {
        let url = "";
        let mime = "";
        let base64 = "";
        if (b.file && typeof b.file === "object") {
            const f = b.file;
            if (typeof f.url === "string")
                url = f.url;
            if (typeof f.type === "string")
                mime = f.type;
            if (typeof f.data === "string")
                base64 = f.data;
            else if (typeof f.content === "string")
                base64 = f.content;
        }
        if (!url && typeof b.url === "string")
            url = b.url;
        if (!mime && typeof b.mimeType === "string")
            mime = b.mimeType;
        if (!base64 && typeof b.data === "string")
            base64 = b.data;
        // 前端传的是纯 base64（multimodal-utils 的 fileToContentBlock），拼成 data URL 供 read_pdf
        if (!url && base64) {
            const m = mime || "application/pdf";
            url = `data:${m};base64,${base64}`;
        }
        const isImage = /^image\//i.test(mime) || /\.(jpe?g|png|gif|webp)(\?|$)/i.test(url) || /^data:image\//i.test(url);
        if (isImage && url)
            return { type: "image_url", image_url: url };
        // 无有效 url 的 file 块（如只有引用无 data）不向下游传，避免前端 "No data found for file"
        const text = url
            ? `【用户上传了文件】请使用 read_pdf 工具读取以下链接并回答。\nurl: ${url}`
            : "【用户上传了文件，但当前无法获取文件链接】请简短说明无法直接读取该文件，建议用户提供 PDF 的网页链接或把要问的内容用文字发给你。";
        return { type: "text", text };
    }
    return block;
}
function normalizeMessageContent(content) {
    if (typeof content === "string")
        return content;
    if (Array.isArray(content))
        return content.map((c) => normalizeContentBlock(c));
    return content;
}
/** 规范化消息，使带图片的消息可被 @langchain/ollama 正确转换 */
function normalizeMessages(messages) {
    return messages.map((msg) => {
        if (msg && typeof msg === "object" && "content" in msg && "_getType" in msg) {
            const type = msg._getType();
            const content = normalizeMessageContent(msg.content);
            if (type === "human" || type === "generic")
                return new HumanMessage({ content });
            if (type === "ai")
                return new AIMessage({ content });
            if (type === "system")
                return new SystemMessage({ content });
        }
        return msg;
    });
}
async function callModel(state) {
    const messages = state.messages;
    const messagesWithPaths = await replacePdfBase64WithPath(messages);
    const lastMessage = messagesWithPaths[messagesWithPaths.length - 1];
    if (lastMessage && typeof lastMessage === "object" && "_getType" in lastMessage) {
        const type = lastMessage._getType();
        if (type === "human" || type === "generic") {
            const content = lastMessage.content;
            const text = typeof content === "string" ? content : Array.isArray(content)
                ? content.map((c) => (c && typeof c === "object" && "text" in c ? c.text : "")).filter(Boolean).join(" ")
                : String(content);
            console.log("[用户输入]", text || "(无文本)");
        }
    }
    const normalized = normalizeMessages(messagesWithPaths);
    const systemContent = `你是一个有帮助的助手。当前日期：${new Date().toISOString().slice(0, 10)}。
你使用本地大模型，知识有截止日期。回答问题时请优先使用 web_search 工具查询最新信息（新闻、实时数据、当前事件、近期动态或你不确定的内容），再结合搜索结果给出准确、有时效性的回答。
当用户消息中出现【用户上传了 PDF】并给出 path 时，你必须调用 read_pdf 工具、参数 path 为该路径，再根据工具返回的文本内容回答；不要回复“无法访问本地文件”或要求用户提供网页链接。
重要：每次你要调用工具（如 read_pdf、web_search）时，必须先在同一轮回复里写一句简短的占位文字（例如：“正在读取 PDF，请稍候。”或“正在查询，请稍候。”），再发起工具调用，不要只发工具调用而不写任何 content，否则前端会报错。
若无法读取用户上传的文件（例如消息中无 path 也无 url），回复时不要提及任何接口或路径（例如 /upload-pdf），仅简短说明需提供 PDF 的网页链接或把问题用文字描述即可。`;
    const response = await modelWithTools.invoke([
        { role: "system", content: systemContent },
        ...normalized,
    ]);
    // 若模型只返回 tool_calls 而 content 为空，前端会报 "No data found for file"，故注入占位文案
    const hasToolCalls = Array.isArray(response.tool_calls) && (response.tool_calls?.length ?? 0) > 0;
    const contentEmpty = response.content === undefined || response.content === null || (typeof response.content === "string" && response.content.trim() === "") || (Array.isArray(response.content) && response.content.length === 0);
    const finalResponse = hasToolCalls && contentEmpty
        ? new AIMessage({ content: "正在处理您的请求，请稍候…", tool_calls: response.tool_calls ?? [] })
        : response;
    console.log("[助手输出]", finalResponse.content);
    // 若上一轮是占位 AI + 工具结果，则本轮的回复与占位合并成一条，避免出现两条助手输出
    const prev = state.messages;
    const lastPrev = prev.length >= 1 ? prev[prev.length - 1] : null;
    const secondLast = prev.length >= 2 ? prev[prev.length - 2] : null;
    const isToolMsg = lastPrev && typeof lastPrev === "object" && "_getType" in lastPrev && lastPrev._getType() === "tool";
    const prevAi = secondLast && typeof secondLast === "object" && "_getType" in secondLast && ["ai", "generic"].includes(secondLast._getType()) ? secondLast : null;
    const prevContent = prevAi?.content;
    const isShortPlaceholder = typeof prevContent === "string" && (prevContent === "正在处理您的请求，请稍候…" || /^正在读取 PDF|^正在查询/.test(prevContent.trim()));
    if (isToolMsg && prevAi && isShortPlaceholder) {
        const sep = typeof finalResponse.content === "string" && finalResponse.content.trim() ? "\n\n" : "";
        const merged = (typeof prevContent === "string" ? prevContent : "") + sep + (typeof finalResponse.content === "string" ? finalResponse.content : "");
        const mergedMsg = new AIMessage({ content: merged.trim(), id: prevAi.id });
        return { messages: [mergedMsg] };
    }
    return { messages: [finalResponse] };
}
function shouldContinue(state) {
    const last = state.messages[state.messages.length - 1];
    if (last && typeof last === "object" && "tool_calls" in last && Array.isArray(last.tool_calls) && (last.tool_calls?.length ?? 0) > 0) {
        return "tools";
    }
    return "__end__";
}
const workflow = new StateGraph(MessagesAnnotation)
    .addNode("callModel", callModel)
    .addNode("tools", toolNode)
    .addEdge("__start__", "callModel")
    .addConditionalEdges("callModel", shouldContinue, ["tools", "__end__"])
    .addEdge("tools", "callModel");
export const graph = workflow.compile();
