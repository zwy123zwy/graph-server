import { Command } from "@langchain/langgraph";
export interface RunSend {
    node: string;
    input?: unknown;
}
export interface RunCommand {
    goto?: string | RunSend | Array<RunSend | string>;
    update?: Record<string, unknown> | [string, unknown][];
    resume?: unknown;
}
export declare const getLangGraphCommand: (command: RunCommand) => Command<unknown, Record<string, unknown>, string>;
