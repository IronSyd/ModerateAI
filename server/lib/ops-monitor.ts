export type OpsEventCode =
  | "WIDGET_RATE_LIMIT_429"
  | "WIDGET_DAILY_QUOTA_REACHED"
  | "WIDGET_KB_ROUTE_UNMAPPED_DOMAIN"
  | "WIDGET_KB_ROUTE_NO_KB_ASSIGNED"
  | "WIDGET_KB_ROUTE_KB_UNAVAILABLE"
  | "WIDGET_SESSION_TOKEN_ISSUED"
  | "WIDGET_SESSION_TOKEN_INVALID"
  | "WIDGET_SOURCE_BINDING_REJECTED"
  | "WIDGET_LEAD_DEDUP_HIT"
  | "WIDGET_STORAGE_FALLBACK_USED"
  | "WIDGET_LEAD_PROMPT_FORM"
  | "WIDGET_LEAD_PROMPT_CTA"
  | "WIDGET_LEAD_PROMPT_SUPPRESSED"
  | "AUTH_SESSION_ERROR"
  | "AUTH_RATE_LIMIT_429"
  | "AUTH_RATE_LIMIT_FAILURE"
  | "OPENAI_REQUEST_FAILED"
  | "INTEGRATION_CLAIM_ATTEMPT"
  | "INTEGRATION_CLAIM_FAILURE"
  | "INTEGRATION_CLAIM_CONFLICT"
  | "INTEGRATION_CLAIM_CONSUME_FAILED"
  | "INTEGRATION_UNCLAIMED_HINT"
  | "MODERATION_CHECK_FAILED"
  | "DESTINATION_LOCK_APPLY"
  | "DESTINATION_LOCK_APPLY_FAILED"
  | "DESTINATION_UNLOCK"
  | "DESTINATION_UNLOCK_FAILED"
  | "DESTINATION_LOCK_AUTO_TRIGGERED"
  | "DESTINATION_LOCK_EXTENDED"
  | "DESTINATION_UNLOCK_ALL"
  | "DESTINATION_LOCK_SCHEDULE_APPLIED"
  | "DESTINATION_LOCK_SCHEDULE_RELEASED"
  | "DESTINATION_LOCK_SCHEDULE_SKIPPED_PAUSED"
  | "DESTINATION_LOCK_SCHEDULE_RECONCILED"
  | "ADMIN_HISTORY_BACKFILL_STARTED"
  | "ADMIN_HISTORY_BACKFILL_DESTINATION_SUMMARY"
  | "ADMIN_HISTORY_BACKFILL_COMPLETED"
  | "ADMIN_HISTORY_BACKFILL_ROW_SKIPPED_AMBIGUOUS"
  | "ADMIN_HISTORY_BACKFILL_MANUAL_TRIGGERED"
  | "ADMIN_HISTORY_BACKFILL_MANUAL_TRIGGER_SKIPPED_RUNNING"
  | "ADMIN_HISTORY_BACKFILL_MANUAL_TRIGGER_SKIPPED_COMPLETED"
  | "ADMIN_HISTORY_BACKFILL_MANUAL_TRIGGER_FORCED"
  | "ADMIN_HISTORY_AUTO_ANALYSIS_STARTED"
  | "ADMIN_HISTORY_AUTO_ANALYSIS_COMPLETED"
  | "ADMIN_HISTORY_AUTO_ANALYSIS_SKIPPED_THRESHOLD"
  | "ADMIN_HISTORY_AUTO_ANALYSIS_FAILED"
  | "ADMIN_HISTORY_ADMIN_DETECTION_FALLBACK_USED"
  | "KB_URL_SYNC_RUN_STARTED"
  | "KB_URL_SYNC_RUN_COMPLETED"
  | "KB_URL_SYNC_RUN_FAILED"
  | "KB_URL_SYNC_PAGE_FETCH_FAILED"
  | "KB_URL_SYNC_PAGE_SKIPPED_NON_HTML"
  | "KB_URL_SYNC_PAGE_MARKED_STALE"
  | "KB_URL_SYNC_QUOTA_LIMIT_REACHED"
  | "KB_URL_SYNC_SOURCE_VALIDATION_FAILED"
  | "DISCORD_SERVER_ENABLE_REQUEST"
  | "DISCORD_SERVER_ENABLED"
  | "DISCORD_SERVER_ENABLE_DENIED"
  | "DISCORD_INVENTORY_SYNC_FAILED"
  | "DISCORD_UNENABLED_SERVER_HINT_SENT";

