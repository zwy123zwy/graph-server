/**
 * LangGraph 入门示例：Hello World
 * 参考 https://docs.langchain.com/oss/javascript/langgraph/overview
 *
 * 运行：npm run build && node dist/examples/hello-graph.js
 */
import { MessagesAnnotation, StateGraph } from "@langchain/langgraph";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
/** 模拟 LLM：无论输入什么，都返回 "hello world" */
async function mockLlm(state) {
    return {
        messages: [new AIMessage("hello world")],
    };
}
const graph = new StateGraph(MessagesAnnotation)
    .addNode("mock_llm", mockLlm)
    .addEdge("__start__", "mock_llm")
    .addEdge("mock_llm", "__end__")
    .compile();
async function main() {
    const result = await graph.invoke({
        messages: [new HumanMessage("hi!")],
    });
    console.log("=== LangGraph Hello World ===");
    console.log("Input:  hi!");
    const lastMsg = result.messages[result.messages.length - 1];
    const content = lastMsg && typeof lastMsg === "object" && "content" in lastMsg
        ? String(lastMsg.content)
        : String(lastMsg);
    console.log("Output:", content);
    console.log("Done.");
}
main().catch(console.error);
