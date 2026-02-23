import type { ChatConfiguration, DestinationLock, Platform } from "@shared/schema";
import { randomUUID } from "crypto";
import { storage } from "../storage";
import {
  botAutoLocksEnabled,
  botLockMaxDurationMinutes,
  botLockSweepIntervalMs,
  botTimedLocksEnabled,
} from "../config/runtime-flags";
import { recordOpsEvent } from "./ops-monitor";
import { recordAuditEvent } from "./audit";

export type DestinationLockSource = "manual_app" | "manual_chat" | "auto";

export type DestinationLockActor = {
  requestedByUserId?: number | null;
  requestedByPlatformUserId?: string | null;
  requestedByPlatformUsername?: string | null;
};

export type LockState = {
  isLocked: boolean;
  source: DestinationLockSource | null;
  startedAt: string | null;
  endsAt: string | null;
  remainingSeconds: number;
  reason: string | null;
};

export type LockScheduleRecurrence = "daily" | "weekly";

export type LockSchedule = {
  id: string;
  recurrence: LockScheduleRecurrence;
  daysOfWeek: number[];
  lockAt: string;
  unlockAt: string;
  isEnabled: boolean;
};

export type NormalizedLockSettings = {
  scheduleEnabled: boolean;
  schedulePaused: boolean;
  timezone: string;
  schedules: LockSchedule[];
  // Deprecated legacy fields kept for payload compatibility only.
  autoLockEnabled: boolean;
  thresholdCount: number;
  windowMinutes: number;
  lockDurationMinutes: number;
};

export type DestinationLockApplyResult = {
  ok: boolean;
  warning?: string;
  permissionSnapshot?: Record<string, unknown>;
  noticeChannelExternalId?: string | null;
};

export type DestinationLockReleaseResult = {
  ok: boolean;
  warning?: string;
};

export type DestinationLockAdapter = {
  applyLock: (params: {
    chatConfig: ChatConfiguration;
    platform: Platform;
    endsAt: Date;
    source: DestinationLockSource;
    reason: string | null;
  }) => Promise<DestinationLockApplyResult>;
  releaseLock: (params: {
    chatConfig: ChatConfiguration;
    platform: Platform;
    lock: DestinationLock;
    releaseReason: string | null;
  }) => Promise<DestinationLockReleaseResult>;
};

type LockSweepResolver = (platformType: string) => DestinationLockAdapter | null;

const MAX_SCHEDULES_PER_DESTINATION = 20;
const LOCK_TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const WEEKDAY_SHORT_TO_INDEX: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

const DEFAULT_LOCK_SETTINGS: NormalizedLockSettings = {
  scheduleEnabled: false,
  schedulePaused: false,
  timezone: "UTC",
  schedules: [],
  autoLockEnabled: false,
  thresholdCount: 5,
  windowMinutes: 2,
  lockDurationMinutes: 10,
};

let lockSweepInFlight = false;
let scheduledSweepInFlight = false;

function parseBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
  }
  return fallback;
}

function parsePositiveInt(value: unknown, fallback: number): number {
  const numeric = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return numeric;
}

function clampDurationMinutes(durationMinutes: number): number {
  const safe = Math.max(1, Math.floor(durationMinutes));
  return Math.min(safe, botLockMaxDurationMinutes);
}

function parseLockTimeToMinutes(value: string): number | null {
  const match = value.match(LOCK_TIME_REGEX);
  if (!match) return null;
  const hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

function normalizeDaysOfWeek(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const unique = new Set<number>();
  for (const item of value) {
    const numeric = Number.parseInt(String(item), 10);
    if (Number.isFinite(numeric) && numeric >= 0 && numeric <= 6) {
      unique.add(numeric);
    }
  }
  return Array.from(unique).sort((a, b) => a - b);
}

function createScheduleId(index: number): string {
  try {
    return `schedule-${randomUUID()}`;
  } catch {
    return `schedule-${Date.now()}-${index}`;
  }
}

function normalizeSchedule(input: unknown, index: number): LockSchedule | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const recurrence = raw.recurrence === "weekly" ? "weekly" : raw.recurrence === "daily" ? "daily" : null;
  if (!recurrence) return null;

  const lockAtRaw = String(raw.lockAt ?? "").trim();
  const unlockAtRaw = String(raw.unlockAt ?? "").trim();
  if (!LOCK_TIME_REGEX.test(lockAtRaw) || !LOCK_TIME_REGEX.test(unlockAtRaw)) {
    return null;
  }

  const idCandidate = String(raw.id ?? "").trim();
  const id = idCandidate.length > 0 ? idCandidate : createScheduleId(index);
  const daysOfWeek = recurrence === "weekly" ? normalizeDaysOfWeek(raw.daysOfWeek) : [];
  if (recurrence === "weekly" && daysOfWeek.length === 0) {
    return null;
  }

  return {
    id,
    recurrence,
    daysOfWeek,
    lockAt: lockAtRaw,
    unlockAt: unlockAtRaw,
    isEnabled: parseBool(raw.isEnabled, true),
  };
}

