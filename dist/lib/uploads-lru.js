/**
 * uploads 目录 LRU：按修改时间保留最近 N 个文件，自动删除最早的文件。
 */
import { readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
const DEFAULT_MAX_FILES = 5;
/**
 * 清理 dir 下超出数量的最旧文件，只保留最多 maxCount 个（按 mtime 从新到旧）。
 * @param dir - uploads 目录绝对或相对路径
 * @param maxCount - 最多保留文件数，默认 5
 */
export async function pruneUploadsLru(dir, maxCount = DEFAULT_MAX_FILES) {
    const resolvedDir = path.resolve(dir);
    let entries;
    try {
        entries = await readdir(resolvedDir);
    }
    catch (e) {
        if (e.code === "ENOENT")
            return;
        throw e;
    }
    const filesWithMtime = [];
    for (const name of entries) {
        const fullPath = path.join(resolvedDir, name);
        try {
            const s = await stat(fullPath);
            if (s.isFile())
                filesWithMtime.push({ file: fullPath, mtimeMs: s.mtimeMs });
        }
        catch {
            // 忽略无法 stat 的项
        }
    }
    if (filesWithMtime.length <= maxCount)
        return;
    filesWithMtime.sort((a, b) => a.mtimeMs - b.mtimeMs);
    const toDelete = filesWithMtime.slice(0, filesWithMtime.length - maxCount);
    for (const { file } of toDelete) {
        try {
            await unlink(file);
        }
        catch {
            // 忽略删除失败（如被占用）
        }
    }
}
