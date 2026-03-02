/**
 * 自定义 HTTP 路由：PDF 上传、可配置角色与输入限制的对话等。
 * 需在 langgraph.json 中配置 "http": { "app": "./src/app.ts:app" }。
 */
import { Hono } from "hono";
export declare const app: Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
