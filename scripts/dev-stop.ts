import { spawnSync } from "node:child_process";
import { readFileSync, rmSync, existsSync } from "node:fs";
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

function killPidTree(pid: number): boolean {
  if (process.platform === "win32") {
    const result = spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
      stdio: "ignore",
    });
    return result.status === 0;
  }

  try {
    process.kill(-pid, "SIGTERM");
    return true;
  } catch {
    try {
      process.kill(pid, "SIGTERM");
      return true;
    } catch {
      return false;
    }
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
    const pidText = parts[parts.length - 1];
    const pid = Number(pidText);
    if (Number.isInteger(pid) && pid > 0) {
      return pid;
    }
  }

  return null;
}

const stoppedPids: number[] = [];
const pid = readPidFromFile();

if (pid && isRunning(pid) && killPidTree(pid)) {
  stoppedPids.push(pid);
}

const portPid = getWindowsListeningPid(5000);
if (portPid && isRunning(portPid) && !stoppedPids.includes(portPid)) {
  if (killPidTree(portPid)) {
    stoppedPids.push(portPid);
  }
}

rmSync(pidFile, { force: true });

if (stoppedPids.length > 0) {
  console.log(`Stopped dev server (pid ${stoppedPids.join(", ")}).`);
  process.exit(0);
}

console.log("No running dev server found.");
