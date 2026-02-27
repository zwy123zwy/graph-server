export declare function checkSemver(packages: {
    name: string;
    version: string;
}[]): Promise<{
    name: string;
    version: string;
    required: string;
    satisfies: boolean;
}[]>;
export declare function checkLangGraphSemver(): Promise<{
    name: string;
    version: string;
    required: string;
    satisfies: boolean;
}[]>;
