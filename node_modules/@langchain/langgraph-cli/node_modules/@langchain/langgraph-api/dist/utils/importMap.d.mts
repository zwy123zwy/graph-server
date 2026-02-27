import { PromptTemplate, AIMessagePromptTemplate, ChatMessagePromptTemplate, ChatPromptTemplate, HumanMessagePromptTemplate, MessagesPlaceholder, SystemMessagePromptTemplate, ImagePromptTemplate, PipelinePromptTemplate } from "@langchain/core/prompts";
import { AIMessage, AIMessageChunk, BaseMessage, BaseMessageChunk, ChatMessage, ChatMessageChunk, FunctionMessage, FunctionMessageChunk, HumanMessage, HumanMessageChunk, SystemMessage, SystemMessageChunk, ToolMessage, ToolMessageChunk } from "@langchain/core/messages";
import { StringPromptValue } from "@langchain/core/prompt_values";
export declare const prompts__prompt: {
    PromptTemplate: typeof PromptTemplate;
};
export declare const schema__messages: {
    AIMessage: typeof AIMessage;
    AIMessageChunk: typeof AIMessageChunk;
    BaseMessage: typeof BaseMessage;
    BaseMessageChunk: typeof BaseMessageChunk;
    ChatMessage: typeof ChatMessage;
    ChatMessageChunk: typeof ChatMessageChunk;
    FunctionMessage: typeof FunctionMessage;
    FunctionMessageChunk: typeof FunctionMessageChunk;
    HumanMessage: typeof HumanMessage;
    HumanMessageChunk: typeof HumanMessageChunk;
    SystemMessage: typeof SystemMessage;
    SystemMessageChunk: typeof SystemMessageChunk;
    ToolMessage: typeof ToolMessage;
    ToolMessageChunk: typeof ToolMessageChunk;
};
export declare const schema: {
    AIMessage: typeof AIMessage;
    AIMessageChunk: typeof AIMessageChunk;
    BaseMessage: typeof BaseMessage;
    BaseMessageChunk: typeof BaseMessageChunk;
    ChatMessage: typeof ChatMessage;
    ChatMessageChunk: typeof ChatMessageChunk;
    FunctionMessage: typeof FunctionMessage;
    FunctionMessageChunk: typeof FunctionMessageChunk;
    HumanMessage: typeof HumanMessage;
    HumanMessageChunk: typeof HumanMessageChunk;
    SystemMessage: typeof SystemMessage;
    SystemMessageChunk: typeof SystemMessageChunk;
    ToolMessage: typeof ToolMessage;
    ToolMessageChunk: typeof ToolMessageChunk;
};
export declare const prompts__chat: {
    AIMessagePromptTemplate: typeof AIMessagePromptTemplate;
    ChatMessagePromptTemplate: typeof ChatMessagePromptTemplate;
    ChatPromptTemplate: typeof ChatPromptTemplate;
    HumanMessagePromptTemplate: typeof HumanMessagePromptTemplate;
    MessagesPlaceholder: typeof MessagesPlaceholder;
    SystemMessagePromptTemplate: typeof SystemMessagePromptTemplate;
};
export declare const prompts__image: {
    ImagePromptTemplate: typeof ImagePromptTemplate;
};
export declare const prompts__pipeline: {
    PipelinePromptTemplate: typeof PipelinePromptTemplate;
};
export declare const prompts__base: {
    StringPromptValue: typeof StringPromptValue;
};