function normalizeSchedules(input: unknown): LockSchedule[] {
  if (!Array.isArray(input)) return [];
  const normalized: LockSchedule[] = [];
  for (let i = 0; i < input.length; i += 1) {
    const schedule = normalizeSchedule(input[i], i);
    if (schedule) {
      normalized.push(schedule);
      if (normalized.length >= MAX_SCHEDULES_PER_DESTINATION) break;
    }
  }
  return normalized;
}

export function isValidIanaTimezone(value: string): boolean {
  const candidate = String(value ?? "").trim();
  if (!candidate) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate });
    return true;
  } catch {
    return false;
  }
}

function resolveTimezone(value: unknown, fallback: string): string {
  const candidate = String(value ?? "").trim();
  if (isValidIanaTimezone(candidate)) return candidate;
  return fallback;
}

function getLocalClockInfo(now: Date, timezone: string): { weekday: number; minuteOfDay: number } | null {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    const parts = formatter.formatToParts(now);
    const weekdayText = parts.find((part) => part.type === "weekday")?.value?.trim().toLowerCase();
    const hourText = parts.find((part) => part.type === "hour")?.value;
    const minuteText = parts.find((part) => part.type === "minute")?.value;
    if (!weekdayText || !hourText || !minuteText) return null;
    const weekday = WEEKDAY_SHORT_TO_INDEX[weekdayText.slice(0, 3)];
    const hour = Number.parseInt(hourText, 10);
    const minute = Number.parseInt(minuteText, 10);
    if (!Number.isFinite(weekday) || !Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    return {
      weekday,
      minuteOfDay: hour * 60 + minute,
    };
  } catch {
    return null;
  }
}

function getRemainingMinutesForSchedule(nowInfo: { weekday: number; minuteOfDay: number }, schedule: LockSchedule): number {
  if (!schedule.isEnabled) return 0;
  const lockMinutes = parseLockTimeToMinutes(schedule.lockAt);
  const unlockMinutes = parseLockTimeToMinutes(schedule.unlockAt);
  if (lockMinutes === null || unlockMinutes === null) return 0;

  const nowMinutes = nowInfo.minuteOfDay;
  const currentDay = nowInfo.weekday;
  const previousDay = (currentDay + 6) % 7;
  const crossesMidnight = unlockMinutes <= lockMinutes;

  if (schedule.recurrence === "daily") {
    if (!crossesMidnight) {
      return nowMinutes >= lockMinutes && nowMinutes < unlockMinutes ? unlockMinutes - nowMinutes : 0;
    }
    if (lockMinutes === unlockMinutes) return 24 * 60;
    if (nowMinutes >= lockMinutes) return 24 * 60 - nowMinutes + unlockMinutes;
    if (nowMinutes < unlockMinutes) return unlockMinutes - nowMinutes;
    return 0;
  }

  const activeDays = new Set(schedule.daysOfWeek);
  if (activeDays.size === 0) return 0;
  if (!crossesMidnight) {
    if (!activeDays.has(currentDay)) return 0;
    return nowMinutes >= lockMinutes && nowMinutes < unlockMinutes ? unlockMinutes - nowMinutes : 0;
  }

  if (lockMinutes === unlockMinutes) {
    return activeDays.has(currentDay) ? 24 * 60 : 0;
  }
  if (activeDays.has(currentDay) && nowMinutes >= lockMinutes) {
    return 24 * 60 - nowMinutes + unlockMinutes;
  }
  if (activeDays.has(previousDay) && nowMinutes < unlockMinutes) {
    return unlockMinutes - nowMinutes;
  }
  return 0;
}

function resolveActiveScheduleWindowEnd(now: Date, settings: NormalizedLockSettings): Date | null {
  if (!settings.scheduleEnabled || settings.schedulePaused || settings.schedules.length === 0) return null;
  const nowInfo = getLocalClockInfo(now, settings.timezone);
  if (!nowInfo) return null;

  let maxRemainingMinutes = 0;
  for (const schedule of settings.schedules) {
    const remaining = getRemainingMinutesForSchedule(nowInfo, schedule);
    if (remaining > maxRemainingMinutes) {
      maxRemainingMinutes = remaining;
    }
  }
  if (maxRemainingMinutes <= 0) return null;
  return new Date(now.getTime() + maxRemainingMinutes * 60 * 1000);
}

