function getRequiredEnv(name: string): string {
  const value = String(process.env[name] ?? "").trim();
  if (!value) {
    throw new Error(`[startup-preflight] Missing required environment variable: ${name}`);
  }
  return value;
}

function parsePort(value: string | undefined): number {
  if (!value) return 5000;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(
      `[startup-preflight] Invalid PORT value \"${value}\". Expected an integer between 1 and 65535.`,
    );
  }
  return parsed;
}

function parseBooleanFlag(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function getDatabaseHost(databaseUrl: string): string {
  try {
    return new URL(databaseUrl).hostname || "unknown";
  } catch {
    throw new Error("[startup-preflight] DATABASE_URL is not a valid URL.");
  }
}

function runStartupPreflight() {
  const mode = String(process.env.NODE_ENV ?? "development").trim() || "development";
  const databaseUrl = getRequiredEnv("DATABASE_URL");
  const sessionSecret = getRequiredEnv("SESSION_SECRET");
  getRequiredEnv("OPENAI_API_KEY");

  const port = parsePort(process.env.PORT);
  const databaseHost = getDatabaseHost(databaseUrl);

  if (mode === "production" && sessionSecret.length < 24) {
    console.warn(
      "[startup-preflight] SESSION_SECRET is shorter than 24 characters. Use a longer random secret in production.",
    );
  }

  const frontendUrl = String(process.env.FRONTEND_URL ?? "").trim();
  if (mode === "production" && !frontendUrl) {
    console.warn("[startup-preflight] FRONTEND_URL is not set in production; CORS/session behavior may be incorrect.");
  }

  const uiV2Enabled = parseBooleanFlag(process.env.UI_V2_ENABLED, false);
  const uiWave1RedoEnabled = parseBooleanFlag(process.env.UI_WAVE1_REDO_ENABLED, false);
  const uiScope = String(process.env.UI_V2_ROUTE_SCOPE ?? "").trim() || "(default)";

  console.info(
    `[startup-preflight] mode=${mode} port=${port} dbHost=${databaseHost} uiV2=${uiV2Enabled} uiV2Scope=${uiScope} wave1Redo=${uiWave1RedoEnabled}`,
  );
}

runStartupPreflight();
