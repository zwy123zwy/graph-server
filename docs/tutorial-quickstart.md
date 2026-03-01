# 教程：Quickstart 对应——从链式图到带工具的 Agent

对应官方文档：[Quickstart](https://docs.langchain.com/oss/javascript/langgraph/quickstart)（计算器 Agent，Graph API / Functional API）。

本页说明如何在本项目中按「先链式图，再工具调用」的顺序学习，并对应到现有代码。

---

## 1. 链式图（无工具）

先跑通「用户 → 节点 A → 节点 B → 结束」的线性图：

- **文档**：[入门教程](./langgraph-getting-started.md) 第三节 Hello World。
- **代码**：[src/examples/hello-graph.ts](../src/examples/hello-graph.ts)（单节点）、[src/examples/streaming-example.ts](../src/examples/streaming-example.ts)（两节点 + 流式）。

```bash
npm run build
node dist/examples/hello-graph.js
node dist/examples/streaming-example.js
```

---

## 2. 带工具的 Agent（条件边 + 循环）

官方 Quickstart 用**计算器工具**（add/multiply/divide）和 **条件边**：模型决定是否调工具，若调则进入 tool 节点再回到模型，形成循环。

本项目的等价实现是 **带 web_search 的对话 Agent**：

- **代码**：[src/agent.ts](../src/agent.ts)。
- **结构**：`callModel`（Ollama + bindTools）→ `shouldContinue` → 若存在 `tool_calls` 则进入 `tools`（ToolNode），再回到 `callModel`；否则结束。

对比要点：

| 官方 Quickstart | 本项目 agent.ts |
|-----------------|------------------|
| StateSchema + MessagesValue | MessagesAnnotation |
| add / multiply / divide 工具 | web_search 工具 |
| ConditionalEdgeRouter → "toolNode" \| END | shouldContinue → "tools" \| "__end__" |
| addEdge("toolNode", "llmCall") | addEdge("tools", "callModel") |

---

## 3. 本地运行与调试

```bash
npm run dev
```

用终端里打印的 **LangGraph Studio** 链接打开，即可对话并观察「模型 → 工具 → 模型」的循环。详见 [README](../README.md) 与 [TROUBLESHOOTING.md](../TROUBLESHOOTING.md)。

---

## 4. 多轮记忆（可选）

若要「同一会话多轮对话」，需 **checkpointer + thread_id**，见 [记忆教程](./tutorial-memory.md) 与 [src/examples/memory-example.ts](../src/examples/memory-example.ts)。

---

## 参考

- [官方 Quickstart](https://docs.langchain.com/oss/javascript/langgraph/quickstart)
- [文档索引](./langgraph-docs-index.md)
