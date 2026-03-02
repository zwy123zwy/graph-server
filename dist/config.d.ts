/**
 * Ollama 模型与服务地址配置
 * 修改此文件即可更换模型或 Ollama 链接
 */
export declare const ollamaConfig: {
    /** 模型名称，如 qwen3-coder:480b-cloud */
    readonly model: "qwen3-coder-next:cloud";
    /** Ollama 服务地址 */
    readonly baseUrl: "http://127.0.0.1:11434";
};
