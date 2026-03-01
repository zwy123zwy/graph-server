# LangGraph 入门教程（JavaScript/TypeScript）

本教程基于 [LangGraph 官方概述](https://docs.langchain.com/oss/javascript/langgraph/overview)，在本项目中用 **JavaScript/TypeScript** 快速上手 LangGraph。

---

## 一、LangGraph 是什么？

LangGraph 是一个**低层级的编排框架与运行时**，用于构建、管理和部署**长时间运行、有状态**的智能体（agents）。它不负责设计提示词或高层架构，而是提供：

- **持久化执行**：失败后可恢复、长时间运行
- **人机协作**：在任意节点插入人工审核或修改
- **完整记忆**：短期工作记忆 + 跨会话长期记忆
- **与 LangSmith 集成**：追踪、调试、评估
- **生产部署**：可扩展的有状态工作流基础设施

可与 LangChain 组件（模型、工具）一起使用，但**不依赖** LangChain 也能使用 LangGraph。

---

## 二、安装

本项目中已安装：

```bash
npm install @langchain/langgraph @langchain/core
```

如需使用本地大模型（如本项目的 Ollama），可额外安装：

```bash
npm install @langchain/ollama
```

---

## 三、Hello World：第一个图

下面是一个最小可运行图：**用户发消息 → 模拟 LLM 节点返回 "hello world"**。

### 3.1 状态与节点

- **状态**：使用 `MessagesAnnotation`，表示「消息列表」。
- **节点**：一个名为 `mock_llm` 的节点，读取当前消息并返回一条 AI 消息。

### 3.2 代码示例

```typescript
import { MessagesAnnotation, StateGraph } from "@langchain/langgraph";
import { AIMessage, HumanMessage } from "@langchain/core/messages";

// 模拟 LLM：无论输入什么，都返回 "hello world"
async function mockLlm(state: typeof MessagesAnnotation.State) {
  return {
    messages: [new AIMessage("hello world")],
  };
}

const graph = new StateGraph(MessagesAnnotation)
  .addNode("mock_llm", mockLlm)
  .addEdge("__start__", "mock_llm")
  .addEdge("mock_llm", "__end__")
  .compile();

// 调用图
const result = await graph.invoke({
  messages: [new HumanMessage("hi!")],
});

console.log(result.messages);
// 最后一条应为 AI 消息 "hello world"
```

### 3.3 运行本项目的 Hello 示例

项目内已提供可执行示例：

```bash
npm run build
node dist/examples/hello-graph.js
```

---

## 四、核心概念

### 4.1 图（Graph）

- **StateGraph**：以「状态」为核心的图，每个节点读/写同一状态。
- **状态**：通常用 `Annotation.Root({ ... })` 或现成的 `MessagesAnnotation` 定义。

### 4.2 节点（Nodes）

- 节点是**异步函数**，接收当前 `state`，返回**对状态的更新**（例如 `{ messages: [newAIMessage] }`）。
- 本项目中 `src/agent.ts` 的 `callModel`、`tools` 都是节点。

### 4.3 边（Edges）

- **addEdge(from, to)**：固定从一节点到下一节点。
- **addConditionalEdges(from, fn, map)**：根据 `fn(state)` 的返回值决定下一个节点（如「是否调工具」）。

### 4.4 入口与出口

- 入口：`"__start__"`（或常量 `START`）。
- 出口：`"__end__"`（或常量 `END`）。

### 4.5 编译与调用

- **compile()**：得到可调用的图。
- **invoke(input)**：同步执行到底并返回最终状态。
- **stream()**：流式返回各节点的更新，适合对话式 UI。

---

## 五、从 Hello World 到本项目的 Agent

本项目的 `src/agent.ts` 在「Hello World」基础上做了这些扩展：

| 能力       | 说明 |
|------------|------|
| 真实模型   | 使用 `ChatOllama`（Ollama）替代 mock LLM |
| 工具调用   | `ToolNode` + `addConditionalEdges`：模型可决定是否调 `web_search` |
| 消息规范化 | 支持多模态（如图片）并兼容 Ollama 的格式 |

学习顺序建议：

1. 跑通 `examples/hello-graph.ts`。
2. 阅读 `src/agent.ts` 中的 `callModel`、`shouldContinue`、`addConditionalEdges`。
3. 用 `npm run dev` 启动服务，用 LangGraph Studio 或 SDK 调试流式对话。

---

## 六、参考链接

- [LangGraph 概述（官方）](https://docs.langchain.com/oss/javascript/langgraph/overview)
- [持久化执行](https://docs.langchain.com/oss/javascript/langgraph/durable-execution)
- [人机协作（Interrupts）](https://docs.langchain.com/oss/javascript/langgraph/interrupts)
- [LangSmith 追踪](https://docs.langchain.com/langsmith/home)（设置 `LANGSMITH_TRACING=true` 与 API Key）

---

## 七、本教程与官方文档的对应关系

官方概述中的 Hello World 使用 `StateSchema`、`MessagesValue`、`GraphNode` 等 API；本仓库当前使用的 `@langchain/langgraph` 版本以 **Annotation + StateGraph** 为主。概念一致：**状态 → 节点 → 边 → 编译 → 调用**；若你查阅的官方示例使用了 `StateSchema`，可对照本教程的 `MessagesAnnotation` 与 `StateGraph` 写法进行迁移。

**更多官方路径**：见 [LangGraph JS 官方文档索引](./langgraph-docs-index.md)（overview、install、quickstart、local-server、graph-api、durable-execution、interrupts 等）。
