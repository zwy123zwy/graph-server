/**
 * 网络搜索工具 - 参考免费 API 方案（如 CSDN 等中文社区推荐）
 * 1. 可选：模力方舟（Gitee）免费体验令牌 → 返回完整网页结果（标题/链接/摘要）
 * 2. 可选：快搜 免费额度（新用户 5000 次）→ 同上
 * 3. 默认：DuckDuckGo Instant Answer + Wikipedia（无需任何密钥，稳定可用）
 *
 * 配置方式：在 .env 中设置 MOARK_API_TOKEN 或 KUAISOU_API_KEY 即可启用对应免费 API
 */
import { tool } from "@langchain/core/tools";
import { z } from "zod";
const MAX_WEB_RESULTS = 8;
/** 模力方舟 互联网搜索（免费体验令牌，需在 ai.gitee.com 获取） */
async function searchMoark(query) {
    const token = process.env.MOARK_API_TOKEN || process.env.GITEE_WEB_SEARCH_TOKEN;
    if (!token?.trim())
        return null;
    try {
        const res = await fetch("https://ai.gitee.com/v1/web-search", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token.trim()}`,
            },
            body: JSON.stringify({ query, count: Math.min(MAX_WEB_RESULTS, 20) }),
        });
        if (!res.ok)
            return null;
        const data = (await res.json());
        const list = data.webPages?.value;
        if (!Array.isArray(list))
            return null;
        return list.slice(0, MAX_WEB_RESULTS).map((v) => ({
            name: v.name || "",
            url: v.url || "",
            snippet: v.snippet,
        }));
    }
    catch {
        return null;
    }
}
/** 快搜 网页搜索（新用户 5000 次免费，需在 platform.kuaisou.com 注册获取 API Key） */
async function searchKuaisou(query) {
    const key = process.env.KUAISOU_API_KEY;
    if (!key?.trim())
        return null;
    try {
        const res = await fetch("https://platform.kuaisou.com/api/web-search", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${key.trim()}`,
            },
            body: JSON.stringify({ query, count: MAX_WEB_RESULTS }),
        });
        if (!res.ok)
            return null;
        const data = (await res.json());
        const list = data.webPages?.value;
        if (!Array.isArray(list))
            return null;
        return list.slice(0, MAX_WEB_RESULTS).map((v) => ({
            name: v.name || "",
            url: v.url || "",
            snippet: v.snippet,
        }));
    }
    catch {
        return null;
    }
}
/** DuckDuckGo Instant Answer API（无需密钥） */
async function searchDuckDuckGo(query) {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1`;
    const res = await fetch(url, { headers: { "User-Agent": "LangGraph-WebSearch/1.0" } });
    if (!res.ok)
        return { related: [] };
    const data = (await res.json());
    const related = [];
    if (Array.isArray(data.RelatedTopics)) {
        for (const t of data.RelatedTopics.slice(0, 8)) {
            if (typeof t === "object" && t?.Text)
                related.push({ text: t.Text, url: t.FirstURL });
        }
    }
    return {
        abstract: data.AbstractText || undefined,
        abstractUrl: data.AbstractURL || undefined,
        related,
    };
}
/** Wikipedia Open Search API（无需密钥） */
async function searchWikipedia(query) {
    try {
        const url = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=5&format=json&origin=*`;
        const res = await fetch(url);
        if (!res.ok)
            return [];
        const arr = (await res.json());
        const [, titles, descriptions, urls] = arr;
        if (!Array.isArray(titles) || !Array.isArray(urls))
            return [];
        return titles.slice(0, 5).map((title, i) => ({
            title,
            desc: (descriptions && descriptions[i]) || "",
            url: urls[i] || "",
        }));
    }
    catch {
        return [];
    }
}
/** 优先使用免费 API 令牌（模力方舟 / 快搜），否则用 DDG + 维基 */
async function runWebSearch(q) {
    const parts = [];
    const moarkResults = await searchMoark(q);
    const kuaisouResults = moarkResults == null ? await searchKuaisou(q) : null;
    if (moarkResults?.length) {
        parts.push("【网页搜索】\n" + moarkResults.map((r, i) => `[${i + 1}] ${r.name}\n    ${r.url}\n    ${r.snippet ?? ""}`).join("\n\n"));
    }
    else if (kuaisouResults?.length) {
        parts.push("【网页搜索】\n" + kuaisouResults.map((r, i) => `[${i + 1}] ${r.name}\n    ${r.url}\n    ${r.snippet ?? ""}`).join("\n\n"));
    }
    const [ddgResult, wikiResults] = await Promise.all([searchDuckDuckGo(q), searchWikipedia(q)]);
    if (ddgResult.abstract) {
        parts.push(`【摘要】${ddgResult.abstract}`);
        if (ddgResult.abstractUrl)
            parts.push(`链接: ${ddgResult.abstractUrl}`);
    }
    if (ddgResult.related.length) {
        parts.push("【相关】\n" + ddgResult.related.map((r, i) => `[${i + 1}] ${r.text}${r.url ? `\n    ${r.url}` : ""}`).join("\n\n"));
    }
    if (wikiResults.length) {
        parts.push("【维基百科】\n" + wikiResults.map((w, i) => `[${i + 1}] ${w.title}\n    ${w.url}\n    ${w.desc}`).join("\n\n"));
    }
    if (parts.length)
        return `【网络搜索结果】\n${parts.join("\n\n")}`;
    return `未找到与「${q}」相关的网页结果，可尝试换更简短或英文关键词。若需更多结果，可在 .env 中配置 MOARK_API_TOKEN 或 KUAISOU_API_KEY 使用免费 API。`;
}
export const webSearchTool = tool(async (input) => {
    const { query } = input;
    const q = query?.trim();
    if (!q)
        return "请提供搜索关键词。";
    try {
        return await runWebSearch(q);
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return `搜索请求失败：${msg}`;
    }
}, {
    name: "web_search",
    description: "在互联网上搜索最新信息。当用户询问新闻、实时数据、当前事件、近期信息或你不确定的内容时，应优先调用此工具获取最新结果后再回答。",
    schema: z.object({
        query: z.string().describe("搜索关键词或问题，尽量用简洁的中文或英文关键词"),
    }),
});
