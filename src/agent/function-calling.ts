/**
 * Function Calling 模式：单轮调用模型（带工具），返回的回复中可能包含 tool_calls，不执行工具。
 * 由调用方根据 tool_calls 自行执行工具或再发起下一轮。
 */
import { ChatOllama } from "@langchain/ollama";
import { MessagesAnnotation, StateGraph } from "@langchain/langgraph";
import { ollamaConfig } from "../config.js";
import { webSearchTool } from "../tools/web-search.js";
import { readPdfTool } from "../tools/read-pdf.js";
import { crawlUrlTool } from "../tools/crawl-url.js";
import { getSystemPrompt } from "../logic/system-prompt.js";

const tools = [webSearchTool, readPdfTool, crawlUrlTool];

const model = new ChatOllama({
  model: ollamaConfig.model,
  baseUrl: ollamaConfig.baseUrl,
  temperature: 0.7,
});
const modelWithTools = model.bindTools(tools);

async function callModelOnly(state: typeof MessagesAnnotation.State) {
  const systemContent = getSystemPrompt();
  const response = await modelWithTools.invoke([
    { role: "system", content: systemContent },
    ...state.messages,
  ]);
  return { messages: [response] };
}

const workflow = new StateGraph(MessagesAnnotation)
  .addNode("callModel", callModelOnly)
  .addEdge("__start__", "callModel")
  .addEdge("callModel", "__end__");

/** 单轮 Function Calling 图：只调用模型并返回，不执行工具。返回的 state.messages 最后一条可能含 tool_calls。 */
export const functionCallingGraph = workflow.compile();