function isScheduledAutoLock(lock: DestinationLock | null | undefined): boolean {
  if (!lock) return false;
  const metadata = (lock.metadata as Record<string, unknown> | undefined) ?? {};
  return metadata.lockMode === "scheduled_auto";
}

async function setSchedulePausedState(chatConfig: ChatConfiguration, paused: boolean): Promise<void> {
  const current = normalizeLockSettings(chatConfig.settings);
  if (current.schedulePaused === paused) return;
  const nextSettings = mergeLockSettingsIntoConfig(chatConfig.settings ?? {}, {
    schedulePaused: paused,
  });
  await storage.updateChatConfiguration(chatConfig.id, {
    settings: nextSettings as any,
  });
}

async function applyManualOverridePause(chatConfig: ChatConfiguration, source: DestinationLockSource | undefined): Promise<void> {
  if (source !== "manual_app" && source !== "manual_chat") return;
  await setSchedulePausedState(chatConfig, true);
}

export function normalizeLockSettings(settings: unknown): NormalizedLockSettings {
  const raw = (settings ?? {}) as Record<string, unknown>;
  const lockSettingsRaw = (raw.lockSettings ?? {}) as Record<string, unknown>;
  const timezone = resolveTimezone(lockSettingsRaw.timezone, DEFAULT_LOCK_SETTINGS.timezone);
  const schedules = normalizeSchedules(lockSettingsRaw.schedules);

  return {
    scheduleEnabled: parseBool(lockSettingsRaw.scheduleEnabled, DEFAULT_LOCK_SETTINGS.scheduleEnabled),
    schedulePaused: parseBool(lockSettingsRaw.schedulePaused, DEFAULT_LOCK_SETTINGS.schedulePaused),
    timezone,
    schedules,
    autoLockEnabled: parseBool(lockSettingsRaw.autoLockEnabled, DEFAULT_LOCK_SETTINGS.autoLockEnabled),
    thresholdCount: Math.max(1, parsePositiveInt(lockSettingsRaw.thresholdCount, DEFAULT_LOCK_SETTINGS.thresholdCount)),
    windowMinutes: Math.max(1, parsePositiveInt(lockSettingsRaw.windowMinutes, DEFAULT_LOCK_SETTINGS.windowMinutes)),
    lockDurationMinutes: clampDurationMinutes(
      parsePositiveInt(lockSettingsRaw.lockDurationMinutes, DEFAULT_LOCK_SETTINGS.lockDurationMinutes),
    ),
  };
}

export function mergeLockSettingsIntoConfig(
  settings: unknown,
  lockSettingsPatch: Partial<NormalizedLockSettings>,
): Record<string, unknown> {
  const base = (settings ?? {}) as Record<string, unknown>;
  const normalized = normalizeLockSettings(base);
  const mergedSchedules =
    lockSettingsPatch.schedules === undefined
      ? normalized.schedules
      : normalizeSchedules(lockSettingsPatch.schedules);
  const merged: NormalizedLockSettings = {
    scheduleEnabled:
      lockSettingsPatch.scheduleEnabled === undefined
        ? normalized.scheduleEnabled
        : Boolean(lockSettingsPatch.scheduleEnabled),
    schedulePaused:
      lockSettingsPatch.schedulePaused === undefined
        ? normalized.schedulePaused
        : Boolean(lockSettingsPatch.schedulePaused),
    timezone:
      lockSettingsPatch.timezone === undefined
        ? normalized.timezone
        : resolveTimezone(lockSettingsPatch.timezone, normalized.timezone),
    schedules: mergedSchedules,
    autoLockEnabled:
      lockSettingsPatch.autoLockEnabled === undefined
        ? normalized.autoLockEnabled
        : Boolean(lockSettingsPatch.autoLockEnabled),
    thresholdCount:
      lockSettingsPatch.thresholdCount === undefined
        ? normalized.thresholdCount
        : Math.max(1, Math.floor(lockSettingsPatch.thresholdCount)),
    windowMinutes:
      lockSettingsPatch.windowMinutes === undefined
        ? normalized.windowMinutes
        : Math.max(1, Math.floor(lockSettingsPatch.windowMinutes)),
    lockDurationMinutes:
      lockSettingsPatch.lockDurationMinutes === undefined
        ? normalized.lockDurationMinutes
        : clampDurationMinutes(lockSettingsPatch.lockDurationMinutes),
  };

  return {
    ...base,
    lockSettings: merged,
  };
}