type OpsEventState = {
  windowStartedAt: number;
  count: number;
};

type OpsEventOptions = {
  bucketKey?: string;
};

type OpsCodeState = {
  windowStartedAt: number;
  count: number;
  totalCount: number;
  lastSeenAt: number;
};

const OPS_EVENT_CODES: OpsEventCode[] = [
  "WIDGET_RATE_LIMIT_429",
  "WIDGET_DAILY_QUOTA_REACHED",
  "WIDGET_KB_ROUTE_UNMAPPED_DOMAIN",
  "WIDGET_KB_ROUTE_NO_KB_ASSIGNED",
  "WIDGET_KB_ROUTE_KB_UNAVAILABLE",
  "WIDGET_SESSION_TOKEN_ISSUED",
  "WIDGET_SESSION_TOKEN_INVALID",
  "WIDGET_SOURCE_BINDING_REJECTED",
  "WIDGET_LEAD_DEDUP_HIT",
  "WIDGET_STORAGE_FALLBACK_USED",
  "WIDGET_LEAD_PROMPT_FORM",
  "WIDGET_LEAD_PROMPT_CTA",
  "WIDGET_LEAD_PROMPT_SUPPRESSED",
  "AUTH_SESSION_ERROR",
  "AUTH_RATE_LIMIT_429",
  "AUTH_RATE_LIMIT_FAILURE",
  "OPENAI_REQUEST_FAILED",
  "INTEGRATION_CLAIM_ATTEMPT",
  "INTEGRATION_CLAIM_FAILURE",
  "INTEGRATION_CLAIM_CONFLICT",
  "INTEGRATION_CLAIM_CONSUME_FAILED",
  "INTEGRATION_UNCLAIMED_HINT",
  "MODERATION_CHECK_FAILED",
  "DESTINATION_LOCK_APPLY",
  "DESTINATION_LOCK_APPLY_FAILED",
  "DESTINATION_UNLOCK",
  "DESTINATION_UNLOCK_FAILED",
  "DESTINATION_LOCK_AUTO_TRIGGERED",
  "DESTINATION_LOCK_EXTENDED",
  "DESTINATION_UNLOCK_ALL",
  "DESTINATION_LOCK_SCHEDULE_APPLIED",
  "DESTINATION_LOCK_SCHEDULE_RELEASED",
  "DESTINATION_LOCK_SCHEDULE_SKIPPED_PAUSED",
  "DESTINATION_LOCK_SCHEDULE_RECONCILED",
  "ADMIN_HISTORY_BACKFILL_STARTED",
  "ADMIN_HISTORY_BACKFILL_DESTINATION_SUMMARY",
  "ADMIN_HISTORY_BACKFILL_COMPLETED",
  "ADMIN_HISTORY_BACKFILL_ROW_SKIPPED_AMBIGUOUS",
  "ADMIN_HISTORY_BACKFILL_MANUAL_TRIGGERED",
  "ADMIN_HISTORY_BACKFILL_MANUAL_TRIGGER_SKIPPED_RUNNING",
  "ADMIN_HISTORY_BACKFILL_MANUAL_TRIGGER_SKIPPED_COMPLETED",
  "ADMIN_HISTORY_BACKFILL_MANUAL_TRIGGER_FORCED",
  "ADMIN_HISTORY_AUTO_ANALYSIS_STARTED",
  "ADMIN_HISTORY_AUTO_ANALYSIS_COMPLETED",
  "ADMIN_HISTORY_AUTO_ANALYSIS_SKIPPED_THRESHOLD",
  "ADMIN_HISTORY_AUTO_ANALYSIS_FAILED",
  "ADMIN_HISTORY_ADMIN_DETECTION_FALLBACK_USED",
  "KB_URL_SYNC_RUN_STARTED",
  "KB_URL_SYNC_RUN_COMPLETED",
  "KB_URL_SYNC_RUN_FAILED",
  "KB_URL_SYNC_PAGE_FETCH_FAILED",
  "KB_URL_SYNC_PAGE_SKIPPED_NON_HTML",
  "KB_URL_SYNC_PAGE_MARKED_STALE",
  "KB_URL_SYNC_QUOTA_LIMIT_REACHED",
  "KB_URL_SYNC_SOURCE_VALIDATION_FAILED",
  "DISCORD_SERVER_ENABLE_REQUEST",
  "DISCORD_SERVER_ENABLED",
  "DISCORD_SERVER_ENABLE_DENIED",
  "DISCORD_INVENTORY_SYNC_FAILED",
  "DISCORD_UNENABLED_SERVER_HINT_SENT",
];

