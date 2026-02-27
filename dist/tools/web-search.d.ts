import { z } from "zod";
export declare const webSearchTool: import("@langchain/core/tools").DynamicStructuredTool<z.ZodObject<{
    query: z.ZodString;
}, z.core.$strip>, unknown, unknown, string>;
