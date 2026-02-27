import { type Logger } from "winston";
import type { MiddlewareHandler } from "hono";
export declare const logger: Logger;
export declare function registerSdkLogger(): void;
export declare function registerRuntimeLogFormatter(formatter: (info: Record<string, unknown>) => Record<string, unknown>): Promise<void>;
export declare const logError: (error: unknown, options?: {
    context?: Record<string, unknown>;
    prefix?: string;
}) => void;
export declare const requestLogger: () => MiddlewareHandler;
