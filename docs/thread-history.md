# Thread 对话历史

本项目的 agent 图已启用 **checkpointer**（MemorySaver），支持按 **thread_id** 保留多轮对话历史。

## 机制说明

- **无 thread_id**：每次 `invoke` 仅带当轮消息，图从空状态开始，无历史。
- **有 thread_id**：传入相同 `thread_id` 时，会先加载该 thread 的 checkpoint（之前的 messages），再追加本轮的 user 消息并运行图，因此模型能看到完整对话历史。

Checkpoint 当前使用 **MemorySaver**（进程内存），进程重启后历史清空。若需持久化到磁盘或数据库，可替换为 SqliteSaver 等（需额外依赖与配置）。

## 使用方式

### 1. POST /chat（主接口，流式）或 POST /chat/sync 传 thread_id

请求体增加可选字段 `thread_id`，同一会话使用同一 ID 即可保留历史：

```json
{
  "message": "第二轮的问题",
  "thread_id": "user-123-session-1"
}
```

首轮与后续轮都传相同的 `thread_id`，后端会按 thread 恢复并追加消息。POST /chat 返回 SSE 流；POST /chat/sync 返回 JSON。

### 2. LangGraph SDK / Studio

使用 LangGraph API 或前端 SDK 时，在创建或继续 run 时传入 `config.configurable.thread_id`（例如 Studio 的 thread 概念），即会自动带历史执行。

### 3. 直接调用 graph.invoke

```ts
const config = { configurable: { thread_id: "my-thread-1" } };
await graph.invoke({ messages: [new HumanMessage("第一轮")] }, config);
await graph.invoke({ messages: [new HumanMessage("第二轮")] }, config); // 模型能看到第一轮
```

## 实现位置

- 图编译时挂载 checkpointer：`src/agent/index.ts`（`MemorySaver` + `workflow.compile({ checkpointer })`）
- POST /chat 透传 thread_id：`src/app.ts` 的 `ChatBody.thread_id` 与 `config.configurable.thread_id`
