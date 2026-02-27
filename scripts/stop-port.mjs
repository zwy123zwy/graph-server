/**
 * 关闭占用 2024 端口的进程（LangGraph 开发服务器）
 * 用法: node scripts/stop-port.mjs [端口号]
 * 默认端口: 2024
 */
import { execSync } from "node:child_process";
import { platform } from "node:os";

const port = Number(process.argv[2]) || 2024;

function killOnWindows(portNum) {
  let out;
  try {
    out = execSync(`netstat -ano | findstr :${portNum}`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    console.log(`未发现占用端口 ${portNum} 的进程。`);
    return;
  }
  const lines = out.split("\n").filter((line) => line.includes("LISTENING"));
  const pids = new Set();
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    const pid = parts[parts.length - 1];
    if (pid && /^\d+$/.test(pid)) pids.add(pid);
  }
  for (const pid of pids) {
    try {
      execSync(`taskkill /PID ${pid} /F`, { stdio: "inherit" });
      console.log(`已结束进程 PID ${pid}（端口 ${portNum}）`);
    } catch (e) {
      if (!e.message?.includes("not found")) console.error(e.message);
    }
  }
  if (pids.size === 0) console.log(`未发现占用端口 ${portNum} 的进程。`);
}

function killOnUnix(portNum) {
  try {
    execSync(`lsof -ti :${portNum} | xargs kill -9`, { stdio: "inherit" });
    console.log(`已关闭端口 ${portNum} 上的进程。`);
  } catch {
    console.log(`未发现占用端口 ${portNum} 的进程。`);
  }
}

if (platform() === "win32") {
  killOnWindows(port);
} else {
  killOnUnix(port);
}
