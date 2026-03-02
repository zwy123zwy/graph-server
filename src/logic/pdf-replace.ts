/**
 * 将消息中带 base64 的 PDF file 块落盘，替换为只含路径的 text，避免 prompt 超长（Ollama context limit）。
 */
import { HumanMessage, BaseMessage, type MessageContent } from "@langchain/core/messages";
import { MessagesAnnotation } from "@langchain/langgraph";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

const UPLOAD_DIR = "uploads";

export async function replacePdfBase64WithPath(
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
        if (!base64 && b.file && typeof b.file === "object")
          base64 = typeof (b.file as Record<string, unknown>).data === "string"
            ? ((b.file as Record<string, unknown>).data as string)
            : "";
        const mime = (typeof b.mimeType === "string" ? b.mimeType : "application/pdf") as string;
        if (base64 && /pdf/i.test(mime)) {
          const buf = Buffer.from(base64, "base64");
          const name = `${Date.now()}-${randomBytes(4).toString("hex")}.pdf`;
          const savedPath = path.join(dir, name);
          await writeFile(savedPath, buf);
          const absolutePath = path.resolve(savedPath);
          newContent.push({
            type: "text",
            text: `【用户上传了 PDF，已保存在服务器】请立即调用 read_pdf 工具，传入参数 path 为下面这个路径（不要用 url），再根据工具返回的文本回答用户。\npath: ${absolutePath}`,
          });
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
