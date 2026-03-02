/**
 * 清理 dir 下超出数量的最旧文件，只保留最多 maxCount 个（按 mtime 从新到旧）。
 * @param dir - uploads 目录绝对或相对路径
 * @param maxCount - 最多保留文件数，默认 5
 */
export declare function pruneUploadsLru(dir: string, maxCount?: number): Promise<void>;
