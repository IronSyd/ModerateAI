import { spawnSync } from "node:child_process";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const pidFile = resolve(process.cwd(), ".dev-server.pid");

function readPidFromFile(): number | null {
  if (!existsSync(pidFile)) return null;
  const raw = readFileSync(pidFile, "utf8").trim();
  const pid = Number(raw);
  return Number.isInteger(pid) && pid > 0 ? pid : null;
}

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function getWindowsListeningPid(port: number): number | null {
  if (process.platform !== "win32") return null;
  const result = spawnSync("netstat", ["-ano"], { encoding: "utf8" });
  if (result.status !== 0 || !result.stdout) return null;

  const lines = result.stdout.split(/\r?\n/);
  for (const line of lines) {
    if (!line.includes("LISTENING")) continue;
    if (!line.includes(`:${port}`)) continue;
    const parts = line.trim().split(/\s+/);
    const pid = Number(parts[parts.length - 1]);
    if (Number.isInteger(pid) && pid > 0) {
      return pid;
    }
  }

  return null;
}

async function checkHealth(url: string): Promise<number | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response.status;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  let pid = readPidFromFile();
  const listenerPid = getWindowsListeningPid(5000);
  if (listenerPid && isRunning(listenerPid)) {
    pid = listenerPid;
    writeFileSync(pidFile, `${pid}\n`, "utf8");
  }

  if (!pid || !isRunning(pid)) {
    if (listenerPid && isRunning(listenerPid)) {
      pid = listenerPid;
    }
  }

  if (!pid || !isRunning(pid)) {
    console.log("Dev server: not running.");
    return 1;
  }

  const healthStatus = await checkHealth("http://127.0.0.1:5000/api/health");
  if (healthStatus === 200) {
    console.log(`Dev server: running (pid ${pid}), health 200.`);
    return 0;
  }

  if (healthStatus !== null) {
    console.log(`Dev server: running (pid ${pid}), health ${healthStatus}.`);
    return 0;
  }

  console.log(`Dev server: running (pid ${pid}), health endpoint unreachable.`);
  return 0;
}

main().catch((error) => {
  console.error("Failed to check dev server status:", error);
  return 1;
}).then((code) => {
  if (typeof code === "number") {
    process.exitCode = code;
  } else {
    process.exitCode = 1;
  }
});
