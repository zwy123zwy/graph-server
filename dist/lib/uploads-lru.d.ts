/**
 * 清理 uploads 目录，保留最多 maxCount 个文件（按 mtime 升序，删除最旧的）。
 * 在写入新文件后调用，使总数不超过 maxCount。
 */
export declare function pruneUploadsLru(dir: string, maxCount?: number): Promise<void>;
