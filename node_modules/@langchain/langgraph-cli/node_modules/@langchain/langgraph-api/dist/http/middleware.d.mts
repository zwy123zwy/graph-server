import { MiddlewareHandler } from "hono";
export declare const cors: (cors: {
    allow_origins?: string[];
    allow_origin_regex?: string;
    allow_methods?: string[];
    allow_headers?: string[];
    allow_credentials?: boolean;
    expose_headers?: string[];
    max_age?: number;
} | undefined) => MiddlewareHandler;
export declare const ensureContentType: () => MiddlewareHandler;
