/**
 * uploads 目录 LRU 策略：最多保留 maxCount 个文件，按 mtime 删除最久未使用的。
 */
import { readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
const MAX_UPLOAD_FILES = 5;
/**
 * 清理 uploads 目录，保留最多 maxCount 个文件（按 mtime 升序，删除最旧的）。
 * 在写入新文件后调用，使总数不超过 maxCount。
 */
export async function pruneUploadsLru(dir, maxCount = MAX_UPLOAD_FILES) {
    let entries;
    try {
        entries = await readdir(dir, { withFileTypes: true }).then(async (dirents) => {
            const list = [];
            for (const e of dirents) {
                if (!e.isFile())
                    continue;
                const full = path.join(dir, e.name);
                const st = await stat(full).catch(() => null);
                if (st)
                    list.push({ name: e.name, mtimeMs: st.mtimeMs });
            }
            return list;
        });
    }
    catch (e) {
        if (e.code === "ENOENT")
            return;
        throw e;
    }
    if (entries.length <= maxCount)
        return;
    entries.sort((a, b) => a.mtimeMs - b.mtimeMs);
    const toRemove = entries.length - maxCount;
    for (let i = 0; i < toRemove; i++) {
        const full = path.join(dir, entries[i].name);
        await unlink(full).catch(() => { });
    }
}