export function parseLockDurationToken(tokenRaw: string | undefined | null): number | null {
  const token = String(tokenRaw ?? "").trim().toLowerCase();
  if (!token) return null;

  const match = token.match(/^(\d+)(m|h|d)?$/);
  if (!match) return null;

  const value = Number.parseInt(match[1], 10);
  if (!Number.isFinite(value) || value <= 0) return null;

  const unit = match[2] ?? "m";
  if (unit === "m") return clampDurationMinutes(value);
  if (unit === "h") return clampDurationMinutes(value * 60);
  if (unit === "d") return clampDurationMinutes(value * 24 * 60);
  return null;
}

export function buildLockState(lock: DestinationLock | null | undefined): LockState {
  if (!lock || lock.status !== "active") {
    return {
      isLocked: false,
      source: null,
      startedAt: null,
      endsAt: null,
      remainingSeconds: 0,
      reason: null,
    };
  }

  const now = Date.now();
  const endsAt = new Date(lock.endsAt).getTime();
  const remainingSeconds = Math.max(0, Math.ceil((endsAt - now) / 1000));

  return {
    isLocked: true,
    source: lock.source as DestinationLockSource,
    startedAt: lock.startedAt ? new Date(lock.startedAt).toISOString() : null,
    endsAt: lock.endsAt ? new Date(lock.endsAt).toISOString() : null,
    remainingSeconds,
    reason: lock.reason ?? null,
  };
}

async function writeLockAuditEvent(params: {
  platform: Platform;
  action: string;
  actorUserId?: number | null;
  chatConfigId: number;
  source: DestinationLockSource;
  reason: string | null;
  durationMinutes?: number;
}) {
  await recordAuditEvent({
    ownerUserId: params.platform.userId,
    actorUserId: params.actorUserId ?? null,
    action: params.action,
    targetType: "chat_configuration",
    targetId: String(params.chatConfigId),
    details: {
      platformType: params.platform.type,
      platformId: params.platform.id,
      source: params.source,
      reason: params.reason,
      durationMinutes: params.durationMinutes,
    },
  });
}

async function createFailedLockRecord(params: {
  chatConfig: ChatConfiguration;
  platform: Platform;
  source: DestinationLockSource;
  actor?: DestinationLockActor;
  durationMinutes: number;
  reason: string | null;
  warning: string;
  metadata?: Record<string, unknown>;
}): Promise<DestinationLock> {
  const now = new Date();
  const endsAt = new Date(now.getTime() + params.durationMinutes * 60 * 1000);
  return storage.createDestinationLock({
    chatConfigurationId: params.chatConfig.id,
    platformId: params.platform.id,
    platformType: params.platform.type,
    destinationExternalId: params.chatConfig.externalId,
    status: "failed",
    source: params.source,
    reason: params.reason,
    requestedByUserId: params.actor?.requestedByUserId ?? null,
    requestedByPlatformUserId: params.actor?.requestedByPlatformUserId ?? null,
    requestedByPlatformUsername: params.actor?.requestedByPlatformUsername ?? null,
    startedAt: now,
    endsAt,
    releasedAt: now,
    releaseReason: params.warning,
    permissionSnapshot: {},
    noticeChannelExternalId: null,
    metadata: params.metadata ?? {},
  });
}

