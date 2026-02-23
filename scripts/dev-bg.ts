import { spawn, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function waitForWindowsListenerPid(port: number, timeoutMs: number): Promise<number | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const pid = getWindowsListeningPid(port);
    if (pid) return pid;
    await sleep(250);
  }
  return null;
}

async function main() {
  const existingPid = readPidFromFile();

  if (process.platform === "win32") {
    const listenerPid = getWindowsListeningPid(5000);
    if (listenerPid && isRunning(listenerPid)) {
      writeFileSync(pidFile, `${listenerPid}\n`, "utf8");
      console.log(`Dev server is already running (pid ${listenerPid}).`);
      return;
    }
  } else if (existingPid && isRunning(existingPid)) {
    console.log(`Dev server is already running (pid ${existingPid}).`);
    return;
  }

  const isWin = process.platform === "win32";
  const command = isWin ? "npm run dev" : "npm";
  const args = isWin ? [] : ["run", "dev"];

  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: "development" },
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    shell: isWin,
  });

  if (!child.pid) {
    console.error("Failed to start dev server process.");
    process.exit(1);
  }

  child.unref();

  let pidToTrack = child.pid;
  if (isWin) {
    const listenerPid = await waitForWindowsListenerPid(5000, 10000);
    if (listenerPid) pidToTrack = listenerPid;
  }

  writeFileSync(pidFile, `${pidToTrack}\n`, "utf8");

  console.log(`Started dev server in background (pid ${pidToTrack}).`);
  console.log("Use `npm run dev:status` to check health.");
}

main().catch((error) => {
  console.error("Failed to start dev server in background:", error);
  process.exit(1);
});
