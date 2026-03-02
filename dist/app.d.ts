/**
 * 自定义 HTTP 路由：接收前端上传的 PDF 文件，落盘后交给 agent 通过 read_pdf 工具处理。
 * 需在 langgraph.json 中配置 "http": { "app": "./src/app.ts:app" }。
 */
import { Hono } from "hono";
export declare const app: Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