export async function createOrExtendDestinationLock(params: {
  chatConfig: ChatConfiguration;
  platform: Platform;
  source: DestinationLockSource;
  durationMinutes: number;
  reason?: string | null;
  actor?: DestinationLockActor;
  adapter: DestinationLockAdapter;
  metadata?: Record<string, unknown>;
}): Promise<{
  ok: boolean;
  warning?: string;
  lock?: DestinationLock;
  extended?: boolean;
  alreadyLocked?: boolean;
}> {
  if (!botTimedLocksEnabled) {
    return { ok: false, warning: "Timed locking is disabled." };
  }

  const durationMinutes = clampDurationMinutes(params.durationMinutes);
  const reason = params.reason ? String(params.reason).trim() : null;
  const now = new Date();
  const requestedEndsAt = new Date(now.getTime() + durationMinutes * 60 * 1000);

  const activeLock = await storage.getActiveDestinationLockByChatConfiguration(params.chatConfig.id);
  if (activeLock) {
    const currentEndsAtMs = new Date(activeLock.endsAt).getTime();
    if (currentEndsAtMs >= requestedEndsAt.getTime()) {
      await applyManualOverridePause(params.chatConfig, params.source);
      return { ok: true, lock: activeLock, alreadyLocked: true, extended: false };
    }

    const updated = await storage.updateDestinationLock(activeLock.id, {
      endsAt: requestedEndsAt,
      reason: reason ?? activeLock.reason,
      metadata: {
        ...(activeLock.metadata as Record<string, unknown> | undefined),
        ...(params.metadata ?? {}),
      },
    });
    const resultLock = updated ?? activeLock;
    recordOpsEvent("DESTINATION_LOCK_EXTENDED", {
      platformType: params.platform.type,
      platformId: params.platform.id,
      chatConfigurationId: params.chatConfig.id,
      destinationExternalId: params.chatConfig.externalId,
      source: params.source,
    });
    await writeLockAuditEvent({
      platform: params.platform,
      action: "integration.destination_locked",
      actorUserId: params.actor?.requestedByUserId ?? null,
      chatConfigId: params.chatConfig.id,
      source: params.source,
      reason,
      durationMinutes,
    });
    await applyManualOverridePause(params.chatConfig, params.source);
    return { ok: true, lock: resultLock, alreadyLocked: true, extended: true };
  }

  const applyResult = await params.adapter.applyLock({
    chatConfig: params.chatConfig,
    platform: params.platform,
    endsAt: requestedEndsAt,
    source: params.source,
    reason,
  });

  if (!applyResult.ok) {
    const failed = await createFailedLockRecord({
      chatConfig: params.chatConfig,
      platform: params.platform,
      source: params.source,
      actor: params.actor,
      durationMinutes,
      reason,
      warning: applyResult.warning ?? "Failed to apply destination lock",
      metadata: params.metadata,
    });
    recordOpsEvent("DESTINATION_LOCK_APPLY_FAILED", {
      platformType: params.platform.type,
      platformId: params.platform.id,
      chatConfigurationId: params.chatConfig.id,
      destinationExternalId: params.chatConfig.externalId,
      source: params.source,
      reason: applyResult.warning ?? "unknown",
    });
    return { ok: false, warning: applyResult.warning, lock: failed };
  }

  const created = await storage.createDestinationLock({
    chatConfigurationId: params.chatConfig.id,
    platformId: params.platform.id,
    platformType: params.platform.type,
    destinationExternalId: params.chatConfig.externalId,
    status: "active",
    source: params.source,
    reason,
    requestedByUserId: params.actor?.requestedByUserId ?? null,
    requestedByPlatformUserId: params.actor?.requestedByPlatformUserId ?? null,
    requestedByPlatformUsername: params.actor?.requestedByPlatformUsername ?? null,
    startedAt: now,
    endsAt: requestedEndsAt,
    permissionSnapshot: applyResult.permissionSnapshot ?? {},
    noticeChannelExternalId: applyResult.noticeChannelExternalId ?? null,
    metadata: params.metadata ?? {},
  });

  recordOpsEvent("DESTINATION_LOCK_APPLY", {
    platformType: params.platform.type,
    platformId: params.platform.id,
    chatConfigurationId: params.chatConfig.id,
    destinationExternalId: params.chatConfig.externalId,
    source: params.source,
  });

  await writeLockAuditEvent({
    platform: params.platform,
    action: params.source === "auto" ? "integration.destination_lock_auto" : "integration.destination_locked",
    actorUserId: params.actor?.requestedByUserId ?? null,
    chatConfigId: params.chatConfig.id,
    source: params.source,
    reason,
    durationMinutes,
  });

  await applyManualOverridePause(params.chatConfig, params.source);
  return { ok: true, lock: created, extended: false, alreadyLocked: false };
}

