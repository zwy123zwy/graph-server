# Function Calling 模式说明

## 一、什么是 Function Calling

**Function Calling**（函数调用 / 工具调用）是指：大模型在对话中除了生成文本外，还可以**返回结构化的“要调用的函数及参数”**，由后端或客户端执行该函数，再把结果交回模型，由模型生成最终回复。

- **本质**：模型输出里多了一种类型——`tool_calls`（要调用的工具名 + 参数），而不仅是 `content`（文本）。
- **常见叫法**：OpenAI 叫 Function Calling，Google 叫 Tool Use，LangChain 里对应 `bindTools` + 工具描述与 schema。

## 二、相关概念

| 概念 | 含义 |
|------|------|
| **Tool / Function** | 可供模型“调用”的能力，例如：搜索、读 PDF、抓取网页。每个工具有一个名字、一段描述、以及参数 schema（如 `query: string`）。 |
| **Tool Schema** | 工具的入参定义（名称、类型、是否必填、描述）。模型根据 schema 生成符合格式的实参。本项目用 Zod 定义，例如 `z.object({ query: z.string() })`。 |
| **bindTools(tools)** | 把工具列表挂到模型上，请求时会把工具的名字、描述、schema 发给模型，模型在需要时在回复里带上 `tool_calls`。 |
| **tool_calls** | 模型返回结构，形如 `[{ id, name: "web_search", args: { query: "..." } }]`。后端据此执行对应工具，得到结果后再拼成 ToolMessage 发回模型。 |
| **ToolMessage** | 工具执行完成后，把结果以“工具名 + 返回内容”的形式追加到对话中，供模型下一轮使用。 |

流程可以概括为：

1. 用户发消息 → 2. 模型收到“消息 + 工具列表” → 3. 模型返回 `content` 和/或 `tool_calls` → 4. 若有 `tool_calls`，后端执行工具 → 5. 把结果作为 ToolMessage 追加 → 6. 再调模型（或结束）。

## 三、本项目中的两种用法

### 1. Agent 模式（当前默认 `graph`）

- **行为**：模型若返回 `tool_calls`，图会**自动**进入 Tool 节点执行工具，再把结果送回模型，直到模型不再发起工具调用为止。
- **适用**：希望“一问到底”、由后端自动完成“调用工具 → 再答”的完整流程。
- **入口**：`import { graph } from "./agent.js"`，`graph.invoke({ messages })`。

### 2. Function Calling 模式（`functionCallingGraph`）

- **行为**：只做**一轮**模型调用，返回的 state 里最后一条是模型的回复；若模型决定要调工具，这条回复里会带 `tool_calls`，**不会在本图中执行工具**。
- **适用**：需要由调用方（或前端）自己执行工具、或只关心“模型想调什么”时使用。
- **入口**：`import { functionCallingGraph } from "./agent.js"`（或 `from "./agent/index.js"`），`functionCallingGraph.invoke({ messages })`，再从返回的 `state.messages` 里取最后一条，检查是否有 `tool_calls` 并自行执行或再发起下一轮。

## 四、本项目中 Function Calling 的落地方式

- **工具定义**：`src/tools/` 下用 `tool()` + Zod schema 定义（如 `web_search`、`read_pdf`、`crawl_url`）。
- **绑定到模型**：`model.bindTools(tools)`，同一套工具在 Agent 图和 Function Calling 图中都会使用。
- **Agent 模式**：`src/agent/index.ts` 中的 `graph` = callModel →（若有 tool_calls）→ tools 节点执行 → 再 callModel，循环直到结束。
- **Function Calling 模式**：`src/agent/function-calling.ts` 中的 `functionCallingGraph` = 单节点“只调模型”，返回的 state 中最后一条消息可能带 `tool_calls`，由调用方自行决定是否执行、是否再发一轮。

两种模式共用同一套工具和模型，区别仅在于：是否在图中自动执行工具、以及是否多轮循环。

## 五、Function Calling 模式使用示例

```ts
import { functionCallingGraph } from "./agent.js";
import { HumanMessage } from "@langchain/core/messages";

const result = await functionCallingGraph.invoke({
  messages: [new HumanMessage("北京今天天气怎么样？")],
});

const lastMessage = result.messages[result.messages.length - 1];
const toolCalls = (lastMessage as { tool_calls?: Array<{ name: string; args: unknown }> }).tool_calls;

if (toolCalls?.length) {
  console.log("模型希望调用工具:", toolCalls.map((t) => ({ name: t.name, args: t.args })));
  // 此处可由调用方自行执行对应工具，再把结果拼成 ToolMessage 发起下一轮
} else {
  console.log("模型直接回复:", (lastMessage as { content?: string }).content);
}
```
