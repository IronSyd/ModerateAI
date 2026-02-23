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
