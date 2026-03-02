/**
 * 消息内容规范化：将 image/file 块转为 Ollama 支持的格式，并统一工具消息的展示形式。
 */
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  BaseMessage,
  type MessageContent,
} from "@langchain/core/messages";
import { MessagesAnnotation } from "@langchain/langgraph";

/** 将 type 为 "image" / "file" 的内容块转为 Ollama 支持的格式。
 * 前端约定：图片 { type: "image", mimeType, data: "<纯 base64>" }；PDF { type: "file", mimeType, data }。
 * 若块缺少有效 data/url，转为占位 text，避免前端 "No data found for file"。 */
export function normalizeContentBlock(block: unknown): unknown {
  if (!block || typeof block !== "object" || !("type" in block)) return block;
  const b = block as Record<string, unknown>;
  const blockType = b.type as string;

  if (blockType === "image") {
    let url = "";
    if (typeof b.image === "string") url = b.image as string;
    else if (b.image && typeof b.image === "object" && typeof (b.image as { url?: string }).url === "string")
      url = (b.image as { url: string }).url;
    else if (typeof b.url === "string") url = b.url;
    else if (typeof b.data === "string" && b.data.length > 0) {
      const mime = (typeof b.mimeType === "string" ? b.mimeType : "image/png") as string;
      url = `data:${mime};base64,${b.data}`;
    }
    if (url) return { type: "image_url", image_url: url };
    return { type: "text", text: "【图片（无数据，已跳过）】" };
  }

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
    if (!url && base64) {
      const m = mime || "application/pdf";
      url = `data:${m};base64,${base64}`;
    }
    const isImage = /^image\//i.test(mime) || /\.(jpe?g|png|gif|webp)(\?|$)/i.test(url) || /^data:image\//i.test(url);
    if (isImage && url) return { type: "image_url", image_url: url };
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

/** 规范化消息列表，使带图片/文件的消息可被 Ollama 正确转换，工具消息转为带上下文的 HumanMessage。 */
export function normalizeMessages(
  messages: typeof MessagesAnnotation.State["messages"]
): (HumanMessage | AIMessage | SystemMessage | BaseMessage)[] {
  return messages.map((msg, idx) => {
    if (msg && typeof msg === "object" && "content" in msg && "_getType" in msg) {
      const type = (msg as BaseMessage)._getType();
      const content = normalizeMessageContent((msg as BaseMessage).content);
      if (type === "human" || type === "generic") return new HumanMessage({ content });
      if (type === "ai") return new AIMessage({ content });
      if (type === "system") return new SystemMessage({ content });

      if (type === "tool") {
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
        const contextualMsg = `【${toolName} 工具执行结束】\n执行结果如下：\n${toolContent}\n\n请根据上述工具结果，回答用户的问题。`;
        return new HumanMessage({ content: contextualMsg });
      }
    }
    return msg;
  });
}
