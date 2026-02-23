import { chatConfigurations, chatHistory, conversations, messages } from "@shared/schema";
import type { ChatConfiguration, Platform } from "@shared/schema";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import { recordOpsEvent } from "./ops-monitor";
import {
  adminHistoryBackfillMaxDays,
  adminHistoryBackfillMaxMessagesPerDestination,
  adminHistoryBackfillOnStartupEnabled,
} from "../config/runtime-flags";
import { isTelegramUserTrainingAdmin } from "./telegram";
import { isDiscordUserTrainingAdmin } from "./discord";

type BackfillResult = {
  processedDestinations: number;
  inserted: number;
  skippedAmbiguous: number;
  skippedDuplicates: number;
  errors: number;
  skipped: boolean;
};

type RunAdminHistoryBackfillOptions = {
  force?: boolean;
  source?: "startup" | "manual";
  bypassStartupFlag?: boolean;
};

export type AdminHistoryBackfillTriggerResult = {
  status: "started" | "already_running" | "already_completed";
  force: boolean;
  runId: number | null;
  message: string;
  canForce?: boolean;
};

type BackfillDestinationSummary = {
  runId: number;
  recordedAt: string;
  platformType: "telegram" | "discord";
  platformId: number;
  chatConfigurationId: number;
  destinationExternalId: string;
  scanned: number;
  inserted: number;
  skippedAmbiguous: number;
  skippedDuplicates: number;
  errors: number;
  missingInventory: boolean;
};

type BackfillDebugState = {
  enabled: boolean;
  running: boolean;
  hasRun: boolean;
  runCount: number;
  currentRunId: number | null;
  lastStartedAt: string | null;
  lastCompletedAt: string | null;
  lastError: string | null;
  lastResult: BackfillResult | null;
  currentProgress: {
    processedDestinations: number;
    inserted: number;
    skippedAmbiguous: number;
    skippedDuplicates: number;
    errors: number;
  } | null;
  config: {
    maxDays: number;
    maxMessagesPerDestination: number;
  };
  recentDestinations: BackfillDestinationSummary[];
};

type JoinedMessageRow = {
  message: typeof messages.$inferSelect;
  conversation: typeof conversations.$inferSelect;
};

let backfillHasRun = false;
let backfillRunning = false;
let backfillRunCounter = 0;
const MAX_DEBUG_DESTINATION_ROWS = 100;
const backfillDebugState: BackfillDebugState = {
  enabled: adminHistoryBackfillOnStartupEnabled,
  running: false,
  hasRun: false,
  runCount: 0,
  currentRunId: null,
  lastStartedAt: null,
  lastCompletedAt: null,
  lastError: null,
  lastResult: null,
  currentProgress: null,
  config: {
    maxDays: adminHistoryBackfillMaxDays,
    maxMessagesPerDestination: adminHistoryBackfillMaxMessagesPerDestination,
  },
  recentDestinations: [],
};

function pushBackfillDestinationSummary(entry: BackfillDestinationSummary): void {
  backfillDebugState.recentDestinations.unshift(entry);
  if (backfillDebugState.recentDestinations.length > MAX_DEBUG_DESTINATION_ROWS) {
    backfillDebugState.recentDestinations.length = MAX_DEBUG_DESTINATION_ROWS;
  }
}

export function getAdminHistoryBackfillDebugState(): BackfillDebugState {
  return {
    ...backfillDebugState,
    config: { ...backfillDebugState.config },
    currentProgress: backfillDebugState.currentProgress ? { ...backfillDebugState.currentProgress } : null,
    lastResult: backfillDebugState.lastResult ? { ...backfillDebugState.lastResult } : null,
    recentDestinations: backfillDebugState.recentDestinations.map((item) => ({ ...item })),
  };
}

function skippedBackfillResult(): BackfillResult {
  return {
    processedDestinations: 0,
    inserted: 0,
    skippedAmbiguous: 0,
    skippedDuplicates: 0,
    errors: 0,
    skipped: true,
  };
}

function safeString(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : null;
}