const DEFAULT_ALERT_WINDOW_MS = 5 * 60 * 1000;
const ALERT_WINDOW_MS =
  Number.parseInt(process.env.OPS_ALERT_WINDOW_MS ?? `${DEFAULT_ALERT_WINDOW_MS}`, 10) || DEFAULT_ALERT_WINDOW_MS;

const ALERT_THRESHOLDS: Record<OpsEventCode, number> = {
  WIDGET_RATE_LIMIT_429: Number.parseInt(process.env.OPS_ALERT_RATE_LIMIT_429_THRESHOLD ?? "20", 10) || 20,
  WIDGET_DAILY_QUOTA_REACHED: Number.parseInt(process.env.OPS_ALERT_DAILY_QUOTA_THRESHOLD ?? "12", 10) || 12,
  WIDGET_KB_ROUTE_UNMAPPED_DOMAIN:
    Number.parseInt(process.env.OPS_ALERT_WIDGET_KB_UNMAPPED_THRESHOLD ?? "20", 10) || 20,
  WIDGET_KB_ROUTE_NO_KB_ASSIGNED:
    Number.parseInt(process.env.OPS_ALERT_WIDGET_KB_UNASSIGNED_THRESHOLD ?? "20", 10) || 20,
  WIDGET_KB_ROUTE_KB_UNAVAILABLE:
    Number.parseInt(process.env.OPS_ALERT_WIDGET_KB_UNAVAILABLE_THRESHOLD ?? "20", 10) || 20,
  WIDGET_SESSION_TOKEN_ISSUED:
    Number.parseInt(process.env.OPS_ALERT_WIDGET_SESSION_TOKEN_ISSUED_THRESHOLD ?? "120", 10) || 120,
  WIDGET_SESSION_TOKEN_INVALID:
    Number.parseInt(process.env.OPS_ALERT_WIDGET_SESSION_TOKEN_INVALID_THRESHOLD ?? "20", 10) || 20,
  WIDGET_SOURCE_BINDING_REJECTED:
    Number.parseInt(process.env.OPS_ALERT_WIDGET_SOURCE_BINDING_REJECTED_THRESHOLD ?? "20", 10) || 20,
  WIDGET_LEAD_DEDUP_HIT:
    Number.parseInt(process.env.OPS_ALERT_WIDGET_LEAD_DEDUP_HIT_THRESHOLD ?? "60", 10) || 60,
  WIDGET_STORAGE_FALLBACK_USED:
    Number.parseInt(process.env.OPS_ALERT_WIDGET_STORAGE_FALLBACK_USED_THRESHOLD ?? "30", 10) || 30,
  WIDGET_LEAD_PROMPT_FORM:
    Number.parseInt(process.env.OPS_ALERT_WIDGET_LEAD_PROMPT_FORM_THRESHOLD ?? "30", 10) || 30,
  WIDGET_LEAD_PROMPT_CTA:
    Number.parseInt(process.env.OPS_ALERT_WIDGET_LEAD_PROMPT_CTA_THRESHOLD ?? "30", 10) || 30,
  WIDGET_LEAD_PROMPT_SUPPRESSED:
    Number.parseInt(process.env.OPS_ALERT_WIDGET_LEAD_PROMPT_SUPPRESSED_THRESHOLD ?? "80", 10) || 80,
  AUTH_SESSION_ERROR: Number.parseInt(process.env.OPS_ALERT_AUTH_SESSION_THRESHOLD ?? "5", 10) || 5,
  AUTH_RATE_LIMIT_429: Number.parseInt(process.env.OPS_ALERT_AUTH_RATE_LIMIT_429_THRESHOLD ?? "20", 10) || 20,
  AUTH_RATE_LIMIT_FAILURE: Number.parseInt(process.env.OPS_ALERT_AUTH_RATE_LIMIT_FAILURE_THRESHOLD ?? "5", 10) || 5,
  OPENAI_REQUEST_FAILED: Number.parseInt(process.env.OPS_ALERT_OPENAI_FAILURE_THRESHOLD ?? "8", 10) || 8,
  INTEGRATION_CLAIM_ATTEMPT:
    Number.parseInt(process.env.OPS_ALERT_INTEGRATION_CLAIM_ATTEMPT_THRESHOLD ?? "50", 10) || 50,
  INTEGRATION_CLAIM_FAILURE:
    Number.parseInt(process.env.OPS_ALERT_INTEGRATION_CLAIM_FAILURE_THRESHOLD ?? "20", 10) || 20,
  INTEGRATION_CLAIM_CONFLICT:
    Number.parseInt(process.env.OPS_ALERT_INTEGRATION_CLAIM_CONFLICT_THRESHOLD ?? "20", 10) || 20,
  INTEGRATION_CLAIM_CONSUME_FAILED:
    Number.parseInt(process.env.OPS_ALERT_INTEGRATION_CLAIM_CONSUME_FAILED_THRESHOLD ?? "20", 10) || 20,
  INTEGRATION_UNCLAIMED_HINT:
    Number.parseInt(process.env.OPS_ALERT_INTEGRATION_UNCLAIMED_HINT_THRESHOLD ?? "40", 10) || 40,
  MODERATION_CHECK_FAILED:
    Number.parseInt(process.env.OPS_ALERT_MODERATION_CHECK_FAILED_THRESHOLD ?? "20", 10) || 20,
  DESTINATION_LOCK_APPLY:
    Number.parseInt(process.env.OPS_ALERT_DESTINATION_LOCK_APPLY_THRESHOLD ?? "25", 10) || 25,
  DESTINATION_LOCK_APPLY_FAILED:
    Number.parseInt(process.env.OPS_ALERT_DESTINATION_LOCK_APPLY_FAILED_THRESHOLD ?? "15", 10) || 15,
  DESTINATION_UNLOCK:
    Number.parseInt(process.env.OPS_ALERT_DESTINATION_UNLOCK_THRESHOLD ?? "25", 10) || 25,
  DESTINATION_UNLOCK_FAILED:
    Number.parseInt(process.env.OPS_ALERT_DESTINATION_UNLOCK_FAILED_THRESHOLD ?? "12", 10) || 12,
  DESTINATION_LOCK_AUTO_TRIGGERED:
    Number.parseInt(process.env.OPS_ALERT_DESTINATION_LOCK_AUTO_TRIGGERED_THRESHOLD ?? "25", 10) || 25,
  DESTINATION_LOCK_EXTENDED:
    Number.parseInt(process.env.OPS_ALERT_DESTINATION_LOCK_EXTENDED_THRESHOLD ?? "25", 10) || 25,
  DESTINATION_UNLOCK_ALL:
    Number.parseInt(process.env.OPS_ALERT_DESTINATION_UNLOCK_ALL_THRESHOLD ?? "20", 10) || 20,
  DESTINATION_LOCK_SCHEDULE_APPLIED:
    Number.parseInt(process.env.OPS_ALERT_DESTINATION_LOCK_SCHEDULE_APPLIED_THRESHOLD ?? "25", 10) || 25,
  DESTINATION_LOCK_SCHEDULE_RELEASED:
    Number.parseInt(process.env.OPS_ALERT_DESTINATION_LOCK_SCHEDULE_RELEASED_THRESHOLD ?? "25", 10) || 25,
  DESTINATION_LOCK_SCHEDULE_SKIPPED_PAUSED:
    Number.parseInt(process.env.OPS_ALERT_DESTINATION_LOCK_SCHEDULE_SKIPPED_PAUSED_THRESHOLD ?? "40", 10) || 40,
  DESTINATION_LOCK_SCHEDULE_RECONCILED:
    Number.parseInt(process.env.OPS_ALERT_DESTINATION_LOCK_SCHEDULE_RECONCILED_THRESHOLD ?? "20", 10) || 20,
  ADMIN_HISTORY_BACKFILL_STARTED:
    Number.parseInt(process.env.OPS_ALERT_ADMIN_HISTORY_BACKFILL_STARTED_THRESHOLD ?? "20", 10) || 20,
  ADMIN_HISTORY_BACKFILL_DESTINATION_SUMMARY:
    Number.parseInt(process.env.OPS_ALERT_ADMIN_HISTORY_BACKFILL_DESTINATION_SUMMARY_THRESHOLD ?? "80", 10) || 80,
  ADMIN_HISTORY_BACKFILL_COMPLETED:
    Number.parseInt(process.env.OPS_ALERT_ADMIN_HISTORY_BACKFILL_COMPLETED_THRESHOLD ?? "20", 10) || 20,
  ADMIN_HISTORY_BACKFILL_ROW_SKIPPED_AMBIGUOUS:
    Number.parseInt(process.env.OPS_ALERT_ADMIN_HISTORY_BACKFILL_ROW_SKIPPED_AMBIGUOUS_THRESHOLD ?? "120", 10) || 120,
  ADMIN_HISTORY_BACKFILL_MANUAL_TRIGGERED:
    Number.parseInt(process.env.OPS_ALERT_ADMIN_HISTORY_BACKFILL_MANUAL_TRIGGERED_THRESHOLD ?? "20", 10) || 20,
  ADMIN_HISTORY_BACKFILL_MANUAL_TRIGGER_SKIPPED_RUNNING:
    Number.parseInt(process.env.OPS_ALERT_ADMIN_HISTORY_BACKFILL_MANUAL_TRIGGER_SKIPPED_RUNNING_THRESHOLD ?? "20", 10) || 20,
  ADMIN_HISTORY_BACKFILL_MANUAL_TRIGGER_SKIPPED_COMPLETED:
    Number.parseInt(process.env.OPS_ALERT_ADMIN_HISTORY_BACKFILL_MANUAL_TRIGGER_SKIPPED_COMPLETED_THRESHOLD ?? "20", 10) || 20,
  ADMIN_HISTORY_BACKFILL_MANUAL_TRIGGER_FORCED:
    Number.parseInt(process.env.OPS_ALERT_ADMIN_HISTORY_BACKFILL_MANUAL_TRIGGER_FORCED_THRESHOLD ?? "20", 10) || 20,
  ADMIN_HISTORY_AUTO_ANALYSIS_STARTED:
    Number.parseInt(process.env.OPS_ALERT_ADMIN_HISTORY_AUTO_ANALYSIS_STARTED_THRESHOLD ?? "40", 10) || 40,
  ADMIN_HISTORY_AUTO_ANALYSIS_COMPLETED:
    Number.parseInt(process.env.OPS_ALERT_ADMIN_HISTORY_AUTO_ANALYSIS_COMPLETED_THRESHOLD ?? "40", 10) || 40,
  ADMIN_HISTORY_AUTO_ANALYSIS_SKIPPED_THRESHOLD:
    Number.parseInt(process.env.OPS_ALERT_ADMIN_HISTORY_AUTO_ANALYSIS_SKIPPED_THRESHOLD_THRESHOLD ?? "120", 10) || 120,
  ADMIN_HISTORY_AUTO_ANALYSIS_FAILED:
    Number.parseInt(process.env.OPS_ALERT_ADMIN_HISTORY_AUTO_ANALYSIS_FAILED_THRESHOLD ?? "20", 10) || 20,
  ADMIN_HISTORY_ADMIN_DETECTION_FALLBACK_USED:
    Number.parseInt(process.env.OPS_ALERT_ADMIN_HISTORY_ADMIN_DETECTION_FALLBACK_USED_THRESHOLD ?? "80", 10) || 80,
  KB_URL_SYNC_RUN_STARTED:
    Number.parseInt(process.env.OPS_ALERT_KB_URL_SYNC_RUN_STARTED_THRESHOLD ?? "30", 10) || 30,
  KB_URL_SYNC_RUN_COMPLETED:
    Number.parseInt(process.env.OPS_ALERT_KB_URL_SYNC_RUN_COMPLETED_THRESHOLD ?? "30", 10) || 30,
  KB_URL_SYNC_RUN_FAILED:
    Number.parseInt(process.env.OPS_ALERT_KB_URL_SYNC_RUN_FAILED_THRESHOLD ?? "10", 10) || 10,
  KB_URL_SYNC_PAGE_FETCH_FAILED:
    Number.parseInt(process.env.OPS_ALERT_KB_URL_SYNC_PAGE_FETCH_FAILED_THRESHOLD ?? "40", 10) || 40,
  KB_URL_SYNC_PAGE_SKIPPED_NON_HTML:
    Number.parseInt(process.env.OPS_ALERT_KB_URL_SYNC_PAGE_SKIPPED_NON_HTML_THRESHOLD ?? "60", 10) || 60,
  KB_URL_SYNC_PAGE_MARKED_STALE:
    Number.parseInt(process.env.OPS_ALERT_KB_URL_SYNC_PAGE_MARKED_STALE_THRESHOLD ?? "40", 10) || 40,
  KB_URL_SYNC_QUOTA_LIMIT_REACHED:
    Number.parseInt(process.env.OPS_ALERT_KB_URL_SYNC_QUOTA_LIMIT_REACHED_THRESHOLD ?? "20", 10) || 20,
  KB_URL_SYNC_SOURCE_VALIDATION_FAILED:
    Number.parseInt(process.env.OPS_ALERT_KB_URL_SYNC_SOURCE_VALIDATION_FAILED_THRESHOLD ?? "20", 10) || 20,
  DISCORD_SERVER_ENABLE_REQUEST:
    Number.parseInt(process.env.OPS_ALERT_DISCORD_SERVER_ENABLE_REQUEST_THRESHOLD ?? "40", 10) || 40,
  DISCORD_SERVER_ENABLED:
    Number.parseInt(process.env.OPS_ALERT_DISCORD_SERVER_ENABLED_THRESHOLD ?? "40", 10) || 40,
  DISCORD_SERVER_ENABLE_DENIED:
    Number.parseInt(process.env.OPS_ALERT_DISCORD_SERVER_ENABLE_DENIED_THRESHOLD ?? "20", 10) || 20,
  DISCORD_INVENTORY_SYNC_FAILED:
    Number.parseInt(process.env.OPS_ALERT_DISCORD_INVENTORY_SYNC_FAILED_THRESHOLD ?? "15", 10) || 15,
  DISCORD_UNENABLED_SERVER_HINT_SENT:
    Number.parseInt(process.env.OPS_ALERT_DISCORD_UNENABLED_SERVER_HINT_SENT_THRESHOLD ?? "30", 10) || 30,
};

