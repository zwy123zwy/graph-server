/**
 * 模型系统提示词。可由前端通过 config.configurable 传入 role、inputConditions 覆盖或追加。
 */
export type AgentPromptOverrides = {
  /** 角色设定，如「你是一位代码审查助手」 */
  role?: string;
  /** 输入与回答限制，如「只回答与编程相关的问题，且回答不超过 200 字」 */
  inputConditions?: string;
};

export function getSystemPrompt(overrides?: AgentPromptOverrides): string {
  const date = new Date().toISOString().slice(0, 10);
  let base = `当前日期：${date}。你使用本地大模型，知识有截止日期。

## 工具使用规则
- 仅在第一轮且用户明确要求时，调用 web_search（搜索、最新、实时等关键词）、read_pdf（用户上传文件）或 crawl_url（用户给了一个链接需要你读该页内容）
- 若用户给了具体网址并要求总结/解读该页，或 web_search 返回的某条链接需要进一步读正文，可调用 crawl_url(url="...") 抓取该页内容后再回答
- 收到【工具执行结果】后，不要再次调用工具，直接根据结果回答用户问题
- 对于常见常识问题、历史事实、定义解释等，直接回答，无需搜索

## 重要
在第一轮调用工具时，必须同时返回占位符和 tool_calls。例如：
内容："正在查询，请稍候…"
工具调用：web_search(query="...")

收到工具结果后，在下一轮直接给出完整答案，不要再提及工具。`;

  if (overrides?.role?.trim()) {
    base = `## 角色\n${overrides.role.trim()}\n\n` + base;
  } else {
    base = `你是一个有帮助的助手。\n\n` + base;
  }
  if (overrides?.inputConditions?.trim()) {
    base += `\n\n## 输入与回答限制（必须遵守）\n${overrides.inputConditions.trim()}`;
  }
  return base;
}
