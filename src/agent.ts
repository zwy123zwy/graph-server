import { ChatOllama } from "@langchain/ollama";
import { MessagesAnnotation, StateGraph } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ollamaConfig } from "./config.js";
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  BaseMessage,
  type MessageContent,
} from "@langchain/core/messages";
import { webSearchTool } from "./tools/web-search.js";
import { readPdfTool } from "./tools/read-pdf.js";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

const UPLOAD_DIR = "uploads";

/** 把消息里带 base64 的 PDF file 块落盘，替换为只含路径的 text，避免 prompt 超长（Ollama context limit） */
async function replacePdfBase64WithPath(
  messages: typeof MessagesAnnotation.State["messages"]
): Promise<typeof MessagesAnnotation.State["messages"]> {
  const dir = path.join(process.cwd(), UPLOAD_DIR);
  await mkdir(dir, { recursive: true });
  const result: typeof MessagesAnnotation.State["messages"] = [];
  for (const msg of messages) {
    if (!msg || typeof msg !== "object" || !("content" in msg) || !("_getType" in msg)) {
      result.push(msg);
      continue;
    }
    const msgType = (msg as BaseMessage)._getType();
    if (msgType !== "human" && msgType !== "generic") {
      result.push(msg);
      continue;
    }
    const content = (msg as BaseMessage).content;
    if (typeof content === "string" || !Array.isArray(content)) {
      result.push(msg);
      continue;
    }
    const newContent: unknown[] = [];
    let changed = false;
    for (const block of content) {
      if (block && typeof block === "object" && "type" in block && (block as { type: string }).type === "file") {
        const b = block as Record<string, unknown>;
        let base64 = typeof b.data === "string" ? b.data : "";
        if (!base64 && b.file && typeof b.file === "object") base64 = typeof (b.file as Record<string, unknown>).data === "string" ? (b.file as Record<string, unknown>).data as string : "";
        const mime = (typeof b.mimeType === "string" ? b.mimeType : "application/pdf") as string;
        if (base64 && /pdf/i.test(mime)) {
          const buf = Buffer.from(base64, "base64");
          const name = `${Date.now()}-${randomBytes(4).toString("hex")}.pdf`;
          const savedPath = path.join(dir, name);
          await writeFile(savedPath, buf);
          const absolutePath = path.resolve(savedPath);
          newContent.push({ type: "text", text: `【用户上传了 PDF，已保存在服务器】请立即调用 read_pdf 工具，传入参数 path 为下面这个路径（不要用 url），再根据工具返回的文本回答用户。\npath: ${absolutePath}` });
          changed = true;
          continue;
        }
      }
      newContent.push(block);
    }
    if (changed) result.push(new HumanMessage({ content: newContent as MessageContent }));
    else result.push(msg);
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
function normalizeContentBlock(block: unknown): unknown {
  if (!block || typeof block !== "object" || !("type" in block)) return block;
  const b = block as Record<string, unknown>;
  const blockType = b.type as string;

  // image → image_url（Ollama 只认 text / image_url）
  if (blockType === "image") {
    let url = "";
    if (typeof b.image === "string") url = b.image as string;
    else if (b.image && typeof b.image === "object" && typeof (b.image as { url?: string }).url === "string")
      url = (b.image as { url: string }).url;
    else if (typeof b.url === "string") url = b.url;
    else if (typeof b.data === "string" && b.data.length > 0) {
      const mime = (typeof b.mimeType === "string" ? b.mimeType : "image/png") as string;
      url = `data:${mime};base64,${b.data}`; // 前端传的是纯 base64，此处拼成 data URL
    }
    if (url) return { type: "image_url", image_url: url };
    return { type: "text", text: "【图片（无数据，已跳过）】" };
  }

  // file → 图片则 image_url，否则 text（PDF 等可让模型用 read_pdf）
  if (blockType === "file") {
    let url = "";
    let mime = "";
    let base64 = "";
    if (b.file && typeof b.file === "object") {
      const f = b.file as Record<string, unknown>;
      if (typeof f.url === "string") url = f.url;
      if (typeof f.type === "string") mime = f.type;
      if (typeof f.data === "string") base64 = f.data;
      else if (typeof f.content === "string") base64 = f.content;
    }
    if (!url && typeof b.url === "string") url = b.url;
    if (!mime && typeof b.mimeType === "string") mime = b.mimeType as string;
    if (!base64 && typeof b.data === "string") base64 = b.data as string;
    // 前端传的是纯 base64（multimodal-utils 的 fileToContentBlock），拼成 data URL 供 read_pdf
    if (!url && base64) {
      const m = mime || "application/pdf";
      url = `data:${m};base64,${base64}`;
    }
    const isImage = /^image\//i.test(mime) || /\.(jpe?g|png|gif|webp)(\?|$)/i.test(url) || /^data:image\//i.test(url);
    if (isImage && url) return { type: "image_url", image_url: url };
    // 无有效 url 的 file 块（如只有引用无 data）不向下游传，避免前端 "No data found for file"
    const text = url
      ? `【用户上传了文件】请使用 read_pdf 工具读取以下链接并回答。\nurl: ${url}`
      : "【用户上传了文件，但当前无法获取文件链接】请简短说明无法直接读取该文件，建议用户提供 PDF 的网页链接或把要问的内容用文字发给你。";
    return { type: "text", text };
  }

  return block;
}

function normalizeMessageContent(content: unknown): MessageContent {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((c) => normalizeContentBlock(c)) as MessageContent;
  return content as MessageContent;
}

/** 判断是否真的需要调用工具。避免对常见问题、常识问题进行不必要的web_search */
function shouldUseTools(messages: typeof MessagesAnnotation.State["messages"]): boolean {
  const lastMsg = messages[messages.length - 1];
  if (!lastMsg || typeof lastMsg !== "object" || !("content" in lastMsg)) return false;

  const content = (lastMsg as BaseMessage).content;
  let text = "";
  if (typeof content === "string") {
    text = content;
  } else if (Array.isArray(content)) {
    text = content
      .map((c) => (c && typeof c === "object" && "text" in c ? (c as { text: string }).text : ""))
      .filter(Boolean)
      .join(" ");
  }

  const lowerText = text.toLowerCase();

  // 1. 如果消息中有【用户上传了 PDF】和 path，必须调用 read_pdf
  if (/【用户上传了 PDF/.test(text) && /path:\s*\//.test(text)) {
    return true;
  }

  // 2. 关键词：明确要求搜索、查询最新信息、实时数据、当前事件等
  const needsSearchKeywords = [
    "搜索",
    "查询",
    "最新",
    "实时",
    "当前",
    "今天",
    "今年",
    "现在",
    "新闻",
    "事件",
    "天气",
    "股票",
    "价格",
    "进展",
    "latest",
    "search",
    "current",
    "today",
    "news",
    "real-time",
  ];
  if (needsSearchKeywords.some((keyword) => lowerText.includes(keyword))) {
    return true;
  }

  // 3. 简单的常识问题、定义问题、数学问题通常不需要搜索
  const simpleQuestionPatterns = [
    /^(什么|什么是|定义|解释|怎样|如何)[^?？]*[?？]?$/,
    /^(计算|求|等于)[^?？]*[?？]?$/,
    /^英文对应|^(translation|what means?)[^?？]*[?？]?$/i,
  ];
  if (simpleQuestionPatterns.some((pattern) => pattern.test(text.trim()))) {
    return false;
  }

  // 4. 默认：对于其他情况，让模型自行判断
  return true;
}

/** 规范化消息，使带图片的消息可被 @langchain/ollama 正确转换 */
function normalizeMessages(messages: typeof MessagesAnnotation.State["messages"]) {
  return messages.map((msg, idx) => {
    if (msg && typeof msg === "object" && "content" in msg && "_getType" in msg) {
      const type = (msg as BaseMessage)._getType();
      const content = normalizeMessageContent((msg as BaseMessage).content);
      if (type === "human" || type === "generic") return new HumanMessage({ content });
      if (type === "ai") return new AIMessage({ content });
      if (type === "system") return new SystemMessage({ content });
      
      // tool 消息：寻找前面的 AI 消息的 tool_calls，构造更清晰的上下文
      if (type === "tool") {
        // 查找前面最近的 AI 消息，看它调用了什么工具
        let prevAIToolName = "";
        for (let i = idx - 1; i >= 0; i--) {
          const prevMsg = messages[i];
          if (prevMsg && typeof prevMsg === "object" && "_getType" in prevMsg) {
            const prevType = (prevMsg as BaseMessage)._getType();
            if (prevType === "ai" || prevType === "generic") {
              const toolCalls = (prevMsg as { tool_calls?: unknown[] }).tool_calls;
              if (Array.isArray(toolCalls) && toolCalls.length > 0) {
                const firstTool = (toolCalls[0] as { function?: { name?: string } })?.function?.name || "unknown";
                prevAIToolName = firstTool;
              }
              break;
            }
          }
        }
        
        const toolContent = typeof content === "string" ? content : JSON.stringify(content);
        const toolName = (msg as { name?: string }).name || prevAIToolName || "tool";
        
        // 构造清晰的结果消息，告诉 LLM 工具调用的名称和结果
        const contextualMsg = `【${toolName} 工具执行结束】\n执行结果如下：\n${toolContent}\n\n请根据上述工具结果，回答用户的问题。`;
        return new HumanMessage({ content: contextualMsg });
      }
    }
    return msg;
  });
}

async function callModel(state: typeof MessagesAnnotation.State) {
  const messages = state.messages;
  const messagesWithPaths = await replacePdfBase64WithPath(messages);
  const lastMessage = messagesWithPaths[messagesWithPaths.length - 1];
  if (lastMessage && typeof lastMessage === "object" && "_getType" in lastMessage) {
    const type = (lastMessage as BaseMessage)._getType();
    if (type === "human" || type === "generic") {
      const content = (lastMessage as BaseMessage).content;
      const text = typeof content === "string" ? content : Array.isArray(content)
        ? content.map((c) => (c && typeof c === "object" && "text" in c ? (c as { text: string }).text : "")).filter(Boolean).join(" ")
        : String(content);
      console.log("[用户输入]", text || "(无文本)");
    }
  }
  
  // 调试：打印消息历史摘要
  const totalMsgs = messagesWithPaths.length;
  console.log(`[消息总数] ${totalMsgs} 条`);
  if (totalMsgs > 0) {
    const lastMsg = messagesWithPaths[totalMsgs - 1];
    if (lastMsg && typeof lastMsg === "object" && "_getType" in lastMsg) {
      const type = (lastMsg as BaseMessage)._getType();
      console.log(`[最后一条] @${type}`);
    }
  }
  
  const normalized = normalizeMessages(messagesWithPaths);
  const systemContent = `你是一个有帮助的助手。当前日期：${new Date().toISOString().slice(0, 10)}。
你使用本地大模型，知识有截止日期。

## 工具使用规则
- 仅在第一轮且用户明确要求时，调用 web_search（搜索、最新、实时等关键词）或 read_pdf（用户上传文件）
- 收到【工具执行结果】后，不要再次调用工具，直接根据结果回答用户问题
- 对于常见常识问题、历史事实、定义解释等，直接回答，无需搜索

## 重要
在第一轮调用工具时，必须同时返回占位符和 tool_calls。例如：
内容："正在查询，请稍候…"
工具调用：web_search(query="...")

收到工具结果后，在下一轮直接给出完整答案，不要再提及工具。`;
  const response = await modelWithTools.invoke([
    { role: "system", content: systemContent },
    ...normalized,
  ]);
  
  // 判断是否真的需要调用工具：如果模型返回了 tool_calls 但根据用户消息不应该调用，则移除 tool_calls
  const hasToolCalls = Array.isArray((response as { tool_calls?: unknown[] }).tool_calls) && ((response as { tool_calls: unknown[] }).tool_calls?.length ?? 0) > 0;
  const needsTools = shouldUseTools(messagesWithPaths);
  
  // 检查是否已经获得了工具结果（即最后一条消息是 tool message）
  const lastMsg = messagesWithPaths[messagesWithPaths.length - 1];
  const hasToolResult = lastMsg && typeof lastMsg === "object" && "_getType" in lastMsg && (lastMsg as BaseMessage)._getType() === "tool";
  
  let finalResponse: AIMessage;
  if (hasToolCalls && !needsTools) {
    // 模型想调用工具，但根据启发式规则不应该调用，则清除 tool_calls，保留 content
    console.log("[工具过滤] 移除不必要的工具调用");
    finalResponse = new AIMessage({ content: response.content });
  } else if (hasToolCalls && hasToolResult) {
    // 已经获得工具结果，但模型还想调用工具 → 阻止，强制只返回内容
    console.log("[工具过滤] 已有工具结果，阻止重复调用");
    finalResponse = new AIMessage({ content: response.content });
  } else if (hasToolCalls) {
    // 若模型只返回 tool_calls 而 content 为空，前端会报 "No data found for file"，故注入占位文案
    const contentEmpty = response.content === undefined || response.content === null || (typeof response.content === "string" && (response.content as string).trim() === "") || (Array.isArray(response.content) && response.content.length === 0);
    finalResponse = contentEmpty
      ? new AIMessage({ content: "正在查询，请稍候…", tool_calls: (response as AIMessage).tool_calls ?? [] })
      : response as AIMessage;
  } else {
    finalResponse = response as AIMessage;
  }
  
  console.log("[助手输出]", finalResponse.content);

  // 若上一轮是占位 AI + 工具结果，则本轮的回复与占位合并成一条，避免出现两条助手输出
  const prev = state.messages;
  const lastIdx = prev.length - 1;
  const secondLastIdx = prev.length - 2;
  
  const isLastToolMsg = lastIdx >= 0 && prev[lastIdx] && typeof prev[lastIdx] === "object" && "_getType" in prev[lastIdx] && (prev[lastIdx] as BaseMessage)._getType() === "tool";
  const isSecondLastAI = secondLastIdx >= 0 && prev[secondLastIdx] && typeof prev[secondLastIdx] === "object" && "_getType" in prev[secondLastIdx] && (prev[secondLastIdx] as BaseMessage)._getType() === "ai";
  const secondLastContent = isSecondLastAI ? (prev[secondLastIdx] as AIMessage).content : null;
  const isShortPlaceholder = typeof secondLastContent === "string" && (
    secondLastContent === "正在查询，请稍候…" || 
    secondLastContent === "正在处理您的请求，请稍候…" ||
    /^正在读取 PDF|^正在查询|^正在处理|^正在尝试/.test(secondLastContent.trim())
  );

  if (isLastToolMsg && isSecondLastAI && isShortPlaceholder) {
    // 上一条是 ToolMessage，上上条是占位符 AI
    // 创建合并消息：占位符 + 最终答案
    const placeholderText = secondLastContent as string;
    const finalText = typeof finalResponse.content === "string" ? finalResponse.content : "";
    const merged = finalText && !finalText.includes(placeholderText) 
      ? `${placeholderText}\n\n${finalText}` 
      : finalText || placeholderText;
    const mergedMsg = new AIMessage({ content: merged.trim() });
    
    console.log("[占位符合并] 将占位符和最终回答合并为一条消息");
    return { messages: [mergedMsg] };
  }

  return { messages: [finalResponse] };
}

function shouldContinue(state: typeof MessagesAnnotation.State) {
  const last = state.messages[state.messages.length - 1];
  if (last && typeof last === "object" && "tool_calls" in last && Array.isArray((last as { tool_calls?: unknown[] }).tool_calls) && ((last as { tool_calls: unknown[] }).tool_calls?.length ?? 0) > 0) {
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