const eventState = new Map<string, OpsEventState>();
const codeState = new Map<OpsEventCode, OpsCodeState>();

function sanitizeDetails(details: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (value === undefined) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
      out[key] = value;
      continue;
    }
    out[key] = String(value);
  }
  return out;
}

function getAlertThreshold(code: OpsEventCode): number {
  const value = ALERT_THRESHOLDS[code];
  if (!Number.isFinite(value) || value < 1) return 1;
  return Math.floor(value);
}

function maybeResetBucket(state: OpsEventState, nowMs: number): OpsEventState {
  if (nowMs - state.windowStartedAt <= ALERT_WINDOW_MS) return state;
  return {
    windowStartedAt: nowMs,
    count: 0,
  };
}

function cleanupOldBuckets(nowMs: number): void {
  const staleAfterMs = ALERT_WINDOW_MS * 4;
  eventState.forEach((state, key) => {
    if (nowMs - state.windowStartedAt > staleAfterMs) {
      eventState.delete(key);
    }
  });
}

function maybeResetCodeWindow(state: OpsCodeState, nowMs: number): OpsCodeState {
  if (nowMs - state.windowStartedAt <= ALERT_WINDOW_MS) return state;
  return {
    windowStartedAt: nowMs,
    count: 0,
    totalCount: state.totalCount,
    lastSeenAt: state.lastSeenAt,
  };
}