function extractMessageMetadata(messageRow: typeof messages.$inferSelect): Record<string, any> {
  return messageRow.metadata && typeof messageRow.metadata === "object"
    ? (messageRow.metadata as Record<string, any>)
    : {};
}

function resolveSentAt(messageRow: typeof messages.$inferSelect): Date {
  const metadata = extractMessageMetadata(messageRow);
  const timestamp = metadata.timestamp;
  if (typeof timestamp === "number" && Number.isFinite(timestamp)) {
    const isSeconds = timestamp < 10_000_000_000;
    const date = new Date(isSeconds ? timestamp * 1000 : timestamp);
    if (Number.isFinite(date.getTime())) return date;
  }
  if (typeof timestamp === "string") {
    const date = new Date(timestamp);
    if (Number.isFinite(date.getTime())) return date;
  }
  return new Date(messageRow.createdAt);
}

function isHistoryLearningEligible(chatConfig: ChatConfiguration): boolean {
  const settings = (chatConfig.settings as any) ?? {};
  return settings.enableHistoryLearning === true || settings.adminLearningMode === true;
}

function getDiscordGuildChannelIdsForChatConfig(platform: Platform, guildId: string): string[] {
  const platformConfig = (platform.config as any) ?? {};
  const channels = Array.isArray(platformConfig.channels) ? platformConfig.channels : [];
  const channelIds = channels
    .filter((channel: any) => String(channel?.guildId ?? "").trim() === guildId)
    .map((channel: any) => String(channel?.id ?? "").trim())
    .filter(Boolean);
  return Array.from(new Set(channelIds));
}

async function getTelegramBackfillRows(platformId: number, chatExternalId: string, since: Date, limit: number): Promise<JoinedMessageRow[]> {
  return db
    .select({ message: messages, conversation: conversations })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(and(
      eq(conversations.platformId, platformId),
      eq(conversations.externalId, chatExternalId),
      eq(messages.sender, "user"),
      gte(messages.createdAt, since),
    ))
    .orderBy(desc(messages.createdAt))
    .limit(limit);
}

async function getDiscordBackfillRows(
  platformId: number,
  channelIds: string[],
  since: Date,
  limit: number,
): Promise<JoinedMessageRow[]> {
  if (channelIds.length === 0) return [];
  return db
    .select({ message: messages, conversation: conversations })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(and(
      eq(conversations.platformId, platformId),
      inArray(conversations.externalId, channelIds),
      eq(messages.sender, "user"),
      gte(messages.createdAt, since),
    ))
    .orderBy(desc(messages.createdAt))
    .limit(limit);
}

async function insertBackfilledChatHistoryRow(params: {
  chatConfig: ChatConfiguration;
  platform: Platform;
  row: JoinedMessageRow;
  isAdmin: boolean;
}): Promise<"inserted" | "duplicate" | "ambiguous"> {
  const { chatConfig, platform, row, isAdmin } = params;
  const metadata = extractMessageMetadata(row.message);
  const externalUserId = safeString(row.conversation.externalUserId) ?? safeString(metadata.userId);
  const content = safeString(row.message.content);
  if (!externalUserId || !content) {
    return "ambiguous";
  }

  const externalUsername = safeString(row.conversation.externalUsername) ?? safeString(metadata.username);
  const externalMessageId = safeString(metadata.messageId);
  const sentAt = resolveSentAt(row.message);

  const threadContext =
    platform.type === "telegram"
      ? {
          chatId: chatConfig.externalId,
          backfilled: true,
          sourceConversationId: row.conversation.id,
        }
      : {
          guildId: chatConfig.externalId,
          channelId: row.conversation.externalId,
          channelName: safeString(metadata.channelName),
          backfilled: true,
          sourceConversationId: row.conversation.id,
        };

  const inserted = await db
    .insert(chatHistory)
    .values({
      chatConfigurationId: chatConfig.id,
      platformId: platform.id,
      sourceMessageId: row.message.id,
      externalUserId,
      externalUsername,
      messageId: externalMessageId,
      content,
      messageType: isAdmin ? "admin" : "user",
      isAdmin,
      replyToMessageId: safeString(metadata.replyToMessageId),
      threadContext,
      metadata: {
        ...metadata,
        backfilled: true,
        originalMessageCreatedAt: row.message.createdAt,
      },
      sentAt,
      isUsedForTraining: false,
    })
    .onConflictDoNothing()
    .returning({ id: chatHistory.id });

  return inserted.length > 0 ? "inserted" : "duplicate";
}