export async function unlockDestinationByChatConfiguration(params: {
  chatConfig: ChatConfiguration;
  platform: Platform;
  adapter: DestinationLockAdapter;
  reason?: string | null;
  actorUserId?: number | null;
  source?: DestinationLockSource;
}): Promise<{ ok: boolean; warning?: string; lock?: DestinationLock; alreadyUnlocked?: boolean }> {
  const unlockSource = params.source ?? "manual_app";
  const activeLock = await storage.getActiveDestinationLockByChatConfiguration(params.chatConfig.id);
  if (!activeLock) {
    await applyManualOverridePause(params.chatConfig, unlockSource);
    return { ok: true, alreadyUnlocked: true };
  }

  const releaseReason = params.reason ? String(params.reason).trim() : "Unlocked manually";
  const releaseResult = await params.adapter.releaseLock({
    chatConfig: params.chatConfig,
    platform: params.platform,
    lock: activeLock,
    releaseReason,
  });

  if (!releaseResult.ok) {
    recordOpsEvent("DESTINATION_UNLOCK_FAILED", {
      platformType: params.platform.type,
      platformId: params.platform.id,
      chatConfigurationId: params.chatConfig.id,
      destinationExternalId: params.chatConfig.externalId,
      reason: releaseResult.warning ?? "unknown",
    });
    return { ok: false, warning: releaseResult.warning, lock: activeLock };
  }

  const updated = await storage.updateDestinationLock(activeLock.id, {
    status: "released",
    releasedAt: new Date(),
    releaseReason,
  });

  recordOpsEvent("DESTINATION_UNLOCK", {
    platformType: params.platform.type,
    platformId: params.platform.id,
    chatConfigurationId: params.chatConfig.id,
    destinationExternalId: params.chatConfig.externalId,
  });

  await writeLockAuditEvent({
    platform: params.platform,
    action: "integration.destination_unlocked",
    actorUserId: params.actorUserId ?? null,
    chatConfigId: params.chatConfig.id,
    source: unlockSource,
    reason: releaseReason,
  });

  await applyManualOverridePause(params.chatConfig, unlockSource);
  return { ok: true, lock: updated ?? activeLock };
}

export async function unlockAllDestinationsForPlatform(params: {
  platform: Platform;
  adapter: DestinationLockAdapter;
  reason?: string | null;
  actorUserId?: number | null;
}): Promise<{ total: number; unlocked: number; failed: number; warnings: string[] }> {
  const locks = await storage.getActiveDestinationLocksByPlatform(params.platform.id);
  if (locks.length === 0) {
    return { total: 0, unlocked: 0, failed: 0, warnings: [] };
  }

  let unlocked = 0;
  let failed = 0;
  const warnings: string[] = [];
  const reason = params.reason ? String(params.reason).trim() : "Unlocked all destinations";

  for (const lock of locks) {
    const chatConfig = await storage.getChatConfiguration(lock.chatConfigurationId);
    if (!chatConfig) {
      failed += 1;
      warnings.push(`Configuration ${lock.chatConfigurationId} no longer exists.`);
      continue;
    }

    const released = await unlockDestinationByChatConfiguration({
      chatConfig,
      platform: params.platform,
      adapter: params.adapter,
      reason,
      actorUserId: params.actorUserId ?? null,
    });
    if (released.ok) {
      unlocked += 1;
    } else {
      failed += 1;
      warnings.push(released.warning ?? `Failed to unlock ${chatConfig.chatName || chatConfig.externalId}`);
    }
  }

  recordOpsEvent("DESTINATION_UNLOCK_ALL", {
    platformType: params.platform.type,
    platformId: params.platform.id,
    total: locks.length,
    unlocked,
    failed,
  });

  await recordAuditEvent({
    ownerUserId: params.platform.userId,
    actorUserId: params.actorUserId ?? null,
    action: "integration.destination_unlock_all",
    targetType: "platform",
    targetId: String(params.platform.id),
    details: {
      platformType: params.platform.type,
      total: locks.length,
      unlocked,
      failed,
      reason,
    },
  });

  return {
    total: locks.length,
    unlocked,
    failed,
    warnings,
  };
}

export async function recordModerationHitAndMaybeAutoLock(params: {
  chatConfig: ChatConfiguration;
  platform: Platform;
  adapter: DestinationLockAdapter;
  metadata?: Record<string, unknown>;
}): Promise<{ triggered: boolean; lock?: DestinationLock; warning?: string; hitCount: number }> {
  await storage.createDestinationModerationHit({
    chatConfigurationId: params.chatConfig.id,
    platformId: params.platform.id,
    platformType: params.platform.type,
    destinationExternalId: params.chatConfig.externalId,
    metadata: params.metadata ?? {},
  });

  const lockSettings = normalizeLockSettings(params.chatConfig.settings);
  const since = new Date(Date.now() - lockSettings.windowMinutes * 60 * 1000);
  const hitCount = await storage.countDestinationModerationHitsSince(params.chatConfig.id, since);

  return { triggered: false, hitCount };
}

