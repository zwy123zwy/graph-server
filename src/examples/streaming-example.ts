/**
 * 流式输出示例：streamMode "updates" 与 "values"
 * 参考 https://docs.langchain.com/oss/javascript/langgraph/streaming
 *
 * 运行：npm run build && node dist/examples/streaming-example.js
 */
import { MessagesAnnotation, StateGraph } from "@langchain/langgraph";
import { AIMessage, HumanMessage } from "@langchain/core/messages";

async function nodeA(state: typeof MessagesAnnotation.State) {
  return { messages: [new AIMessage(`Echo: ${(state.messages[0] as HumanMessage)?.content ?? ""}`)] };
}
async function nodeB(state: typeof MessagesAnnotation.State) {
  const last = state.messages[state.messages.length - 1];
  const text = last && typeof last === "object" && "content" in last ? String((last as { content: unknown }).content) : "";
  return { messages: [new AIMessage(`Second: ${text}`)] };
}

const graph = new StateGraph(MessagesAnnotation)
  .addNode("nodeA", nodeA)
  .addNode("nodeB", nodeB)
  .addEdge("__start__", "nodeA")
  .addEdge("nodeA", "nodeB")
  .addEdge("nodeB", "__end__")
  .compile();

async function main() {
  const input = { messages: [new HumanMessage("hi")] };

  console.log("=== streamMode: updates (每步只收到该节点的更新) ===\n");
  for await (const chunk of await graph.stream(input, { streamMode: "updates" })) {
    console.log(JSON.stringify(chunk, null, 2));
  }

  console.log("\n=== streamMode: values (每步收到当前完整状态) ===\n");
  for await (const chunk of await graph.stream(input, { streamMode: "values" })) {
    const msg = chunk.messages?.[chunk.messages.length - 1];
    const content = msg && typeof msg === "object" && "content" in msg ? (msg as { content: unknown }).content : "";
    console.log("Last message content:", content);
  }

  console.log("\nDone.");
}

main().catch(console.error);
