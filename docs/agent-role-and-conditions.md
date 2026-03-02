# 前端设置角色与输入限制

前端可以自定义**角色**和**输入/回答限制**，大模型会据此作答。

## 概念

- **角色（role）**：系统提示中的身份设定，如「你是一位代码审查助手」「你是一位客服」。
- **输入与回答限制（inputConditions）**：对用户输入或模型回答的约束，如「只回答与编程相关的问题」「回答不超过 200 字」「禁止讨论政治」。

二者都会拼进系统提示，模型在生成时需遵守这些设定。

## 使用方式

### 1. HTTP 主接口：POST /chat（流式）

请求体（JSON）：

```json
{
  "message": "用户本轮输入（必填）",
  "role": "你是一位代码审查助手（可选）",
  "inputConditions": "只回答与代码相关的问题，且回答不超过 200 字（可选）",
  "thread_id": "会话 ID（可选，同 ID 保留多轮历史）"
}
```

响应：**SSE 流**（`Content-Type: text/event-stream`），大模型输出流式返回，前端边收边渲染。

若需要一次性拿到完整回复的 JSON，使用 **POST /chat/sync**，请求体同上，响应示例：

```json
{
  "success": true,
  "lastMessage": "助手最后一轮回复的文本"
}
```

未传 `role` 时使用默认角色「你是一个有帮助的助手」；未传 `inputConditions` 时不追加限制段落。

### 2. 使用 LangGraph SDK 时通过 config 传入

若通过 LangGraph API / SDK 调用图（如 `client.runs.stream`），在发起 run 时把 `role`、`inputConditions` 放进 `config.configurable` 即可，例如：

```ts
await client.runs.create(threadId, {
  input: { messages: [...] },
  config: {
    configurable: {
      role: "你是一位代码审查助手",
      inputConditions: "只回答与编程相关的问题，回答不超过 200 字",
    },
  },
});
```

图中 callModel 节点会读取 `config.configurable` 中的 `role` 与 `inputConditions`，并注入到当轮系统提示中。

## 实现位置

- 系统提示拼接：`src/logic/system-prompt.ts`（`getSystemPrompt(overrides)`）
- 从 config 取参并传入逻辑层：`src/agent/call-model.ts`
- HTTP 入口：`src/app.ts` 的 `POST /chat`
