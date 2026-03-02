/**
 * Agent 模型节点：仅负责「调用逻辑层」完成一轮推理。支持从 config.configurable 读取前端传入的 role、inputConditions。
 */
import { AIMessage } from "@langchain/core/messages";
import { MessagesAnnotation } from "@langchain/langgraph";
import { runModelRound, type ModelWithTools } from "../logic/run.js";
import type { AgentPromptOverrides } from "../logic/system-prompt.js";

export type CallModelFn = (
  state: typeof MessagesAnnotation.State,
  config?: { configurable?: Record<string, unknown> }
) => Promise<{ messages: AIMessage[] }>;

/** 创建图节点：收到 state 与 config 后委托 logic.runModelRound；config.configurable 中的 role、inputConditions 会注入系统提示。 */
export function createCallModel(modelWithTools: ModelWithTools): CallModelFn {
  return (state, config) => {
    const c = config?.configurable as AgentPromptOverrides | undefined;
    const agentConfig: AgentPromptOverrides | undefined =
      c?.role !== undefined || c?.inputConditions !== undefined
        ? { role: c?.role, inputConditions: c?.inputConditions }
        : undefined;
    return runModelRound(state, modelWithTools, agentConfig);
  };
}
