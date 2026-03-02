/**
 * PDF 读取工具：根据 URL 或本地路径提取 PDF 正文文本，供模型总结或回答。
 * 使用 pdf-parse v2（PDFParse）提取文本。
 */
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { PDFParse } from "pdf-parse";
import { readFile } from "node:fs/promises";
const MAX_TEXT_LENGTH = 80_000;
/** 解析 data URL，返回 Buffer；非 data URL 返回 null */
function parseDataUrl(dataUrl) {
    const trimmed = dataUrl.trim();
    if (!trimmed.startsWith("data:"))
        return null;
    const base64 = trimmed.replace(/^data:[^;]+;base64,/, "");
    if (!base64)
        return null;
    try {
        return Buffer.from(base64, "base64");
    }
    catch {
        return null;
    }
}
async function extractPdfText(source) {
    let parser = null;
    try {
        if (source.url?.trim()) {
            const url = source.url.trim();
            const dataBuffer = parseDataUrl(url);
            if (dataBuffer && dataBuffer.length > 0) {
                parser = new PDFParse({ data: dataBuffer });
            }
            else {
                parser = new PDFParse({ url });
            }
        }
        else if (source.path?.trim()) {
            const buffer = await readFile(source.path.trim());
            parser = new PDFParse({ data: buffer });
        }
        else {
            return "请提供 url（PDF 的 HTTP 地址）或 path（服务器上的文件路径）之一。";
        }
        const result = await parser.getText();
        await parser.destroy();
        parser = null;
        const text = (result?.text ?? "").trim();
        if (!text)
            return "该 PDF 未能提取到文本（可能为扫描件或空白页）。";
        if (text.length > MAX_TEXT_LENGTH) {
            return `【前 ${MAX_TEXT_LENGTH} 字】\n${text.slice(0, MAX_TEXT_LENGTH)}\n\n...（已截断，共 ${text.length} 字）`;
        }
        return text;
    }
    catch (e) {
        if (parser)
            await parser.destroy().catch(() => { });
        const msg = e instanceof Error ? e.message : String(e);
        return `读取 PDF 失败：${msg}`;
    }
}
const schema = z
    .object({
    url: z.string().optional().describe("PDF 的 HTTP(S) 地址或 data URL（data:application/pdf;base64,...）"),
    path: z.string().optional().describe("服务器上的 PDF 文件路径（相对或绝对）"),
})
    .refine((o) => (o.url?.trim() ?? "") !== "" || (o.path?.trim() ?? "") !== "", {
    message: "必须提供 url 或 path 之一",
});
export const readPdfTool = tool(async (input) => {
    const { url, path } = input;
    if (!url?.trim() && !path?.trim())
        return "请提供 url 或 path 之一。";
    return extractPdfText({ url, path });
}, {
    name: "read_pdf",
    description: "根据 URL 或本地文件路径读取 PDF 并提取正文文本。当用户要求总结、解读或回答与某份 PDF 相关的问题时，先调用此工具获取内容再回答。",
    schema,
});
