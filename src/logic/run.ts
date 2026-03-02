/**
 * 区分逻辑编排：预处理消息 → 调用模型 → 工具过滤与占位符合并。
 * Agent 层只做「图 + 基础调用」，具体规则集中在此。
 */
import { AIMessage, BaseMessage } from "@langchain/core/messages";
import { MessagesAnnotation } from "@langchain/langgraph";
import { replacePdfBase64WithPath } from "./pdf-replace.js";
import { normalizeMessages } from "./normalize.js";
import { shouldUseTools } from "./should-use-tools.js";
import { getSystemPrompt } from "./system-prompt.js";

export type ModelWithTools = { invoke: (input: unknown) => Promise<unknown> };

/** 执行一轮模型调用：预处理、invoke、后处理（工具过滤、占位符合并）。 */
export async function runModelRound(
  state: typeof MessagesAnnotation.State,
  modelWithTools: ModelWithTools
): Promise<{ messages: AIMessage[] }> {
  const messages = state.messages;
  const messagesWithPaths = await replacePdfBase64WithPath(messages);
  const lastMessage = messagesWithPaths[messagesWithPaths.length - 1];
  if (lastMessage && typeof lastMessage === "object" && "_getType" in lastMessage) {
    const type = (lastMessage as BaseMessage)._getType();
    if (type === "human" || type === "generic") {
      const content = (lastMessage as BaseMessage).content;
      const text =
        typeof content === "string"
          ? content
          : Array.isArray(content)
            ? content
                .map((c) =>
                  c && typeof c === "object" && "text" in c ? (c as { text: string }).text : ""
                )
                .filter(Boolean)
                .join(" ")
            : String(content);
      console.log("[用户输入]", text || "(无文本)");
    }
  }

  const totalMsgs = messagesWithPaths.length;
  console.log(`[消息总数] ${totalMsgs} 条`);
  if (totalMsgs > 0) {
    const lastMsg = messagesWithPaths[totalMsgs - 1];
    if (lastMsg && typeof lastMsg === "object" && "_getType" in lastMsg) {
      console.log(`[最后一条] @${(lastMsg as BaseMessage)._getType()}`);
    }
  }

  const normalized = normalizeMessages(messagesWithPaths);
  const systemContent = getSystemPrompt();
  const response = (await modelWithTools.invoke([
    { role: "system", content: systemContent },
    ...normalized,
  ])) as AIMessage;

  const hasToolCalls =
    Array.isArray((response as { tool_calls?: unknown[] }).tool_calls) &&
    ((response as { tool_calls: unknown[] }).tool_calls?.length ?? 0) > 0;
  const needsTools = shouldUseTools(messagesWithPaths);
  console.log("[是否使用工具]", needsTools ? "是" : "否");
  const lastMsg = messagesWithPaths[messagesWithPaths.length - 1];
  const hasToolResult =
    lastMsg &&
    typeof lastMsg === "object" &&
    "_getType" in lastMsg &&
    (lastMsg as BaseMessage)._getType() === "tool";

  let finalResponse: AIMessage;
  if (hasToolCalls && !needsTools) {
    console.log("[工具过滤] 移除不必要的工具调用");
    finalResponse = new AIMessage({ content: response.content });
  } else if (hasToolCalls && hasToolResult) {
    console.log("[工具过滤] 已有工具结果，阻止重复调用");
    finalResponse = new AIMessage({ content: response.content });
  } else if (hasToolCalls) {
    const contentEmpty =
      response.content === undefined ||
      response.content === null ||
      (typeof response.content === "string" && (response.content as string).trim() === "") ||
      (Array.isArray(response.content) && response.content.length === 0);
    finalResponse = contentEmpty
      ? new AIMessage({
          content: "正在查询，请稍候…",
          tool_calls: (response as AIMessage).tool_calls ?? [],
        })
      : (response as AIMessage);
  } else {
    finalResponse = response as AIMessage;
  }

  console.log("[助手输出]", finalResponse.content);

  const prev = state.messages;
  const lastIdx = prev.length - 1;
  const secondLastIdx = prev.length - 2;
  const isLastToolMsg =
    lastIdx >= 0 &&
    prev[lastIdx] &&
    typeof prev[lastIdx] === "object" &&
    "_getType" in prev[lastIdx] &&
    (prev[lastIdx] as BaseMessage)._getType() === "tool";
  const isSecondLastAI =
    secondLastIdx >= 0 &&
    prev[secondLastIdx] &&
    typeof prev[secondLastIdx] === "object" &&
    "_getType" in prev[secondLastIdx] &&
    (prev[secondLastIdx] as BaseMessage)._getType() === "ai";
  const secondLastContent = isSecondLastAI ? (prev[secondLastIdx] as AIMessage).content : null;
  const isShortPlaceholder =
    typeof secondLastContent === "string" &&
    (secondLastContent === "正在查询，请稍候…" ||
      secondLastContent === "正在处理您的请求，请稍候…" ||
      /^正在读取 PDF|^正在查询|^正在处理|^正在尝试/.test(secondLastContent.trim()));

  if (isLastToolMsg && isSecondLastAI && isShortPlaceholder) {
    const placeholderText = secondLastContent as string;
    const finalText = typeof finalResponse.content === "string" ? finalResponse.content : "";
    const merged =
      finalText && !finalText.includes(placeholderText)
        ? `${placeholderText}\n\n${finalText}`
        : finalText || placeholderText;
    const mergedMsg = new AIMessage({ content: merged.trim() });
    console.log("[占位符合并] 将占位符和最终回答合并为一条消息");
    return { messages: [mergedMsg] };
  }

  return { messages: [finalResponse] };
}
