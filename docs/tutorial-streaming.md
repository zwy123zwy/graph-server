# 教程：流式输出（Streaming）

对应官方文档：[Streaming](https://docs.langchain.com/oss/javascript/langgraph/streaming)。

LangGraph 支持流式返回执行过程中的状态与消息，适合对话式 UI：不必等整轮跑完再展示，可边执行边输出。

---

## 流模式（streamMode）

调用 `graph.stream(input, { streamMode: ... })` 时可选用一种或多种模式：

| 模式 | 说明 |
|------|------|
| `values` | 每一步之后**完整状态**（默认之一） |
| `updates` | 每一步之后**状态增量**（各节点返回的更新） |
| `messages` | 消息流（LLM 词元 + 元数据） |
| `custom` | 节点内自定义数据 |
| `tools` | 工具生命周期事件 |
| `debug` | 调试用详细信息 |

---

## 基本用法

```typescript
for await (const chunk of await graph.stream(input, { streamMode: "updates" })) {
  console.log(chunk);
}
```

- **单模式**：`streamMode: "updates"` 或 `"values"`，迭代得到的就是该模式的 chunk。
- **多模式**：`streamMode: ["updates", "values"]`，迭代得到 `[mode, chunk]` 二元组。

---

## 本项目的可运行示例

运行：

```bash
npm run build
node dist/examples/streaming-example.js
```

示例中图有两个节点：`refine` → `reply`。会演示：

- `streamMode: "updates"`：每步只收到该节点的状态更新。
- `streamMode: "values"`：每步收到当前完整状态。

代码见 [src/examples/streaming-example.ts](../src/examples/streaming-example.ts)。

---

## 与主 Agent 的关系

- **自定义 HTTP 主接口**：**POST /chat** 为流式主接口，请求体为 `message`, `role?`, `inputConditions?`, `thread_id?`，返回 **SSE 流**（`Content-Type: text/event-stream`），使用 `graph.streamEvents(..., { version: "v2", encoding: "text/event-stream" })`，前端可边收边渲染。一次性 JSON 回复请用 **POST /chat/sync**。
- **LangGraph API / SDK**：`npm run dev` 启动后通过 LangGraph API 或 SDK 调用时，请求体里使用 `stream_mode: "messages"` 或 `"messages-tuple"` 等即可在客户端收到 SSE 流。  
图定义在 `src/agent.ts`，未改图结构即可享受流式输出。

---

## 参考

- [官方 Streaming](https://docs.langchain.com/oss/javascript/langgraph/streaming)
- [文档索引](./langgraph-docs-index.md)
