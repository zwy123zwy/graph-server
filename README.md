# LangGraph 本地服务器（TypeScript + Ollama）

基于 [LangChain 中文文档 - 运行本地服务器](https://langchain-doc.cn/v1/python/langgraph/local-server.html) 创建的 TypeScript 版 LangGraph 应用，大模型使用本地 **Ollama** 的 **qwen3-coder:480b-cloud**。

## 先决条件

- **Node.js** >= 20
- 已安装并运行 **Ollama**，且已拉取模型：
  ```bash
  ollama pull qwen3-coder:480b-cloud
  ```

## 1. 安装依赖

```bash
npm install
```

## 2. 环境变量

**启动本地服务器前** 需要存在 `.env` 文件（可为空）。首次可复制示例：

```bash
copy .env.example .env
```

如需 LangSmith 追踪，在 `.env` 中设置 `LANGSMITH_API_KEY`。

## 3. 启动本地服务器

```bash
npx @langchain/langgraph-cli dev
```

或使用脚本：

```bash
npm run dev
```

示例输出：

```
Ready!
- API: http://localhost:2024
- Docs: http://localhost:2024/docs
- LangGraph Studio Web UI: https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024
```

## 4. 在 Studio 中测试

打开上述输出中的 **LangGraph Studio Web UI** 链接，即可在浏览器中可视化和调试图。

## 5. 调用 API 示例

**JavaScript SDK：**

```bash
npm install @langchain/langgraph-sdk
```

```js
const { Client } = await import("@langchain/langgraph-sdk");

const client = new Client({ apiUrl: "http://localhost:2024" });

const streamResponse = client.runs.stream(
  null,
  "agent",
  {
    input: {
      messages: [{ role: "user", content: "什么是 LangGraph？" }],
    },
    streamMode: "messages-tuple",
  }
);

for await (const chunk of streamResponse) {
  console.log(`事件: ${chunk.event}`, chunk.data);
}
```

**REST API：**

```bash
curl -s -X POST "http://localhost:2024/runs/stream" \
  -H "Content-Type: application/json" \
  -d "{\"assistant_id\": \"agent\", \"input\": {\"messages\": [{\"role\": \"human\", \"content\": \"什么是 LangGraph？\"}]}, \"stream_mode\": \"messages-tuple\"}"
```

## 项目结构

```
graph/
├── src/
│   ├── agent.ts              # 图定义，使用 ChatOllama + 工具
│   ├── config.ts
│   ├── examples/
│   │   ├── hello-graph.ts    # 入门 Hello World
│   │   ├── streaming-example.ts  # 流式 updates/values
│   │   └── memory-example.ts # 短期记忆 thread_id + MemorySaver
│   └── tools/
│       └── web-search.ts
├── docs/
│   ├── langgraph-getting-started.md  # 入门教程
│   ├── langgraph-docs-index.md       # 官方文档索引
│   ├── tutorial-streaming.md         # 流式教程
│   ├── tutorial-memory.md            # 记忆教程
│   ├── tutorial-graph-api.md         # Graph API 要点
│   └── tutorial-quickstart.md        # Quickstart 对应
├── langgraph.json
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

**入门**：先看 [LangGraph 入门教程](docs/langgraph-getting-started.md)，运行 `npm run build && node dist/examples/hello-graph.js` 体验最小示例。  
**更多教程**：流式、记忆、Graph API、Quickstart 对应见 [docs/langgraph-docs-index.md](docs/langgraph-docs-index.md) 中「本项目中对应内容」。

## 流式输出与「两条助手消息」合并

- **流式**：上面示例已使用 `client.runs.stream(..., { streamMode: "messages-tuple" })`，模型会以流式返回 token，前端可边收边渲染。
- **两条变一条**：调用工具（如 read_pdf）时，第一轮会先输出占位句（如「正在读取 PDF，请稍候。」），第二轮再输出总结。后端已在 `callModel` 中把「占位 + 工具结果后的最终回复」合并成**同一条** AI 消息（同 id 替换），会话里只保留一条助手输出。

## 修改模型或 Ollama 地址

在 `src/agent.ts` 中调整 `ChatOllama` 的 `model` 和 `baseUrl`：

```ts
const model = new ChatOllama({
  model: "qwen3-coder:480b-cloud",
  baseUrl: "http://127.0.0.1:11434",  // 若 Ollama 在其他主机/端口可修改
  temperature: 0.7,
  maxRetries: 2,
});
```
