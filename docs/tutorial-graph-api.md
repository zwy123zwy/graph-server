# 教程：Graph API 使用要点

对应官方文档：[Use the graph API](https://docs.langchain.com/oss/javascript/langgraph/use-graph-api)。

本页概括 Graph API 的核心用法，并指向本仓库中的代码与示例。

---

## 状态（State）

- 图的**状态**是所有节点共享的数据结构；节点**只返回增量更新**，不返回完整状态。
- 本项目用 **MessagesAnnotation**（消息列表 + 内置 reducer），见 [src/agent.ts](../src/agent.ts) 和 [src/examples/hello-graph.ts](../src/examples/hello-graph.ts)。
- 官方文档中的 **StateSchema / MessagesValue / ReducedValue** 与当前版本的 **Annotation.Root / MessagesAnnotation** 对应，概念一致。

---

## 节点（Nodes）

- **节点**是异步函数：`(state) => Promise<Partial<State>>`，接收当前状态，返回对状态的更新。
- 示例：
  - [src/examples/hello-graph.ts](../src/examples/hello-graph.ts)：单节点 `mock_llm`。
  - [src/agent.ts](../src/agent.ts)：`callModel`（调 LLM）、`tools`（ToolNode）。

---

## 边（Edges）

- **addEdge(from, to)**：固定顺序，如 `__start__ → callModel → __end__`。
- **addConditionalEdges(node, fn, map)**：按 `fn(state)` 结果选下一节点，例如「有 tool_calls → tools，否则 → __end__」。
- 本项目中的条件边见 [src/agent.ts](../src/agent.ts) 的 `shouldContinue` 与 `addConditionalEdges("callModel", shouldContinue, ["tools", "__end__"])`。

---

## 常见图结构

| 结构 | 说明 | 本项目对应 |
|------|------|------------|
| **序列** | 节点 A → B → C | [streaming-example.ts](../src/examples/streaming-example.ts)（nodeA → nodeB） |
| **分支** | 条件边选择下一节点 | [agent.ts](../src/agent.ts)（callModel → tools 或 __end__） |
| **循环** | 工具调用后回到模型节点 | [agent.ts](../src/agent.ts)（tools → callModel） |

---

## 编译与运行

- **compile()**：得到可调用的图；可传入 `{ checkpointer }` 或 `{ store }` 启用记忆。
- **invoke(input, config)**：同步执行到底；`config.configurable.thread_id` 用于多轮对话。
- **stream(input, config)**：流式返回，见 [流式教程](./tutorial-streaming.md)。

---

## 参考

- [官方 Use the graph API](https://docs.langchain.com/oss/javascript/langgraph/use-graph-api)
- [Graph API overview](https://docs.langchain.com/oss/javascript/langgraph/graph-api)
- [文档索引](./langgraph-docs-index.md)
