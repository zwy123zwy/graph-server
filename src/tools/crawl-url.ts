/**
 * 抓取 URL 正文工具：请求指定网址，将 HTML 转为纯文本返回。
 * 与 web_search 配合可实现「搜索 → 选链接 → 抓取正文 → 总结」。
 *
 * 人为判断点见 docs/web-search.md：
 * - 允许的域名/协议、超时与长度上限、是否引入 html-to-text 等。
 */
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const FETCH_TIMEOUT_MS = 15_000;
/** 返回正文最大字符数，避免撑爆上下文（人为可调） */
const MAX_TEXT_LENGTH = 18_000;

function stripHtmlToText(html: string): string {
  const noScript = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  const noStyle = noScript.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
  const withNewlines = noStyle
    .replace(/<\/?(?:p|div|br|tr|li|h[1-6])\b[^>]*>/gi, "\n")
    .replace(/<\/?[^>]+>/g, "");
  const decoded = withNewlines
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
  return decoded
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export const crawlUrlTool = tool(
  async (input: unknown) => {
    const { url } = input as { url: string };
    const raw = (url ?? "").trim();
    if (!raw) return "请提供要抓取的网址（url）。";

    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      return "无效的 URL 格式，请提供完整的 http(s) 地址。";
    }
    if (!/^https?:$/i.test(parsed.protocol)) {
      return "仅支持 http 或 https 协议。";
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(raw, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; LangGraph-Crawl/1.0; +https://github.com/langchain-ai/langgraph)",
        },
        redirect: "follow",
      });
      clearTimeout(timeout);
      if (!res.ok) {
        return `请求失败: HTTP ${res.status} ${res.statusText}。`;
      }
      const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
      if (!contentType.includes("text/html")) {
        return `该 URL 不是 HTML 页面（Content-Type: ${contentType}），无法提取正文。`;
      }
      const html = await res.text();
      const text = stripHtmlToText(html);
      if (!text) return "页面无有效正文内容。";
      if (text.length > MAX_TEXT_LENGTH) {
        return `【网页正文（已截断至 ${MAX_TEXT_LENGTH} 字）】\n\n${text.slice(0, MAX_TEXT_LENGTH)}\n\n…（后续省略）`;
      }
      return `【网页正文】\n\n${text}`;
    } catch (e) {
      clearTimeout(timeout);
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("abort")) return "请求超时，请稍后重试或换一个链接。";
      return `抓取失败：${msg}`;
    }
  },
  {
    name: "crawl_url",
    description:
      "抓取指定网址的网页正文（HTML 转纯文本）。在用户需要某条链接的详细内容、或 web_search 返回了链接需要进一步阅读时使用。仅支持 http/https。",
    schema: z.object({
      url: z.string().describe("要抓取的完整 URL，例如 https://example.com/page"),
    }),
  }
);
