/**
 * 短期记忆示例：MemorySaver + thread_id 多轮对话
 * 参考 https://docs.langchain.com/oss/javascript/langgraph/add-memory
 *
 * 运行：npm run build && node dist/examples/memory-example.js
 */
import { MemorySaver, MessagesAnnotation, StateGraph } from "@langchain/langgraph";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
/** 模拟 LLM：根据历史消息回答；若最后一条是「我叫 X」则确认，若问「我叫什么？」则从历史中找名字 */
async function mockLlm(state) {
    const messages = state.messages;
    const last = messages[messages.length - 1];
    const content = last && typeof last === "object" && "content" in last
        ? String(last.content)
        : "";
    const role = last && typeof last === "object" && "_getType" in last
        ? last._getType()
        : "";
    if (role === "human" && /我叫什么|我的名字|what'?s my name/i.test(content)) {
        let name = "";
        for (let i = 0; i < messages.length; i++) {
            const m = messages[i];
            const c = m && typeof m === "object" && "content" in m ? String(m.content) : "";
            const r = m && typeof m === "object" && "_getType" in m ? m._getType() : "";
            if (r === "human" && c.startsWith("我叫") && !/我叫\s*什么/i.test(c)) {
                name = c.replace(/^我叫\s*/, "").trim();
            }
        }
        return {
            messages: [new AIMessage(name ? `你叫 ${name}。` : "我还不知道你的名字。")],
        };
    }
    if (role === "human" && content.startsWith("我叫")) {
        const name = content.replace(/^我叫\s*/, "").trim() || "unknown";
        return { messages: [new AIMessage(`好的，我记住了你叫 ${name}。`)] };
    }
    return { messages: [new AIMessage(`收到：${content}`)] };
}
const checkpointer = new MemorySaver();
const graph = new StateGraph(MessagesAnnotation)
    .addNode("callModel", mockLlm)
    .addEdge("__start__", "callModel")
    .addEdge("callModel", "__end__")
    .compile({ checkpointer });
async function main() {
    const threadId = "tutorial-thread-1";
    const config = { configurable: { thread_id: threadId } };
    console.log("=== 第一轮：用户说「我叫 Bob」 ===\n");
    const r1 = await graph.invoke({ messages: [new HumanMessage("我叫 Bob")] }, config);
    const out1 = r1.messages[r1.messages.length - 1];
    console.log("AI:", out1 && typeof out1 === "object" && "content" in out1 ? out1.content : out1);
    console.log("\n=== 第二轮：用户问「我叫什么？」（同一 thread_id，状态里带上一轮消息） ===\n");
    const r2 = await graph.invoke({ messages: [new HumanMessage("我叫什么？")] }, config);
    const out2 = r2.messages[r2.messages.length - 1];
    console.log("AI:", out2 && typeof out2 === "object" && "content" in out2 ? out2.content : out2);
    console.log("\nDone.");
}
main().catch(console.error);
