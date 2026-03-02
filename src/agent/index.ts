/**
 * Agent 图入口：组装工具、模型、节点与边，导出编译后的 graph。
 * 使用 MemorySaver 做 thread 级持久化：同一 thread_id 下多轮对话会保留历史消息。
 */
import { ChatOllama } from "@langchain/ollama";
import { MemorySaver, MessagesAnnotation, StateGraph } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ollamaConfig } from "../config.js";
import { webSearchTool } from "../tools/web-search.js";
import { readPdfTool } from "../tools/read-pdf.js";
import { crawlUrlTool } from "../tools/crawl-url.js";
import { createCallModel } from "./call-model.js";

const tools = [webSearchTool, readPdfTool, crawlUrlTool];
const toolNode = new ToolNode(tools);

// 创建工具执行的包装器，用于输出工具结果
const toolNodeWithLogging = async (state: typeof MessagesAnnotation.State) => {
  console.log("\n[工具执行开始]");
  
  const result = await toolNode.invoke(state);
  
  // 打印工具执行结果
  if (result && result.messages && Array.isArray(result.messages)) {
    for (const msg of result.messages) {
      if (msg && typeof msg === "object" && "content" in msg) {
        const content = (msg as { content?: unknown }).content;
        const type = (msg as { _getType?: () => string })._getType?.();
        
        if (type === "tool") {
          const toolName = (msg as { name?: string }).name || "unknown";
          const toolContent = typeof content === "string" 
            ? content 
            : JSON.stringify(content, null, 2);
          
          console.log(`\n[工具执行结果] @${toolName}`);
          console.log("---");
          
          // 对长结果进行截断，避免输出过多
          const maxLength = 1000;
          if (toolContent.length > maxLength) {
            console.log(toolContent.slice(0, maxLength) + "\n...[已截断，更多内容请查看完整日志]");
          } else {
            console.log(toolContent);
          }
          
          console.log("---\n");
        }
      }
    }
  }
  
  console.log("[工具执行结束]\n");
  return result;
};

const model = new ChatOllama({
  model: ollamaConfig.model,
  baseUrl: ollamaConfig.baseUrl,
  temperature: 0.7,
});
const modelWithTools = model.bindTools(tools);
const callModel = createCallModel(modelWithTools as { invoke: (input: unknown) => Promise<unknown> });

function shouldContinue(state: typeof MessagesAnnotation.State): "tools" | "__end__" {
  const last = state.messages[state.messages.length - 1];
  if (
    last &&
    typeof last === "object" &&
    "tool_calls" in last &&
    Array.isArray((last as { tool_calls?: unknown[] }).tool_calls) &&
    ((last as { tool_calls: unknown[] }).tool_calls?.length ?? 0) > 0
  ) {
    return "tools";
  }
  return "__end__";
}

const workflow = new StateGraph(MessagesAnnotation)
  .addNode("callModel", callModel)
  .addNode("tools", toolNodeWithLogging)
  .addEdge("__start__", "callModel")
  .addConditionalEdges("callModel", shouldContinue, ["tools", "__end__"])
  .addEdge("tools", "callModel");

/** 进程内 checkpoint 存储，同一 thread_id 会保留对话历史；进程重启后清空。 */
const checkpointer = new MemorySaver();
export const graph = workflow.compile({ checkpointer });
export { functionCallingGraph } from "./function-calling.js";
