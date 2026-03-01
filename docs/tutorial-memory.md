# 教程：记忆（Memory）

对应官方文档：[Memory](https://docs.langchain.com/oss/javascript/langgraph/add-memory)。

LangGraph 支持两类记忆：

- **短期记忆**：通过 **checkpointer**（如 `MemorySaver`）+ **thread_id** 实现多轮对话，状态按线程持久化。
- **长期记忆**：通过 **store**（如 `InMemoryStore`）在会话之间存储用户级或应用级数据。

---

## 短期记忆（多轮对话）

1. 使用 **checkpointer** 编译图：`compile({ checkpointer: new MemorySaver() })`。
2. 每次调用时传入 **thread_id**：`invoke(input, { configurable: { thread_id: "xxx" } })`。
3. 同一 `thread_id` 下多次 `invoke` 会沿用同一线程的状态（例如历史消息）。

```typescript
import { MemorySaver, StateGraph } from "@langchain/langgraph";

const checkpointer = new MemorySaver();
const graph = new StateGraph(MessagesAnnotation)
  .addNode("callModel", callModel)
  .addEdge("__start__", "callModel")
  .addEdge("callModel", "__end__")
  .compile({ checkpointer });

const config = { configurable: { thread_id: "thread-1" } };

await graph.invoke({ messages: [new HumanMessage("我叫小明")] }, config);
await graph.invoke({ messages: [new HumanMessage("我叫什么？")] }, config);
// 模型可看到上一轮的“我叫小明”，回答“你叫小明”
```

生产环境应使用持久化 checkpointer（如 Postgres），见官方 [Persistence](https://docs.langchain.com/oss/javascript/langgraph/persistence)。

---

## 本项目的可运行示例

运行：

```bash
npm run build
node dist/examples/memory-example.js
```

示例用 **MemorySaver** 和固定 **thread_id** 做两轮调用：第一轮“我叫 Bob”，第二轮“我叫什么？”，模拟 LLM 会基于上下文回答“Bob”。  
代码见 [src/examples/memory-example.ts](../src/examples/memory-example.ts)。

---

## 长期记忆（Store）

使用 **store** 可在节点内读写跨会话数据（如用户偏好、检索库）：

```typescript
import { InMemoryStore, StateGraph } from "@langchain/langgraph";

const store = new InMemoryStore();
const graph = builder.compile({ store });
// 在节点中通过 runtime.store 做 search/put 等
```

生产环境可换用 Postgres 等持久化 store，详见官方 [Add long-term memory](https://docs.langchain.com/oss/javascript/langgraph/add-memory#add-long-term-memory)。

---

## 参考

- [官方 Memory](https://docs.langchain.com/oss/javascript/langgraph/add-memory)
- [Persistence](https://docs.langchain.com/oss/javascript/langgraph/persistence)
- [文档索引](./langgraph-docs-index.md)
