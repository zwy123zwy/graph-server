export declare function serialize(data: unknown): string;
export declare function deserialize<T>(input: string): Promise<T>;
export declare class FileSystemPersistence<Schema> {
    private filepath;
    private data;
    private defaultSchema;
    private name;
    private flushTimeout;
    constructor(name: `.${string}.json`, defaultSchema: () => Schema);
    initialize(cwd: string): Promise<this>;
    protected persist(): Promise<void>;
    protected schedulePersist(): void;
    flush(): Promise<void>;
    with<T>(fn: (data: Schema) => T): Promise<T>;
    withGenerator<T extends AsyncGenerator<any>>(fn: ((data: Schema, options: {
        schedulePersist: () => void;
    }) => T) | T): AsyncGenerator<any, void, any>;
}
