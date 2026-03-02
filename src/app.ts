/**
 * 自定义 HTTP 路由：PDF 上传、可配置角色与输入限制的对话等。
 * 需在 langgraph.json 中配置 "http": { "app": "./src/app.ts:app" }。
 */
import { Hono } from "hono";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { graph } from "./agent.js";
import { HumanMessage } from "@langchain/core/messages";
import { pruneUploadsLru } from "./lib/uploads-lru.js";

export const app = new Hono();

/** 前端可传入的角色、输入限制与 thread（会话）标识 */
type ChatBody = {
  /** 当前轮用户输入（必填） */
  message: string;
  /** 角色设定，如「你是一位代码审查助手」 */
  role?: string;
  /** 输入与回答限制，如「只回答与编程相关的问题，回答不超过 200 字」 */
  inputConditions?: string;
  /** 会话 ID：传同一 thread_id 时保留多轮历史；不传则每轮独立无历史 */
  thread_id?: string;
};

const UPLOAD_DIR = "uploads";
const MAX_UPLOAD_FILES = 5;

/** 生成安全文件名，避免路径穿越 */
function safeFileName(originalName: string): string {
  const base = path.basename(originalName || "upload.pdf").replace(/[^a-zA-Z0-9._-]/g, "_");
  return base.endsWith(".pdf") ? base : `${base}.pdf`;
}

/**
 * POST /upload-pdf
 * Content-Type: multipart/form-data
 * 字段：
 *   - file: PDF 文件（必填）
 *   - message: 用户问题（可选，默认“请总结这份 PDF。”）
 * 返回：JSON { success, message?, error?, lastMessage? }
 */
app.post("/upload-pdf", async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body["file"] ?? body["file[]"];
    const messageText = (typeof body["message"] === "string" ? body["message"] : "")?.trim() || "请总结这份 PDF。";

    if (file == null || typeof file === "string") {
      return c.json({ success: false, error: "缺少字段：file（PDF 文件）" }, 400);
    }

    const raw = file as Blob;
    const name = raw instanceof File ? raw.name : "upload.pdf";
    const bytes = await raw.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (buffer.length === 0) {
      return c.json({ success: false, error: "上传的文件为空" }, 400);
    }

    const dir = path.join(process.cwd(), UPLOAD_DIR);
    await mkdir(dir, { recursive: true });
    const fileName = `${Date.now()}-${safeFileName(name)}`;
    const savedPath = path.join(dir, fileName);
    await writeFile(savedPath, buffer);
    await pruneUploadsLru(dir, MAX_UPLOAD_FILES);

    // 使用绝对路径，确保 read_pdf 工具能读到
    const absolutePath = path.resolve(savedPath);
    const userMessage = `【用户上传了 PDF 文件】路径：${absolutePath}。用户问题：${messageText}`;

    const result = await graph.invoke({
      messages: [new HumanMessage(userMessage)],
    });

    const messages = result?.messages ?? [];
    const last = messages[messages.length - 1];
    const lastContent = last && typeof last === "object" && "content" in last
      ? (last as { content: unknown }).content
      : null;
    const lastText = typeof lastContent === "string" ? lastContent : "";

    return c.json({
      success: true,
      message: "已处理上传的 PDF。",
      savedPath: absolutePath,
      lastMessage: lastText || (last ? JSON.stringify(last) : null),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ success: false, error: `处理 PDF 失败：${msg}` }, 500);
  }
});

/** 解析 chat 请求体，校验 message，返回 configurable */
function parseChatBody(body: unknown): { message: string; configurable: Record<string, unknown> } | { error: string } {
  const b = body as ChatBody | null;
  const message = typeof b?.message === "string" ? b.message.trim() : "";
  if (!message) return { error: "缺少字段：message（用户输入）" };
  const role = typeof b?.role === "string" ? b.role.trim() : undefined;
  const inputConditions = typeof b?.inputConditions === "string" ? b.inputConditions.trim() : undefined;
  const threadId = typeof b?.thread_id === "string" ? b.thread_id.trim() || undefined : undefined;
  const configurable: Record<string, unknown> = { role, inputConditions };
  if (threadId) configurable.thread_id = threadId;
  return { message, configurable };
}

/**
 * POST /chat（主接口，流式）
 * Body: { message: string, role?: string, inputConditions?: string, thread_id?: string }
 * 返回：SSE 流（Content-Type: text/event-stream），大模型输出流式返回，前端边收边渲染。
 */
app.post("/chat", async (c) => {
  try {
    const body = (await c.req.json()) as ChatBody;
    const parsed = parseChatBody(body);
    if ("error" in parsed) return c.json({ success: false, error: parsed.error }, 400);

    const stream = graph.streamEvents(
      { messages: [new HumanMessage(parsed.message)] },
      {
        version: "v2",
        configurable: parsed.configurable,
        encoding: "text/event-stream" as const,
      }
    );

    return new Response(stream as unknown as ReadableStream<Uint8Array>, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ success: false, error: `对话失败：${msg}` }, 500);
  }
});

/**
 * POST /chat/sync
 * Body 同 POST /chat。一次性 invoke，返回 JSON { success, lastMessage }，不流式。
 */
app.post("/chat/sync", async (c) => {
  try {
    const body = (await c.req.json()) as ChatBody;
    const parsed = parseChatBody(body);
    if ("error" in parsed) return c.json({ success: false, error: parsed.error }, 400);

    const result = await graph.invoke(
      { messages: [new HumanMessage(parsed.message)] },
      { configurable: parsed.configurable }
    );

    const messages = result?.messages ?? [];
    const last = messages[messages.length - 1];
    const lastContent =
      last && typeof last === "object" && "content" in last
        ? (last as { content: unknown }).content
        : null;
    const lastText = typeof lastContent === "string" ? lastContent : "";

    return c.json({
      success: true,
      lastMessage: lastText || (last ? JSON.stringify(last) : null),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ success: false, error: `对话失败：${msg}` }, 500);
  }
});
