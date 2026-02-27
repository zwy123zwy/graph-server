export type SendToParent = (data: Record<string, unknown>) => void;
export type Parent = {
    send: SendToParent | undefined;
};
export declare const connectToServer: (processId?: number) => Promise<SendToParent | undefined>;
