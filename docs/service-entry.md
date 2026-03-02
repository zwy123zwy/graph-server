# 项目入口与服务启动方式

本项目的 **HTTP 服务不是由你写的 `main.ts` 启动**，而是由 **LangGraph CLI** 启动并加载你导出的图。

---

## 1. 入口在哪里？

| 类型 | 位置 | 说明 |
|------|------|------|
| **进程入口** | `node_modules/@langchain/langgraph-cli/dist/cli/cli.mjs` | 执行 `npm run dev` 时实际跑的是 `langgraphjs` 命令（即该 CLI） |
| **图定义入口** | **`src/agent.ts`** | 导出名 `graph`（`workflow.compile()` 的结果），被 CLI 动态加载 |

`package.json` 里的 `"main": "dist/agent.js"` 表示：当别人把本项目当作**依赖包**引用时，入口是 `dist/agent.js`。**本地跑服务时不走这个文件**。

---

## 2. 服务是怎么启动的？

整体流程：

```
npm run dev
  → 执行 script "dev": "langgraphjs dev"
  → 运行 @langchain/langgraph-cli 的 bin：langgraphjs（cli.mjs）
  → 解析 dev 子命令（dev.mjs）
  → 读取项目根目录的 langgraph.json
  → 调用 @langchain/langgraph-api 的 spawnServer(options, { config, env, hostUrl }, { pid, projectCwd })
  → 子进程：node + tsx watch + preload + entrypoint.mjs + 传入的 config（含 port、graphs、cwd 等）
  → entrypoint.mjs 解析 config，调用 startServer(options)
  → startServer 里：
       - 初始化存储（checkpointer、store 等）
       - registerFromEnv(assistants, graphPaths, { cwd })   // graphPaths = { agent: "./src/agent.ts:graph" }
       - 挂载路由（runs、threads、assistants、store、meta 等）
       - serve(app) 在 port（默认 2024）上监听
  → 图加载：resolveGraph("./src/agent.ts:graph", { cwd })
       - path.resolve(cwd, "src/agent.ts") 得到绝对路径
       - import(该文件的 file:// URL)
       - 取模块的 export "graph"
       - 若是 builder（有 .compile）则调用 .compile()，得到编译后的图
       - 存到内存 GRAPHS["agent"]
  → 控制台打印 API 地址与 Studio 链接
```

---

## 3. 关键配置文件

**langgraph.json**（项目根目录）：

```json
{
  "node_version": "20",
  "dependencies": ["."],
  "graphs": { "agent": "./src/agent.ts:graph" },
  "env": ".env",
  "http": { "cors": { "allow_origins": ["http://localhost:3000", "http://127.0.0.1:3000"] } }
}
```

- **graphs**：键 `agent` 为图 ID（API 里叫 assistant_id），值 `./src/agent.ts:graph` 表示从该文件加载**具名导出** `graph`。
- **dependencies**：`["."]` 表示把当前项目作为依赖安装进 API 进程，便于 resolve 到 `src/agent.ts`。
- **env**：启动前会加载 `.env` 到 `process.env`。

---

## 4. 如何“自己”启动服务？（不改 CLI 时）

在**不修改、不替换** LangGraph CLI 的前提下，服务**只能**这样启动：

```bash
npm run dev
# 或
npx @langchain/langgraph-cli dev
# 可选：指定端口
npx @langchain/langgraph-cli dev --port 2024
```

没有单独的 `node dist/agent.js` 或 `node dist/server.js` 来起 HTTP 服务；图只是被 CLI 加载的一个模块。

---

## 5. 代码位置速查

| 作用 | 文件路径（均在 node_modules 内） |
|------|----------------------------------|
| CLI 入口 | `@langchain/langgraph-cli/dist/cli/cli.mjs` |
| dev 子命令 | `@langchain/langgraph-cli/dist/cli/dev.mjs` |
| 生成子进程、传入 config | `@langchain/langgraph-api/dist/cli/spawn.mjs`（spawnServer） |
| 子进程入口、调用 startServer | `@langchain/langgraph-api/dist/cli/entrypoint.mjs` |
| HTTP 服务与图注册 | `@langchain/langgraph-api/dist/server.mjs`（startServer） |
| 解析 graphs、动态 import 图 | `@langchain/langgraph-api/dist/graph/load.mjs`（registerFromEnv） + `load.utils.mjs`（resolveGraph） |

---

## 6. 小结

- **入口文件**：对“服务进程”而言是 CLI 的 `cli.mjs` → `dev.mjs` → API 的 `entrypoint.mjs`；对“图”而言是 **`src/agent.ts`** 的导出 **`graph`**。
- **服务启动**：执行 **`npm run dev`**（即 `langgraphjs dev`），由 CLI 读 `langgraph.json`、spawn 子进程、在子进程中加载 `src/agent.ts` 的 `graph` 并启动 Hono 服务器（默认端口 2024）。
