import type { CompiledGraph } from "@langchain/langgraph";
export declare const GRAPHS: Record<string, CompiledGraph<string>>;
export declare const NAMESPACE_GRAPH: Uint8Array<ArrayBufferLike>;
export type CompiledGraphFactory<T extends string> = (config: {
    configurable?: Record<string, unknown>;
}) => Promise<CompiledGraph<T>>;
export declare function resolveGraph(spec: string, options: {
    cwd: string;
    onlyFilePresence?: false;
}): Promise<{
    sourceFile: string;
    exportSymbol: string;
    resolved: CompiledGraph<string> | CompiledGraphFactory<string>;
}>;
export declare function resolveGraph(spec: string, options: {
    cwd: string;
    onlyFilePresence: true;
}): Promise<{
    sourceFile: string;
    exportSymbol: string;
    resolved: undefined;
}>;
