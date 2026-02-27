import { ChatOllama } from "@langchain/ollama";
import { MessagesAnnotation, StateGraph } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ollamaConfig } from "./config.js";
import { HumanMessage, AIMessage, SystemMessage, } from "@langchain/core/messages";
import { webSearchTool } from "./tools/web-search.js";
const tools = [webSearchTool];
const toolNode = new ToolNode(tools);
const model = new ChatOllama({
    model: ollamaConfig.model,
    baseUrl: ollamaConfig.baseUrl,
    temperature: 0.7,
    maxRetries: 2,
});
const modelWithTools = model.bindTools(tools);
/** 将 type 为 "image" 的内容块转为 Ollama 支持的 "image_url" 格式，避免 Unsupported content type: image */
function normalizeContentBlock(block) {
    if (block && typeof block === "object" && "type" in block && block.type === "image") {
        const b = block;
        let url = "";
        if (typeof b.image === "string")
            url = b.image;
        else if (b.image && typeof b.image === "object" && typeof b.image.url === "string")
            url = b.image.url;
        else if (typeof b.url === "string")
            url = b.url;
        else if (typeof b.data === "string") {
            const mime = (typeof b.mimeType === "string" ? b.mimeType : "image/png");
            url = `data:${mime};base64,${b.data}`;
        }
        if (url)
            return { type: "image_url", image_url: url };
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
    // 在终端打印用户输入（仅当最后一条是用户消息时）
    const lastMessage = messages[messages.length - 1];
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
    const normalized = normalizeMessages(messages);
    const systemContent = `你是一个有帮助的助手。当前日期：${new Date().toISOString().slice(0, 10)}。
你使用本地大模型，知识有截止日期。回答问题时请优先使用 web_search 工具查询最新信息（新闻、实时数据、当前事件、近期动态或你不确定的内容），再结合搜索结果给出准确、有时效性的回答。`;
    const response = await modelWithTools.invoke([
        { role: "system", content: systemContent },
        ...normalized,
    ]);
    return { messages: [response] };
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
