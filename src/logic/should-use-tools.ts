/**
 * 判断当前轮次是否应允许调用工具。
 * 仅当明确需要（PDF/链接/搜索类意图）时允许；否则一律不允许，避免无谓的 web_search。
 */
import { BaseMessage } from "@langchain/core/messages";
import { MessagesAnnotation } from "@langchain/langgraph";

export function shouldUseTools(
  messages: typeof MessagesAnnotation.State["messages"]
): boolean {
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

  // 1. 用户上传了 PDF 并给出 path → 必须允许 read_pdf
  if (/【用户上传了 PDF/.test(text) && /path:\s*\//.test(text)) return true;

  // 2. 消息里包含网址 → 允许 crawl_url
  if (/https?:\/\/[^\s]+/i.test(text)) return true;

  // 3. 明确带有「需要联网/搜索」意图的关键词 → 允许 web_search / crawl_url
  const needsSearchKeywords = [
    "搜索", "查询", "查一下", "查一查", "找一下", "最新", "实时", "当前", "今天", "今年", "现在",
    "新闻", "事件", "天气", "股票", "价格", "进展",
    "latest", "search", "current", "today", "news", "real-time",
  ];
  if (needsSearchKeywords.some((k) => lowerText.includes(k))) return true;

  // 4. 默认：不满足上述条件则不允许调用工具，由模型直接回答
  return false;
}