export async function reconcileScheduledLockForChatConfiguration(params: {
  chatConfig: ChatConfiguration;
  platform: Platform;
  adapter: DestinationLockAdapter;
  now?: Date;
}): Promise<{ action: "applied" | "released" | "none" | "failed" | "skipped_paused"; warning?: string }> {
  if (!botTimedLocksEnabled || !botAutoLocksEnabled) {
    return { action: "none" };
  }

  const now = params.now ?? new Date();
  const lockSettings = normalizeLockSettings(params.chatConfig.settings);
  const activeLock = await storage.getActiveDestinationLockByChatConfiguration(params.chatConfig.id);

  if (!lockSettings.scheduleEnabled) {
    if (activeLock && isScheduledAutoLock(activeLock)) {
      const released = await unlockDestinationByChatConfiguration({
        chatConfig: params.chatConfig,
        platform: params.platform,
        adapter: params.adapter,
        reason: "Scheduled lock disabled.",
        actorUserId: null,
        source: "auto",
      });
      if (!released.ok) return { action: "failed", warning: released.warning };
      recordOpsEvent("DESTINATION_LOCK_SCHEDULE_RELEASED", {
        platformType: params.platform.type,
        platformId: params.platform.id,
        chatConfigurationId: params.chatConfig.id,
        destinationExternalId: params.chatConfig.externalId,
        reason: "schedule_disabled",
      });
      return { action: "released" };
    }
    return { action: "none" };
  }

  if (lockSettings.schedulePaused) {
    if (activeLock && isScheduledAutoLock(activeLock)) {
      const released = await unlockDestinationByChatConfiguration({
        chatConfig: params.chatConfig,
        platform: params.platform,
        adapter: params.adapter,
        reason: "Scheduled lock paused.",
        actorUserId: null,
        source: "auto",
      });
      if (!released.ok) return { action: "failed", warning: released.warning };
      recordOpsEvent("DESTINATION_LOCK_SCHEDULE_RELEASED", {
        platformType: params.platform.type,
        platformId: params.platform.id,
        chatConfigurationId: params.chatConfig.id,
        destinationExternalId: params.chatConfig.externalId,
        reason: "schedule_paused",
      });
    } else {
      recordOpsEvent("DESTINATION_LOCK_SCHEDULE_SKIPPED_PAUSED", {
        platformType: params.platform.type,
        platformId: params.platform.id,
        chatConfigurationId: params.chatConfig.id,
        destinationExternalId: params.chatConfig.externalId,
      });
    }
    return { action: "skipped_paused" };
  }

  const activeWindowEnd = resolveActiveScheduleWindowEnd(now, lockSettings);
  if (!activeWindowEnd) {
    if (activeLock && isScheduledAutoLock(activeLock)) {
      const released = await unlockDestinationByChatConfiguration({
        chatConfig: params.chatConfig,
        platform: params.platform,
        adapter: params.adapter,
        reason: "Scheduled lock window ended.",
        actorUserId: null,
        source: "auto",
      });
      if (!released.ok) return { action: "failed", warning: released.warning };
      recordOpsEvent("DESTINATION_LOCK_SCHEDULE_RELEASED", {
        platformType: params.platform.type,
        platformId: params.platform.id,
        chatConfigurationId: params.chatConfig.id,
        destinationExternalId: params.chatConfig.externalId,
        reason: "window_ended",
      });
      return { action: "released" };
    }
    return { action: "none" };
  }

  const durationMinutes = Math.max(1, Math.ceil((activeWindowEnd.getTime() - now.getTime()) / 60_000));
  const lockResult = await createOrExtendDestinationLock({
    chatConfig: params.chatConfig,
    platform: params.platform,
    source: "auto",
    durationMinutes,
    reason: "Scheduled auto-lock window active.",
    adapter: params.adapter,
    metadata: {
      lockMode: "scheduled_auto",
      scheduleTimezone: lockSettings.timezone,
      scheduleEnabled: true,
      scheduleCount: lockSettings.schedules.length,
    },
  });

  if (!lockResult.ok) {
    return { action: "failed", warning: lockResult.warning };
  }

  recordOpsEvent("DESTINATION_LOCK_SCHEDULE_APPLIED", {
    platformType: params.platform.type,
    platformId: params.platform.id,
    chatConfigurationId: params.chatConfig.id,
    destinationExternalId: params.chatConfig.externalId,
    durationMinutes,
    extended: lockResult.extended === true,
  });
  return { action: "applied" };
}

