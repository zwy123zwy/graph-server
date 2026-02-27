import { Hono } from "hono";
export declare function registerGraphUi(defs: Record<string, string>, options: {
    cwd: string;
    config?: {
        shared?: string[];
    };
}): Promise<void>;
export declare const api: Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