function updateCodeState(code: OpsEventCode, nowMs: number): OpsCodeState {
  const current = codeState.get(code);
  const next = maybeResetCodeWindow(
    current ?? {
      windowStartedAt: nowMs,
      count: 0,
      totalCount: 0,
      lastSeenAt: nowMs,
    },
    nowMs,
  );

  next.count += 1;
  next.totalCount += 1;
  next.lastSeenAt = nowMs;
  codeState.set(code, next);
  return next;
}

function getCodeWindowCount(state: OpsCodeState | undefined, nowMs: number): number {
  if (!state) return 0;
  if (nowMs - state.windowStartedAt > ALERT_WINDOW_MS) return 0;
  return state.count;
}

export type OpsEventSummary = {
  code: OpsEventCode;
  threshold: number;
  windowSeconds: number;
  windowCount: number;
  totalCount: number;
  windowStartedAt: string | null;
  lastSeenAt: string | null;
};

export function getOpsEventSummary(filterCodes?: OpsEventCode[]): OpsEventSummary[] {
  const nowMs = Date.now();
  const codes = filterCodes && filterCodes.length > 0 ? filterCodes : OPS_EVENT_CODES;
  const uniqueCodes = Array.from(new Set(codes));

  return uniqueCodes.map((code) => {
    const state = codeState.get(code);
    const windowCount = getCodeWindowCount(state, nowMs);

    return {
      code,
      threshold: getAlertThreshold(code),
      windowSeconds: Math.round(ALERT_WINDOW_MS / 1000),
      windowCount,
      totalCount: state?.totalCount ?? 0,
      windowStartedAt: state ? new Date(state.windowStartedAt).toISOString() : null,
      lastSeenAt: state ? new Date(state.lastSeenAt).toISOString() : null,
    };
  });
}

export function recordOpsEvent(
  code: OpsEventCode,
  details: Record<string, unknown> = {},
  options: OpsEventOptions = {},
): void {
  const nowMs = Date.now();
  cleanupOldBuckets(nowMs);
  updateCodeState(code, nowMs);

  const bucketKey = options.bucketKey || code;
  const current = eventState.get(bucketKey);
  const state = maybeResetBucket(
    current ?? {
      windowStartedAt: nowMs,
      count: 0,
    },
    nowMs,
  );

  state.count += 1;
  eventState.set(bucketKey, state);

  const threshold = getAlertThreshold(code);
  const shouldAlert = state.count === threshold || (state.count > threshold && state.count % threshold === 0);
  if (!shouldAlert) return;

  const windowSeconds = Math.round(ALERT_WINDOW_MS / 1000);
  const payload = sanitizeDetails(details);
  console.warn(
    `[ops-alert] ${code} repeated ${state.count} times in ${windowSeconds}s window`,
    JSON.stringify(payload),
  );
}