export async function runScheduledAutoLockSweep(resolveAdapter: LockSweepResolver): Promise<{
  processed: number;
  applied: number;
  released: number;
  failed: number;
  skippedPaused: number;
}> {
  if (!botTimedLocksEnabled || !botAutoLocksEnabled) {
    return { processed: 0, applied: 0, released: 0, failed: 0, skippedPaused: 0 };
  }
  if (scheduledSweepInFlight) {
    return { processed: 0, applied: 0, released: 0, failed: 0, skippedPaused: 0 };
  }

  scheduledSweepInFlight = true;
  try {
    const [telegramPlatforms, discordPlatforms] = await Promise.all([
      storage.getPlatformsByType("telegram"),
      storage.getPlatformsByType("discord"),
    ]);
    const platforms = [...telegramPlatforms, ...discordPlatforms];

    let processed = 0;
    let applied = 0;
    let released = 0;
    let failed = 0;
    let skippedPaused = 0;

    for (const platform of platforms) {
      const adapter = resolveAdapter(platform.type);
      if (!adapter) continue;
      const chatConfigs = await storage.getChatConfigurationsByPlatformId(platform.id);
      for (const chatConfig of chatConfigs) {
        processed += 1;
        const result = await reconcileScheduledLockForChatConfiguration({
          chatConfig,
          platform,
          adapter,
        });
        if (result.action === "applied") applied += 1;
        else if (result.action === "released") released += 1;
        else if (result.action === "failed") failed += 1;
        else if (result.action === "skipped_paused") skippedPaused += 1;
      }
    }

    if (processed > 0) {
      recordOpsEvent("DESTINATION_LOCK_SCHEDULE_RECONCILED", {
        processed,
        applied,
        released,
        failed,
        skippedPaused,
      });
    }

    return { processed, applied, released, failed, skippedPaused };
  } finally {
    scheduledSweepInFlight = false;
  }
}

export async function runDestinationLockSweep(resolveAdapter: LockSweepResolver): Promise<{
  processed: number;
  unlocked: number;
  failed: number;
}> {
  if (!botTimedLocksEnabled) {
    return { processed: 0, unlocked: 0, failed: 0 };
  }

  if (lockSweepInFlight) {
    return { processed: 0, unlocked: 0, failed: 0 };
  }

  lockSweepInFlight = true;
  try {
    const dueLocks = await storage.getDueActiveDestinationLocks(new Date(), 250);
    let unlocked = 0;
    let failed = 0;

    for (const lock of dueLocks) {
      const chatConfig = await storage.getChatConfiguration(lock.chatConfigurationId);
      const platform = await storage.getPlatform(lock.platformId);
      if (!chatConfig || !platform) {
        await storage.updateDestinationLock(lock.id, {
          status: "failed",
          releasedAt: new Date(),
          releaseReason: "Lock target no longer exists.",
        });
        failed += 1;
        continue;
      }

      const adapter = resolveAdapter(platform.type);
      if (!adapter) {
        await storage.updateDestinationLock(lock.id, {
          status: "failed",
          releasedAt: new Date(),
          releaseReason: `No lock adapter available for platform type ${platform.type}`,
        });
        failed += 1;
        continue;
      }

      const released = await unlockDestinationByChatConfiguration({
        chatConfig,
        platform,
        adapter,
        reason: "Timed lock expired",
        actorUserId: null,
        source: lock.source as DestinationLockSource,
      });

      if (released.ok) {
        unlocked += 1;
      } else {
        failed += 1;
      }
    }

    return {
      processed: dueLocks.length,
      unlocked,
      failed,
    };
  } finally {
    lockSweepInFlight = false;
  }
}

export function scheduleDestinationLockSweep(
  resolveAdapter: LockSweepResolver,
  logFn: (line: string) => void,
): NodeJS.Timeout {
  const run = async () => {
    try {
      const result = await runDestinationLockSweep(resolveAdapter);
      if (result.processed > 0) {
        logFn(
          `destination lock sweep: processed=${result.processed}, unlocked=${result.unlocked}, failed=${result.failed}`,
        );
      }
    } catch (error: any) {
      logFn(`destination lock sweep error: ${error?.message || "unknown error"}`);
    }
  };

  setTimeout(() => {
    void run();
  }, 15_000);

  return setInterval(() => {
    void run();
  }, botLockSweepIntervalMs);
}

export function scheduleScheduledAutoLockSweep(
  resolveAdapter: LockSweepResolver,
  logFn: (line: string) => void,
): NodeJS.Timeout {
  const run = async () => {
    try {
      const result = await runScheduledAutoLockSweep(resolveAdapter);
      if (result.processed > 0) {
        logFn(
          `scheduled auto-lock sweep: processed=${result.processed}, applied=${result.applied}, released=${result.released}, failed=${result.failed}, paused=${result.skippedPaused}`,
        );
      }
    } catch (error: any) {
      logFn(`scheduled auto-lock sweep error: ${error?.message || "unknown error"}`);
    }
  };

  setTimeout(() => {
    void run();
  }, 10_000);

  return setInterval(() => {
    void run();
  }, botLockSweepIntervalMs);
}