async function backfillTelegramDestination(chatConfig: ChatConfiguration, platform: Platform, since: Date, limit: number) {
  const rows = await getTelegramBackfillRows(platform.id, chatConfig.externalId, since, limit);
  let inserted = 0;
  let skippedAmbiguous = 0;
  let skippedDuplicates = 0;
  let errors = 0;

  for (const row of rows.reverse()) {
    try {
      const externalUserId = safeString(row.conversation.externalUserId) ?? safeString(extractMessageMetadata(row.message).userId);
      if (!externalUserId) {
        skippedAmbiguous += 1;
        recordOpsEvent("ADMIN_HISTORY_BACKFILL_ROW_SKIPPED_AMBIGUOUS", {
          platformType: "telegram",
          platformId: platform.id,
          chatConfigurationId: chatConfig.id,
          destinationExternalId: chatConfig.externalId,
          messageId: row.message.id,
          reason: "missing_external_user_id",
        });
        continue;
      }

      const isAdmin = await isTelegramUserTrainingAdmin({
        platformId: platform.id,
        chatId: chatConfig.externalId,
        userId: externalUserId,
      });

      const result = await insertBackfilledChatHistoryRow({ chatConfig, platform, row, isAdmin });
      if (result === "inserted") inserted += 1;
      else if (result === "duplicate") skippedDuplicates += 1;
      else skippedAmbiguous += 1;
    } catch (error) {
      errors += 1;
      console.warn(`Telegram admin-history backfill row failed (chatConfig=${chatConfig.id}, msg=${row.message.id}):`, error);
    }
  }

  return { inserted, skippedAmbiguous, skippedDuplicates, errors, scanned: rows.length };
}

async function backfillDiscordDestination(chatConfig: ChatConfiguration, platform: Platform, since: Date, limit: number) {
  const guildId = String(chatConfig.externalId ?? "").trim();
  const channelIds = getDiscordGuildChannelIdsForChatConfig(platform, guildId);
  if (channelIds.length === 0) {
    return { inserted: 0, skippedAmbiguous: 0, skippedDuplicates: 0, errors: 0, scanned: 0, missingInventory: true };
  }

  const rows = await getDiscordBackfillRows(platform.id, channelIds, since, limit);
  let inserted = 0;
  let skippedAmbiguous = 0;
  let skippedDuplicates = 0;
  let errors = 0;

  for (const row of rows.reverse()) {
    try {
      const externalUserId = safeString(row.conversation.externalUserId) ?? safeString(extractMessageMetadata(row.message).userId);
      if (!externalUserId) {
        skippedAmbiguous += 1;
        recordOpsEvent("ADMIN_HISTORY_BACKFILL_ROW_SKIPPED_AMBIGUOUS", {
          platformType: "discord",
          platformId: platform.id,
          chatConfigurationId: chatConfig.id,
          destinationExternalId: guildId,
          messageId: row.message.id,
          reason: "missing_external_user_id",
        });
        continue;
      }

      const isAdmin = await isDiscordUserTrainingAdmin({
        platformId: platform.id,
        guildId,
        userId: externalUserId,
      });

      const result = await insertBackfilledChatHistoryRow({ chatConfig, platform, row, isAdmin });
      if (result === "inserted") inserted += 1;
      else if (result === "duplicate") skippedDuplicates += 1;
      else skippedAmbiguous += 1;
    } catch (error) {
      errors += 1;
      console.warn(`Discord admin-history backfill row failed (chatConfig=${chatConfig.id}, msg=${row.message.id}):`, error);
    }
  }

  return { inserted, skippedAmbiguous, skippedDuplicates, errors, scanned: rows.length, missingInventory: false };
}

