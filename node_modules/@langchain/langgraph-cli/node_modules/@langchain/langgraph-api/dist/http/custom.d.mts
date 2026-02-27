import { Hono } from "hono";
export declare function registerHttp(appPath: string, options: {
    cwd: string;
}): Promise<{
    api: Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
}>;
