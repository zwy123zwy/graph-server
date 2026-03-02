/**
 * Agent 模型节点：仅负责「调用逻辑层」完成一轮推理，不包含任何区分/业务规则。
 */
import { AIMessage } from "@langchain/core/messages";
import { MessagesAnnotation } from "@langchain/langgraph";
import { runModelRound, type ModelWithTools } from "../logic/run.js";

export type CallModelFn = (state: typeof MessagesAnnotation.State) => Promise<{ messages: AIMessage[] }>;

/** 创建图节点：收到 state 后委托给 logic.runModelRound，只做「基础调用」桥接。 */
export function createCallModel(modelWithTools: ModelWithTools): CallModelFn {
  return (state) => runModelRound(state, modelWithTools);
}
