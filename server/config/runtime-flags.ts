const isProduction = process.env.NODE_ENV === "production";

function parseBooleanEnv(name: string, fallback: boolean): boolean {
  const raw = String(process.env[name] ?? "").trim().toLowerCase();
  if (!raw) return fallback;
  if (["1", "true", "yes", "on"].includes(raw)) return true;
  if (["0", "false", "no", "off"].includes(raw)) return false;
  return fallback;
}

function parsePositiveIntEnv(name: string, fallback: number): number {
  const raw = Number.parseInt(String(process.env[name] ?? "").trim(), 10);
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  return raw;
}

function parseCsvEnv(name: string): string[] {
  const raw = String(process.env[name] ?? "").trim();
  if (!raw) return [];

  const values = raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);

  return Array.from(new Set(values));
}

function parseUiV2RolesEnv(name: string): string[] {
  const allowedRoles = new Set(["owner", "admin", "moderator", "viewer"]);
  return parseCsvEnv(name).filter((role) => allowedRoles.has(role));
}

function parseUiWave1RedoRouteScopeEnv(name: string): string[] {
  const aliasMap: Record<string, string> = {
    "*": "all",
    dash: "dashboard",
    dashboard: "dashboard",
    conversation: "conversations",
    conversations: "conversations",
    kb: "knowledge-base",
    knowledge: "knowledge-base",
    "knowledge-base": "knowledge-base",
    integration: "integrations",
    integrations: "integrations",
    wave1: "all",
    "wave-1": "all",
  };

  const allowed = new Set(["all", "dashboard", "conversations", "knowledge-base", "integrations"]);
  return parseCsvEnv(name)
    .map((entry) => aliasMap[entry] ?? entry)
    .filter((entry) => allowed.has(entry));
}

export const integrationSafetyHardeningEnabled = parseBooleanEnv(
  "INTEGRATION_SAFETY_HARDENING_ENABLED",
  !isProduction,
);

export const integrationClaimDestinationLockEnabled = parseBooleanEnv(
  "INTEGRATION_CLAIM_DESTINATION_LOCK_ENABLED",
  true,
);

export const botTimedLocksEnabled = parseBooleanEnv(
  "BOT_TIMED_LOCKS_ENABLED",
  !isProduction,
);

export const botAutoLocksEnabled = parseBooleanEnv(
  "BOT_AUTO_LOCKS_ENABLED",
  false,
);

export const botLockSweepIntervalMs = parsePositiveIntEnv(
  "BOT_LOCK_SWEEP_INTERVAL_MS",
  30_000,
);

export const botLockMaxDurationMinutes = parsePositiveIntEnv(
  "BOT_LOCK_MAX_DURATION_MINUTES",
  1_440,
);

export const adminHistoryAutoAnalysisEnabled = parseBooleanEnv(
  "ADMIN_HISTORY_AUTO_ANALYSIS_ENABLED",
  !isProduction,
);

export const adminHistoryAutoAnalysisIntervalMs = parsePositiveIntEnv(
  "ADMIN_HISTORY_AUTO_ANALYSIS_INTERVAL_MS",
  30 * 60 * 1000,
);

export const adminHistoryAutoAnalysisMinNewAdminMessages = parsePositiveIntEnv(
  "ADMIN_HISTORY_AUTO_ANALYSIS_MIN_NEW_ADMIN_MESSAGES",
  10,
);

export const adminHistoryBackfillOnStartupEnabled = parseBooleanEnv(
  "ADMIN_HISTORY_BACKFILL_ON_STARTUP_ENABLED",
  !isProduction,
);

export const adminHistoryBackfillMaxDays = parsePositiveIntEnv(
  "ADMIN_HISTORY_BACKFILL_MAX_DAYS",
  90,
);

export const adminHistoryBackfillMaxMessagesPerDestination = parsePositiveIntEnv(
  "ADMIN_HISTORY_BACKFILL_MAX_MESSAGES_PER_DESTINATION",
  5_000,
);

export const adminHistoryAdminCheckCacheTtlMs = parsePositiveIntEnv(
  "ADMIN_HISTORY_ADMIN_CHECK_CACHE_TTL_MS",
  5 * 60 * 1000,
);

export const uiV2Enabled = parseBooleanEnv(
  "UI_V2_ENABLED",
  false,
);

export const uiV2RouteScope = parseCsvEnv("UI_V2_ROUTE_SCOPE");

export const uiV2AllowlistEmails = parseCsvEnv("UI_V2_ALLOWLIST_EMAILS");

export const uiV2ForceRoles = parseUiV2RolesEnv("UI_V2_FORCE_ROLES");

export const uiWave1RedoEnabled = parseBooleanEnv(
  "UI_WAVE1_REDO_ENABLED",
  false,
);

export const uiWave1RedoRouteScope = parseUiWave1RedoRouteScopeEnv("UI_WAVE1_REDO_ROUTE_SCOPE");

export const uiWave1RedoAllowlistEmails = parseCsvEnv("UI_WAVE1_REDO_ALLOWLIST_EMAILS");

export const uiWave1RedoForceRoles = parseUiV2RolesEnv("UI_WAVE1_REDO_FORCE_ROLES");
