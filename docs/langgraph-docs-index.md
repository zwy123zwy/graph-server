# LangGraph JavaScript/TypeScript 官方文档索引

本文档整理 [docs.langchain.com](https://docs.langchain.com) 下 **LangGraph JS/TS** 相关路径，便于在本项目中快速跳转查阅。完整文档索引见 [llms.txt](https://docs.langchain.com/llms.txt)。

---

## 入口与安装

| 标题 | 路径 | 说明 |
|------|------|------|
| [LangGraph overview](https://docs.langchain.com/oss/javascript/langgraph/overview) | `oss/javascript/langgraph/overview` | 概述、核心价值、Hello World、与 LangChain 关系 |
| [Install LangGraph](https://docs.langchain.com/oss/javascript/langgraph/install) | `oss/javascript/langgraph/install` | 安装 `@langchain/langgraph`、`@langchain/core`，可选 `langchain`、各 Provider 集成 |

---

## 快速开始与本地运行

| 标题 | 路径 | 说明 |
|------|------|------|
| [Quickstart](https://docs.langchain.com/oss/javascript/langgraph/quickstart) | `oss/javascript/langgraph/quickstart` | 计算器 Agent：Graph API 与 Functional API 两种写法（工具、状态、条件边） |
| [Run a local server](https://docs.langchain.com/oss/javascript/langgraph/local-server) | `oss/javascript/langgraph/local-server` | 安装 CLI、创建/配置应用、`langgraph dev`、Studio、JS SDK / REST 测试 |

---

## 核心概念（Graph API / Functional API）

| 标题 | 路径 | 说明 |
|------|------|------|
| [Graph API overview](https://docs.langchain.com/oss/javascript/langgraph/graph-api) | `oss/javascript/langgraph/graph-api` | 图、State、Nodes、Edges、StateSchema、Reducers、编译 |
| [Functional API overview](https://docs.langchain.com/oss/javascript/langgraph/functional-api) | `oss/javascript/langgraph/functional-api` | `task`、`entrypoint`、单函数定义 Agent |
| [Choosing between Graph and Functional APIs](https://docs.langchain.com/oss/javascript/langgraph/choosing-apis) | `oss/javascript/langgraph/choosing-apis` | 两种 API 的取舍 |
| [Use the graph API](https://docs.langchain.com/oss/javascript/langgraph/use-graph-api) | `oss/javascript/langgraph/use-graph-api` | 使用 Graph API 的实践 |
| [Use the functional API](https://docs.langchain.com/oss/javascript/langgraph/use-functional-api) | `oss/javascript/langgraph/use-functional-api` | 使用 Functional API 的实践（含恢复、错误后继续） |

---

## 持久化、人机协作、运行时

| 标题 | 路径 | 说明 |
|------|------|------|
| [Persistence](https://docs.langchain.com/oss/javascript/langgraph/persistence) | `oss/javascript/langgraph/persistence` | 持久化、thread、checkpointer |
| [Durable execution](https://docs.langchain.com/oss/javascript/langgraph/durable-execution) | `oss/javascript/langgraph/durable-execution` | 持久化执行、确定性重放、task 包装、恢复起点、durability 模式 |
| [Interrupts](https://docs.langchain.com/oss/javascript/langgraph/interrupts) | `oss/javascript/langgraph/interrupts` | 人机协作：`interrupt()`、`Command({ resume })`、多中断、审批流程 |
| [LangGraph runtime](https://docs.langchain.com/oss/javascript/langgraph/pregel) | `oss/javascript/langgraph/pregel` | Pregel 运行时、super-step、消息传递 |
| [Streaming](https://docs.langchain.com/oss/javascript/langgraph/streaming) | `oss/javascript/langgraph/streaming` | 流式输出 |
| [Memory](https://docs.langchain.com/oss/javascript/langgraph/add-memory) | `oss/javascript/langgraph/add-memory` | 记忆/记忆体 |
| [Use time-travel](https://docs.langchain.com/oss/javascript/langgraph/use-time-travel) | `oss/javascript/langgraph/use-time-travel` | 时间旅行（历史状态） |

---

## 进阶：子图、RAG、应用结构

| 标题 | 路径 | 说明 |
|------|------|------|
| [Subgraphs](https://docs.langchain.com/oss/javascript/langgraph/use-subgraphs) | `oss/javascript/langgraph/use-subgraphs` | 子图 |
| [Build a custom RAG agent with LangGraph](https://docs.langchain.com/oss/javascript/langgraph/agentic-rag) | `oss/javascript/langgraph/agentic-rag` | 用 LangGraph 做 RAG Agent |
| [Application structure](https://docs.langchain.com/oss/javascript/langgraph/application-structure) | `oss/javascript/langgraph/application-structure` | 应用结构 |
| [Workflows and agents](https://docs.langchain.com/oss/javascript/langgraph/workflows-agents) | `oss/javascript/langgraph/workflows-agents` | 工作流与 Agent |
| [Thinking in LangGraph](https://docs.langchain.com/oss/javascript/langgraph/thinking-in-langgraph) | `oss/javascript/langgraph/thinking-in-langgraph` | 用 LangGraph 的思维方式 |

---

## 调试、测试、部署、Studio

| 标题 | 路径 | 说明 |
|------|------|------|
| [LangSmith Observability](https://docs.langchain.com/oss/javascript/langgraph/observability) | `oss/javascript/langgraph/observability` | 可观测性 |
| [LangSmith Studio](https://docs.langchain.com/oss/javascript/langgraph/studio) | `oss/javascript/langgraph/studio` | Studio 使用 |
| [Test](https://docs.langchain.com/oss/javascript/langgraph/test) | `oss/javascript/langgraph/test` | 测试 |
| [LangSmith Deployment](https://docs.langchain.com/oss/javascript/langgraph/deploy) | `oss/javascript/langgraph/deploy` | 部署 |
| [Agent Chat UI](https://docs.langchain.com/oss/javascript/langgraph/ui) | `oss/javascript/langgraph/ui` | Agent 聊天 UI |

---

## 参考与版本

| 标题 | 路径 | 说明 |
|------|------|------|
| [LangGraph SDK](https://docs.langchain.com/oss/javascript/reference/langgraph-javascript) | `oss/javascript/reference/langgraph-javascript` | SDK 参考 |
| [Changelog](https://docs.langchain.com/oss/javascript/langgraph/changelog-js) | `oss/javascript/langgraph/changelog-js` | LangGraph JS 更新日志 |
| [LangGraph v1 migration guide](https://docs.langchain.com/oss/javascript/migrate/langgraph-v1) | `oss/javascript/migrate/langgraph-v1` | 迁移到 v1 |
| [What's new in LangGraph v1](https://docs.langchain.com/oss/javascript/releases/langgraph-v1) | `oss/javascript/releases/langgraph-v1` | v1 新特性 |

---

## 本项目中对应内容

- **入门**：[langgraph-getting-started.md](./langgraph-getting-started.md)（overview + install，Hello World）
- **Hello 示例**：`src/examples/hello-graph.ts` → `node dist/examples/hello-graph.js`
- **流式**：[tutorial-streaming.md](./tutorial-streaming.md) + `src/examples/streaming-example.ts` → `node dist/examples/streaming-example.js`
- **记忆**：[tutorial-memory.md](./tutorial-memory.md) + `src/examples/memory-example.ts` → `node dist/examples/memory-example.js`
- **Graph API 要点**：[tutorial-graph-api.md](./tutorial-graph-api.md)（状态、节点、边、序列/分支/循环）
- **Quickstart 对应**：[tutorial-quickstart.md](./tutorial-quickstart.md)（链式图 → 带工具 Agent，对应 agent.ts）
- **完整 Agent**：`src/agent.ts`（Ollama + 工具 + 条件边），配合 `npm run dev` 与 Studio 使用

文档根：<https://docs.langchain.com/oss/javascript/langgraph/>  
全站索引：<https://docs.langchain.com/llms.txt>
