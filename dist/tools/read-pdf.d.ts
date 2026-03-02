import { z } from "zod";
export declare const readPdfTool: import("@langchain/core/tools").DynamicStructuredTool<z.ZodObject<{
    url: z.ZodOptional<z.ZodString>;
    path: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, unknown, unknown, string>;