export async function runAdminHistoryBackfill(options: RunAdminHistoryBackfillOptions = {}): Promise<BackfillResult> {
  const {
    force = false,
    source = "startup",
    bypassStartupFlag = false,
  } = options;

  if (!bypassStartupFlag && !adminHistoryBackfillOnStartupEnabled) {
    return skippedBackfillResult();
  }

  if (backfillRunning) {
    return skippedBackfillResult();
  }

  if (backfillHasRun && !force) {
    return skippedBackfillResult();
  }

  backfillRunning = true;
  backfillRunCounter += 1;
  backfillDebugState.running = true;
  backfillDebugState.currentRunId = backfillRunCounter;
  backfillDebugState.lastStartedAt = new Date().toISOString();
  backfillDebugState.lastError = null;
  backfillDebugState.currentProgress = {
    processedDestinations: 0,
    inserted: 0,
    skippedAmbiguous: 0,
    skippedDuplicates: 0,
    errors: 0,
  };
  recordOpsEvent("ADMIN_HISTORY_BACKFILL_STARTED", {
    maxDays: adminHistoryBackfillMaxDays,
    maxMessagesPerDestination: adminHistoryBackfillMaxMessagesPerDestination,
    source,
    forced: force,
  });

  try {
    const since = new Date(Date.now() - adminHistoryBackfillMaxDays * 24 * 60 * 60 * 1000);
    const result: BackfillResult = {
      processedDestinations: 0,
      inserted: 0,
      skippedAmbiguous: 0,
      skippedDuplicates: 0,
      errors: 0,
      skipped: false,
    };

    for (const platformType of ["telegram", "discord"] as const) {
      const typedPlatforms = (await storage.getPlatformsByType(platformType)).filter(
        (platform) => platform.status === "active" && Number.isFinite(Number(platform.userId)),
      );

      for (const platform of typedPlatforms) {
        const configs = await storage.getChatConfigurationsByPlatformId(platform.id);
        for (const chatConfig of configs) {
          if (!isHistoryLearningEligible(chatConfig)) continue;
          result.processedDestinations += 1;

          let destinationSummary:
            | { inserted: number; skippedAmbiguous: number; skippedDuplicates: number; errors: number; scanned: number; missingInventory?: boolean };
          if (platformType === "telegram") {
            destinationSummary = await backfillTelegramDestination(
              chatConfig,
              platform,
              since,
              adminHistoryBackfillMaxMessagesPerDestination,
            );
          } else {
            destinationSummary = await backfillDiscordDestination(
              chatConfig,
              platform,
              since,
              adminHistoryBackfillMaxMessagesPerDestination,
            );
          }

          result.inserted += destinationSummary.inserted;
          result.skippedAmbiguous += destinationSummary.skippedAmbiguous;
          result.skippedDuplicates += destinationSummary.skippedDuplicates;
          result.errors += destinationSummary.errors;
          backfillDebugState.currentProgress = {
            processedDestinations: result.processedDestinations,
            inserted: result.inserted,
            skippedAmbiguous: result.skippedAmbiguous,
            skippedDuplicates: result.skippedDuplicates,
            errors: result.errors,
          };

          pushBackfillDestinationSummary({
            runId: backfillRunCounter,
            recordedAt: new Date().toISOString(),
            platformType,
            platformId: platform.id,
            chatConfigurationId: chatConfig.id,
            destinationExternalId: chatConfig.externalId,
            scanned: destinationSummary.scanned,
            inserted: destinationSummary.inserted,
            skippedAmbiguous: destinationSummary.skippedAmbiguous,
            skippedDuplicates: destinationSummary.skippedDuplicates,
            errors: destinationSummary.errors,
            missingInventory: destinationSummary.missingInventory === true,
          });

          recordOpsEvent("ADMIN_HISTORY_BACKFILL_DESTINATION_SUMMARY", {
            platformType,
            platformId: platform.id,
            chatConfigurationId: chatConfig.id,
            destinationExternalId: chatConfig.externalId,
            scanned: destinationSummary.scanned,
            inserted: destinationSummary.inserted,
            skippedAmbiguous: destinationSummary.skippedAmbiguous,
            skippedDuplicates: destinationSummary.skippedDuplicates,
            errors: destinationSummary.errors,
            missingInventory: destinationSummary.missingInventory === true,
          });
        }
      }
    }

    backfillHasRun = true;
    backfillDebugState.hasRun = true;
    backfillDebugState.runCount = backfillRunCounter;
    backfillDebugState.lastCompletedAt = new Date().toISOString();
    backfillDebugState.lastResult = { ...result };
    recordOpsEvent("ADMIN_HISTORY_BACKFILL_COMPLETED", {
      processedDestinations: result.processedDestinations,
      inserted: result.inserted,
      skippedAmbiguous: result.skippedAmbiguous,
      skippedDuplicates: result.skippedDuplicates,
      errors: result.errors,
    });

    return result;
  } catch (error) {
    backfillDebugState.lastError = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    backfillRunning = false;
    backfillDebugState.running = false;
    backfillDebugState.currentRunId = null;
    backfillDebugState.currentProgress = null;
  }
}

export function triggerAdminHistoryBackfill(options: { force?: boolean; source?: "startup" | "manual" } = {}): AdminHistoryBackfillTriggerResult {
  const force = options.force === true;
  const source = options.source ?? "manual";

  if (backfillRunning) {
    if (source === "manual") {
      recordOpsEvent("ADMIN_HISTORY_BACKFILL_MANUAL_TRIGGER_SKIPPED_RUNNING", {
        currentRunId: backfillDebugState.currentRunId,
      });
    }
    return {
      status: "already_running",
      force,
      runId: backfillDebugState.currentRunId ?? null,
      message: "Admin-history backfill is already running.",
    };
  }

  if (backfillHasRun && !force) {
    if (source === "manual") {
      recordOpsEvent("ADMIN_HISTORY_BACKFILL_MANUAL_TRIGGER_SKIPPED_COMPLETED", {
        runCount: backfillRunCounter,
      });
    }
    return {
      status: "already_completed",
      force,
      runId: null,
      canForce: true,
      message: "Admin-history backfill has already completed for this app process.",
    };
  }

  const nextRunId = backfillRunCounter + 1;

  if (source === "manual") {
    recordOpsEvent("ADMIN_HISTORY_BACKFILL_MANUAL_TRIGGERED", { force });
    if (force) {
      recordOpsEvent("ADMIN_HISTORY_BACKFILL_MANUAL_TRIGGER_FORCED", { previousRunCount: backfillRunCounter });
    }
  }

  void runAdminHistoryBackfill({
    force,
    source,
    bypassStartupFlag: source === "manual",
  }).catch((error) => {
    console.warn("Admin-history backfill trigger failed:", error);
  });

  return {
    status: "started",
    force,
    runId: nextRunId,
    message: force
      ? "Admin-history backfill re-run started (force mode)."
      : "Admin-history backfill started.",
  };
}

export function scheduleAdminHistoryBackfillOnStartup(logFn: (line: string) => void): NodeJS.Timeout | null {
  if (!adminHistoryBackfillOnStartupEnabled) {
    logFn("admin-history backfill disabled");
    return null;
  }

  return setTimeout(() => {
    void (async () => {
      try {
        const result = await runAdminHistoryBackfill({ source: "startup" });
        if (!result.skipped) {
          logFn(
            `admin-history backfill: destinations=${result.processedDestinations}, inserted=${result.inserted}, duplicates=${result.skippedDuplicates}, ambiguous=${result.skippedAmbiguous}, errors=${result.errors}`,
          );
        }
      } catch (error: any) {
        logFn(`admin-history backfill error: ${error?.message || "unknown error"}`);
      }
    })();
  }, 60_000);
}
