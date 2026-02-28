import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { randomInt } from "crypto";
import multer from "multer";
import { storage } from "./storage";
import { db } from "./db";
import { and, asc, count, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { 
  generateAIResponse, 
  generateKnowledgeBasedResponse, 
  trainOnConversations,
  generateImprovedSystemPrompt
} from "./lib/openai";
import {
  initializeBot as initializeTelegramBot,
  disconnectBot as disconnectTelegramBot,
  initializeAllBots as initializeAllTelegramBots,
  startAppOwnedBot as startTelegramAppOwnedBot,
  getAppOwnedBotPublicInfo as getTelegramAppOwnedBotPublicInfo,
  getTelegramDestinationLockAdapter,
} from "./lib/telegram";
import {
  initializeBot as initializeDiscordBot,
  disconnectBot as disconnectDiscordBot,
  initializeAllBots as initializeAllDiscordBots,
  refreshChannels as refreshDiscordChannels,
  exchangeDiscordAuthCode,
  startAppOwnedBot as startDiscordAppOwnedBot,
  getAppOwnedBotPublicInfo as getDiscordAppOwnedBotPublicInfo,
  getDiscoveredServersForPlatform as getDiscordDiscoveredServers,
  enableByobDiscordServer,
  syncDiscordServerConfigurations,
  getDiscordDestinationLockAdapter,
} from "./lib/discord";
import {
  adminHistoryAutoAnalysisEnabled,
  adminHistoryAutoAnalysisIntervalMs,
  adminHistoryAutoAnalysisMinNewAdminMessages,
  uiWave1RedoAllowlistEmails,
  uiWave1RedoEnabled,
  uiWave1RedoForceRoles,
  uiWave1RedoRouteScope,
  uiV2AllowlistEmails,
  uiV2Enabled,
  uiV2ForceRoles,
  uiV2RouteScope,
  adminHistoryBackfillMaxDays,
  adminHistoryBackfillMaxMessagesPerDestination,
  adminHistoryBackfillOnStartupEnabled,
  botLockMaxDurationMinutes,
  botTimedLocksEnabled,
} from "./config/runtime-flags";
import {
  getAdminHistoryBackfillDebugState,
  triggerAdminHistoryBackfill,
} from "./lib/chatHistoryBackfill";
import {
  getAdminHistoryAutoAnalysisDebugState,
} from "./lib/adminHistoryAutoAnalysis";
import { chatHistoryManager } from "./lib/chatHistoryManager";
import {
  buildLockState,
  createOrExtendDestinationLock,
  isValidIanaTimezone,
  mergeLockSettingsIntoConfig,
  normalizeLockSettings,
  reconcileScheduledLockForChatConfiguration,
  unlockAllDestinationsForPlatform,
  unlockDestinationByChatConfiguration,
} from "./lib/destination-locks";
import { getAuditEventsByAction, getAuditEventsForWorkspace, recordAuditEvent } from "./lib/audit";
import { getOpsEventSummary, recordOpsEvent } from "./lib/ops-monitor";
import {
  extractUrlContentFromUrl,
  getKnowledgeUrlSourceById,
  getKnowledgeUrlSourcesForKnowledgeBase,
  getKnowledgeUrlSyncRunById,
  getKnowledgeUrlSyncRunsBySourceId,
  normalizeKnowledgeUrlSourceInput,
  triggerKnowledgeUrlSourceSync,
} from "./lib/kb-url-sync";
import {
  getKnowledgeUploadMaxBytes,
  parseKnowledgeUploadFile,
} from "./lib/kb-file-ingest";
import { listModerationActionsForWorkspace } from "./lib/moderation-actions";
import { hashPassword, setupAuth, toSafeUser } from "./auth";
import trainingRoutes from "./routes/training";
import { registerWidgetRoutes } from "./routes/widget";
import { getWorkspaceOwnerId, hasWorkspaceRole, type WorkspaceRole } from "./workspace";
import {
  getEntitlementsForUser,
  normalizePlan,
  normalizePlanStatus,
  type Plan,
  type PlanStatus,
} from "./billing/entitlements";
import {
  canAccessAuditLog,
  canExportData,
  getAllowedModerationPresetsForUser,
  getAnalyticsTierForUser,
  getConversationHistoryWindowDaysForUser,
  getDefaultModerationPresetForUser,
  isSentimentAnalysisAvailableForUser,
  type ModerationPreset,
} from "./billing/features";
import {
  buildSeatLimitError,
  getSeatUsageForOwner,
  hasSeatCapacity,
} from "./billing/seats";
import { enforceDestinationLimit } from "./billing/destination-limits";
import { 
  insertPlatformSchema, 
  insertConversationSchema, 
  insertMessageSchema, 
  insertAiConfigurationSchema,
  insertConversationTrainingSchema,
  platforms,
  conversations,
  messages,
  messageCorrections,
  moderationActions,
  emailWhitelist,
  knowledgeBases,
  knowledgeDocuments,
  knowledgeUrlSources,
  teamInvitations,
  chatConfigurations,
  integrationClaimCodes,
  trainingInsights,
  users,
  sessions,
} from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

export async function registerRoutes(app: Express): Promise<Server> {

  // Set up authentication with Passport.js
  setupAuth(app);
  
  // Auth middleware to check if the user is authenticated
  const authMiddleware = (req: Request, res: Response, next: Function) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  };

  const isAdminRole = (role: string | undefined) => role === "admin" || role === "owner";

  const requireAdmin = (req: Request, res: Response) => {
    if (!req.user || !isAdminRole(req.user.role)) {
      res.status(403).json({ message: "Forbidden" });
      return false;
    }
    return true;
  };

  const parsePositiveInt = (value: string | undefined, fallback: number) => {
    const parsed = Number.parseInt(String(value ?? "").trim(), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return parsed;
  };

  const parseBooleanEnv = (value: string | undefined, fallback: boolean) => {
    if (value === undefined) return fallback;
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
    return fallback;
  };

  const TEMP_PASSWORD_TTL_MINUTES = 60;
  const TEMP_PASSWORD_LENGTH = 14;
  const TEMP_PASSWORD_EXPIRED_MESSAGE = "Temporary password expired. Contact your admin for a new reset.";
  const DASHBOARD_OVERVIEW_CACHE_TTL_MS = parsePositiveInt(
    process.env.DASHBOARD_OVERVIEW_CACHE_TTL_MS,
    10_000,
  );
  const dashboardOverviewCache = new Map<string, { expiresAt: number; data: unknown }>();
  const uiPerfProfile = String(process.env.UI_PERF_PROFILE ?? "balanced").trim().toLowerCase() === "full_motion"
    ? "full_motion"
    : "balanced";
  const uiV2AllowlistEmailSet = new Set(uiV2AllowlistEmails);
  const uiV2ForceRoleSet = new Set(uiV2ForceRoles);
  const hasUiV2AudienceFilters = uiV2AllowlistEmailSet.size > 0 || uiV2ForceRoleSet.size > 0;
  const uiWave1RedoAllowlistEmailSet = new Set(uiWave1RedoAllowlistEmails);
  const uiWave1RedoForceRoleSet = new Set(uiWave1RedoForceRoles);
  const hasUiWave1RedoAudienceFilters =
    uiWave1RedoAllowlistEmailSet.size > 0 || uiWave1RedoForceRoleSet.size > 0;
  const INTEGRATION_CLAIM_CODE_TTL_MINUTES = parsePositiveInt(
    process.env.INTEGRATION_CLAIM_CODE_TTL_MINUTES,
    10,
  );
  const KB_FILE_UPLOAD_MAX_BYTES = getKnowledgeUploadMaxBytes();
  const kbFileUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: KB_FILE_UPLOAD_MAX_BYTES },
  });
  const kbFileUploadSingle = (req: Request, res: Response, next: NextFunction) => {
    kbFileUpload.single("file")(req as any, res as any, (err: any) => {
      if (!err) return next();
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
          message: `File exceeds upload limit (${Math.ceil(KB_FILE_UPLOAD_MAX_BYTES / (1024 * 1024))}MB)`,
        });
      }
      return res.status(400).json({ message: err?.message || "Invalid multipart upload" });
    });
  };

  const generateTemporaryPassword = () => {
    const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const lower = "abcdefghijkmnopqrstuvwxyz";
    const digits = "23456789";
    const symbols = "!@#$%*-_";
    const all = `${upper}${lower}${digits}${symbols}`;

    const chars = [
      upper[randomInt(upper.length)],
      lower[randomInt(lower.length)],
      digits[randomInt(digits.length)],
      symbols[randomInt(symbols.length)],
    ];

    while (chars.length < TEMP_PASSWORD_LENGTH) {
      chars.push(all[randomInt(all.length)]);
    }

    for (let i = chars.length - 1; i > 0; i -= 1) {
      const j = randomInt(i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }

    return chars.join("");
  };

  const startOfLocalDay = (now = new Date()) => {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    return day;
  };

  const startOfNextLocalDay = (now = new Date()) => {
    const day = startOfLocalDay(now);
    day.setDate(day.getDate() + 1);
    return day;
  };

  const isUiV2PreviewEnabledForRequest = (req: Request) => {
    if (!uiV2Enabled) return false;
    if (!hasUiV2AudienceFilters) return true;

    const user = req.user as { email?: string | null; role?: string | null } | undefined;
    if (!user) return false;

    const email = String(user.email ?? "").trim().toLowerCase();
    const role = String(user.role ?? "").trim().toLowerCase();

    if (email && uiV2AllowlistEmailSet.has(email)) return true;
    if (role && uiV2ForceRoleSet.has(role)) return true;
    return false;
  };

  const isUiWave1RedoPreviewEnabledForRequest = (
    req: Request,
    isUiV2EnabledForRequest: boolean,
  ) => {
    if (!uiWave1RedoEnabled) return false;
    if (!isUiV2EnabledForRequest) return false;
    if (!hasUiWave1RedoAudienceFilters) return true;

    const user = req.user as { email?: string | null; role?: string | null } | undefined;
    if (!user) return false;

    const email = String(user.email ?? "").trim().toLowerCase();
    const role = String(user.role ?? "").trim().toLowerCase();

    if (email && uiWave1RedoAllowlistEmailSet.has(email)) return true;
    if (role && uiWave1RedoForceRoleSet.has(role)) return true;
    return false;
  };

  const ensureWorkspacePlatforms = async (workspaceOwnerId: number) => {
    const existing = await storage.getPlatformsByUserId(workspaceOwnerId);
    const existingTypes = new Set(existing.map((platform) => String(platform.type)));

    const defaults: Array<{ type: string; name: string }> = [
      { type: "telegram", name: "ModerateAI Telegram" },
      { type: "discord", name: "ModerateAI Discord" },
      { type: "website", name: "ModerateAI Website" },
    ];

    for (const def of defaults) {
      if (existingTypes.has(def.type)) continue;
      await storage.createPlatform({
        userId: workspaceOwnerId,
        type: def.type,
        name: def.name,
        status: "setup_required",
        config: null,
        authToken: null,
      } as any);
    }

    return storage.getPlatformsByUserId(workspaceOwnerId);
  };

  const countAllowedWebsiteDomainsFromConfig = (platformRows: Array<{ type: string; config: unknown }>) => {
    const websitePlatform = platformRows.find((platform) => platform.type === "website");
    const source = (websitePlatform?.config ?? null) as { allowedDomains?: unknown } | null;
    const allowedDomains = Array.isArray(source?.allowedDomains) ? source.allowedDomains : [];
    const normalized = allowedDomains
      .map((domain) => String(domain ?? "").trim().toLowerCase())
      .filter(Boolean);
    return new Set(normalized).size;
  };

  const getDashboardDestinationUsage = async (workspaceOwnerId: number) => {
    const rows = await db
      .select({
        platformType: platforms.type,
        chatType: chatConfigurations.chatType,
        total: count(),
      })
      .from(chatConfigurations)
      .innerJoin(platforms, eq(chatConfigurations.platformId, platforms.id))
      .where(and(eq(platforms.userId, workspaceOwnerId), eq(chatConfigurations.isActive, true)))
      .groupBy(platforms.type, chatConfigurations.chatType);

    let telegramGroupsUsed = 0;
    let discordServersUsed = 0;
    let websiteDomainsUsed = 0;

    for (const row of rows) {
      const platformType = String(row.platformType ?? "");
      const chatType = String(row.chatType ?? "");
      const total = Number(row.total ?? 0);

      if (platformType === "telegram" && (chatType === "group" || chatType === "supergroup")) {
        telegramGroupsUsed += total;
        continue;
      }

      if (platformType === "discord" && chatType === "server") {
        discordServersUsed += total;
        continue;
      }

      if (platformType === "website" && chatType === "website_domain") {
        websiteDomainsUsed += total;
      }
    }

    return { telegramGroupsUsed, discordServersUsed, websiteDomainsUsed };
  };

  const getWorkspaceAiResponsesToday = async (workspaceOwnerId: number, now = new Date()) => {
    const start = startOfLocalDay(now);
    const rows = await db
      .select({ total: count() })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .innerJoin(platforms, eq(conversations.platformId, platforms.id))
      .where(and(eq(messages.sender, "ai"), eq(platforms.userId, workspaceOwnerId), gt(messages.createdAt, start)));

    return Number(rows[0]?.total ?? 0);
  };

  const getDashboardStatsForOwner = async (workspaceOwnerId: number) => {
    const [statsRow] = await db
      .select({
        totalConversations: sql<number>`count(distinct ${conversations.id})`,
        aiResponses: sql<number>`coalesce(sum(case when ${messages.sender} = 'ai' then 1 else 0 end), 0)`,
        userMessages: sql<number>`coalesce(sum(case when ${messages.sender} = 'user' then 1 else 0 end), 0)`,
      })
      .from(platforms)
      .leftJoin(conversations, eq(conversations.platformId, platforms.id))
      .leftJoin(messages, eq(messages.conversationId, conversations.id))
      .where(eq(platforms.userId, workspaceOwnerId));

    const totalConversations = Number(statsRow?.totalConversations ?? 0);
    const aiResponses = Number(statsRow?.aiResponses ?? 0);
    const userMessages = Number(statsRow?.userMessages ?? 0);
    const responseRate = userMessages > 0 ? (aiResponses / userMessages) * 100 : 0;

    return {
      totalConversations,
      aiResponses,
      responseRate,
    };
  };

  const getWorkspaceUsageSummary = async (
    ownerUser: any,
    ownerPlatforms: Array<{ type: string; config: unknown }>,
  ) => {
    const entitlements = getEntitlementsForUser(ownerUser);
    const role = String(ownerUser?.role ?? "").toLowerCase();
    const isInternalRole = role === "owner" || role === "admin";
    const now = new Date();

    const destinationUsage = await getDashboardDestinationUsage(ownerUser.id);
    if (destinationUsage.websiteDomainsUsed === 0) {
      destinationUsage.websiteDomainsUsed = countAllowedWebsiteDomainsFromConfig(ownerPlatforms);
    }

    const aiResponsesUsedToday = await getWorkspaceAiResponsesToday(ownerUser.id, now);

    return {
      telegramGroupsUsed: destinationUsage.telegramGroupsUsed,
      telegramGroupLimit: entitlements.telegramGroupLimit,
      discordServersUsed: destinationUsage.discordServersUsed,
      discordServerLimit: entitlements.discordServerLimit,
      websiteDomainsUsed: destinationUsage.websiteDomainsUsed,
      websiteDomainLimit: entitlements.websiteDomainLimit,
      aiResponsesUsedToday,
      aiResponsesPerDay: isInternalRole ? null : entitlements.aiResponsesPerDay,
      aiResponsesResetAt: startOfNextLocalDay(now).toISOString(),
    };
  };

  const getDashboardOverviewCached = async (cacheKey: string, loader: () => Promise<unknown>) => {
    if (DASHBOARD_OVERVIEW_CACHE_TTL_MS <= 0) {
      return loader();
    }

    const now = Date.now();
    dashboardOverviewCache.forEach((value, key) => {
      if (value.expiresAt <= now) {
        dashboardOverviewCache.delete(key);
      }
    });

    const cached = dashboardOverviewCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    const data = await loader();
    dashboardOverviewCache.set(cacheKey, {
      expiresAt: now + DASHBOARD_OVERVIEW_CACHE_TTL_MS,
      data,
    });
    return data;
  };

  const requireWorkspaceRole = (required: WorkspaceRole) => {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (!hasWorkspaceRole(req.user as any, required)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      return next();
    };
  };

  const resolveWorkspaceOwnerUser = async (user: any) => {
    const workspaceOwnerId = getWorkspaceOwnerId(user as any);
    if (workspaceOwnerId === user.id) {
      return user as any;
    }
    return (await storage.getUser(workspaceOwnerId)) as any;
  };

  const getLockAdapterForPlatformType = (platformType: string) => {
    if (platformType === "telegram") {
      return getTelegramDestinationLockAdapter();
    }
    if (platformType === "discord") {
      return getDiscordDestinationLockAdapter();
    }
    return null;
  };

  const enrichChatConfigurationsWithLocks = async <T extends { id: number; settings: unknown }>(
    platformId: number,
    rows: T[],
  ) => {
    if (rows.length === 0) {
      return rows.map((row) => ({
        ...row,
        lockSettings: normalizeLockSettings(row.settings),
        lockState: buildLockState(null),
      }));
    }

    const locks = await storage.getActiveDestinationLocksByChatConfigurationIds(rows.map((row) => row.id));
    const locksByChatId = new Map(locks.map((lock) => [lock.chatConfigurationId, lock]));

    return rows.map((row) => ({
      ...row,
      lockSettings: normalizeLockSettings(row.settings),
      lockState: buildLockState(locksByChatId.get(row.id)),
    }));
  };

  const messageCorrectionUpsertSchema = z.object({
    correctedContent: z.string().trim().min(1, "Corrected content is required").max(10000),
    annotation: z.string().trim().max(5000).nullable().optional(),
  });

  const correctionApproveSchema = z.object({
    annotation: z.string().trim().max(5000).optional(),
  });

  const normalizeCorrectionPattern = (input: string): string => {
    const normalized = String(input ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
    return normalized.slice(0, 240);
  };

  const sanitizeCorrectionAnnotation = (value: unknown): string | null => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  };

  const toCorrectionResponse = (row: any) => ({
    id: row.id,
    correctedContent: row.correctedContent,
    annotation: row.annotation ?? null,
    status: row.status,
    approvedForLearningAt: row.approvedForLearningAt ?? null,
    approvedByUserId: row.approvedByUserId ?? null,
    createdByUserId: row.createdByUserId,
    updatedByUserId: row.updatedByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });

  const extractHostFromMaybeUrl = (input: unknown): string | null => {
    if (typeof input !== "string") return null;
    const raw = input.trim();
    if (!raw) return null;
    try {
      const parsed = new URL(raw);
      return parsed.hostname.trim().toLowerCase() || null;
    } catch {
      try {
        const parsed = new URL(`https://${raw}`);
        return parsed.hostname.trim().toLowerCase() || null;
      } catch {
        return null;
      }
    }
  };

  const matchWebsiteDomainConfigForHost = (
    host: string,
    configs: Array<{ id: number; externalId: string | null }>,
  ) => {
    const normalizedHost = String(host ?? "").trim().toLowerCase();
    if (!normalizedHost) return null;
    const matches = configs
      .filter((config) => {
        const domain = String(config.externalId ?? "").trim().toLowerCase();
        if (!domain) return false;
        return normalizedHost === domain || normalizedHost.endsWith(`.${domain}`);
      })
      .sort((a, b) => String(b.externalId ?? "").length - String(a.externalId ?? "").length);
    return matches[0] ?? null;
  };

  const buildTrainingInsightPromptBlock = (insights: any[]): string => {
    if (!insights.length) return "";
    let block =
      "\n\nVALIDATED RESPONSE CORRECTION INSIGHTS:\n" +
      "Use these approved response corrections as guidance when they match the user's intent.\n";
    insights.slice(0, 5).forEach((insight, index) => {
      const context = (insight.context && typeof insight.context === "object" ? insight.context : {}) as Record<string, any>;
      const correctedResponse = String(context.correctedResponse ?? "").trim();
      const note = String(context.annotation ?? "").trim();
      block += `\n${index + 1}. Pattern: ${insight.pattern}\n`;
      if (correctedResponse) {
        block += `Preferred response: ${correctedResponse.slice(0, 400)}\n`;
      }
      if (note) {
        block += `Correction note: ${note.slice(0, 250)}\n`;
      }
      block += `Confidence: ${Math.max(0, Math.min(100, Number(insight.confidence ?? 0)))}%\n`;
    });
    block +=
      "\nIf a correction insight directly applies, prefer it while staying consistent with the knowledge base and current context.";
    return block;
  };

  const resolveMessageCorrectionLearningContext = async (params: {
    conversation: any;
    platform: any;
    aiMessage: any;
    precedingUserMessage: any;
  }): Promise<{
    ok: true;
    chatConfig: any;
    sourceMetadata: Record<string, unknown>;
  } | {
    ok: false;
    status: number;
    message: string;
  }> => {
    const platformType = String(params.platform.type ?? "").toLowerCase();

    if (platformType === "telegram") {
      const externalChatId =
        String(params.conversation.externalId ?? "").trim() || String(params.conversation.externalUserId ?? "").trim();
      if (!externalChatId) {
        return { ok: false, status: 422, message: "Cannot resolve Telegram chat for learning approval." };
      }
      const chatConfig = await storage.getChatConfigurationByPlatformAndExternalId(params.platform.id, externalChatId);
      if (!chatConfig) {
        return { ok: false, status: 422, message: "Telegram destination configuration not found for this conversation." };
      }
      return {
        ok: true,
        chatConfig,
        sourceMetadata: {
          platformType,
          telegramChatId: externalChatId,
        },
      };
    }

    if (platformType === "discord") {
      const channelId = String(params.conversation.externalId ?? "").trim();
      if (!channelId) {
        return { ok: false, status: 422, message: "Cannot resolve Discord channel for learning approval." };
      }
      const platformConfig = (params.platform.config && typeof params.platform.config === "object"
        ? params.platform.config
        : {}) as Record<string, any>;
      const channels = Array.isArray(platformConfig.channels) ? platformConfig.channels : [];
      const channelEntry = channels.find((entry: any) => String(entry?.id ?? "").trim() === channelId);
      const guildId = String(channelEntry?.guildId ?? "").trim();
      if (!guildId) {
        return {
          ok: false,
          status: 422,
          message: "Cannot resolve Discord server for this conversation. Refresh server configuration and try again.",
        };
      }
      const chatConfig = await storage.getChatConfigurationByPlatformAndExternalId(params.platform.id, guildId);
      if (!chatConfig) {
        return { ok: false, status: 422, message: "Discord server configuration not found for this conversation." };
      }
      return {
        ok: true,
        chatConfig,
        sourceMetadata: {
          platformType,
          discordChannelId: channelId,
          discordGuildId: guildId,
          discordChannelName: channelEntry?.name ?? null,
        },
      };
    }

    if (platformType === "website") {
      const metadata =
        params.precedingUserMessage?.metadata && typeof params.precedingUserMessage.metadata === "object"
          ? (params.precedingUserMessage.metadata as Record<string, any>)
          : params.aiMessage?.metadata && typeof params.aiMessage.metadata === "object"
            ? (params.aiMessage.metadata as Record<string, any>)
            : {};

      const hostCandidates = [
        extractHostFromMaybeUrl(metadata.resolvedHost),
        extractHostFromMaybeUrl(metadata.origin),
        extractHostFromMaybeUrl(metadata.pageUrl),
      ].filter((value): value is string => Boolean(value));

      const websiteConfigs = (await storage.getChatConfigurationsByPlatformId(params.platform.id))
        .filter((config) => config.chatType === "website_domain" && Boolean(config.isActive));

      const matchedConfig = hostCandidates
        .map((host) => matchWebsiteDomainConfigForHost(host, websiteConfigs as any))
        .find((config) => Boolean(config));

      if (!matchedConfig) {
        return {
          ok: false,
          status: 422,
          message: "Cannot approve for learning until website domain can be resolved for this conversation.",
        };
      }

      return {
        ok: true,
        chatConfig: matchedConfig,
        sourceMetadata: {
          platformType,
          websiteHost: hostCandidates[0] ?? null,
          mappedDomain: matchedConfig.externalId,
        },
      };
    }

    return {
      ok: false,
      status: 422,
      message: `Learning approval is not supported for platform type "${platformType}".`,
    };
  };

  const getHistoryCutoffForWorkspace = async (user: any): Promise<Date | null> => {
    const ownerUser = await resolveWorkspaceOwnerUser(user);
    const historyDays = getConversationHistoryWindowDaysForUser(ownerUser as any);
    if (historyDays === null) return null;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - historyDays);
    return cutoff;
  };

  const getWorkspaceModerationSettings = async (user: any) => {
    const workspaceOwnerId = getWorkspaceOwnerId(user as any);
    const ownerUser = await resolveWorkspaceOwnerUser(user);
    const defaultPreset = getDefaultModerationPresetForUser(ownerUser as any);
    const existingSettings = await storage.getWorkspaceSettings(workspaceOwnerId);
    const preset = (existingSettings?.moderationPreset ?? defaultPreset) as ModerationPreset;
    const allowedPresets = getAllowedModerationPresetsForUser(ownerUser as any);
    const resolvedPreset = allowedPresets.includes(preset) ? preset : defaultPreset;

    return {
      ownerUser,
      workspaceOwnerId,
      defaultPreset,
      allowedPresets,
      settings: existingSettings,
      preset: resolvedPreset,
      rules: (existingSettings?.moderationRules ?? {
        blockedKeywords: [],
        allowedKeywords: [],
        spamSensitivity: 50,
        strictness: 50,
      }) as any,
    };
  };

  const writeAuditEventSafe = async (input: {
    ownerUserId: number;
    actorUserId?: number | null;
    action: string;
    targetType?: string | null;
    targetId?: string | null;
    details?: Record<string, unknown> | null;
  }) => {
    try {
      await recordAuditEvent(input);
    } catch (error) {
      console.warn("Failed to write audit event:", error);
    }
  };

  const writeActorWorkspaceAudit = async (
    req: Request,
    event: {
      action: string;
      targetType?: string | null;
      targetId?: string | null;
      details?: Record<string, unknown> | null;
    },
  ) => {
    await writeAuditEventSafe({
      ownerUserId: getWorkspaceOwnerId(req.user as any),
      actorUserId: req.user?.id ?? null,
      action: event.action,
      targetType: event.targetType ?? null,
      targetId: event.targetId ?? null,
      details: event.details ?? {},
    });
  };

  const normalizeDomainValue = (input: string): string | null => {
    const raw = String(input ?? "").trim().toLowerCase();
    if (!raw) return null;
    try {
      return new URL(raw).hostname.toLowerCase();
    } catch {
      try {
        return new URL(`https://${raw}`).hostname.toLowerCase();
      } catch {
        return null;
      }
    }
  };

  const normalizeAllowedDomains = (input: unknown): string[] => {
    if (!Array.isArray(input)) return [];
    const domains = input
      .map((value) => (typeof value === "string" ? normalizeDomainValue(value) : null))
      .filter((value): value is string => Boolean(value));
    return Array.from(new Set(domains));
  };

  type BotOwnershipMode = "app_owned" | "byob";

  const normalizeBotOwnershipMode = (value: unknown): BotOwnershipMode => {
    const normalized = String(value ?? "").trim().toLowerCase();
    return normalized === "byob" ? "byob" : "app_owned";
  };

  const getAppOwnedBotToken = (platformType: string): string | null => {
    if (platformType === "telegram") {
      const token = String(process.env.TELEGRAM_APP_BOT_TOKEN ?? "").trim();
      return token.length > 0 ? token : null;
    }

    if (platformType === "discord") {
      const token = String(process.env.DISCORD_APP_BOT_TOKEN ?? "").trim();
      return token.length > 0 ? token : null;
    }

    return null;
  };

  const isAppOwnedAvailableForPlatformType = (platformType: string): boolean => {
    return getAppOwnedBotToken(platformType) !== null;
  };

  const isByobAllowedForUser = (ownerUser: any): boolean => {
    const role = String(ownerUser?.role ?? "").toLowerCase();
    if (role === "owner" || role === "admin") return true;
    return normalizePlan(ownerUser?.plan) === "pro";
  };

  const getAppOwnedBotMetadata = (platformType: string) => {
    if (platformType === "telegram") {
      const metadata = getTelegramAppOwnedBotPublicInfo();
      const username = String(metadata?.username ?? "").trim().replace(/^@/, "");
      return {
        available: isAppOwnedAvailableForPlatformType(platformType),
        username: username || undefined,
        inviteUrl: username ? `https://t.me/${username}?startgroup=true` : undefined,
      };
    }

    if (platformType === "discord") {
      const metadata = getDiscordAppOwnedBotPublicInfo();
      return {
        available: isAppOwnedAvailableForPlatformType(platformType),
        clientId: metadata?.clientId,
        inviteUrl: metadata?.inviteUrl,
        invitePermissions: metadata?.invitePermissions,
      };
    }

    return undefined;
  };

  const withPlatformCapabilityMetadata = <T extends { type: string; botOwnershipMode?: unknown }>(platform: T) => {
    const mode = normalizeBotOwnershipMode(platform.botOwnershipMode);
    const platformType = String(platform.type);
    return {
      ...platform,
      botOwnershipMode: mode,
      appOwnedAvailable: isAppOwnedAvailableForPlatformType(platformType),
      appOwnedBot:
        platformType === "telegram" || platformType === "discord"
          ? getAppOwnedBotMetadata(platformType)
          : undefined,
    };
  };

  const hasActiveClaimedDestination = (platformType: string, chatType: string, isActive: boolean): boolean => {
    if (!isActive) return false;
    if (platformType === "telegram") return chatType === "group" || chatType === "supergroup";
    if (platformType === "discord") return chatType === "server";
    return false;
  };

  const reconcileClaimedAppOwnedPlatformStatus = async (platform: any): Promise<any> => {
    const mode = normalizeBotOwnershipMode(platform.botOwnershipMode);
    if (mode !== "app_owned") return platform;
    if (platform.status === "active") return platform;
    if (platform.type !== "telegram" && platform.type !== "discord") return platform;

    const chatConfigs = await storage.getChatConfigurationsByPlatformId(platform.id);
    const hasClaimedDestination = chatConfigs.some((chatConfig) =>
      hasActiveClaimedDestination(platform.type, chatConfig.chatType, chatConfig.isActive),
    );

    if (!hasClaimedDestination) return platform;

    const updated = await storage.updatePlatform(platform.id, { status: "active" } as any);
    if (!updated) return platform;
    return updated;
  };

  const generateIntegrationClaimCode = (): string => {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const length = 8;
    const chars: string[] = [];
    while (chars.length < length) {
      chars.push(alphabet[randomInt(alphabet.length)]);
    }
    return chars.join("");
  };

  const getActiveClaimCodeForPlatform = async (platformId: number) => {
    const claim = await storage.getActiveIntegrationClaimCodeForPlatform(platformId);
    if (!claim) return null;
    return {
      id: claim.id,
      code: claim.code,
      expiresAt: claim.expiresAt,
      createdAt: claim.createdAt,
    };
  };
  
  
  // Register training routes
  app.use("/api/training", trainingRoutes);

  // Website widget + lead-generation routes (public and authenticated)
  registerWidgetRoutes(app);

  // Billing status for the current user (manual billing for now)
  app.get("/api/billing/status", authMiddleware, async (req, res) => {
    try {
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const workspaceOwner =
        workspaceOwnerId === req.user!.id ? (req.user as any) : ((await storage.getUser(workspaceOwnerId)) as any);
      const billingUser = workspaceOwner ?? (req.user as any);

      const role = String((billingUser as any)?.role ?? "").toLowerCase();
      const isOwner = role === "owner";
      const plan = normalizePlan((billingUser as any).plan) as Plan;
      const planStatus = normalizePlanStatus((billingUser as any).planStatus) as PlanStatus;
      // Internal accounts (owner/admin) are not subject to subscription limits.
      const entitlements = getEntitlementsForUser(billingUser as any);
      const seatUsage = await getSeatUsageForOwner(workspaceOwnerId);

      return res.json({
        isOwner,
        plan,
        planStatus,
        trialStartedAt: (billingUser as any).trialStartedAt ?? null,
        trialEndsAt: (billingUser as any).trialEndsAt ?? null,
        planSelectedAt: (billingUser as any).planSelectedAt ?? null,
        paidThroughAt: (billingUser as any).paidThroughAt ?? null,
        billingSuspendedAt: (billingUser as any).billingSuspendedAt ?? null,
        billingSuspendedReason: (billingUser as any).billingSuspendedReason ?? null,
        entitlements,
        seatUsage: {
          ...seatUsage,
          seatLimit: entitlements.seatLimit,
        },
      });
    } catch (error: any) {
      console.error("Error fetching billing status:", error);
      return res.status(500).json({ message: error?.message || "Failed to fetch billing status" });
    }
  });

  // One-time onboarding: allow an authenticated user to select a plan and start a trial if applicable.
  app.post("/api/billing/select-plan", authMiddleware, async (req, res) => {
    try {
      const bodySchema = z.object({
        plan: z.enum(["free", "standard", "pro"]),
      });

      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).message });
      }

      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      if (workspaceOwnerId !== req.user!.id) {
        return res.status(403).json({ message: "Team members inherit the workspace plan and cannot select a tier." });
      }

      // One-time selection (first plan pick). Upgrades/downgrades can be handled later via admin or billing UI.
      if ((req.user as any).planSelectedAt) {
        return res.status(409).json({ message: "Plan has already been selected for this account" });
      }

      const now = new Date();
      const selectedPlan = parsed.data.plan;

      // Manual billing: customers can self-serve the Free plan only.
      // Standard/Pro are activated by support/admin after payment.
      if (selectedPlan !== "free") {
        return res.status(403).json({
          message:
            "Standard and Pro require manual activation. Please contact support to upgrade your account.",
        });
      }

      const update: Record<string, any> = {
        plan: selectedPlan,
        planSelectedAt: now,
        planUpdatedAt: now,
      };

      update.planStatus = "active";
      update.trialEndsAt = null;

      const updated = await storage.updateUser(req.user!.id, update as any);
      if (!updated) {
        return res.status(500).json({ message: "Failed to update plan" });
      }

      await writeActorWorkspaceAudit(req, {
        action: "billing.plan_selected",
        targetType: "user",
        targetId: String(updated.id),
        details: {
          plan: selectedPlan,
          planStatus: update.planStatus,
        },
      });

      return res.json({
        id: updated.id,
        email: updated.email,
        fullName: updated.fullName,
        role: updated.role,
        workspaceOwnerId: (updated as any).workspaceOwnerId ?? null,
        workspaceRole: (updated as any).workspaceRole ?? "admin",
        plan: (updated as any).plan ?? "free",
        planStatus: (updated as any).planStatus ?? "active",
        trialStartedAt: (updated as any).trialStartedAt ?? null,
        trialEndsAt: (updated as any).trialEndsAt ?? null,
        planSelectedAt: (updated as any).planSelectedAt ?? null,
      });
    } catch (error: any) {
      console.error("Error selecting plan:", error);
      return res.status(500).json({ message: error?.message || "Failed to select plan" });
    }
  });

  // Admin-only: manually set a user's plan (no Stripe integration yet)
  app.post("/api/admin/billing/set-plan", authMiddleware, async (req, res) => {
    try {
      if (!requireAdmin(req, res)) return;

      const bodySchema = z.object({
        userId: z.coerce.number().int().positive(),
        plan: z.enum(["free", "standard", "pro"]),
        planStatus: z.enum(["active", "past_due", "canceled"]).optional(),
        trialEndsAt: z.union([z.string().datetime(), z.null()]).optional(),
      });

      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).message });
      }

      const trialEndsAt =
        parsed.data.trialEndsAt === undefined
          ? undefined
          : parsed.data.trialEndsAt === null
            ? null
            : new Date(parsed.data.trialEndsAt);

      const update: Record<string, any> = {
        plan: parsed.data.plan,
        planUpdatedAt: new Date(),
      };
      if (parsed.data.planStatus !== undefined) update.planStatus = parsed.data.planStatus;
      if (trialEndsAt !== undefined) update.trialEndsAt = trialEndsAt;

      const existingUser = await storage.getUser(parsed.data.userId);
      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const now = new Date();

      // Manual billing: trials are not supported.
      if (trialEndsAt instanceof Date) {
        return res.status(400).json({ message: "Trials are not supported. Clear trialEndsAt instead." });
      }

      // If an admin sets a plan for a customer who hasn't completed onboarding,
      // mark the plan as selected so they don't get redirected to /choose-plan.
      if (!(existingUser as any).planSelectedAt) {
        update.planSelectedAt = now;
      }

      const updated = await storage.updateUser(parsed.data.userId, update as any);
      if (!updated) {
        return res.status(500).json({ message: "Failed to update user plan" });
      }

      await writeActorWorkspaceAudit(req, {
        action: "admin.billing_set_plan",
        targetType: "user",
        targetId: String(updated.id),
        details: {
          plan: (updated as any).plan ?? "free",
          planStatus: (updated as any).planStatus ?? "active",
          trialEndsAt: (updated as any).trialEndsAt ?? null,
        },
      });

      return res.json({
        userId: updated.id,
        plan: (updated as any).plan,
        planStatus: (updated as any).planStatus,
        trialEndsAt: (updated as any).trialEndsAt ?? null,
        planUpdatedAt: (updated as any).planUpdatedAt ?? null,
      });
    } catch (error: any) {
      console.error("Error setting user plan:", error);
      return res.status(500).json({ message: error?.message || "Failed to set user plan" });
    }
  });

  // Admin-only: list all signed-up users (excluding sensitive secrets like password hashes)
  app.get("/api/admin/users", authMiddleware, async (req, res) => {
    try {
      if (!requireAdmin(req, res)) return;

      const allUsers = await storage.getAllUsers();

      const safeUsers = allUsers.map((user) => ({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isActive: user.isActive,
        isBanned: (user as any).isBanned ?? false,
        bannedAt: (user as any).bannedAt ?? null,
        banReason: (user as any).banReason ?? null,
        mustChangePassword: (user as any).mustChangePassword ?? false,
        temporaryPasswordExpiresAt: (user as any).temporaryPasswordExpiresAt ?? null,
        requireTwoFactor: user.requireTwoFactor,
        plan: (user as any).plan ?? "free",
        planStatus: (user as any).planStatus ?? "active",
        trialStartedAt: (user as any).trialStartedAt ?? null,
        trialEndsAt: (user as any).trialEndsAt ?? null,
        planSelectedAt: (user as any).planSelectedAt ?? null,
        planUpdatedAt: (user as any).planUpdatedAt ?? null,
        paidThroughAt: (user as any).paidThroughAt ?? null,
        billingSuspendedAt: (user as any).billingSuspendedAt ?? null,
        billingSuspendedReason: (user as any).billingSuspendedReason ?? null,
        billingSuspendedBy: (user as any).billingSuspendedBy ?? null,
        workspaceOwnerId: (user as any).workspaceOwnerId ?? null,
        workspaceRole: (user as any).workspaceRole ?? "admin",
        createdAt: user.createdAt,
      }));

      return res.json({ users: safeUsers });
    } catch (error: any) {
      console.error("Error listing users:", error);
      return res.status(500).json({ message: error?.message || "Failed to list users" });
    }
  });

  // Admin-only: workspace destination usage and caps across all workspace owners.
  app.get("/api/admin/workspaces/integrations", authMiddleware, async (req, res) => {
    try {
      if (!requireAdmin(req, res)) return;

      const allUsers = await storage.getAllUsers();
      const workspaceOwners = allUsers.filter((user) => (user as any).workspaceOwnerId == null);

      const workspaces = await Promise.all(
        workspaceOwners.map(async (ownerUser) => {
          const entitlements = getEntitlementsForUser(ownerUser as any);
          const ownerPlatforms = await storage.getPlatformsByUserId(ownerUser.id);

          const destinationUsage = {
            telegram: { active: 0, inactive: 0, cap: entitlements.telegramGroupLimit as number | null },
            discord: { active: 0, inactive: 0, cap: entitlements.discordServerLimit as number | null },
            website: { active: 0, inactive: 0, cap: entitlements.websiteDomainLimit as number | null },
          };

          for (const platform of ownerPlatforms) {
            const chatConfigs = await storage.getChatConfigurationsByPlatformId(platform.id);

            if (platform.type === "telegram") {
              const telegramConfigs = chatConfigs.filter(
                (config) => config.chatType === "group" || config.chatType === "supergroup",
              );
              destinationUsage.telegram.active += telegramConfigs.filter((config) => config.isActive).length;
              destinationUsage.telegram.inactive += telegramConfigs.filter((config) => !config.isActive).length;
              continue;
            }

            if (platform.type === "discord") {
              const discordConfigs = chatConfigs.filter((config) => config.chatType === "server");
              destinationUsage.discord.active += discordConfigs.filter((config) => config.isActive).length;
              destinationUsage.discord.inactive += discordConfigs.filter((config) => !config.isActive).length;
              continue;
            }

            if (platform.type === "website") {
              const websiteConfigs = chatConfigs.filter((config) => config.chatType === "website_domain");
              destinationUsage.website.active += websiteConfigs.filter((config) => config.isActive).length;
              destinationUsage.website.inactive += websiteConfigs.filter((config) => !config.isActive).length;

              // Backward compatibility: if website chat-config rows were not generated yet,
              // reflect the configured allowed domains so admins still see destination usage.
              if (websiteConfigs.length === 0) {
                const allowedDomains = normalizeAllowedDomains((platform as any).config?.allowedDomains);
                destinationUsage.website.active += allowedDomains.length;
              }
            }
          }

          return {
            ownerUserId: ownerUser.id,
            ownerEmail: ownerUser.email,
            ownerFullName: ownerUser.fullName,
            role: ownerUser.role,
            plan: (ownerUser as any).plan ?? "free",
            planStatus: (ownerUser as any).planStatus ?? "active",
            destinationUsage,
          };
        }),
      );

      return res.json({
        generatedAt: new Date().toISOString(),
        workspaces,
      });
    } catch (error: any) {
      console.error("Error listing workspace integration usage:", error);
      return res.status(500).json({ message: error?.message || "Failed to list workspace integration usage" });
    }
  });

  app.get("/api/admin/ops/auth-limiter", authMiddleware, async (req, res) => {
    try {
      if (!requireAdmin(req, res)) return;

      const configuredBackend = String(process.env.AUTH_RATE_LIMIT_BACKEND ?? "postgres").trim().toLowerCase();
      const redisUrl = String(process.env.AUTH_RATE_LIMIT_REDIS_URL ?? process.env.REDIS_URL ?? "").trim();

      return res.json({
        generatedAt: new Date().toISOString(),
        authLimiter: {
          max: parsePositiveInt(process.env.AUTH_RATE_LIMIT_MAX, 20),
          windowMs: parsePositiveInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
          cleanupIntervalMs: parsePositiveInt(process.env.AUTH_RATE_LIMIT_CLEANUP_INTERVAL_MS, 5 * 60 * 1000),
          configuredBackend: configuredBackend === "redis" ? "redis" : "postgres",
          redisConfigured: Boolean(redisUrl),
          redisPrefix:
            String(process.env.AUTH_RATE_LIMIT_REDIS_PREFIX ?? "moderateai:auth_rate_limits").trim() ||
            "moderateai:auth_rate_limits",
          redisFallbackToPostgres: parseBooleanEnv(process.env.AUTH_RATE_LIMIT_REDIS_FALLBACK_TO_POSTGRES, true),
        },
        events: getOpsEventSummary(["AUTH_RATE_LIMIT_429", "AUTH_RATE_LIMIT_FAILURE"]),
      });
    } catch (error: any) {
      console.error("Error fetching auth limiter ops summary:", error);
      return res.status(500).json({ message: error?.message || "Failed to fetch auth limiter ops summary" });
    }
  });
  
  
  
  const adminUserIdParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
  });

  async function clearUserSessions(userId: number) {
    await db.execute(sql`DELETE FROM ${sessions} WHERE (sess->'passport'->>'user') = ${String(userId)}`);
  }

  async function clearWorkspaceSessions(ownerUserId: number) {
    const workspaceUserRows = await db
      .select({ id: users.id })
      .from(users)
      .where(or(eq(users.id, ownerUserId), eq(users.workspaceOwnerId, ownerUserId)));

    for (const row of workspaceUserRows) {
      await clearUserSessions(row.id);
    }
  }

  // Authenticated user: complete forced password reset after signing in with temporary password.
  app.post("/api/account/complete-password-reset", authMiddleware, async (req, res) => {
    try {
      const bodySchema = z
        .object({
          newPassword: z.string().min(8, "Password must be at least 8 characters"),
          confirmPassword: z.string().min(8, "Please confirm your password"),
        })
        .refine((data) => data.newPassword === data.confirmPassword, {
          message: "Passwords do not match",
          path: ["confirmPassword"],
        });

      const parsed = bodySchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).message });
      }

      const current = await storage.getUser(req.user!.id);
      if (!current) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!(current as any).mustChangePassword) {
        return res.status(409).json({ message: "Password reset is not required for this account" });
      }

      const expiresAtRaw = (current as any).temporaryPasswordExpiresAt;
      const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;
      const expired =
        !expiresAt ||
        Number.isNaN(expiresAt.getTime()) ||
        expiresAt.getTime() <= Date.now();
      if (expired) {
        return res.status(409).json({ message: TEMP_PASSWORD_EXPIRED_MESSAGE });
      }

      const hashed = await hashPassword(parsed.data.newPassword);
      const updated = await storage.updateUser(current.id, {
        password: hashed,
        mustChangePassword: false,
        temporaryPasswordIssuedAt: null,
        temporaryPasswordExpiresAt: null,
        temporaryPasswordIssuedBy: null,
      } as any);

      if (!updated) {
        return res.status(500).json({ message: "Failed to update password" });
      }

      // Invalidate stale sessions for this account, then establish a fresh session.
      await clearUserSessions(current.id);
      await new Promise<void>((resolve, reject) => {
        const activeSession = (req as any).session;
        if (!activeSession || typeof activeSession.regenerate !== "function") {
          return reject(new Error("Session unavailable"));
        }
        activeSession.regenerate((err: any) => (err ? reject(err) : resolve()));
      });
      await new Promise<void>((resolve, reject) => {
        req.login(updated as any, (err) => (err ? reject(err) : resolve()));
      });

      await writeActorWorkspaceAudit(req, {
        action: "auth.password_reset_completed",
        targetType: "user",
        targetId: String(current.id),
        details: {
          email: current.email,
        },
      });

      return res.json({ ok: true, user: await toSafeUser(updated as any) });
    } catch (error: any) {
      console.error("Error completing password reset:", error);
      return res.status(500).json({ message: error?.message || "Failed to complete password reset" });
    }
  });

  // Admin-only: issue a temporary password for manual, no-email account recovery.
  app.post("/api/admin/users/:id/reset-temp-password", authMiddleware, async (req, res) => {
    try {
      if (!requireAdmin(req, res)) return;

      const parsed = adminUserIdParamsSchema.safeParse(req.params);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).message });
      }

      const targetUserId = parsed.data.id;
      if (targetUserId === req.user!.id) {
        return res.status(400).json({ message: "You cannot reset your own password from admin actions" });
      }

      const target = await storage.getUser(targetUserId);
      if (!target) return res.status(404).json({ message: "User not found" });

      const actorIsOwner = req.user!.role === "owner";
      if (target.role === "owner") {
        return res.status(400).json({ message: "Cannot reset the owner account password" });
      }
      if (target.role === "admin" && !actorIsOwner) {
        return res.status(403).json({ message: "Only the owner can reset admin passwords" });
      }

      const temporaryPassword = generateTemporaryPassword();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + TEMP_PASSWORD_TTL_MINUTES * 60 * 1000);
      const hashed = await hashPassword(temporaryPassword);

      const updated = await storage.updateUser(targetUserId, {
        password: hashed,
        mustChangePassword: true,
        temporaryPasswordIssuedAt: now,
        temporaryPasswordExpiresAt: expiresAt,
        temporaryPasswordIssuedBy: req.user!.id,
      } as any);

      if (!updated) {
        return res.status(500).json({ message: "Failed to issue temporary password" });
      }

      await clearUserSessions(targetUserId);
      await writeActorWorkspaceAudit(req, {
        action: "admin.password_temp_reset_issued",
        targetType: "user",
        targetId: String(targetUserId),
        details: {
          email: target.email,
          expiresAt: expiresAt.toISOString(),
          ttlMinutes: TEMP_PASSWORD_TTL_MINUTES,
        },
      });

      return res.json({
        ok: true,
        userId: targetUserId,
        email: target.email,
        temporaryPassword,
        expiresAt: expiresAt.toISOString(),
        ttlMinutes: TEMP_PASSWORD_TTL_MINUTES,
      });
    } catch (error: any) {
      console.error("Error issuing temporary password:", error);
      return res.status(500).json({ message: error?.message || "Failed to issue temporary password" });
    }
  });

  // Admin-only: deactivate a user (blocks login + invalidates existing sessions)
  app.post("/api/admin/users/:id/deactivate", authMiddleware, async (req, res) => {
    try {
      if (!requireAdmin(req, res)) return;

      const parsed = adminUserIdParamsSchema.safeParse(req.params);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).message });
      }

      const targetUserId = parsed.data.id;
      if (targetUserId === req.user!.id) {
        return res.status(400).json({ message: "You cannot deactivate your own account" });
      }

      const target = await storage.getUser(targetUserId);
      if (!target) return res.status(404).json({ message: "User not found" });
      const actorIsOwner = req.user!.role === "owner";
      if (target.role === "owner") {
        return res.status(400).json({ message: "Cannot deactivate the owner account" });
      }
      if (target.role === "admin" && !actorIsOwner) {
        return res.status(403).json({ message: "Only the owner can deactivate admin accounts" });
      }

      await storage.updateUser(targetUserId, { isActive: false } as any);
      // Free the seat if this user was invited/whitelisted by someone.
      await db
        .update(emailWhitelist)
        .set({ isActive: false })
        .where(eq(emailWhitelist.email, target.email.toLowerCase()));
      await clearUserSessions(targetUserId);

      await writeActorWorkspaceAudit(req, {
        action: "admin.user_deactivated",
        targetType: "user",
        targetId: String(targetUserId),
        details: {
          email: target.email,
          role: target.role,
        },
      });

      return res.json({ ok: true });
    } catch (error: any) {
      console.error("Error deactivating user:", error);
      return res.status(500).json({ message: error?.message || "Failed to deactivate user" });
    }
  });

  // Admin-only: activate a user (does not override bans)
  app.post("/api/admin/users/:id/activate", authMiddleware, async (req, res) => {
    try {
      if (!requireAdmin(req, res)) return;

      const parsed = adminUserIdParamsSchema.safeParse(req.params);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).message });
      }

      const targetUserId = parsed.data.id;
      if (targetUserId === req.user!.id) {
        return res.status(400).json({ message: "You cannot modify your own account status" });
      }

      const target = await storage.getUser(targetUserId);
      if (!target) return res.status(404).json({ message: "User not found" });
      const actorIsOwner = req.user!.role === "owner";
      if (target.role === "owner") {
        return res.status(400).json({ message: "Cannot modify the owner account" });
      }
      if (target.role === "admin" && !actorIsOwner) {
        return res.status(403).json({ message: "Only the owner can modify admin accounts" });
      }

      if ((target as any).isBanned) {
        return res.status(409).json({ message: "User is banned. Unban first to activate." });
      }

      await storage.updateUser(targetUserId, { isActive: true } as any);
      await writeActorWorkspaceAudit(req, {
        action: "admin.user_activated",
        targetType: "user",
        targetId: String(targetUserId),
        details: {
          email: target.email,
          role: target.role,
        },
      });
      return res.json({ ok: true });
    } catch (error: any) {
      console.error("Error activating user:", error);
      return res.status(500).json({ message: error?.message || "Failed to activate user" });
    }
  });

  // Admin-only: ban a user (sets is_banned=true + is_active=false, frees seat, invalidates sessions)
  app.post("/api/admin/users/:id/ban", authMiddleware, async (req, res) => {
    try {
      if (!requireAdmin(req, res)) return;

      const parsedParams = adminUserIdParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        return res.status(400).json({ message: fromZodError(parsedParams.error).message });
      }

      const bodySchema = z.object({
        reason: z.string().trim().max(500).optional(),
      });
      const parsedBody = bodySchema.safeParse(req.body ?? {});
      if (!parsedBody.success) {
        return res.status(400).json({ message: fromZodError(parsedBody.error).message });
      }

      const targetUserId = parsedParams.data.id;
      if (targetUserId === req.user!.id) {
        return res.status(400).json({ message: "You cannot ban your own account" });
      }

      const target = await storage.getUser(targetUserId);
      if (!target) return res.status(404).json({ message: "User not found" });
      const actorIsOwner = req.user!.role === "owner";
      if (target.role === "owner") {
        return res.status(400).json({ message: "Cannot ban the owner account" });
      }
      if (target.role === "admin" && !actorIsOwner) {
        return res.status(403).json({ message: "Only the owner can ban admin accounts" });
      }

      const now = new Date();
      await storage.updateUser(
        targetUserId,
        {
          isBanned: true,
          bannedAt: now,
          banReason: parsedBody.data.reason ?? null,
          isActive: false,
        } as any,
      );

      await db
        .update(emailWhitelist)
        .set({ isActive: false })
        .where(eq(emailWhitelist.email, target.email.toLowerCase()));
      await clearUserSessions(targetUserId);

      await writeActorWorkspaceAudit(req, {
        action: "admin.user_banned",
        targetType: "user",
        targetId: String(targetUserId),
        details: {
          email: target.email,
          role: target.role,
          reason: parsedBody.data.reason ?? null,
        },
      });

      return res.json({ ok: true });
    } catch (error: any) {
      console.error("Error banning user:", error);
      return res.status(500).json({ message: error?.message || "Failed to ban user" });
    }
  });

  // Admin-only: unban a user (does not automatically re-activate)
  app.post("/api/admin/users/:id/unban", authMiddleware, async (req, res) => {
    try {
      if (!requireAdmin(req, res)) return;

      const parsed = adminUserIdParamsSchema.safeParse(req.params);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).message });
      }

      const targetUserId = parsed.data.id;
      if (targetUserId === req.user!.id) {
        return res.status(400).json({ message: "You cannot modify your own account status" });
      }

      const target = await storage.getUser(targetUserId);
      if (!target) return res.status(404).json({ message: "User not found" });
      const actorIsOwner = req.user!.role === "owner";
      if (target.role === "owner") {
        return res.status(400).json({ message: "Cannot modify the owner account" });
      }
      if (target.role === "admin" && !actorIsOwner) {
        return res.status(403).json({ message: "Only the owner can modify admin accounts" });
      }

      await storage.updateUser(
        targetUserId,
        {
          isBanned: false,
          bannedAt: null,
          banReason: null,
        } as any,
      );

      await writeActorWorkspaceAudit(req, {
        action: "admin.user_unbanned",
        targetType: "user",
        targetId: String(targetUserId),
        details: {
          email: target.email,
          role: target.role,
        },
      });

      return res.json({ ok: true });
    } catch (error: any) {
      console.error("Error unbanning user:", error);
      return res.status(500).json({ message: error?.message || "Failed to unban user" });
    }
  });

  // Admin-only: billing suspension (distinct from deactivation/bans)
  app.post("/api/admin/users/:id/suspend-billing", authMiddleware, async (req, res) => {
    try {
      if (!requireAdmin(req, res)) return;

      const parsedParams = adminUserIdParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        return res.status(400).json({ message: fromZodError(parsedParams.error).message });
      }

      const bodySchema = z.object({
        reason: z.string().trim().max(500).optional(),
      });
      const parsedBody = bodySchema.safeParse(req.body ?? {});
      if (!parsedBody.success) {
        return res.status(400).json({ message: fromZodError(parsedBody.error).message });
      }

      const targetUserId = parsedParams.data.id;
      if (targetUserId === req.user!.id) {
        return res.status(400).json({ message: "You cannot billing-suspend your own account" });
      }

      const target = await storage.getUser(targetUserId);
      if (!target) return res.status(404).json({ message: "User not found" });

      const actorIsOwner = req.user!.role === "owner";
      if (target.role === "owner") {
        return res.status(400).json({ message: "Cannot billing-suspend the owner account" });
      }
      if (target.role === "admin" && !actorIsOwner) {
        return res.status(403).json({ message: "Only the owner can modify admin accounts" });
      }

      if ((target as any).workspaceOwnerId) {
        return res.status(400).json({ message: "Billing suspension applies to workspace owners only" });
      }

      const now = new Date();
      await storage.updateUser(
        targetUserId,
        {
          billingSuspendedAt: now,
          billingSuspendedReason: parsedBody.data.reason ?? "non_payment_manual",
          billingSuspendedBy: req.user!.id,
          planStatus: "past_due",
        } as any,
      );

      await writeActorWorkspaceAudit(req, {
        action: "admin.billing_suspend",
        targetType: "user",
        targetId: String(targetUserId),
        details: {
          reason: parsedBody.data.reason ?? "non_payment_manual",
        },
      });

      await clearWorkspaceSessions(targetUserId);
      return res.json({ ok: true });
    } catch (error: any) {
      console.error("Error billing-suspending user:", error);
      return res.status(500).json({ message: error?.message || "Failed to billing-suspend user" });
    }
  });

  // Admin-only: mark paid / reinstate billing until a specified date (or duration)
  app.post("/api/admin/users/:id/allow-billing", authMiddleware, async (req, res) => {
    try {
      if (!requireAdmin(req, res)) return;

      const parsedParams = adminUserIdParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        return res.status(400).json({ message: fromZodError(parsedParams.error).message });
      }

      const bodySchema = z
        .object({
          // Extend from the greater of now, trial end, or current paidThroughAt.
          durationDays: z.coerce.number().int().min(1).max(3650).optional(),
          // Or set an absolute paid-through timestamp.
          paidThroughAt: z.string().datetime().optional(),
        })
        .refine((value) => value.durationDays !== undefined || value.paidThroughAt !== undefined, {
          message: "durationDays or paidThroughAt is required",
        });

      const parsedBody = bodySchema.safeParse(req.body ?? {});
      if (!parsedBody.success) {
        return res.status(400).json({ message: fromZodError(parsedBody.error).message });
      }

      const targetUserId = parsedParams.data.id;
      if (targetUserId === req.user!.id) {
        return res.status(400).json({ message: "You cannot modify your own billing status" });
      }

      const target = await storage.getUser(targetUserId);
      if (!target) return res.status(404).json({ message: "User not found" });

      const actorIsOwner = req.user!.role === "owner";
      if (target.role === "owner") {
        return res.status(400).json({ message: "Cannot modify the owner account" });
      }
      if (target.role === "admin" && !actorIsOwner) {
        return res.status(403).json({ message: "Only the owner can modify admin accounts" });
      }

      if ((target as any).workspaceOwnerId) {
        return res.status(400).json({ message: "Billing allowances apply to workspace owners only" });
      }

      const plan = normalizePlan((target as any).plan) as Plan;
      if (plan === "free") {
        return res.status(400).json({ message: "User is on the free plan. Set a paid plan first." });
      }

      const now = new Date();
      let newPaidThroughAt: Date;

      if (parsedBody.data.paidThroughAt) {
        newPaidThroughAt = new Date(parsedBody.data.paidThroughAt);
        if (Number.isNaN(newPaidThroughAt.getTime())) {
          return res.status(400).json({ message: "Invalid paidThroughAt datetime" });
        }
      } else {
        const durationDays = parsedBody.data.durationDays as number;
        let baseline = now;
        const trialEndsAt = ((target as any).trialEndsAt ?? null) as Date | null;
        const currentPaidThroughAt = ((target as any).paidThroughAt ?? null) as Date | null;
        if (trialEndsAt && trialEndsAt.getTime() > baseline.getTime()) baseline = trialEndsAt;
        if (currentPaidThroughAt && currentPaidThroughAt.getTime() > baseline.getTime()) baseline = currentPaidThroughAt;
        newPaidThroughAt = new Date(baseline.getTime() + durationDays * 24 * 60 * 60 * 1000);
      }

      await storage.updateUser(
        targetUserId,
        {
          paidThroughAt: newPaidThroughAt,
          planStatus: "active",
          billingSuspendedAt: null,
          billingSuspendedReason: null,
          billingSuspendedBy: req.user!.id,
        } as any,
      );

      await writeActorWorkspaceAudit(req, {
        action: "admin.billing_allow",
        targetType: "user",
        targetId: String(targetUserId),
        details: {
          paidThroughAt: newPaidThroughAt.toISOString(),
          source:
            parsedBody.data.paidThroughAt !== undefined ? "paidThroughAt" : "durationDays",
          durationDays: parsedBody.data.durationDays ?? null,
        },
      });

      await clearWorkspaceSessions(targetUserId);
      return res.json({ ok: true, paidThroughAt: newPaidThroughAt });
    } catch (error: any) {
      console.error("Error allowing billing for user:", error);
      return res.status(500).json({ message: error?.message || "Failed to allow billing" });
    }
  });

  // Admin-only: activate a paid plan and set paid-through in one step (manual billing)
  app.post("/api/admin/users/:id/activate-plan", authMiddleware, async (req, res) => {
    try {
      if (!requireAdmin(req, res)) return;

      const parsedParams = adminUserIdParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        return res.status(400).json({ message: fromZodError(parsedParams.error).message });
      }

      const bodySchema = z.object({
        plan: z.enum(["standard", "pro"]),
        durationDays: z.coerce.number().int().min(1).max(3650),
      });
      const parsedBody = bodySchema.safeParse(req.body ?? {});
      if (!parsedBody.success) {
        return res.status(400).json({ message: fromZodError(parsedBody.error).message });
      }

      const targetUserId = parsedParams.data.id;
      if (targetUserId === req.user!.id) {
        return res.status(400).json({ message: "You cannot modify your own billing status" });
      }

      const target = await storage.getUser(targetUserId);
      if (!target) return res.status(404).json({ message: "User not found" });

      const actorIsOwner = req.user!.role === "owner";
      if (target.role === "owner") {
        return res.status(400).json({ message: "Cannot modify the owner account" });
      }
      if (target.role === "admin" && !actorIsOwner) {
        return res.status(403).json({ message: "Only the owner can modify admin accounts" });
      }

      // Billing is workspace-level; only apply it to workspace owners (customers), not their invited members.
      if ((target as any).workspaceOwnerId) {
        return res.status(400).json({ message: "Plan activation applies to workspace owners only" });
      }
      if (target.role !== "user") {
        return res.status(400).json({ message: "Plan activation applies to customer accounts only" });
      }

      const now = new Date();
      const currentPaidThroughAt = ((target as any).paidThroughAt ?? null) as Date | null;
      let baseline = now;
      if (currentPaidThroughAt && currentPaidThroughAt.getTime() > baseline.getTime()) baseline = currentPaidThroughAt;
      const newPaidThroughAt = new Date(baseline.getTime() + parsedBody.data.durationDays * 24 * 60 * 60 * 1000);

      const update: Record<string, any> = {
        plan: parsedBody.data.plan,
        planStatus: "active",
        planUpdatedAt: now,
        paidThroughAt: newPaidThroughAt,
        // Clear any billing suspension so the workspace can log in immediately.
        billingSuspendedAt: null,
        billingSuspendedReason: null,
        billingSuspendedBy: req.user!.id,
        // Trials are no longer supported.
        trialEndsAt: null,
      };
      if (!(target as any).planSelectedAt) {
        update.planSelectedAt = now;
      }

      await storage.updateUser(targetUserId, update as any);

      await writeActorWorkspaceAudit(req, {
        action: "admin.billing_activate_plan",
        targetType: "user",
        targetId: String(targetUserId),
        details: {
          plan: parsedBody.data.plan,
          durationDays: parsedBody.data.durationDays,
          paidThroughAt: newPaidThroughAt.toISOString(),
        },
      });

      await clearWorkspaceSessions(targetUserId);
      return res.json({ ok: true, plan: parsedBody.data.plan, paidThroughAt: newPaidThroughAt });
    } catch (error: any) {
      console.error("Error activating plan for user:", error);
      return res.status(500).json({ message: error?.message || "Failed to activate plan" });
    }
  });

  // Admin-only: downgrade a customer back to Free (clears paid-through and billing suspension)
  app.post("/api/admin/users/:id/downgrade-to-free", authMiddleware, async (req, res) => {
    try {
      if (!requireAdmin(req, res)) return;

      const parsed = adminUserIdParamsSchema.safeParse(req.params);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).message });
      }

      const targetUserId = parsed.data.id;
      if (targetUserId === req.user!.id) {
        return res.status(400).json({ message: "You cannot modify your own account" });
      }

      const target = await storage.getUser(targetUserId);
      if (!target) return res.status(404).json({ message: "User not found" });

      const actorIsOwner = req.user!.role === "owner";
      if (target.role === "owner") {
        return res.status(400).json({ message: "Cannot modify the owner account" });
      }
      if (target.role === "admin" && !actorIsOwner) {
        return res.status(403).json({ message: "Only the owner can modify admin accounts" });
      }

      if ((target as any).workspaceOwnerId) {
        return res.status(400).json({ message: "Downgrade applies to workspace owners only" });
      }
      if (target.role !== "user") {
        return res.status(400).json({ message: "Downgrade applies to customer accounts only" });
      }

      const now = new Date();
      const update: Record<string, any> = {
        plan: "free",
        planStatus: "active",
        planUpdatedAt: now,
        paidThroughAt: null,
        billingSuspendedAt: null,
        billingSuspendedReason: null,
        billingSuspendedBy: req.user!.id,
        trialEndsAt: null,
      };
      if (!(target as any).planSelectedAt) {
        update.planSelectedAt = now;
      }

      await storage.updateUser(targetUserId, update as any);
      await writeActorWorkspaceAudit(req, {
        action: "admin.billing_downgrade_free",
        targetType: "user",
        targetId: String(targetUserId),
        details: {
          fromPlan: normalizePlan((target as any).plan),
          toPlan: "free",
        },
      });
      await clearWorkspaceSessions(targetUserId);
      return res.json({ ok: true });
    } catch (error: any) {
      console.error("Error downgrading user to free:", error);
      return res.status(500).json({ message: error?.message || "Failed to downgrade user" });
    }
  });

  // Admin-only: permanently delete a user (and invalidate sessions)
  app.delete("/api/admin/users/:id", authMiddleware, async (req, res) => {
    try {
      if (!requireAdmin(req, res)) return;

      const parsed = adminUserIdParamsSchema.safeParse(req.params);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).message });
      }

      const targetUserId = parsed.data.id;
      if (targetUserId === req.user!.id) {
        return res.status(400).json({ message: "You cannot delete your own account" });
      }

      const target = await storage.getUser(targetUserId);
      if (!target) return res.status(404).json({ message: "User not found" });
      const actorIsOwner = req.user!.role === "owner";
      if (target.role === "owner") {
        return res.status(400).json({ message: "Cannot delete the owner account" });
      }
      if (target.role === "admin" && !actorIsOwner) {
        return res.status(403).json({ message: "Only the owner can delete admin accounts" });
      }

      // Prevent FK issues and free seats:
      // - Emails whitelisted *by* this user should be disabled and disassociated.
      // - This user's own email (if whitelisted by someone else) should be disabled.
      await db
        .update(emailWhitelist)
        .set({ addedBy: null, isActive: false })
        .where(eq(emailWhitelist.addedBy, targetUserId));
      await db
        .update(emailWhitelist)
        .set({ isActive: false })
        .where(eq(emailWhitelist.email, target.email.toLowerCase()));

      await clearUserSessions(targetUserId);
      await storage.deleteUser(targetUserId);

      await writeActorWorkspaceAudit(req, {
        action: "admin.user_deleted",
        targetType: "user",
        targetId: String(targetUserId),
        details: {
          email: target.email,
          role: target.role,
        },
      });

      return res.json({ ok: true });
    } catch (error: any) {
      console.error("Error deleting user:", error);
      return res.status(500).json({ message: error?.message || "Failed to delete user" });
    }
  });

  // Team members API endpoint
  app.get("/api/team/members", authMiddleware, requireWorkspaceRole("admin"), async (req, res) => {
    try {
      const now = new Date();
      const actorUserId = req.user!.id;
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);

      const workspaceUsers = await db
        .select()
        .from(users)
        .where(or(eq(users.id, workspaceOwnerId), eq(users.workspaceOwnerId, workspaceOwnerId)))
        .orderBy(desc(users.createdAt));

      const formattedMembers = workspaceUsers.map((user) => {
        const isOwner = user.id === workspaceOwnerId;
        const isDisabled = !user.isActive || (user as any).isBanned;
        const workspaceRole = isOwner ? "admin" : ((user as any).workspaceRole ?? "viewer");

        return {
          id: `user:${user.id}`,
          kind: "user",
          userId: user.id,
          name: user.fullName,
          email: user.email,
          role: workspaceRole,
          status: isDisabled ? "disabled" : "active",
          lastActive: user.id === actorUserId ? "Just now" : "Recently",
        };
      });

      const invitations = await db
        .select()
        .from(teamInvitations)
        .where(
          and(
            // Back-compat: older invites may not have workspaceOwnerId populated.
            or(
              eq(teamInvitations.workspaceOwnerId, workspaceOwnerId),
              and(isNull(teamInvitations.workspaceOwnerId), eq(teamInvitations.invitedBy, workspaceOwnerId)),
            ),
            eq(teamInvitations.status, "pending"),
          ),
        )
        .orderBy(desc(teamInvitations.createdAt));

      const memberEmails = new Set(workspaceUsers.map((u) => u.email));
      const formattedInvites = invitations
        .filter((invitation) => !memberEmails.has(invitation.email))
        .map((invitation) => ({
          id: `invite:${invitation.id}`,
          kind: "invitation",
          invitationId: invitation.id,
          name: invitation.email,
          email: invitation.email,
          role: invitation.role,
          status: invitation.expiresAt > now ? "invited" : "expired",
          lastActive: invitation.expiresAt > now ? "Pending invitation" : "Invitation expired",
          expiresAt: invitation.expiresAt,
        }));

      res.json([...formattedMembers, ...formattedInvites]);
    } catch (error: any) {
      console.error("Error fetching team members:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Invite a team member to this workspace (reserves a seat immediately).
  app.post("/api/team/invite", authMiddleware, requireWorkspaceRole("admin"), async (req, res) => {
    try {
      const bodySchema = z.object({
        email: z.string().trim().email("Valid email is required"),
        role: z.enum(["admin", "moderator", "viewer"]),
      });

      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).message });
      }

      const actorUserId = req.user!.id;
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const normalizedEmail = parsed.data.email.toLowerCase().trim();

      if (normalizedEmail === req.user!.email.toLowerCase()) {
        return res.status(400).json({ message: "You cannot invite yourself" });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(normalizedEmail);
      if (existingUser) {
        return res.status(400).json({ message: "User with this email already exists" });
      }

      // Avoid issuing multiple active invitations for the same email (workspace-scoped)
      const existingInvitations = await storage.getTeamInvitationsByEmail(normalizedEmail);
      const hasActiveInvite = existingInvitations.some((invitation) => {
        if (invitation.status !== "pending") return false;
        if (invitation.expiresAt <= new Date()) return false;
        const inviteWorkspaceOwnerId = invitation.workspaceOwnerId ?? invitation.invitedBy;
        return inviteWorkspaceOwnerId === workspaceOwnerId;
      });
      if (hasActiveInvite) {
        return res.status(400).json({ message: "An active invitation already exists for this email" });
      }

      // Enforce seat limits based on the workspace owner's subscription tier.
      const ownerUser = workspaceOwnerId === actorUserId ? (req.user as any) : await storage.getUser(workspaceOwnerId);
      const entitlements = getEntitlementsForUser(ownerUser as any);
      const seatUsage = await getSeatUsageForOwner(workspaceOwnerId);

      if (!hasSeatCapacity(seatUsage, entitlements)) {
        return res.status(402).json(buildSeatLimitError(seatUsage, entitlements));
      }

      // Create invitation with 7-day expiry so the frontend can share a join link
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const invitation = await storage.createTeamInvitation({
        email: normalizedEmail,
        role: parsed.data.role,
        invitedBy: actorUserId,
        workspaceOwnerId,
        expiresAt,
      });

      const baseUrl = process.env.BASE_URL || "http://localhost:5000";
      const inviteLink = `${baseUrl}/accept-invitation?token=${invitation.token}`;

      return res.status(201).json({ 
        message: "Invitation created.",
        invitation: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
        },
        inviteLink,
        status: "success"
      });
    } catch (error: any) {
      console.error("Error creating team invitation:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get invitation by token (for public access to view invitation details)
  app.get("/api/team/invite/token/:token", async (req, res) => {
    try {
      const token = req.params.token;
      
      if (!token) {
        return res.status(400).json({ message: "Token is required" });
      }
      
      const invitation = await storage.getTeamInvitationByToken(token);
      
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found or has expired" });
      }
      
      // Check if invitation has expired
      if (invitation.expiresAt < new Date()) {
        return res.status(410).json({ message: "This invitation has expired" });
      }
      
      // Don't return the token in the response for security reasons
      const { token: _, ...safeInvitation } = invitation;
      
      res.json({
        message: "Invitation found",
        invitation: safeInvitation
      });
    } catch (error: any) {
      console.error("Error retrieving invitation:", error);
      res.status(500).json({ message: error.message || "Failed to retrieve invitation" });
    }
  });

  // Get invitation link (for administrators/inviters)
  app.get("/api/team/invite/:id/link", authMiddleware, requireWorkspaceRole("admin"), async (req, res) => {
    try {
      const invitationId = parseInt(req.params.id);
      
      if (isNaN(invitationId)) {
        return res.status(400).json({ message: "Invalid invitation ID" });
      }
      
      const invitation = await storage.getTeamInvitation(invitationId);
      
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const invitationWorkspaceOwnerId = invitation.workspaceOwnerId ?? invitation.invitedBy;
      if (invitationWorkspaceOwnerId !== workspaceOwnerId) {
        return res.status(403).json({ message: "You don't have permission to view this invitation link" });
      }
      
      // Check if invitation has expired
      if (invitation.expiresAt < new Date()) {
        return res.status(410).json({ message: "This invitation has expired" });
      }
      
      // Generate invite link
      const baseUrl = process.env.BASE_URL || `http://localhost:5000`;
      const inviteLink = `${baseUrl}/accept-invitation?token=${invitation.token}`;
      
      res.json({
        message: "Invitation link retrieved",
        inviteLink,
        invitation: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          status: invitation.status,
          createdAt: invitation.createdAt,
          expiresAt: invitation.expiresAt
        }
      });
    } catch (error: any) {
      console.error("Error retrieving invitation link:", error);
      res.status(500).json({ message: error.message || "Failed to retrieve invitation link" });
    }
  });
  
  // Cancel/delete invitation API endpoint
  app.delete("/api/team/invite/:id", authMiddleware, requireWorkspaceRole("admin"), async (req, res) => {
    try {
      const invitationId = parseInt(req.params.id);
      
      if (isNaN(invitationId)) {
        return res.status(400).json({ message: "Invalid invitation ID" });
      }
      
      const invitation = await storage.getTeamInvitation(invitationId);
      
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      if (invitation.status !== "pending") {
        return res.status(400).json({ message: `Invitation is ${invitation.status}` });
      }
      
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const invitationWorkspaceOwnerId = invitation.workspaceOwnerId ?? invitation.invitedBy;
      if (invitationWorkspaceOwnerId !== workspaceOwnerId) {
        return res.status(403).json({ message: "You don't have permission to cancel this invitation" });
      }
      
      const deleted = await storage.deleteTeamInvitation(invitationId);
      
      if (!deleted) {
        return res.status(500).json({ message: "Failed to delete invitation" });
      }
      
      res.json({ message: "Invitation cancelled successfully" });
    } catch (error: any) {
      console.error("Error cancelling team invitation:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Remove a user from this workspace (frees a seat).
  app.delete("/api/team/members/:id", authMiddleware, requireWorkspaceRole("admin"), async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const actorUserId = req.user!.id;
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      // Prevent removing self or workspace owner.
      if (userId === actorUserId) {
        return res.status(400).json({ message: "You cannot remove yourself from the team" });
      }
      if (userId === workspaceOwnerId) {
        return res.status(400).json({ message: "You cannot remove the workspace owner" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      if ((user as any).workspaceOwnerId !== workspaceOwnerId) {
        return res.status(403).json({ message: "You can only remove members from your workspace" });
      }
      
      const updated = await storage.updateUser(userId, {
        workspaceOwnerId: null,
        workspaceRole: "admin",
      } as any);

      if (!updated) {
        return res.status(500).json({ message: "Failed to remove user from workspace" });
      }

      res.json({ message: "User removed from workspace successfully" });
    } catch (error: any) {
      console.error("Error removing user from workspace:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Accept invitation endpoint
  app.get("/api/team/accept-invitation/:token", async (req, res) => {
    try {
      const { token } = req.params;
      
      const invitation = await storage.getTeamInvitationByToken(token);
      
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }
      
      if (invitation.status !== "pending") {
        return res.status(400).json({ message: `Invitation is ${invitation.status}` });
      }
      
      const now = new Date();
      if (invitation.expiresAt < now) {
        return res.status(400).json({ message: "Invitation has expired" });
      }
      
      // Return invitation details so the frontend can show a registration form
      res.json({
        email: invitation.email,
        role: invitation.role,
        token: invitation.token
      });
    } catch (error: any) {
      console.error("Error accepting invitation:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Accept invitation and create an account under the inviter's workspace.
  app.post("/api/team/accept-invitation/:token", async (req, res) => {
    try {
      const paramsSchema = z.object({
        token: z.string().min(1, "Token is required"),
      });
      const bodySchema = z
        .object({
          fullName: z.string().trim().min(2, "Full name is required"),
          password: z.string().min(8, "Password must be at least 8 characters"),
          confirmPassword: z.string().min(8, "Please confirm your password"),
        })
        .refine((data) => data.password === data.confirmPassword, {
          message: "Passwords do not match",
          path: ["confirmPassword"],
        });

      const parsedParams = paramsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        return res.status(400).json({ message: fromZodError(parsedParams.error).message });
      }

      const parsedBody = bodySchema.safeParse(req.body);
      if (!parsedBody.success) {
        return res.status(400).json({ message: fromZodError(parsedBody.error).message });
      }

      const { token } = parsedParams.data;
      const invitation = await storage.getTeamInvitationByToken(token);
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      if (invitation.status !== "pending") {
        return res.status(400).json({ message: `Invitation is ${invitation.status}` });
      }

      const now = new Date();
      if (invitation.expiresAt < now) {
        return res.status(400).json({ message: "Invitation has expired" });
      }

      const normalizedEmail = invitation.email.toLowerCase().trim();

      const existingUser = await storage.getUserByEmail(normalizedEmail);
      if (existingUser) {
        return res.status(409).json({ message: "An account with this email already exists" });
      }

      const inviter = await storage.getUser(invitation.invitedBy);
      if (!inviter) {
        return res.status(400).json({ message: "Invitation inviter no longer exists" });
      }

      const workspaceOwnerId = invitation.workspaceOwnerId ?? getWorkspaceOwnerId(inviter as any);

      const hashed = await hashPassword(parsedBody.data.password);
      const created = await storage.createUser({
        email: normalizedEmail,
        fullName: parsedBody.data.fullName.trim(),
        password: hashed,
        role: "user",
      });

      await storage.updateUser(created.id, {
        workspaceOwnerId,
        workspaceRole: invitation.role,
      } as any);

      await storage.updateTeamInvitation(invitation.id, {
        status: "accepted",
        acceptedAt: now,
        workspaceOwnerId,
      } as any);

      return res.status(201).json({ ok: true });
    } catch (error: any) {
      console.error("Error accepting invitation:", error);
      return res.status(500).json({ message: error?.message || "Failed to accept invitation" });
    }
  });
  
  // Team settings API endpoint
  app.get("/api/team/settings", authMiddleware, requireWorkspaceRole("admin"), async (req, res) => {
    try {
      const { db } = await import("./db");
      const { teamSettings } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      // Use the workspace owner for shared settings.
      const userId = getWorkspaceOwnerId(req.user as any);
      
      // Get team settings from database, or create default if none exists
      let settings = await db.query.teamSettings.findFirst({
        where: eq(teamSettings.userId, userId)
      });
      
      if (!settings) {
        // Create default team settings for this user
        const [newSettings] = await db.insert(teamSettings)
          .values({
            userId,
            name: "ModerateAI Team",
            securitySettings: {
              twoFactorRequired: false,
              sessionTimeoutMinutes: 60
            },
            notificationSettings: {
              newMemberNotifications: true,
              criticalAlertNotifications: true,
              weeklyActivitySummary: true
            }
          })
          .returning();
          
        settings = newSettings;
      }
      
      res.json(settings);
    } catch (error: any) {
      console.error("Error fetching team settings:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Update team settings API endpoint
  app.post("/api/team/settings", authMiddleware, requireWorkspaceRole("admin"), async (req, res) => {
    try {
      const { db } = await import("./db");
      const { teamSettings } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      // Use the workspace owner for shared settings.
      const userId = getWorkspaceOwnerId(req.user as any);
      const { teamName, newMemberNotifications, criticalAlertNotifications, 
              weeklyActivitySummary } = req.body;
      
      // Check if settings exist
      const existingSettings = await db.query.teamSettings.findFirst({
        where: eq(teamSettings.userId, userId)
      });
      
      if (!existingSettings) {
        // Create new settings
        const [newSettings] = await db.insert(teamSettings)
          .values({
            userId,
            name: teamName || "ModerateAI Team",
            notificationSettings: {
              newMemberNotifications: newMemberNotifications !== undefined ? newMemberNotifications : true,
              criticalAlertNotifications: criticalAlertNotifications !== undefined ? criticalAlertNotifications : true,
              weeklyActivitySummary: weeklyActivitySummary !== undefined ? weeklyActivitySummary : true
            }
          })
          .returning();
          
        return res.json({ 
          success: true, 
          message: "Team settings created successfully",
          settings: newSettings
        });
      } else {
        const existingNotificationSettings = (existingSettings.notificationSettings ?? {}) as {
          newMemberNotifications?: boolean;
          criticalAlertNotifications?: boolean;
          weeklyActivitySummary?: boolean;
        };

        // Update existing settings
        const [updatedSettings] = await db.update(teamSettings)
          .set({
            name: teamName !== undefined ? teamName : existingSettings.name,
            notificationSettings: {
              newMemberNotifications: newMemberNotifications !== undefined ? newMemberNotifications : 
                                      existingNotificationSettings.newMemberNotifications ?? true,
              criticalAlertNotifications: criticalAlertNotifications !== undefined ? criticalAlertNotifications : 
                                         existingNotificationSettings.criticalAlertNotifications ?? true,
              weeklyActivitySummary: weeklyActivitySummary !== undefined ? weeklyActivitySummary : 
                                     existingNotificationSettings.weeklyActivitySummary ?? true
            },
            updatedAt: new Date()
          })
          .where(eq(teamSettings.userId, userId))
          .returning();
          
        return res.json({ 
          success: true, 
          message: "Team settings updated successfully",
          settings: updatedSettings
        });
      }
    } catch (error: any) {
      console.error("Error updating team settings:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/workspace/settings", authMiddleware, requireWorkspaceRole("admin"), async (req, res) => {
    try {
      const context = await getWorkspaceModerationSettings(req.user as any);
      const historyDays = getConversationHistoryWindowDaysForUser(context.ownerUser as any);
      const analyticsTier = getAnalyticsTierForUser(context.ownerUser as any);

      return res.json({
        moderationPreset: context.preset,
        moderationRules: context.rules,
        allowedModerationPresets: context.allowedPresets,
        defaultModerationPreset: context.defaultPreset,
        features: {
          historyDays,
          sentimentAnalysis: isSentimentAnalysisAvailableForUser(context.ownerUser as any),
          analyticsTier,
          dataExport: canExportData(context.ownerUser as any),
          auditLog: canAccessAuditLog(context.ownerUser as any),
        },
      });
    } catch (error: any) {
      console.error("Error fetching workspace settings:", error);
      return res.status(500).json({ message: error?.message || "Failed to fetch workspace settings" });
    }
  });

  app.patch("/api/workspace/settings", authMiddleware, requireWorkspaceRole("admin"), async (req, res) => {
    try {
      const bodySchema = z.object({
        moderationPreset: z.enum(["basic", "custom", "advanced"]).optional(),
        moderationRules: z
          .object({
            blockedKeywords: z.array(z.string().trim().min(1)).max(250).optional(),
            allowedKeywords: z.array(z.string().trim().min(1)).max(250).optional(),
            spamSensitivity: z.number().min(0).max(100).optional(),
            strictness: z.number().min(0).max(100).optional(),
          })
          .optional(),
      });

      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).message });
      }

      if (parsed.data.moderationPreset === undefined && parsed.data.moderationRules === undefined) {
        return res.status(400).json({ message: "No workspace settings provided" });
      }

      const context = await getWorkspaceModerationSettings(req.user as any);
      const canCustomizeRules = context.allowedPresets.includes("custom") || context.allowedPresets.includes("advanced");

      if (parsed.data.moderationPreset && !context.allowedPresets.includes(parsed.data.moderationPreset)) {
        return res.status(403).json({
          message: "That moderation preset is not available on the current subscription tier.",
        });
      }

      if (parsed.data.moderationRules && !canCustomizeRules) {
        return res.status(403).json({
          message: "Custom moderation rules are available on Standard and Pro plans.",
        });
      }

      const existingRules = (context.rules ?? {}) as any;
      const incomingRules = parsed.data.moderationRules;

      const mergedRules = incomingRules
        ? {
            blockedKeywords: incomingRules.blockedKeywords ?? existingRules.blockedKeywords ?? [],
            allowedKeywords: incomingRules.allowedKeywords ?? existingRules.allowedKeywords ?? [],
            spamSensitivity: incomingRules.spamSensitivity ?? existingRules.spamSensitivity ?? 50,
            strictness: incomingRules.strictness ?? existingRules.strictness ?? 50,
          }
        : undefined;

      const updated = await storage.upsertWorkspaceSettings(context.workspaceOwnerId, {
        moderationPreset: parsed.data.moderationPreset,
        moderationRules: mergedRules,
      });

      await writeAuditEventSafe({
        ownerUserId: context.workspaceOwnerId,
        actorUserId: req.user!.id,
        action: "workspace.settings_updated",
        targetType: "workspace",
        targetId: String(context.workspaceOwnerId),
        details: {
          moderationPreset: updated.moderationPreset,
          hasModerationRules: Boolean(mergedRules),
          moderationRuleCounts: mergedRules
            ? {
                blockedKeywords: (mergedRules.blockedKeywords ?? []).length,
                allowedKeywords: (mergedRules.allowedKeywords ?? []).length,
              }
            : undefined,
        },
      });

      return res.json({
        moderationPreset: updated.moderationPreset,
        moderationRules: updated.moderationRules,
        allowedModerationPresets: context.allowedPresets,
        defaultModerationPreset: context.defaultPreset,
      });
    } catch (error: any) {
      console.error("Error updating workspace settings:", error);
      return res.status(500).json({ message: error?.message || "Failed to update workspace settings" });
    }
  });
  
  // Roles & permissions API endpoint
  app.get("/api/team/roles", authMiddleware, async (req, res) => {
    try {
      // Real permissions data
      const roles = [
        {
          id: "admin",
          name: "Admin",
          description: "Full access to all features and settings",
          iconColor: "red",
          permissions: [
            { id: "manage_team", name: "Manage team members", granted: true },
            { id: "configure_ai", name: "Configure AI settings", granted: true },
            { id: "manage_integrations", name: "Manage integrations", granted: true },
            { id: "access_billing", name: "Access billing & subscription", granted: true }
          ]
        },
        {
          id: "moderator",
          name: "Moderator",
          description: "Access to manage conversations and moderate content",
          iconColor: "blue",
          permissions: [
            { id: "access_conversations", name: "Access conversations", granted: true },
            { id: "perform_moderation", name: "Perform moderation actions", granted: true },
            { id: "edit_templates", name: "Edit response templates", granted: true },
            { id: "manage_team", name: "Manage team members", granted: false }
          ]
        },
        {
          id: "viewer",
          name: "Viewer",
          description: "Read-only access to view data",
          iconColor: "gray",
          permissions: [
            { id: "view_conversations", name: "View conversations", granted: true },
            { id: "perform_actions", name: "Perform actions", granted: false },
            { id: "edit_settings", name: "Edit settings", granted: false }
          ]
        }
      ];
      
      res.json(roles);
    } catch (error: any) {
      console.error("Error fetching roles and permissions:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Update roles & permissions API endpoint
  app.post("/api/team/roles", authMiddleware, requireWorkspaceRole("admin"), async (req, res) => {
    try {
      console.log('Received roles update request:', JSON.stringify(req.body));
      const { updatedRoles } = req.body;
      
      if (!updatedRoles || !Array.isArray(updatedRoles)) {
        console.log('Invalid roles data received:', req.body);
        return res.status(400).json({ message: "Invalid roles data" });
      }
      
      console.log('Valid roles data, processing update...');
      
      // In a real app, we would save the roles to the database
      // For now, just return success with the updated roles
      
      res.json({ 
        success: true, 
        message: "Roles updated successfully",
        roles: updatedRoles
      });
    } catch (error: any) {
      console.error("Error updating roles and permissions:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/runtime-config", (req, res) => {
    const isUiV2EnabledForRequest = isUiV2PreviewEnabledForRequest(req);
    const isUiWave1RedoEnabledForRequest = isUiWave1RedoPreviewEnabledForRequest(
      req,
      isUiV2EnabledForRequest,
    );
    res.status(200).json({
      uiPerfProfile,
      uiVersion: isUiV2EnabledForRequest ? "v2" : "v1",
      uiV2Enabled: isUiV2EnabledForRequest,
      uiV2RouteScope: uiV2RouteScope.length ? uiV2RouteScope : ["all"],
      uiWave1RedoEnabled: isUiWave1RedoEnabledForRequest,
      uiWave1RedoRouteScope: uiWave1RedoRouteScope,
      uiWave1RedoPreview: isUiWave1RedoEnabledForRequest,
    });
  });

  app.get("/api/admin/ops/runtime-observability", authMiddleware, async (req, res) => {
    try {
      if (!requireAdmin(req, res)) return;

      return res.json({
        generatedAt: new Date().toISOString(),
        requestTracing: {
          header: "X-Request-Id",
          slowRequestThresholdMs: parsePositiveInt(process.env.API_SLOW_REQUEST_THRESHOLD_MS, 2_000),
        },
        securityHeaders: {
          enabled: parseBooleanEnv(process.env.SECURITY_HEADERS_ENABLED, true),
          hstsMaxAgeSeconds: parsePositiveInt(process.env.SECURITY_HSTS_MAX_AGE_SECONDS, 31_536_000),
        },
        events: getOpsEventSummary([
          "API_SLOW_REQUEST",
          "API_5XX_RESPONSE",
          "AUTH_SESSION_ERROR",
          "AUTH_RATE_LIMIT_429",
          "AUTH_RATE_LIMIT_FAILURE",
          "OPENAI_REQUEST_FAILED",
        ]),
      });
    } catch (error: any) {
      console.error("Error fetching runtime observability summary:", error);
      return res.status(500).json({ message: error?.message || "Failed to fetch runtime observability summary" });
    }
  });

  // Health check
  app.get("/api/health", (_req, res) => {
    res.status(200).json({ status: "ok", mode: process.env.NODE_ENV ?? "development" });
  });

  app.get("/api/dashboard/overview", authMiddleware, async (req, res) => {
    try {
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const limitRaw = Number.parseInt(String(req.query.limit ?? "5"), 10);
      const activityLimit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 5;
      const cacheKey = `${workspaceOwnerId}:${activityLimit}`;

      const overview = await getDashboardOverviewCached(cacheKey, async () => {
        const ownerPlatforms = await ensureWorkspacePlatforms(workspaceOwnerId);
        const ownerUser =
          workspaceOwnerId === req.user!.id ? (req.user as any) : await storage.getUser(workspaceOwnerId);
        if (!ownerUser) {
          throw new Error("Workspace owner not found");
        }

        const stats = await getDashboardStatsForOwner(workspaceOwnerId);
        const recentActivity = await storage.getRecentActivity(activityLimit, workspaceOwnerId);
        const usage = await getWorkspaceUsageSummary(ownerUser, ownerPlatforms as any);

        return {
          stats,
          platforms: ownerPlatforms,
          recentActivity,
          widgetUsage: { usage },
        };
      });

      return res.status(200).json(overview);
    } catch (error: any) {
      console.error("Error fetching dashboard overview:", error);
      return res.status(500).json({ message: error?.message || "Error fetching dashboard overview" });
    }
  });

  // Dashboard stats (kept for compatibility with existing clients)
  app.get("/api/dashboard/stats", authMiddleware, async (req, res) => {
    try {
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const stats = await getDashboardStatsForOwner(workspaceOwnerId);

      res.status(200).json({
        totalConversations: stats.totalConversations,
        aiResponses: stats.aiResponses,
        responseRate: stats.responseRate,
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Error fetching dashboard stats" });
    }
  });

  // Recent activity
  app.get("/api/dashboard/recent-activity", authMiddleware, async (req, res) => {
    try {
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const limit = parseInt(req.query.limit as string) || 5;
      const recentActivity = await storage.getRecentActivity(limit, workspaceOwnerId);
      res.status(200).json(recentActivity);
    } catch (error) {
      console.error("Error fetching recent activity:", error);
      res.status(500).json({ message: "Error fetching recent activity" });
    }
  });
  
  // All activity - for the activity page
  app.get("/api/activity", authMiddleware, async (req, res) => {
    try {
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const limit = parseInt(req.query.limit as string) || 100; // Default to a larger number
      const recentActivity = await storage.getRecentActivity(limit, workspaceOwnerId);
      res.status(200).json(recentActivity);
    } catch (error) {
      console.error("Error fetching all activity:", error);
      res.status(500).json({ message: "Error fetching activity data" });
    }
  });

  app.get("/api/analytics/deep", authMiddleware, requireWorkspaceRole("viewer"), async (req, res) => {
    try {
      const querySchema = z.object({
        days: z.coerce.number().int().min(1).max(365).optional(),
      });
      const parsedQuery = querySchema.safeParse(req.query ?? {});
      if (!parsedQuery.success) {
        return res.status(400).json({ message: fromZodError(parsedQuery.error).message });
      }

      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const ownerUser = await resolveWorkspaceOwnerUser(req.user as any);
      const analyticsTier = getAnalyticsTierForUser(ownerUser as any);
      if (analyticsTier !== "deep") {
        return res.status(403).json({ message: "Deep analytics is available on Pro only." });
      }

      const windowDays = parsedQuery.data.days ?? 30;
      const since = new Date();
      since.setHours(0, 0, 0, 0);
      since.setDate(since.getDate() - (windowDays - 1));

      const toDateKey = (date: Date) => date.toISOString().split("T")[0];

      const dayKeys: string[] = [];
      for (let i = windowDays - 1; i >= 0; i--) {
        const day = new Date();
        day.setHours(0, 0, 0, 0);
        day.setDate(day.getDate() - i);
        dayKeys.push(toDateKey(day));
      }

      const dailyMap = new Map(
        dayKeys.map((day) => [
          day,
          {
            date: day,
            messages: 0,
            aiResponses: 0,
            moderationEvents: 0,
          },
        ]),
      );

      const messageRows = await db
        .select({
          createdAt: messages.createdAt,
          sender: messages.sender,
          platformType: platforms.type,
        })
        .from(messages)
        .innerJoin(conversations, eq(conversations.id, messages.conversationId))
        .innerJoin(platforms, eq(platforms.id, conversations.platformId))
        .where(and(eq(platforms.userId, workspaceOwnerId), gt(messages.createdAt, since)));

      const recentConversationRows = await db
        .select({
          id: conversations.id,
        })
        .from(conversations)
        .innerJoin(platforms, eq(platforms.id, conversations.platformId))
        .where(and(eq(platforms.userId, workspaceOwnerId), gt(conversations.createdAt, since)));

      const moderationRows = await db
        .select({
          createdAt: moderationActions.createdAt,
          platformType: moderationActions.platformType,
          action: moderationActions.action,
          ruleSource: moderationActions.ruleSource,
        })
        .from(moderationActions)
        .where(and(eq(moderationActions.ownerUserId, workspaceOwnerId), gt(moderationActions.createdAt, since)));

      const workspacePlatforms = await storage.getPlatformsByUserId(workspaceOwnerId);
      const platformBreakdownMap = new Map<
        string,
        {
          platformType: string;
          messages: number;
          aiResponses: number;
          moderationEvents: number;
          contentFiltered: number;
          spamBlocked: number;
          warningsIssued: number;
        }
      >();

      const ensurePlatformBucket = (type: string) => {
        const normalized = String(type || "unknown").toLowerCase();
        if (!platformBreakdownMap.has(normalized)) {
          platformBreakdownMap.set(normalized, {
            platformType: normalized,
            messages: 0,
            aiResponses: 0,
            moderationEvents: 0,
            contentFiltered: 0,
            spamBlocked: 0,
            warningsIssued: 0,
          });
        }
        return platformBreakdownMap.get(normalized)!;
      };

      for (const platform of workspacePlatforms) {
        ensurePlatformBucket(platform.type);
      }

      let userMessageCount = 0;
      let aiResponseCount = 0;
      for (const row of messageRows) {
        const dateKey = toDateKey(row.createdAt);
        const dayBucket = dailyMap.get(dateKey);
        if (dayBucket) {
          dayBucket.messages += 1;
          if (row.sender === "ai") dayBucket.aiResponses += 1;
        }

        const platformBucket = ensurePlatformBucket(row.platformType);
        platformBucket.messages += 1;
        if (row.sender === "ai") {
          platformBucket.aiResponses += 1;
          aiResponseCount += 1;
        } else if (row.sender === "user") {
          userMessageCount += 1;
        }
      }

      const actionBreakdownMap = new Map<string, number>();
      const ruleSourceBreakdownMap = new Map<string, number>();
      let moderationEventCount = 0;
      let contentFiltered = 0;
      let spamBlocked = 0;
      let warningsIssued = 0;

      for (const row of moderationRows) {
        moderationEventCount += 1;

        const dateKey = toDateKey(row.createdAt);
        const dayBucket = dailyMap.get(dateKey);
        if (dayBucket) {
          dayBucket.moderationEvents += 1;
        }

        const platformBucket = ensurePlatformBucket(row.platformType);
        platformBucket.moderationEvents += 1;

        actionBreakdownMap.set(row.action, (actionBreakdownMap.get(row.action) ?? 0) + 1);
        ruleSourceBreakdownMap.set(row.ruleSource, (ruleSourceBreakdownMap.get(row.ruleSource) ?? 0) + 1);

        if (row.action === "content_filtered") {
          contentFiltered += 1;
          platformBucket.contentFiltered += 1;
        } else if (row.action === "spam_blocked") {
          spamBlocked += 1;
          platformBucket.spamBlocked += 1;
        } else if (row.action === "warning_issued") {
          warningsIssued += 1;
          platformBucket.warningsIssued += 1;
        }
      }

      const responseRate = userMessageCount > 0 ? Math.round((aiResponseCount / userMessageCount) * 10000) / 100 : 0;
      const platformBreakdown = Array.from(platformBreakdownMap.values()).sort((a, b) => b.messages - a.messages);
      const actionBreakdown = Array.from(actionBreakdownMap.entries())
        .map(([action, count]) => ({ action, count }))
        .sort((a, b) => b.count - a.count);
      const ruleSourceBreakdown = Array.from(ruleSourceBreakdownMap.entries())
        .map(([ruleSource, count]) => ({ ruleSource, count }))
        .sort((a, b) => b.count - a.count);

      await writeAuditEventSafe({
        ownerUserId: workspaceOwnerId,
        actorUserId: req.user!.id,
        action: "deep_analytics.viewed",
        targetType: "workspace",
        targetId: String(workspaceOwnerId),
        details: {
          windowDays,
          returnedMessages: messageRows.length,
          returnedModerationEvents: moderationRows.length,
        },
      });

      return res.json({
        generatedAt: new Date().toISOString(),
        windowDays,
        totals: {
          conversationCount: recentConversationRows.length,
          totalMessages: messageRows.length,
          aiResponses: aiResponseCount,
          responseRate,
          moderationEvents: moderationEventCount,
          contentFiltered,
          spamBlocked,
          warningsIssued,
        },
        dailyTrend: dayKeys.map((key) => dailyMap.get(key)!),
        platformBreakdown,
        actionBreakdown,
        ruleSourceBreakdown,
      });
    } catch (error: any) {
      console.error("Error fetching deep analytics:", error);
      return res.status(500).json({ message: error?.message || "Error fetching deep analytics" });
    }
  });

  app.get("/api/moderation/actions", authMiddleware, requireWorkspaceRole("moderator"), async (req, res) => {
    try {
      const querySchema = z.object({
        limit: z.coerce.number().int().min(1).max(1000).optional(),
        platformId: z.coerce.number().int().positive().optional(),
        action: z.string().trim().min(1).max(100).optional(),
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
      });

      const parsedQuery = querySchema.safeParse(req.query ?? {});
      if (!parsedQuery.success) {
        return res.status(400).json({ message: fromZodError(parsedQuery.error).message });
      }

      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const limit = parsedQuery.data.limit ?? 200;
      const action = parsedQuery.data.action?.trim();
      const from = parsedQuery.data.from ? new Date(parsedQuery.data.from) : undefined;
      const to = parsedQuery.data.to ? new Date(parsedQuery.data.to) : undefined;

      if (parsedQuery.data.platformId !== undefined) {
        const platform = await storage.getPlatform(parsedQuery.data.platformId);
        if (!platform || platform.userId !== workspaceOwnerId) {
          return res.status(404).json({ message: "Platform not found" });
        }
      }

      const items = await listModerationActionsForWorkspace(workspaceOwnerId, {
        limit,
        platformId: parsedQuery.data.platformId,
        action: action || undefined,
        from,
        to,
      });

      await writeAuditEventSafe({
        ownerUserId: workspaceOwnerId,
        actorUserId: req.user!.id,
        action: "moderation_log.viewed",
        targetType: "workspace",
        targetId: String(workspaceOwnerId),
        details: {
          filterPlatformId: parsedQuery.data.platformId ?? null,
          filterAction: action ?? null,
          from: from?.toISOString() ?? null,
          to: to?.toISOString() ?? null,
          returnedCount: items.length,
        },
      });

      return res.json({
        generatedAt: new Date().toISOString(),
        count: items.length,
        items,
      });
    } catch (error: any) {
      console.error("Error fetching moderation actions:", error);
      return res.status(500).json({ message: error?.message || "Error fetching moderation actions" });
    }
  });

  app.get("/api/audit-log", authMiddleware, requireWorkspaceRole("admin"), async (req, res) => {
    try {
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const ownerUser = await resolveWorkspaceOwnerUser(req.user as any);
      if (!canAccessAuditLog(ownerUser as any)) {
        return res.status(403).json({ message: "Audit log is available on Pro only." });
      }

      const limit = Math.max(1, Math.min(500, parseInt(req.query.limit as string) || 200));
      const rawAction =
        typeof req.query.action === "string" ? req.query.action.trim() : "";
      const actionFilter = rawAction.length > 0 ? rawAction : null;
      const items = actionFilter
        ? await getAuditEventsByAction(workspaceOwnerId, actionFilter, limit)
        : await getAuditEventsForWorkspace(workspaceOwnerId, limit);

      await writeAuditEventSafe({
        ownerUserId: workspaceOwnerId,
        actorUserId: req.user!.id,
        action: "audit_log.viewed",
        targetType: "workspace",
        targetId: String(workspaceOwnerId),
        details: {
          filterAction: actionFilter,
          returnedCount: items.length,
        },
      });

      return res.json({
        generatedAt: new Date().toISOString(),
        count: items.length,
        items: items.map((item) => ({
          id: item.id,
          ownerUserId: item.ownerUserId,
          actorUserId: item.actorUserId,
          action: item.action,
          targetType: item.targetType,
          targetId: item.targetId,
          details: item.details ?? {},
          createdAt: item.createdAt,
        })),
      });
    } catch (error: any) {
      console.error("Error fetching audit log:", error);
      return res.status(500).json({ message: error?.message || "Error fetching audit log" });
    }
  });

  app.get("/api/export/messages", authMiddleware, requireWorkspaceRole("admin"), async (req, res) => {
    try {
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const ownerUser = await resolveWorkspaceOwnerUser(req.user as any);
      if (!canExportData(ownerUser as any)) {
        return res.status(403).json({ message: "Data export is available on Pro only." });
      }

      const requestedPlatformId = req.query.platformId ? parseInt(req.query.platformId as string) : null;
      const format = String(req.query.format ?? "json").toLowerCase();
      if (format !== "json" && format !== "csv") {
        return res.status(400).json({ message: "format must be json or csv" });
      }

      const allPlatforms = await storage.getPlatformsByUserId(workspaceOwnerId);
      const selectedPlatforms =
        requestedPlatformId === null
          ? allPlatforms
          : allPlatforms.filter((platform) => platform.id === requestedPlatformId);

      if (requestedPlatformId !== null && selectedPlatforms.length === 0) {
        return res.status(404).json({ message: "Platform not found" });
      }

      const rows: Array<Record<string, any>> = [];
      for (const platform of selectedPlatforms) {
        const platformConversations = await storage.getConversationsByPlatformId(platform.id);
        for (const conversation of platformConversations) {
          const conversationMessages = await storage.getMessagesByConversationId(conversation.id);
          for (const message of conversationMessages) {
            rows.push({
              platformId: platform.id,
              platformType: platform.type,
              platformName: platform.name,
              conversationId: conversation.id,
              conversationExternalId: conversation.externalId,
              conversationExternalUserId: conversation.externalUserId,
              messageId: message.id,
              sender: message.sender,
              content: message.content,
              createdAt: message.createdAt,
            });
          }
        }
      }

      await writeAuditEventSafe({
        ownerUserId: workspaceOwnerId,
        actorUserId: req.user!.id,
        action: "data_export.messages",
        targetType: "workspace",
        targetId: String(workspaceOwnerId),
        details: {
          format,
          platformId: requestedPlatformId,
          platformCount: selectedPlatforms.length,
          exportedRows: rows.length,
        },
      });

      if (format === "csv") {
        const headers = [
          "platformId",
          "platformType",
          "platformName",
          "conversationId",
          "conversationExternalId",
          "conversationExternalUserId",
          "messageId",
          "sender",
          "content",
          "createdAt",
        ];
        const escapeCsv = (value: unknown) => `"${String(value ?? "").replace(/\"/g, "\"\"")}"`;
        const csv = [
          headers.join(","),
          ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(",")),
        ].join("\n");

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", "attachment; filename=moderateai-message-export.csv");
        return res.status(200).send(csv);
      }

      return res.status(200).json({
        exportedAt: new Date().toISOString(),
        count: rows.length,
        items: rows,
      });
    } catch (error: any) {
      console.error("Error exporting messages:", error);
      return res.status(500).json({ message: error?.message || "Error exporting messages" });
    }
  });

  // Telegram Analytics endpoint
  app.get("/api/platforms/:id/analytics", authMiddleware, async (req, res) => {
    try {
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const ownerUser = await resolveWorkspaceOwnerUser(req.user as any);
      const analyticsTier = getAnalyticsTierForUser(ownerUser as any);
      if (analyticsTier === "none") {
        return res.status(403).json({ message: "Analytics are available on Standard and Pro plans." });
      }

      const platformId = parseInt(req.params.id);
      if (isNaN(platformId)) {
        return res.status(400).json({ message: "Invalid platform ID" });
      }
      
      // Verify platform exists and belongs to user
      const platform = await storage.getPlatform(platformId);
      if (!platform || platform.userId !== workspaceOwnerId) {
        return res.status(404).json({ message: "Platform not found" });
      }
      
      let analytics;
      if (platform.type === 'telegram') {
        analytics = await storage.getTelegramAnalytics(platformId);
      } else if (platform.type === 'discord') {
        analytics = await storage.getDiscordAnalytics(platformId);
      } else {
        return res.status(400).json({ message: "Analytics not available for this platform type" });
      }

      if (analyticsTier === "deep") {
        const recentActivity = await storage.getRecentActivity(100, workspaceOwnerId);
        const groupedByPlatform = recentActivity.reduce<Record<string, number>>((acc, item) => {
          acc[item.platform] = (acc[item.platform] ?? 0) + 1;
          return acc;
        }, {});

        return res.status(200).json({
          ...analytics,
          deepAnalytics: {
            recentActivityCount: recentActivity.length,
            activityByPlatform: groupedByPlatform,
          },
        });
      }

      res.status(200).json(analytics);
    } catch (error) {
      console.error("Error fetching platform analytics:", error);
      res.status(500).json({ message: "Error fetching analytics data" });
    }
  });

  // Chat Configuration endpoints
  
  // Get all chat configurations for a platform
  app.get("/api/platforms/:id/chat-configurations", authMiddleware, async (req, res) => {
    try {
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const platformId = parseInt(req.params.id);
      
      // Verify platform belongs to user
      const platform = await storage.getPlatform(platformId);
      if (!platform || platform.userId !== workspaceOwnerId) {
        return res.status(404).json({ message: "Platform not found" });
      }
      
      const chatConfigs = await storage.getChatConfigurationsByPlatformId(platformId);
      const enriched = await enrichChatConfigurationsWithLocks(platformId, chatConfigs);
      res.json(enriched);
    } catch (error: any) {
      console.error("Error fetching chat configurations:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/ops/admin-history-learning", authMiddleware, async (req, res) => {
    try {
      if (!requireAdmin(req, res)) return;

      return res.json({
        generatedAt: new Date().toISOString(),
        config: {
          autoAnalysisEnabled: adminHistoryAutoAnalysisEnabled,
          autoAnalysisIntervalMs: adminHistoryAutoAnalysisIntervalMs,
          autoAnalysisMinNewAdminMessages: adminHistoryAutoAnalysisMinNewAdminMessages,
          backfillOnStartupEnabled: adminHistoryBackfillOnStartupEnabled,
          backfillMaxDays: adminHistoryBackfillMaxDays,
          backfillMaxMessagesPerDestination: adminHistoryBackfillMaxMessagesPerDestination,
        },
        backfill: getAdminHistoryBackfillDebugState(),
        autoAnalysis: getAdminHistoryAutoAnalysisDebugState(),
        events: getOpsEventSummary([
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
        ]),
      });
    } catch (error: any) {
      console.error("Error fetching admin-history learning debug summary:", error);
      return res.status(500).json({ message: error?.message || "Failed to fetch admin-history learning debug summary" });
    }
  });

  app.post("/api/admin/ops/admin-history-learning/backfill", authMiddleware, async (req, res) => {
    try {
      if (!requireAdmin(req, res)) return;

      const parsed = z.object({
        force: z.boolean().optional().default(false),
      }).safeParse(req.body ?? {});

      if (!parsed.success) {
        return res.status(400).json({ status: "error", message: fromZodError(parsed.error).message });
      }

      const triggerResult = triggerAdminHistoryBackfill({
        force: parsed.data.force,
        source: "manual",
      });

      if (triggerResult.status === "already_running") {
        return res.status(409).json({
          status: "already_running",
          message: triggerResult.message,
          runId: triggerResult.runId ?? null,
        });
      }

      if (triggerResult.status === "already_completed") {
        return res.status(409).json({
          status: "already_completed",
          message: triggerResult.message,
          canForce: true,
        });
      }

      return res.status(202).json({
        status: "started",
        force: triggerResult.force,
        runId: triggerResult.runId ?? null,
        message: triggerResult.message,
      });
    } catch (error: any) {
      console.error("Error triggering admin-history backfill:", error);
      return res.status(500).json({
        status: "error",
        message: error?.message || "Failed to trigger admin-history backfill",
      });
    }
  });

  // Get a specific chat configuration
  app.get("/api/chat-configurations/:id", authMiddleware, async (req, res) => {
    try {
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const configId = parseInt(req.params.id);
      const chatConfig = await storage.getChatConfiguration(configId);
      
      if (!chatConfig) {
        return res.status(404).json({ message: "Chat configuration not found" });
      }
      
      // Verify platform belongs to user
      const platform = await storage.getPlatform(chatConfig.platformId);
      if (!platform || platform.userId !== workspaceOwnerId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const [enriched] = await enrichChatConfigurationsWithLocks(platform.id, [chatConfig]);
      res.json(enriched ?? chatConfig);
    } catch (error: any) {
      console.error("Error fetching chat configuration:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update chat configuration
  app.patch("/api/chat-configurations/:id", authMiddleware, requireWorkspaceRole("admin"), async (req, res) => {
    try {
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const configId = parseInt(req.params.id);
      const { aiConfigurationId, knowledgeBaseId, settings, isActive } = req.body;
      
      const chatConfig = await storage.getChatConfiguration(configId);
      if (!chatConfig) {
        return res.status(404).json({ message: "Chat configuration not found" });
      }
      
      // Verify platform belongs to user
      const platform = await storage.getPlatform(chatConfig.platformId);
      if (!platform || platform.userId !== workspaceOwnerId) {
        return res.status(403).json({ message: "Access denied" });
      }

      let validatedKnowledgeBaseId = chatConfig.knowledgeBaseId;
      if (knowledgeBaseId !== undefined) {
        if (knowledgeBaseId === null) {
          validatedKnowledgeBaseId = null;
        } else {
          const parsedKnowledgeBaseId = Number.parseInt(String(knowledgeBaseId), 10);
          if (!Number.isFinite(parsedKnowledgeBaseId)) {
            return res.status(400).json({ message: "Invalid knowledge base ID" });
          }

          const knowledgeBase = await storage.getKnowledgeBase(parsedKnowledgeBaseId);
          if (!knowledgeBase) {
            return res.status(400).json({ message: "Knowledge base not found" });
          }
          if (knowledgeBase.userId !== workspaceOwnerId) {
            return res.status(403).json({ message: "Knowledge base does not belong to this workspace" });
          }

          validatedKnowledgeBaseId = parsedKnowledgeBaseId;
        }
      }
      
      const updatedConfig = await storage.updateChatConfiguration(configId, {
        aiConfigurationId: aiConfigurationId !== undefined ? aiConfigurationId : chatConfig.aiConfigurationId,
        knowledgeBaseId: validatedKnowledgeBaseId,
        settings: settings || chatConfig.settings,
        isActive: isActive !== undefined ? Boolean(isActive) : chatConfig.isActive,
      });
      
      res.json(updatedConfig);
    } catch (error: any) {
      console.error("Error updating chat configuration:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/chat-configurations/:id/lock-settings", authMiddleware, requireWorkspaceRole("moderator"), async (req, res) => {
    try {
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const configId = Number.parseInt(req.params.id, 10);
      if (!Number.isFinite(configId)) {
        return res.status(400).json({ message: "Invalid chat configuration ID" });
      }

      const chatConfig = await storage.getChatConfiguration(configId);
      if (!chatConfig) {
        return res.status(404).json({ message: "Chat configuration not found" });
      }

      const platform = await storage.getPlatform(chatConfig.platformId);
      if (!platform || platform.userId !== workspaceOwnerId) {
        return res.status(403).json({ message: "Access denied" });
      }
      if (platform.type !== "telegram" && platform.type !== "discord") {
        return res.status(400).json({ message: "Timed locking only supports Telegram and Discord destinations" });
      }

      const scheduleRuleSchema = z.object({
        id: z.string().trim().min(1).max(120).optional(),
        recurrence: z.enum(["daily", "weekly"]),
        daysOfWeek: z.array(z.coerce.number().int().min(0).max(6)).max(7).optional(),
        lockAt: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
        unlockAt: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
        isEnabled: z.boolean().optional(),
      });

      const payloadSchema = z.object({
        scheduleEnabled: z.boolean().optional(),
        schedulePaused: z.boolean().optional(),
        timezone: z.string().trim().min(1).max(120).optional(),
        schedules: z.array(scheduleRuleSchema).max(20).optional(),
        // Deprecated legacy fields accepted for compatibility and ignored by schedule runtime.
        autoLockEnabled: z.boolean().optional(),
        thresholdCount: z.coerce.number().int().min(1).max(100).optional(),
        windowMinutes: z.coerce.number().int().min(1).max(60).optional(),
        lockDurationMinutes: z.coerce.number().int().min(1).max(botLockMaxDurationMinutes).optional(),
      });
      const parsed = payloadSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).message });
      }

      if (parsed.data.timezone && !isValidIanaTimezone(parsed.data.timezone)) {
        return res.status(400).json({ message: "Invalid IANA timezone" });
      }

      if (parsed.data.schedules) {
        for (const rule of parsed.data.schedules) {
          if (rule.recurrence === "weekly" && (!rule.daysOfWeek || rule.daysOfWeek.length === 0)) {
            return res.status(400).json({ message: "Weekly schedules require at least one day." });
          }
        }
      }

      const nextSettings = mergeLockSettingsIntoConfig(chatConfig.settings ?? {}, parsed.data as any);
      const updated = await storage.updateChatConfiguration(configId, {
        settings: nextSettings as any,
      });
      if (!updated) {
        return res.status(500).json({ message: "Failed to update lock settings" });
      }

      const adapter = getLockAdapterForPlatformType(platform.type);
      if (adapter) {
        await reconcileScheduledLockForChatConfiguration({
          chatConfig: updated as any,
          platform,
          adapter,
          now: new Date(),
        });
      }

      const activeLock = await storage.getActiveDestinationLockByChatConfiguration(configId);
      res.json({
        ...updated,
        lockSettings: normalizeLockSettings(updated.settings),
        lockState: buildLockState(activeLock),
      });
    } catch (error: any) {
      console.error("Error updating destination lock settings:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/chat-configurations/:id/lock", authMiddleware, requireWorkspaceRole("moderator"), async (req, res) => {
    try {
      if (!botTimedLocksEnabled) {
        return res.status(400).json({ message: "Timed locking is currently disabled." });
      }

      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const configId = Number.parseInt(req.params.id, 10);
      if (!Number.isFinite(configId)) {
        return res.status(400).json({ message: "Invalid chat configuration ID" });
      }

      const payloadSchema = z.object({
        durationMinutes: z.coerce.number().int().min(1).max(botLockMaxDurationMinutes),
        reason: z.string().trim().max(240).optional(),
      });
      const parsed = payloadSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).message });
      }

      const chatConfig = await storage.getChatConfiguration(configId);
      if (!chatConfig) {
        return res.status(404).json({ message: "Chat configuration not found" });
      }
      const platform = await storage.getPlatform(chatConfig.platformId);
      if (!platform || platform.userId !== workspaceOwnerId) {
        return res.status(403).json({ message: "Access denied" });
      }
      if (platform.type !== "telegram" && platform.type !== "discord") {
        return res.status(400).json({ message: "Timed locking only supports Telegram and Discord destinations" });
      }

      const adapter = getLockAdapterForPlatformType(platform.type);
      if (!adapter) {
        return res.status(400).json({ message: "No lock adapter available for this platform type" });
      }

      const result = await createOrExtendDestinationLock({
        chatConfig,
        platform,
        source: "manual_app",
        durationMinutes: parsed.data.durationMinutes,
        reason: parsed.data.reason ?? null,
        actor: {
          requestedByUserId: (req.user as any).id ?? null,
        },
        adapter,
        metadata: {
          requestedVia: "api",
        },
      });

      if (!result.ok) {
        return res.status(400).json({
          message: result.warning || "Failed to lock this destination. Check bot permissions.",
          lockState: buildLockState(result.lock ?? null),
        });
      }

      res.status(200).json({
        message:
          result.alreadyLocked && !result.extended
            ? "Destination is already locked for an equal or longer duration."
            : result.extended
              ? "Destination lock duration extended."
              : "Destination lock applied.",
        lockState: buildLockState(result.lock ?? null),
      });
    } catch (error: any) {
      console.error("Error applying destination lock:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/chat-configurations/:id/unlock", authMiddleware, requireWorkspaceRole("moderator"), async (req, res) => {
    try {
      if (!botTimedLocksEnabled) {
        return res.status(400).json({ message: "Timed locking is currently disabled." });
      }

      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const configId = Number.parseInt(req.params.id, 10);
      if (!Number.isFinite(configId)) {
        return res.status(400).json({ message: "Invalid chat configuration ID" });
      }

      const payloadSchema = z.object({
        reason: z.string().trim().max(240).optional(),
      });
      const parsed = payloadSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).message });
      }

      const chatConfig = await storage.getChatConfiguration(configId);
      if (!chatConfig) {
        return res.status(404).json({ message: "Chat configuration not found" });
      }
      const platform = await storage.getPlatform(chatConfig.platformId);
      if (!platform || platform.userId !== workspaceOwnerId) {
        return res.status(403).json({ message: "Access denied" });
      }
      if (platform.type !== "telegram" && platform.type !== "discord") {
        return res.status(400).json({ message: "Timed locking only supports Telegram and Discord destinations" });
      }

      const adapter = getLockAdapterForPlatformType(platform.type);
      if (!adapter) {
        return res.status(400).json({ message: "No lock adapter available for this platform type" });
      }

      const result = await unlockDestinationByChatConfiguration({
        chatConfig,
        platform,
        adapter,
        reason: parsed.data.reason ?? "Unlocked from ModerateAI dashboard.",
        actorUserId: (req.user as any).id ?? null,
        source: "manual_app",
      });

      if (!result.ok) {
        return res.status(400).json({
          message: result.warning || "Failed to unlock this destination.",
          lockState: buildLockState(result.lock ?? null),
        });
      }

      if (result.alreadyUnlocked) {
        return res.status(200).json({
          message: "Destination is already unlocked.",
          lockState: buildLockState(null),
        });
      }

      res.status(200).json({
        message: "Destination unlocked.",
        lockState: buildLockState(null),
      });
    } catch (error: any) {
      console.error("Error unlocking destination:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/platforms/:id/unlock-all", authMiddleware, requireWorkspaceRole("moderator"), async (req, res) => {
    try {
      if (!botTimedLocksEnabled) {
        return res.status(400).json({ message: "Timed locking is currently disabled." });
      }

      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const platformId = Number.parseInt(req.params.id, 10);
      if (!Number.isFinite(platformId)) {
        return res.status(400).json({ message: "Invalid platform ID" });
      }

      const payloadSchema = z.object({
        reason: z.string().trim().max(240).optional(),
      });
      const parsed = payloadSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).message });
      }

      const platform = await storage.getPlatform(platformId);
      if (!platform || platform.userId !== workspaceOwnerId) {
        return res.status(404).json({ message: "Platform not found" });
      }
      if (platform.type !== "telegram" && platform.type !== "discord") {
        return res.status(400).json({ message: "Timed locking only supports Telegram and Discord destinations" });
      }

      const adapter = getLockAdapterForPlatformType(platform.type);
      if (!adapter) {
        return res.status(400).json({ message: "No lock adapter available for this platform type" });
      }

      const summary = await unlockAllDestinationsForPlatform({
        platform,
        adapter,
        reason: parsed.data.reason ?? "Unlocked all destinations from ModerateAI dashboard.",
        actorUserId: (req.user as any).id ?? null,
      });

      res.status(200).json({
        message: summary.total === 0 ? "No active locks found." : "Unlock-all completed.",
        ...summary,
      });
    } catch (error: any) {
      console.error("Error unlocking all destinations:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Delete chat configuration
  app.delete("/api/chat-configurations/:id", authMiddleware, requireWorkspaceRole("admin"), async (req, res) => {
    try {
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const configId = parseInt(req.params.id);
      
      const chatConfig = await storage.getChatConfiguration(configId);
      if (!chatConfig) {
        return res.status(404).json({ message: "Chat configuration not found" });
      }
      
      // Verify platform belongs to user
      const platform = await storage.getPlatform(chatConfig.platformId);
      if (!platform || platform.userId !== workspaceOwnerId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const deleted = await storage.deleteChatConfiguration(configId);
      if (deleted) {
        res.json({ message: "Chat configuration deleted successfully" });
      } else {
        res.status(500).json({ message: "Failed to delete chat configuration" });
      }
    } catch (error: any) {
      console.error("Error deleting chat configuration:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get(
    "/api/platforms/:id/discord/discovered-servers",
    authMiddleware,
    requireWorkspaceRole("admin"),
    async (req, res) => {
      try {
        const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
        const platformId = parseInt(req.params.id);
        if (Number.isNaN(platformId)) {
          return res.status(400).json({ message: "Invalid platform ID" });
        }

        const platform = await storage.getPlatform(platformId);
        if (!platform || platform.userId !== workspaceOwnerId) {
          return res.status(404).json({ message: "Platform not found" });
        }
        if (platform.type !== "discord") {
          return res.status(400).json({ message: "This endpoint only supports Discord platforms" });
        }

        const discovered = await getDiscordDiscoveredServers(platformId);
        res.json(discovered);
      } catch (error: any) {
        console.error("Error fetching discovered Discord servers:", error);
        res.status(500).json({ message: error.message });
      }
    },
  );

  app.post(
    "/api/platforms/:id/discord/servers/:guildId/enable",
    authMiddleware,
    requireWorkspaceRole("admin"),
    async (req, res) => {
      try {
        const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
        const platformId = parseInt(req.params.id);
        if (Number.isNaN(platformId)) {
          return res.status(400).json({ message: "Invalid platform ID" });
        }
        const guildId = String(req.params.guildId ?? "").trim();
        if (!guildId) {
          return res.status(400).json({ message: "Guild ID is required" });
        }

        const platform = await storage.getPlatform(platformId);
        if (!platform || platform.userId !== workspaceOwnerId) {
          return res.status(404).json({ message: "Platform not found" });
        }
        if (platform.type !== "discord") {
          return res.status(400).json({ message: "This endpoint only supports Discord platforms" });
        }

        try {
          const result = await enableByobDiscordServer(platformId, guildId);
          res.status(200).json(result);
        } catch (error: any) {
          const message = String(error?.message ?? "Unable to enable Discord server");
          const status =
            message.includes("not found") ||
            message.includes("required") ||
            message.includes("mode") ||
            message.includes("limit")
              ? 400
              : 500;
          res.status(status).json({ message });
        }
      } catch (error: any) {
        console.error("Error enabling BYOB Discord server:", error);
        res.status(500).json({ message: error.message });
      }
    },
  );

  // Refresh discovered inventory + sync existing server configurations for Discord.
  app.post("/api/platforms/:id/generate-chat-configurations", authMiddleware, requireWorkspaceRole("admin"), async (req, res) => {
    try {
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const platformId = parseInt(req.params.id);

      const platform = await storage.getPlatform(platformId);
      if (!platform || platform.userId !== workspaceOwnerId) {
        return res.status(404).json({ message: "Platform not found" });
      }
      if (platform.type !== "discord") {
        return res.status(400).json({ message: "This endpoint only supports Discord platforms" });
      }

      const mode = (platform.botOwnershipMode ?? "byob") as "app_owned" | "byob";
      let inventoryRefreshed = true;
      if (mode === "byob") {
        inventoryRefreshed = await refreshDiscordChannels(platformId);
      }

      const syncSummary = await syncDiscordServerConfigurations(platformId, mode);
      const discovered = await getDiscordDiscoveredServers(platformId);

      const message =
        mode === "app_owned"
          ? `Synced ${syncSummary.synced} claimed server configurations.`
          : `Refreshed ${discovered.length} discovered servers and synced ${syncSummary.synced} enabled server configurations.`;

      res.json({
        message,
        mode,
        inventoryRefreshed,
        discoveredCount: discovered.length,
        ...syncSummary,
      });
    } catch (error: any) {
      console.error("Error refreshing Discord server configurations:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Platforms
  app.get("/api/platforms", authMiddleware, async (req, res) => {
    try {
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      console.log(`Getting platforms for workspace owner ID: ${workspaceOwnerId}`);
      const platformRows = await ensureWorkspacePlatforms(workspaceOwnerId);
      const enriched = await Promise.all(
        platformRows.map(async (platformRow) => {
          const reconciledPlatform = await reconcileClaimedAppOwnedPlatformStatus(platformRow as any);
          const base = withPlatformCapabilityMetadata(reconciledPlatform as any);
          if (
            base.botOwnershipMode === "app_owned" &&
            (base.type === "telegram" || base.type === "discord") &&
            hasWorkspaceRole(req.user as any, "admin")
          ) {
            return {
              ...base,
              activeClaimCode: await getActiveClaimCodeForPlatform(base.id),
            };
          }
          return base;
        }),
      );

      console.log(`Retrieved ${enriched.length} platforms:`, enriched.map(p => `${p.id}: ${p.name} (${p.type})`));
      res.status(200).json(enriched);
    } catch (error) {
      console.error("Error fetching platforms:", error);
      res.status(500).json({ message: "Error fetching platforms" });
    }
  });

  app.get("/api/platforms/:id", authMiddleware, async (req, res) => {
    try {
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const platformId = parseInt(req.params.id);
      if (isNaN(platformId)) {
        return res.status(400).json({ message: "Invalid platform ID" });
      }
      console.log(`Getting platform ID: ${platformId} for workspace owner: ${workspaceOwnerId}`);
      
      const platform = await storage.getPlatform(platformId);
      if (!platform) {
        console.log(`Platform ID ${platformId} not found`);
        return res.status(404).json({ message: "Platform not found" });
      }

      if (platform.userId !== workspaceOwnerId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      const reconciledPlatform = await reconcileClaimedAppOwnedPlatformStatus(platform as any);
      console.log(`Successfully retrieved platform: ${reconciledPlatform.name} (${reconciledPlatform.type})`);
      
      // Debug: Log what we're sending to frontend
      console.log('=== GET PLATFORM RESPONSE ===');
      console.log('Platform config being sent:', reconciledPlatform.config);
      const platformConfig = (reconciledPlatform.config ?? {}) as { botName?: string; botUsername?: string };
      console.log('Bot name in config:', platformConfig.botName);
      console.log('Bot username in config:', platformConfig.botUsername);
      console.log('=== END GET PLATFORM RESPONSE ===');
      
      const enriched = withPlatformCapabilityMetadata(reconciledPlatform as any);
      if (
        enriched.botOwnershipMode === "app_owned" &&
        (enriched.type === "telegram" || enriched.type === "discord") &&
        hasWorkspaceRole(req.user as any, "admin")
      ) {
        return res.status(200).json({
          ...enriched,
          activeClaimCode: await getActiveClaimCodeForPlatform(enriched.id),
        });
      }

      res.status(200).json(enriched);
    } catch (error) {
      console.error(`Error fetching platform ${req.params.id}:`, error);
      res.status(500).json({ message: "Error fetching platform" });
    }
  });

  app.get("/api/platforms/:id/claim-code", authMiddleware, requireWorkspaceRole("admin"), async (req, res) => {
    try {
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const platformId = parseInt(req.params.id, 10);
      if (!Number.isFinite(platformId)) {
        return res.status(400).json({ message: "Invalid platform ID" });
      }

      const platform = await storage.getPlatform(platformId);
      if (!platform || platform.userId !== workspaceOwnerId) {
        return res.status(404).json({ message: "Platform not found" });
      }

      if (platform.type !== "telegram" && platform.type !== "discord") {
        return res.status(400).json({ message: "Claim codes are only supported for Telegram and Discord." });
      }

      if (normalizeBotOwnershipMode((platform as any).botOwnershipMode) !== "app_owned") {
        return res.status(400).json({ message: "Claim codes are available only in app-owned mode." });
      }

      const activeClaimCode = await getActiveClaimCodeForPlatform(platform.id);
      return res.status(200).json({
        platformId: platform.id,
        platformType: platform.type,
        activeClaimCode,
      });
    } catch (error) {
      console.error(`Error fetching claim code for platform ${req.params.id}:`, error);
      return res.status(500).json({ message: "Error fetching claim code" });
    }
  });

  app.post("/api/platforms/:id/claim-code", authMiddleware, requireWorkspaceRole("admin"), async (req, res) => {
    try {
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const platformId = parseInt(req.params.id, 10);
      if (!Number.isFinite(platformId)) {
        return res.status(400).json({ message: "Invalid platform ID" });
      }

      const platform = await storage.getPlatform(platformId);
      if (!platform || platform.userId !== workspaceOwnerId) {
        return res.status(404).json({ message: "Platform not found" });
      }

      if (platform.type !== "telegram" && platform.type !== "discord") {
        return res.status(400).json({ message: "Claim codes are only supported for Telegram and Discord." });
      }

      if (normalizeBotOwnershipMode((platform as any).botOwnershipMode) !== "app_owned") {
        return res.status(400).json({ message: "Switch this integration to app-owned mode before issuing claim codes." });
      }

      if (!isAppOwnedAvailableForPlatformType(platform.type)) {
        return res.status(400).json({
          message: `App-owned ${platform.type} bot is not available yet. Ask support to configure the shared bot token.`,
        });
      }

      // Keep one active code at a time per platform.
      await storage.revokeLatestActiveIntegrationClaimCode(platform.id);

      const expiresAt = new Date(Date.now() + INTEGRATION_CLAIM_CODE_TTL_MINUTES * 60_000);
      let createdClaim = null as Awaited<ReturnType<typeof storage.createIntegrationClaimCode>> | null;
      let attempts = 0;

      while (!createdClaim && attempts < 8) {
        attempts += 1;
        const code = generateIntegrationClaimCode();
        try {
          createdClaim = await storage.createIntegrationClaimCode({
            platformId: platform.id,
            workspaceOwnerId,
            platformType: platform.type,
            code,
            createdByUserId: req.user!.id,
            expiresAt,
            usedAt: null,
            usedExternalId: null,
            usedByPlatformUserId: null,
            revokedAt: null,
          } as any);
        } catch (error) {
          // Retry on rare code collision.
          createdClaim = null;
        }
      }

      if (!createdClaim) {
        return res.status(500).json({ message: "Failed to issue claim code. Please try again." });
      }

      await writeActorWorkspaceAudit(req, {
        action: "integration.claim_code_issued",
        targetType: "platform",
        targetId: String(platform.id),
        details: {
          platformType: platform.type,
          expiresAt: createdClaim.expiresAt,
          codeSuffix: createdClaim.code.slice(-4),
        },
      });

      return res.status(201).json({
        platformId: platform.id,
        platformType: platform.type,
        code: createdClaim.code,
        expiresAt: createdClaim.expiresAt,
      });
    } catch (error) {
      console.error(`Error issuing claim code for platform ${req.params.id}:`, error);
      return res.status(500).json({ message: "Error issuing claim code" });
    }
  });

  app.post("/api/platforms/:id/claim-code/revoke", authMiddleware, requireWorkspaceRole("admin"), async (req, res) => {
    try {
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const platformId = parseInt(req.params.id, 10);
      if (!Number.isFinite(platformId)) {
        return res.status(400).json({ message: "Invalid platform ID" });
      }

      const platform = await storage.getPlatform(platformId);
      if (!platform || platform.userId !== workspaceOwnerId) {
        return res.status(404).json({ message: "Platform not found" });
      }

      if (platform.type !== "telegram" && platform.type !== "discord") {
        return res.status(400).json({ message: "Claim codes are only supported for Telegram and Discord." });
      }

      if (normalizeBotOwnershipMode((platform as any).botOwnershipMode) !== "app_owned") {
        return res.status(400).json({ message: "Claim codes are available only in app-owned mode." });
      }

      const revokedClaim = await storage.revokeLatestActiveIntegrationClaimCode(platform.id);
      if (!revokedClaim) {
        return res.status(404).json({ message: "No active claim code to revoke." });
      }

      await writeActorWorkspaceAudit(req, {
        action: "integration.claim_code_revoked",
        targetType: "platform",
        targetId: String(platform.id),
        details: {
          platformType: platform.type,
          codeSuffix: revokedClaim.code.slice(-4),
        },
      });

      return res.status(200).json({
        platformId: platform.id,
        platformType: platform.type,
        revoked: true,
      });
    } catch (error) {
      console.error(`Error revoking claim code for platform ${req.params.id}:`, error);
      return res.status(500).json({ message: "Error revoking claim code" });
    }
  });

  app.post("/api/platforms", authMiddleware, requireWorkspaceRole("admin"), async (req, res) => {
    try {
      const result = insertPlatformSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: fromZodError(result.error).message });
      }

      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const ownerUser =
        workspaceOwnerId === req.user!.id ? (req.user as any) : ((await storage.getUser(workspaceOwnerId)) as any);
      const requestedMode = normalizeBotOwnershipMode((result.data as any).botOwnershipMode);
      if (requestedMode === "byob" && !isByobAllowedForUser(ownerUser)) {
        return res.status(403).json({
          message: "Bring-your-own-bot mode is available on Pro only.",
        });
      }
      const platform = await storage.createPlatform({
        ...result.data,
        botOwnershipMode: requestedMode,
        userId: workspaceOwnerId
      });
      res.status(201).json(withPlatformCapabilityMetadata(platform as any));
    } catch (error) {
      console.error("Error creating platform:", error);
      res.status(500).json({ message: "Error creating platform" });
    }
  });

  app.patch("/api/platforms/:id", authMiddleware, requireWorkspaceRole("admin"), async (req, res) => {
    try {
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const platformId = parseInt(req.params.id, 10);
      if (!Number.isFinite(platformId)) {
        return res.status(400).json({ message: "Invalid platform ID" });
      }

      const platform = await storage.getPlatform(platformId);
      
      if (!platform) {
        return res.status(404).json({ message: "Platform not found" });
      }
      
      // Validate user authorization to access this platform
      if (platform.userId !== workspaceOwnerId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      // Prevent changing platform type via PATCH.
      if (req.body?.type && String(req.body.type) !== String(platform.type)) {
        return res.status(400).json({ message: "Platform type cannot be changed" });
      }

      const ownerUser =
        workspaceOwnerId === req.user!.id ? (req.user as any) : ((await storage.getUser(workspaceOwnerId)) as any);
      const currentMode = normalizeBotOwnershipMode((platform as any).botOwnershipMode);
      const requestedMode =
        req.body?.botOwnershipMode === undefined
          ? currentMode
          : normalizeBotOwnershipMode(req.body.botOwnershipMode);

      if (requestedMode === "byob" && !isByobAllowedForUser(ownerUser)) {
        return res.status(403).json({
          message: "Bring-your-own-bot mode is available on Pro only.",
        });
      }

      const patchBody = {
        ...(req.body ?? {}),
        botOwnershipMode: requestedMode,
      } as any;

      if (requestedMode === "byob" && requestedMode !== currentMode && typeof patchBody.status !== "string") {
        patchBody.status = platform.type === "discord" ? "setup_required" : "not_connected";
      }

      const requestedStatus = typeof patchBody.status === "string" ? patchBody.status : platform.status;
      const modeChanged = requestedMode !== currentMode;

      // Enforce platform integration limits at activation time.
      const wantsActivate = requestedStatus === "active" && platform.status !== "active";
      if (wantsActivate) {
        const entitlements = getEntitlementsForUser(ownerUser as any);

        if (entitlements.integrationLimit !== null) {
          const platforms = await storage.getPlatformsByUserId(workspaceOwnerId);
          const activeTypes = new Set(
            platforms
              .filter((p) => p.status === "active")
              .map((p) => String(p.type)),
          );

          // If this platform type isn't already active, ensure we have capacity to activate it.
          if (!activeTypes.has(String(platform.type)) && activeTypes.size >= entitlements.integrationLimit) {
            return res.status(402).json({
              code: "INTEGRATION_LIMIT_REACHED",
              message: "Platform integration limit reached for your plan.",
              activeIntegrations: activeTypes.size,
              integrationLimit: entitlements.integrationLimit,
            });
          }
        }
      }

      if (requestedMode === "app_owned" && patchBody.authToken) {
        return res.status(400).json({
          message: "App-owned mode does not accept a workspace bot token.",
        });
      }

      if (
        requestedMode === "app_owned" &&
        requestedStatus === "active" &&
        (platform.type === "telegram" || platform.type === "discord") &&
        !isAppOwnedAvailableForPlatformType(platform.type)
      ) {
        return res.status(400).json({
          message: `App-owned ${platform.type} bot is unavailable. Ask support to configure TELEGRAM_APP_BOT_TOKEN / DISCORD_APP_BOT_TOKEN.`,
        });
      }

      if (modeChanged && currentMode === "byob" && platform.status === "active") {
        if (platform.type === "telegram") {
          disconnectTelegramBot(platformId);
        } else if (platform.type === "discord") {
          await disconnectDiscordBot(platformId);
        }
      }

      if (requestedMode === "app_owned") {
        patchBody.authToken = null;
      }

      // Special handling for Telegram platform
      if (platform.type === "telegram") {
        if (requestedMode === "byob") {
          if (requestedStatus === "active") {
            const tokenToUse =
              typeof patchBody.authToken === "string" && patchBody.authToken.trim().length > 0
                ? patchBody.authToken.trim()
                : (platform.authToken ?? null);
            if (!tokenToUse) {
              return res.status(400).json({ message: "Bot token is required for Telegram BYOB mode." });
            }

            console.log(`Attempting to connect Telegram bot for platform ${platformId}`);
            const result = await initializeTelegramBot(platformId, tokenToUse);
            if (!result.success) {
              return res.status(400).json({
                message: result.message || "Failed to connect Telegram bot",
              });
            }

            patchBody.authToken = tokenToUse;

            if (result.botInfo) {
              const currentConfig = (platform.config || {}) as Record<string, unknown>;
              patchBody.config = {
                ...currentConfig,
                ...(patchBody.config || {}),
                botName: result.botInfo.botName,
                botUsername: result.botInfo.botUsername,
                botId: result.botInfo.botId,
              };
            }
          } else if (platform.status === "active" && requestedStatus === "not_connected") {
            console.log(`Disconnecting Telegram bot for platform ${platformId}`);
            disconnectTelegramBot(platformId);
          }
        } else if (requestedStatus === "active") {
          // Ensure app-owned runtime is started when this platform is activated.
          await startTelegramAppOwnedBot();
        }
      }
      
      // Special handling for Discord platform
      if (platform.type === "discord") {
        if (requestedMode === "byob") {
          if (requestedStatus === "active") {
            const tokenToUse =
              typeof patchBody.authToken === "string" && patchBody.authToken.trim().length > 0
                ? patchBody.authToken.trim()
                : (platform.authToken ?? null);
            if (!tokenToUse) {
              return res.status(400).json({ message: "Bot token is required for Discord BYOB mode." });
            }

            console.log(`Attempting to complete Discord setup for platform ${platformId}`);
            const isAuthCode = tokenToUse.length < 50 && !tokenToUse.includes(".");
            if (isAuthCode) {
              return res.status(400).json({
                message:
                  "Authorization successful! However, to complete the Discord setup, you need to provide your Discord bot token. You can find this in your Discord Developer Portal under Bot settings.",
              });
            }

            const result = await initializeDiscordBot(platformId, tokenToUse);
            if (!result.success) {
              return res.status(400).json({
                message: result.message || "Failed to connect Discord bot",
              });
            }

            patchBody.authToken = tokenToUse;
          } else if (platform.status === "active" && requestedStatus === "not_connected") {
            console.log(`Disconnecting Discord bot for platform ${platformId}`);
            await disconnectDiscordBot(platformId);
          } else if (patchBody.config?.lastRefreshed) {
            console.log(`Refreshing Discord channels for platform ${platformId}`);
            const success = await refreshDiscordChannels(platformId);
            if (!success) {
              return res.status(400).json({
                message: "Failed to refresh Discord channels",
              });
            }
          }
        } else if (requestedStatus === "active") {
          // Ensure app-owned runtime is started when this platform is activated.
          await startDiscordAppOwnedBot();
        }
      }

      const updatedPlatform = await storage.updatePlatform(platformId, patchBody);
      if (!updatedPlatform) {
        return res.status(404).json({ message: "Platform not found" });
      }

      if (modeChanged) {
        await writeActorWorkspaceAudit(req, {
          action: "integration.mode_switched",
          targetType: "platform",
          targetId: String(updatedPlatform.id),
          details: {
            platformType: updatedPlatform.type,
            previousMode: currentMode,
            nextMode: requestedMode,
          },
        });
      }
      
      // Debug: Log what we're returning
      console.log('=== PLATFORM UPDATE RESPONSE ===');
      console.log('Updated platform config:', updatedPlatform.config);
      const updatedPlatformConfig = (updatedPlatform.config ?? {}) as { botName?: string; botUsername?: string };
      console.log('Bot name in config:', updatedPlatformConfig.botName);
      console.log('Bot username in config:', updatedPlatformConfig.botUsername);
      console.log('=== END PLATFORM UPDATE RESPONSE ===');

      const enriched = withPlatformCapabilityMetadata(updatedPlatform as any);
      const responsePayload =
        enriched.botOwnershipMode === "app_owned" &&
        (enriched.type === "telegram" || enriched.type === "discord")
          ? {
              ...enriched,
              activeClaimCode: await getActiveClaimCodeForPlatform(enriched.id),
            }
          : enriched;

      res.status(200).json(responsePayload);
    } catch (error) {
      console.error("Error updating platform:", error);
      res.status(500).json({ message: "Error updating platform" });
    }
  });

  app.delete("/api/platforms/:id", authMiddleware, requireWorkspaceRole("admin"), async (req, res) => {
    try {
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const platformId = parseInt(req.params.id);
      const platform = await storage.getPlatform(platformId);
      
      if (!platform) {
        return res.status(404).json({ message: "Platform not found" });
      }
      
      // Use same authorization logic as the PATCH route
      if (platform.userId !== workspaceOwnerId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      await storage.deletePlatform(platformId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting platform:", error);
      res.status(500).json({ message: "Error deleting platform" });
    }
  });
  


  // Conversations
  app.get("/api/conversations", authMiddleware, async (req, res) => {
    try {
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const platformId = req.query.platformId ? parseInt(req.query.platformId as string) : undefined;
      const historyCutoff = await getHistoryCutoffForWorkspace(req.user as any);
      
      let conversations = [];
      if (platformId) {
        const platform = await storage.getPlatform(platformId);
        if (!platform || platform.userId !== workspaceOwnerId) {
          return res.status(403).json({ message: "Unauthorized" });
        }
        conversations = await storage.getConversationsByPlatformId(platformId);
      } else {
        // Get all platforms for user, then get conversations for each
        const platforms = await storage.getPlatformsByUserId(workspaceOwnerId);
        const allConversations = await Promise.all(
          platforms.map(platform => storage.getConversationsByPlatformId(platform.id))
        );
        conversations = allConversations.flat();
      }

      if (historyCutoff) {
        const filtered = await Promise.all(
          conversations.map(async (conversation) => {
            const conversationMessages = await storage.getMessagesByConversationId(conversation.id);
            const latestMessage = conversationMessages.length
              ? conversationMessages[conversationMessages.length - 1]
              : null;
            const activityAt = latestMessage?.createdAt ?? conversation.updatedAt ?? conversation.createdAt;
            return activityAt >= historyCutoff ? conversation : null;
          }),
        );
        conversations = filtered.filter((conversation) => conversation !== null) as typeof conversations;
      }

      res.status(200).json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ message: "Error fetching conversations" });
    }
  });

  app.get("/api/conversations/:id", authMiddleware, async (req, res) => {
    try {
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const conversation = await storage.getConversation(parseInt(req.params.id));
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      
      // Check if user has access to this conversation
      const platform = await storage.getPlatform(conversation.platformId);
      if (!platform || platform.userId !== workspaceOwnerId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      res.status(200).json(conversation);
    } catch (error) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ message: "Error fetching conversation" });
    }
  });

  app.post("/api/conversations", authMiddleware, requireWorkspaceRole("moderator"), async (req, res) => {
    try {
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const result = insertConversationSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: fromZodError(result.error).message });
      }
      
      // Check if user has access to the platform
      const platform = await storage.getPlatform(result.data.platformId);
      if (!platform || platform.userId !== workspaceOwnerId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      const conversation = await storage.createConversation(result.data);
      res.status(201).json(conversation);
    } catch (error) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ message: "Error creating conversation" });
    }
  });

  app.patch("/api/conversations/:id", authMiddleware, requireWorkspaceRole("moderator"), async (req, res) => {
    try {
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const conversationId = parseInt(req.params.id);
      const conversation = await storage.getConversation(conversationId);
      
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      
      // Check if user has access to this conversation
      const platform = await storage.getPlatform(conversation.platformId);
      if (!platform || platform.userId !== workspaceOwnerId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      const updatedConversation = await storage.updateConversation(conversationId, req.body);
      res.status(200).json(updatedConversation);
    } catch (error) {
      console.error("Error updating conversation:", error);
      res.status(500).json({ message: "Error updating conversation" });
    }
  });

  // Messages
  app.get("/api/conversations/:id/messages", authMiddleware, async (req, res) => {
    try {
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const conversationId = parseInt(req.params.id);
      const conversation = await storage.getConversation(conversationId);
      const historyCutoff = await getHistoryCutoffForWorkspace(req.user as any);
      
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      
      // Check if user has access to this conversation
      const platform = await storage.getPlatform(conversation.platformId);
      if (!platform || platform.userId !== workspaceOwnerId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      let messages = await storage.getMessagesByConversationId(conversationId);
      if (historyCutoff) {
        messages = messages.filter((message) => message.createdAt >= historyCutoff);
      }

      const messageIds = messages.map((message) => message.id);
      const corrections = messageIds.length
        ? await db
            .select()
            .from(messageCorrections)
            .where(inArray(messageCorrections.messageId, messageIds))
        : [];
      const correctionsByMessageId = new Map(corrections.map((row) => [row.messageId, row]));

      res.status(200).json(
        messages.map((message) => ({
          ...message,
          correction: correctionsByMessageId.has(message.id)
            ? toCorrectionResponse(correctionsByMessageId.get(message.id))
            : undefined,
        })),
      );
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Error fetching messages" });
    }
  });

  app.post("/api/conversations/:id/messages", authMiddleware, requireWorkspaceRole("moderator"), async (req, res) => {
    try {
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const conversationId = parseInt(req.params.id);
      const conversation = await storage.getConversation(conversationId);
      
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      
      // Check if user has access to this conversation
      const platform = await storage.getPlatform(conversation.platformId);
      if (!platform || platform.userId !== workspaceOwnerId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      const messageData = { ...req.body, conversationId };
      const result = insertMessageSchema.safeParse(messageData);
      
      if (!result.success) {
        return res.status(400).json({ message: fromZodError(result.error).message });
      }
      
      const message = await storage.createMessage(result.data);
      res.status(201).json(message);
    } catch (error) {
      console.error("Error creating message:", error);
      res.status(500).json({ message: "Error creating message" });
    }
  });

  app.put("/api/messages/:id/correction", authMiddleware, requireWorkspaceRole("moderator"), async (req, res) => {
    try {
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const actorUserId = Number((req.user as any)?.id);
      const messageId = Number.parseInt(String(req.params.id ?? ""), 10);
      if (!Number.isFinite(messageId) || messageId <= 0) {
        return res.status(400).json({ message: "Invalid message ID" });
      }

      const parsed = messageCorrectionUpsertSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).message });
      }

      const message = await storage.getMessage(messageId);
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }
      if (message.sender !== "ai") {
        return res.status(422).json({ message: "Only AI messages can be corrected" });
      }

      const conversation = await storage.getConversation(message.conversationId);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      const platform = await storage.getPlatform(conversation.platformId);
      if (!platform || platform.userId !== workspaceOwnerId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const existing = await db
        .select()
        .from(messageCorrections)
        .where(eq(messageCorrections.messageId, message.id))
        .limit(1);

      const correctedContent = parsed.data.correctedContent.trim();
      const annotation = sanitizeCorrectionAnnotation(parsed.data.annotation);
      let saved: any;
      let auditAction = "conversation.message_correction_created";

      if (existing[0]) {
        const previous = existing[0];
        const contentChanged = previous.correctedContent !== correctedContent;
        const resetApproval = contentChanged && previous.status === "approved";

        [saved] = await db
          .update(messageCorrections)
          .set({
            correctedContent,
            annotation,
            updatedByUserId: actorUserId,
            updatedAt: new Date(),
            ...(resetApproval
              ? {
                  status: "draft",
                  approvedForLearningAt: null,
                  approvedByUserId: null,
                  trainingInsightId: null,
                }
              : {}),
          })
          .where(eq(messageCorrections.id, previous.id))
          .returning();
        auditAction = "conversation.message_correction_updated";
      } else {
        [saved] = await db
          .insert(messageCorrections)
          .values({
            messageId: message.id,
            conversationId: conversation.id,
            platformId: platform.id,
            workspaceOwnerId,
            correctedContent,
            annotation,
            status: "draft",
            sourceMetadata: {
              platformType: platform.type,
            },
            createdByUserId: actorUserId,
            updatedByUserId: actorUserId,
          } as any)
          .returning();
      }

      await recordAuditEvent({
        ownerUserId: workspaceOwnerId,
        actorUserId,
        action: auditAction,
        targetType: "message_correction",
        targetId: String(saved.id),
        details: {
          messageId: message.id,
          conversationId: conversation.id,
          platformId: platform.id,
          status: saved.status,
        },
      });

      return res.status(existing[0] ? 200 : 201).json(toCorrectionResponse(saved));
    } catch (error) {
      console.error("Error upserting message correction:", error);
      return res.status(500).json({ message: "Error saving message correction" });
    }
  });

  app.post(
    "/api/messages/:id/correction/approve-learning",
    authMiddleware,
    requireWorkspaceRole("moderator"),
    async (req, res) => {
      try {
        const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
        const actorUserId = Number((req.user as any)?.id);
        const messageId = Number.parseInt(String(req.params.id ?? ""), 10);
        if (!Number.isFinite(messageId) || messageId <= 0) {
          return res.status(400).json({ message: "Invalid message ID" });
        }

        const parsed = correctionApproveSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
          return res.status(400).json({ message: fromZodError(parsed.error).message });
        }

        const message = await storage.getMessage(messageId);
        if (!message) {
          return res.status(404).json({ message: "Message not found" });
        }
        if (message.sender !== "ai") {
          return res.status(422).json({ message: "Only AI messages can be approved for correction learning" });
        }

        const conversation = await storage.getConversation(message.conversationId);
        if (!conversation) {
          return res.status(404).json({ message: "Conversation not found" });
        }
        const platform = await storage.getPlatform(conversation.platformId);
        if (!platform || platform.userId !== workspaceOwnerId) {
          return res.status(403).json({ message: "Unauthorized" });
        }

        const [existingCorrection] = await db
          .select()
          .from(messageCorrections)
          .where(eq(messageCorrections.messageId, message.id))
          .limit(1);

        if (!existingCorrection) {
          return res.status(404).json({ message: "No correction found for this AI message" });
        }

        let correction = existingCorrection;
        const annotationPatch = sanitizeCorrectionAnnotation(parsed.data.annotation);
        if (parsed.data.annotation !== undefined) {
          const [updated] = await db
            .update(messageCorrections)
            .set({
              annotation: annotationPatch,
              updatedByUserId: actorUserId,
              updatedAt: new Date(),
            })
            .where(eq(messageCorrections.id, correction.id))
            .returning();
          correction = updated;
        }

        if (!String(correction.correctedContent ?? "").trim()) {
          return res.status(422).json({ message: "Correction content is required before approval" });
        }

        const threadMessages = await storage.getMessagesByConversationId(conversation.id);
        const aiIndex = threadMessages.findIndex((entry) => entry.id === message.id);
        if (aiIndex < 0) {
          return res.status(500).json({ message: "Message thread could not be resolved" });
        }
        const precedingUserMessage = [...threadMessages.slice(0, aiIndex)].reverse().find((entry) => entry.sender === "user");
        if (!precedingUserMessage) {
          return res.status(422).json({ message: "Cannot approve for learning without a preceding user message" });
        }

        const learningContext = await resolveMessageCorrectionLearningContext({
          conversation,
          platform,
          aiMessage: message,
          precedingUserMessage,
        });
        if (!learningContext.ok) {
          return res.status(learningContext.status).json({ message: learningContext.message });
        }

        const normalizedPattern = normalizeCorrectionPattern(precedingUserMessage.content);
        if (!normalizedPattern) {
          return res.status(422).json({ message: "Preceding user message is empty and cannot be used for learning" });
        }

        const existingInsights = await db
          .select()
          .from(trainingInsights)
          .where(and(
            eq(trainingInsights.userId, workspaceOwnerId),
            eq(trainingInsights.chatConfigurationId, learningContext.chatConfig.id),
            eq(trainingInsights.insightType, "response_pattern"),
            eq(trainingInsights.learnedFrom, "message_correction"),
          ));

        const matchingInsight = existingInsights.find(
          (insight) => normalizeCorrectionPattern(String(insight.pattern ?? "")) === normalizedPattern,
        );

        const insightContext = {
          correctedResponse: correction.correctedContent,
          originalAiResponse: message.content,
          annotation: correction.annotation ?? null,
          platformType: platform.type,
          sourceMessageId: message.id,
          sourceConversationId: conversation.id,
          sourceUserMessageId: precedingUserMessage.id,
          ...learningContext.sourceMetadata,
        };

        let learningResult: "created" | "updated" = "created";
        let insightRecord: any;

        if (matchingInsight) {
          [insightRecord] = await db
            .update(trainingInsights)
            .set({
              pattern: normalizedPattern,
              context: insightContext as any,
              confidence: 100,
              isActive: true,
              learnedFrom: "message_correction",
              updatedAt: new Date(),
            })
            .where(eq(trainingInsights.id, matchingInsight.id))
            .returning();
          learningResult = "updated";
        } else {
          [insightRecord] = await db
            .insert(trainingInsights)
            .values({
              userId: workspaceOwnerId,
              chatConfigurationId: learningContext.chatConfig.id,
              insightType: "response_pattern",
              pattern: normalizedPattern,
              context: insightContext as any,
              confidence: 100,
              usageCount: 0,
              successRate: 100,
              isActive: true,
              learnedFrom: "message_correction",
            } as any)
            .returning();
        }

        const [approvedCorrection] = await db
          .update(messageCorrections)
          .set({
            status: "approved",
            approvedForLearningAt: new Date(),
            approvedByUserId: actorUserId,
            trainingInsightId: insightRecord.id,
            chatConfigurationId: learningContext.chatConfig.id,
            sourceMetadata: {
              ...(correction.sourceMetadata && typeof correction.sourceMetadata === "object"
                ? correction.sourceMetadata
                : {}),
              ...learningContext.sourceMetadata,
            } as any,
            updatedByUserId: actorUserId,
            updatedAt: new Date(),
          })
          .where(eq(messageCorrections.id, correction.id))
          .returning();

        await recordAuditEvent({
          ownerUserId: workspaceOwnerId,
          actorUserId,
          action: "conversation.message_correction_learning_approved",
          targetType: "message_correction",
          targetId: String(approvedCorrection.id),
          details: {
            messageId: message.id,
            conversationId: conversation.id,
            platformId: platform.id,
            platformType: platform.type,
            trainingInsightId: insightRecord.id,
            chatConfigurationId: learningContext.chatConfig.id,
            learningResult,
          },
        });

        return res.status(200).json({
          correction: toCorrectionResponse(approvedCorrection),
          learningResult,
          trainingInsightId: insightRecord.id,
          destination: {
            platformType: platform.type,
            chatConfigurationId: learningContext.chatConfig.id,
            sourceMetadata: learningContext.sourceMetadata,
          },
        });
      } catch (error) {
        console.error("Error approving correction for learning:", error);
        return res.status(500).json({ message: "Error approving correction for learning" });
      }
    },
  );

  // AI Response generation
  app.post("/api/generate-response", authMiddleware, requireWorkspaceRole("moderator"), async (req, res) => {
    try {
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const { conversationId, message } = req.body;
      
      if (!conversationId || !message) {
        return res.status(400).json({ message: "Conversation ID and message are required" });
      }
      
      const conversation = await storage.getConversation(parseInt(conversationId));
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      
      // Check if user has access to this conversation
      const platform = await storage.getPlatform(conversation.platformId);
      if (!platform || platform.userId !== workspaceOwnerId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      // Get the active AI configuration
      const aiConfig = await storage.getActiveAiConfiguration(workspaceOwnerId);
      if (!aiConfig) {
        return res.status(404).json({ message: "No active AI configuration found" });
      }
      
      // Create user message
      const userMessage = await storage.createMessage({
        conversationId: conversation.id,
        content: message,
        sender: "user",
        metadata: null
      });
      
      // Get previous messages to build conversation history
      const previousMessages = await storage.getMessagesByConversationId(conversation.id);
      const conversationHistory = previousMessages.map(msg => ({
        role: msg.sender === "user" ? "user" : "assistant",
        content: msg.content
      }));
      
      // Generate AI response
      const aiResponse = await generateAIResponse(
        message,
        conversationHistory,
        aiConfig.systemPrompt || "",
        aiConfig.responseStyle,
        aiConfig.responseLength
      );
      
      // Save AI response
      const aiMessage = await storage.createMessage({
        conversationId: conversation.id,
        content: aiResponse,
        sender: "ai",
        metadata: null
      });
      
      res.status(200).json({ message: aiMessage });
    } catch (error) {
      console.error("Error generating response:", error);
      res.status(500).json({ message: "Error generating response" });
    }
  });



  // AI Configurations
  app.get("/api/ai-configurations", authMiddleware, async (req, res) => {
    try {
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const configurations = await storage.getAiConfigurationsByUserId(workspaceOwnerId);
      res.status(200).json(configurations);
    } catch (error) {
      console.error("Error fetching AI configurations:", error);
      res.status(500).json({ message: "Error fetching AI configurations" });
    }
  });

  app.get("/api/ai-configurations/active", authMiddleware, async (req, res) => {
    try {
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const activeConfig = await storage.getActiveAiConfiguration(workspaceOwnerId);
      
      if (!activeConfig) {
        return res.status(404).json({ message: "No active AI configuration found" });
      }
      
      res.status(200).json(activeConfig);
    } catch (error) {
      console.error("Error fetching active AI configuration:", error);
      res.status(500).json({ message: "Error fetching active AI configuration" });
    }
  });

  app.post("/api/ai-configurations", authMiddleware, requireWorkspaceRole("admin"), async (req, res) => {
    try {
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const ownerUser = await resolveWorkspaceOwnerUser(req.user as any);
      const result = insertAiConfigurationSchema.safeParse({
        ...req.body,
        userId: workspaceOwnerId
      });
      
      if (!result.success) {
        return res.status(400).json({ message: fromZodError(result.error).message });
      }

      const canUseSentiment = isSentimentAnalysisAvailableForUser(ownerUser as any);
      if (!canUseSentiment && result.data.enableSentimentAnalysis === true) {
        return res.status(403).json({ message: "Sentiment analysis is available on Standard and Pro plans." });
      }

      const payload = {
        ...result.data,
        enableSentimentAnalysis: canUseSentiment ? result.data.enableSentimentAnalysis : false,
      };

      const aiConfiguration = await storage.createAiConfiguration(payload);
      res.status(201).json(aiConfiguration);
    } catch (error) {
      console.error("Error creating AI configuration:", error);
      res.status(500).json({ message: "Error creating AI configuration" });
    }
  });

  app.patch("/api/ai-configurations/:id", authMiddleware, requireWorkspaceRole("admin"), async (req, res) => {
    try {
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const ownerUser = await resolveWorkspaceOwnerUser(req.user as any);
      const configId = parseInt(req.params.id);
      const config = await storage.getAiConfiguration(configId);
      
      if (!config) {
        return res.status(404).json({ message: "AI configuration not found" });
      }
      
      if (config.userId !== workspaceOwnerId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const canUseSentiment = isSentimentAnalysisAvailableForUser(ownerUser as any);
      if (!canUseSentiment && req.body?.enableSentimentAnalysis === true) {
        return res.status(403).json({ message: "Sentiment analysis is available on Standard and Pro plans." });
      }

      const updatePayload = !canUseSentiment
        ? { ...req.body, enableSentimentAnalysis: false }
        : req.body;

      const updatedConfig = await storage.updateAiConfiguration(configId, updatePayload);
      res.status(200).json(updatedConfig);
    } catch (error) {
      console.error("Error updating AI configuration:", error);
      res.status(500).json({ message: "Error updating AI configuration" });
    }
  });

  // Knowledge Bases
  app.get("/api/knowledge-bases", authMiddleware, async (req, res) => {
    try {
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const knowledgeBases = await storage.getKnowledgeBasesByUserId(workspaceOwnerId);
      res.status(200).json(knowledgeBases);
    } catch (error) {
      console.error("Error fetching knowledge bases:", error);
      res.status(500).json({ message: "Error fetching knowledge bases" });
    }
  });

  // Create knowledge base
  app.post("/api/knowledge-bases", authMiddleware, requireWorkspaceRole("admin"), async (req, res) => {
    try {
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const { name, description, isActive } = req.body;
      
      if (!name || name.trim() === "") {
        return res.status(400).json({ message: "Knowledge base name is required" });
      }
      
      const knowledgeBase = await storage.createKnowledgeBase({
        userId: workspaceOwnerId,
        name: name.trim(),
        description: description?.trim() || null,
        isActive: isActive !== undefined ? isActive : true,
        documentCount: 0
      });
      
      res.status(201).json(knowledgeBase);
    } catch (error) {
      console.error("Error creating knowledge base:", error);
      res.status(500).json({ message: "Failed to create knowledge base" });
    }
  });

  app.get("/api/knowledge-bases/active", authMiddleware, async (req, res) => {
    try {
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const activeKnowledgeBase = await storage.getActiveKnowledgeBase(workspaceOwnerId);
      
      if (!activeKnowledgeBase) {
        return res.status(404).json({ message: "No active knowledge base found" });
      }
      
      res.status(200).json(activeKnowledgeBase);
    } catch (error) {
      console.error("Error fetching active knowledge base:", error);
      res.status(500).json({ message: "Error fetching active knowledge base" });
    }
  });

  // Managed KB URL Sources (crawl + scheduled sync)
  app.get("/api/knowledge-bases/:id/url-sources", authMiddleware, requireWorkspaceRole("admin"), async (req, res) => {
    try {
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const knowledgeBaseId = Number.parseInt(req.params.id, 10);
      if (!Number.isFinite(knowledgeBaseId)) {
        return res.status(400).json({ message: "Invalid knowledge base ID" });
      }
      const kb = await storage.getKnowledgeBase(knowledgeBaseId);
      if (!kb) return res.status(404).json({ message: "Knowledge base not found" });
      if (kb.userId !== workspaceOwnerId) return res.status(403).json({ message: "Unauthorized" });

      const sources = await getKnowledgeUrlSourcesForKnowledgeBase(knowledgeBaseId, workspaceOwnerId);
      res.status(200).json(sources);
    } catch (error) {
      console.error("Error fetching knowledge URL sources:", error);
      res.status(500).json({ message: "Error fetching knowledge URL sources" });
    }
  });

  app.post("/api/knowledge-bases/:id/url-sources", authMiddleware, requireWorkspaceRole("admin"), async (req, res) => {
    try {
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const knowledgeBaseId = Number.parseInt(req.params.id, 10);
      if (!Number.isFinite(knowledgeBaseId)) {
        return res.status(400).json({ message: "Invalid knowledge base ID" });
      }
      const kb = await storage.getKnowledgeBase(knowledgeBaseId);
      if (!kb) return res.status(404).json({ message: "Knowledge base not found" });
      if (kb.userId !== workspaceOwnerId) return res.status(403).json({ message: "Unauthorized" });

      const existing = await db
        .select({ count: count() })
        .from(knowledgeUrlSources)
        .where(and(eq(knowledgeUrlSources.knowledgeBaseId, knowledgeBaseId), eq(knowledgeUrlSources.workspaceOwnerId, workspaceOwnerId)));
      if (Number(existing[0]?.count ?? 0) >= 20) {
        return res.status(400).json({ message: "Maximum URL sync sources per knowledge base reached (20)." });
      }

      let normalized;
      try {
        normalized = normalizeKnowledgeUrlSourceInput(req.body ?? {});
      } catch (error: any) {
        recordOpsEvent("KB_URL_SYNC_SOURCE_VALIDATION_FAILED", {
          workspaceOwnerId,
          knowledgeBaseId,
          reason: error?.message || "invalid_source_input",
        });
        return res.status(400).json({ message: String(error?.message || "Invalid URL source configuration") });
      }

      const duplicate = await db
        .select()
        .from(knowledgeUrlSources)
        .where(
          and(
            eq(knowledgeUrlSources.knowledgeBaseId, knowledgeBaseId),
            eq(knowledgeUrlSources.host, normalized.host),
            eq(knowledgeUrlSources.pathPrefix, normalized.pathPrefix),
          ),
        )
        .limit(1);
      if (duplicate.length > 0) {
        return res.status(409).json({ message: "A URL sync source for this host/path prefix already exists in this knowledge base." });
      }

      const now = new Date();
      const [created] = await db
        .insert(knowledgeUrlSources)
        .values({
          knowledgeBaseId,
          workspaceOwnerId,
          name: normalized.name,
          seedUrl: normalized.seedUrl,
          host: normalized.host,
          pathPrefix: normalized.pathPrefix,
          status: normalized.status,
          syncMode: normalized.syncMode,
          scheduleRecurrence: normalized.scheduleRecurrence,
          scheduleDaysOfWeek: normalized.scheduleDaysOfWeek,
          scheduleTime: normalized.scheduleTime,
          scheduleTimezone: normalized.scheduleTimezone,
          createdByUserId: req.user!.id,
          updatedByUserId: req.user!.id,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      res.status(201).json(created);
    } catch (error: any) {
      console.error("Error creating knowledge URL source:", error);
      const message = String(error?.message || "");
      if (message.toLowerCase().includes("unique")) {
        return res.status(409).json({ message: "A URL sync source for this host/path prefix already exists in this knowledge base." });
      }
      res.status(500).json({ message: "Failed to create URL sync source" });
    }
  });

  app.patch("/api/knowledge-url-sources/:id", authMiddleware, requireWorkspaceRole("admin"), async (req, res) => {
    try {
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const sourceId = Number.parseInt(req.params.id, 10);
      if (!Number.isFinite(sourceId)) return res.status(400).json({ message: "Invalid source ID" });

      const source = await getKnowledgeUrlSourceById(sourceId);
      if (!source) return res.status(404).json({ message: "URL sync source not found" });
      if (source.workspaceOwnerId !== workspaceOwnerId) return res.status(403).json({ message: "Unauthorized" });

      const patchPayload: any = { updatedByUserId: req.user!.id, updatedAt: new Date() };
      const nextSeedUrl = req.body?.seedUrl ?? source.seedUrl;
      const nextPathPrefix = req.body?.pathPrefix ?? source.pathPrefix;
      const hasConfigFields = [
        "seedUrl",
        "pathPrefix",
        "name",
        "status",
        "syncMode",
        "scheduleRecurrence",
        "scheduleDaysOfWeek",
        "scheduleTime",
        "scheduleTimezone",
      ].some((k) => k in (req.body ?? {}));

      if (hasConfigFields) {
        let normalized;
        try {
          normalized = normalizeKnowledgeUrlSourceInput({
            seedUrl: nextSeedUrl,
            pathPrefix: nextPathPrefix,
            name: req.body?.name ?? source.name,
            status: req.body?.status ?? source.status,
            syncMode: req.body?.syncMode ?? source.syncMode,
            scheduleRecurrence: req.body?.scheduleRecurrence ?? source.scheduleRecurrence,
            scheduleDaysOfWeek: req.body?.scheduleDaysOfWeek ?? source.scheduleDaysOfWeek,
            scheduleTime: req.body?.scheduleTime ?? source.scheduleTime,
            scheduleTimezone: req.body?.scheduleTimezone ?? source.scheduleTimezone,
          });
        } catch (error: any) {
          recordOpsEvent("KB_URL_SYNC_SOURCE_VALIDATION_FAILED", {
            workspaceOwnerId,
            knowledgeBaseId: source.knowledgeBaseId,
            sourceId,
            reason: error?.message || "invalid_source_patch",
          });
          return res.status(400).json({ message: String(error?.message || "Invalid URL source configuration") });
        }
        Object.assign(patchPayload, {
          name: normalized.name,
          seedUrl: normalized.seedUrl,
          host: normalized.host,
          pathPrefix: normalized.pathPrefix,
          status: normalized.status,
          syncMode: normalized.syncMode,
          scheduleRecurrence: normalized.scheduleRecurrence,
          scheduleDaysOfWeek: normalized.scheduleDaysOfWeek,
          scheduleTime: normalized.scheduleTime,
          scheduleTimezone: normalized.scheduleTimezone,
        });
      }

      const [updated] = await db
        .update(knowledgeUrlSources)
        .set(patchPayload)
        .where(eq(knowledgeUrlSources.id, sourceId))
        .returning();

      res.status(200).json(updated);
    } catch (error: any) {
      console.error("Error updating knowledge URL source:", error);
      res.status(500).json({ message: "Failed to update URL sync source" });
    }
  });

  app.delete("/api/knowledge-url-sources/:id", authMiddleware, requireWorkspaceRole("admin"), async (req, res) => {
    try {
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const sourceId = Number.parseInt(req.params.id, 10);
      if (!Number.isFinite(sourceId)) return res.status(400).json({ message: "Invalid source ID" });

      const source = await getKnowledgeUrlSourceById(sourceId);
      if (!source) return res.status(404).json({ message: "URL sync source not found" });
      if (source.workspaceOwnerId !== workspaceOwnerId) return res.status(403).json({ message: "Unauthorized" });

      await db.delete(knowledgeUrlSources).where(eq(knowledgeUrlSources.id, sourceId));
      res.status(200).json({ message: "URL sync source deleted. Synced documents were retained." });
    } catch (error) {
      console.error("Error deleting knowledge URL source:", error);
      res.status(500).json({ message: "Failed to delete URL sync source" });
    }
  });

  app.post("/api/knowledge-url-sources/:id/sync", authMiddleware, requireWorkspaceRole("admin"), async (req, res) => {
    try {
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const sourceId = Number.parseInt(req.params.id, 10);
      if (!Number.isFinite(sourceId)) return res.status(400).json({ message: "Invalid source ID" });
      const source = await getKnowledgeUrlSourceById(sourceId);
      if (!source) return res.status(404).json({ message: "URL sync source not found" });
      if (source.workspaceOwnerId !== workspaceOwnerId) return res.status(403).json({ message: "Unauthorized" });

      const result = await triggerKnowledgeUrlSourceSync(sourceId, { triggerType: "manual", triggeredByUserId: req.user!.id });
      if (result.status === "already_running") return res.status(409).json(result);
      if (result.status === "already_completed") return res.status(409).json(result);
      if (result.status === "error") return res.status(500).json(result);
      return res.status(202).json(result);
    } catch (error) {
      console.error("Error triggering knowledge URL sync:", error);
      res.status(500).json({ message: "Failed to start URL sync" });
    }
  });

  app.get("/api/knowledge-url-sources/:id/runs", authMiddleware, requireWorkspaceRole("admin"), async (req, res) => {
    try {
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const sourceId = Number.parseInt(req.params.id, 10);
      if (!Number.isFinite(sourceId)) return res.status(400).json({ message: "Invalid source ID" });
      const source = await getKnowledgeUrlSourceById(sourceId);
      if (!source) return res.status(404).json({ message: "URL sync source not found" });
      if (source.workspaceOwnerId !== workspaceOwnerId) return res.status(403).json({ message: "Unauthorized" });

      const limit = Math.min(50, Math.max(1, Number.parseInt(String(req.query.limit ?? "20"), 10) || 20));
      const runs = await getKnowledgeUrlSyncRunsBySourceId(sourceId, limit);
      res.status(200).json(runs);
    } catch (error) {
      console.error("Error fetching knowledge URL sync runs:", error);
      res.status(500).json({ message: "Error fetching URL sync runs" });
    }
  });

  app.get("/api/knowledge-url-sources/:id/runs/:runId", authMiddleware, requireWorkspaceRole("admin"), async (req, res) => {
    try {
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const sourceId = Number.parseInt(req.params.id, 10);
      const runId = Number.parseInt(req.params.runId, 10);
      if (!Number.isFinite(sourceId) || !Number.isFinite(runId)) {
        return res.status(400).json({ message: "Invalid source or run ID" });
      }
      const source = await getKnowledgeUrlSourceById(sourceId);
      if (!source) return res.status(404).json({ message: "URL sync source not found" });
      if (source.workspaceOwnerId !== workspaceOwnerId) return res.status(403).json({ message: "Unauthorized" });

      const run = await getKnowledgeUrlSyncRunById(runId);
      if (!run || run.sourceId !== sourceId) return res.status(404).json({ message: "URL sync run not found" });
      res.status(200).json(run);
    } catch (error) {
      console.error("Error fetching knowledge URL sync run:", error);
      res.status(500).json({ message: "Error fetching URL sync run" });
    }
  });
  
  // Knowledge Documents API
  app.post(
    "/api/knowledge-bases/:id/documents/parse-file",
    authMiddleware,
    requireWorkspaceRole("admin"),
    kbFileUploadSingle,
    async (req, res) => {
      try {
        const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
        const knowledgeBaseId = Number.parseInt(req.params.id, 10);
        const knowledgeBase = await storage.getKnowledgeBase(knowledgeBaseId);

        if (!knowledgeBase) {
          return res.status(404).json({ message: "Knowledge base not found" });
        }
        if (knowledgeBase.userId !== workspaceOwnerId) {
          return res.status(403).json({ message: "Unauthorized" });
        }

        const file = (req as Request & { file?: Express.Multer.File }).file;
        if (!file) {
          return res.status(400).json({ message: "File is required" });
        }

        const parsed = await parseKnowledgeUploadFile({
          fileName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          buffer: file.buffer,
          titleOverride: typeof (req as any).body?.title === "string" ? (req as any).body.title : undefined,
        });

        return res.status(200).json({
          title: parsed.title,
          content: parsed.content,
          metadata: parsed.metadata,
          detectedFormat: parsed.detectedKind,
          originalFileName: file.originalname,
          sizeBytes: file.size,
        });
      } catch (error: any) {
        console.error("Error parsing uploaded knowledge file:", error);
        const message = error?.message || "Failed to parse uploaded file";
        const isClientError =
          /unsupported|not supported|empty|exceeds upload limit|Could not extract/i.test(message);
        return res.status(isClientError ? 400 : 500).json({ message });
      }
    },
  );

  app.post(
    "/api/knowledge-bases/:id/documents/upload",
    authMiddleware,
    requireWorkspaceRole("admin"),
    kbFileUploadSingle,
    async (req, res) => {
      try {
        const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
        const knowledgeBaseId = Number.parseInt(req.params.id, 10);
        const knowledgeBase = await storage.getKnowledgeBase(knowledgeBaseId);

        if (!knowledgeBase) {
          return res.status(404).json({ message: "Knowledge base not found" });
        }
        if (knowledgeBase.userId !== workspaceOwnerId) {
          return res.status(403).json({ message: "Unauthorized" });
        }

        const file = (req as Request & { file?: Express.Multer.File }).file;
        if (!file) {
          return res.status(400).json({ message: "File is required" });
        }

        const parsed = await parseKnowledgeUploadFile({
          fileName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          buffer: file.buffer,
          titleOverride: typeof (req as any).body?.title === "string" ? (req as any).body.title : undefined,
        });

        // Enforce knowledge base storage quota (MB) at the workspace level.
        {
          const ownerUser =
            workspaceOwnerId === req.user!.id ? (req.user as any) : ((await storage.getUser(workspaceOwnerId)) as any);
          const entitlements = getEntitlementsForUser(ownerUser as any);
          const limitMb = entitlements.knowledgeBaseMb;

          if (limitMb !== null) {
            const rows = await db
              .select({
                bytes: sql<number>`coalesce(sum(octet_length(${knowledgeDocuments.content}) + octet_length(${knowledgeDocuments.title})), 0)`,
              })
              .from(knowledgeDocuments)
              .innerJoin(knowledgeBases, eq(knowledgeDocuments.knowledgeBaseId, knowledgeBases.id))
              .where(eq(knowledgeBases.userId, workspaceOwnerId));

            const usedBytes = Number(rows[0]?.bytes ?? 0);
            const incomingBytes =
              Buffer.byteLength(String(parsed.title), "utf8") + Buffer.byteLength(String(parsed.content), "utf8");
            const limitBytes = limitMb * 1024 * 1024;

            if (usedBytes + incomingBytes > limitBytes) {
              return res.status(402).json({
                code: "KB_STORAGE_LIMIT_REACHED",
                message: `Knowledge base storage limit reached for your plan (${limitMb}MB). Upgrade to add more content.`,
                usedMb: Math.ceil(usedBytes / (1024 * 1024)),
                limitMb,
              });
            }
          }
        }

        const document = await storage.createKnowledgeDocument({
          knowledgeBaseId,
          title: parsed.title,
          content: parsed.content,
          metadata: parsed.metadata,
        });

        return res.status(201).json(document);
      } catch (error: any) {
        console.error("Error uploading knowledge file:", error);
        const message = error?.message || "Failed to upload file to knowledge base";
        const isClientError =
          /unsupported|not supported|empty|exceeds upload limit|Could not extract/i.test(message);
        return res.status(isClientError ? 400 : 500).json({ message });
      }
    },
  );

  app.get("/api/knowledge-bases/:id/documents", authMiddleware, async (req, res) => {
    try {
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const knowledgeBaseId = parseInt(req.params.id);
      const knowledgeBase = await storage.getKnowledgeBase(knowledgeBaseId);
      
      if (!knowledgeBase) {
        return res.status(404).json({ message: "Knowledge base not found" });
      }
      
      if (knowledgeBase.userId !== workspaceOwnerId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      const documents = await storage.getKnowledgeDocumentsByKnowledgeBaseId(knowledgeBaseId);
      res.status(200).json(documents);
    } catch (error) {
      console.error("Error fetching knowledge documents:", error);
      res.status(500).json({ message: "Error fetching knowledge documents" });
    }
  });
  
  app.post("/api/knowledge-bases/:id/documents", authMiddleware, requireWorkspaceRole("admin"), async (req, res) => {
    try {
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const knowledgeBaseId = parseInt(req.params.id);
      const knowledgeBase = await storage.getKnowledgeBase(knowledgeBaseId);
      
      if (!knowledgeBase) {
        return res.status(404).json({ message: "Knowledge base not found" });
      }
      
      if (knowledgeBase.userId !== workspaceOwnerId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      const { title, content, metadata } = req.body;
      
      if (!title || !content) {
        return res.status(400).json({ message: "Title and content are required" });
      }

      // Enforce knowledge base storage quota (MB) at the workspace level.
      {
        const ownerUser =
          workspaceOwnerId === req.user!.id ? (req.user as any) : ((await storage.getUser(workspaceOwnerId)) as any);
        const entitlements = getEntitlementsForUser(ownerUser as any);
        const limitMb = entitlements.knowledgeBaseMb;

        if (limitMb !== null) {
          const rows = await db
            .select({
              bytes: sql<number>`coalesce(sum(octet_length(${knowledgeDocuments.content}) + octet_length(${knowledgeDocuments.title})), 0)`,
            })
            .from(knowledgeDocuments)
            .innerJoin(knowledgeBases, eq(knowledgeDocuments.knowledgeBaseId, knowledgeBases.id))
            .where(eq(knowledgeBases.userId, workspaceOwnerId));

          const usedBytes = Number(rows[0]?.bytes ?? 0);
          const incomingBytes =
            Buffer.byteLength(String(title), "utf8") + Buffer.byteLength(String(content), "utf8");
          const limitBytes = limitMb * 1024 * 1024;

          if (usedBytes + incomingBytes > limitBytes) {
            return res.status(402).json({
              code: "KB_STORAGE_LIMIT_REACHED",
              message: `Knowledge base storage limit reached for your plan (${limitMb}MB). Upgrade to add more content.`,
              usedMb: Math.ceil(usedBytes / (1024 * 1024)),
              limitMb,
            });
          }
        }
      }
      
      const document = await storage.createKnowledgeDocument({
        knowledgeBaseId,
        title,
        content,
        metadata: metadata || {}
      });
      
      res.status(201).json(document);
    } catch (error) {
      console.error("Error creating knowledge document:", error);
      res.status(500).json({ message: "Error creating knowledge document" });
    }
  });

  // Update knowledge document
  app.put("/api/knowledge-documents/:id", authMiddleware, requireWorkspaceRole("admin"), async (req, res) => {
    try {
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const documentId = parseInt(req.params.id);
      const document = await storage.getKnowledgeDocument(documentId);
      
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      // Check if user owns the knowledge base that contains this document
      const knowledgeBase = await storage.getKnowledgeBase(document.knowledgeBaseId);
      if (!knowledgeBase || knowledgeBase.userId !== workspaceOwnerId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      const { title, content } = req.body;
      
      if (!title || !content) {
        return res.status(400).json({ message: "Title and content are required" });
      }

      // Enforce knowledge base storage quota (MB) at the workspace level.
      {
        const ownerUser =
          workspaceOwnerId === req.user!.id ? (req.user as any) : ((await storage.getUser(workspaceOwnerId)) as any);
        const entitlements = getEntitlementsForUser(ownerUser as any);
        const limitMb = entitlements.knowledgeBaseMb;

        if (limitMb !== null) {
          const rows = await db
            .select({
              bytes: sql<number>`coalesce(sum(octet_length(${knowledgeDocuments.content}) + octet_length(${knowledgeDocuments.title})), 0)`,
            })
            .from(knowledgeDocuments)
            .innerJoin(knowledgeBases, eq(knowledgeDocuments.knowledgeBaseId, knowledgeBases.id))
            .where(eq(knowledgeBases.userId, workspaceOwnerId));

          const usedBytes = Number(rows[0]?.bytes ?? 0);
          const oldBytes =
            Buffer.byteLength(String((document as any).title ?? ""), "utf8") +
            Buffer.byteLength(String((document as any).content ?? ""), "utf8");
          const incomingBytes =
            Buffer.byteLength(String(title), "utf8") + Buffer.byteLength(String(content), "utf8");
          const nextBytes = Math.max(0, usedBytes - oldBytes) + incomingBytes;
          const limitBytes = limitMb * 1024 * 1024;

          if (nextBytes > limitBytes) {
            return res.status(402).json({
              code: "KB_STORAGE_LIMIT_REACHED",
              message: `Knowledge base storage limit reached for your plan (${limitMb}MB). Upgrade to add more content.`,
              usedMb: Math.ceil(usedBytes / (1024 * 1024)),
              limitMb,
            });
          }
        }
      }
      
      const updatedDocument = await storage.updateKnowledgeDocument(documentId, {
        title,
        content
      });
      
      res.status(200).json(updatedDocument);
    } catch (error) {
      console.error("Error updating knowledge document:", error);
      res.status(500).json({ message: "Error updating knowledge document" });
    }
  });

  // Conversation Training routes
  app.get("/api/conversation-trainings", authMiddleware, async (req, res) => {
    try {
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const platformId = req.query.platformId ? parseInt(req.query.platformId as string) : undefined;
      
      let trainings = [];
      if (platformId) {
        // Check if user has access to this platform
        const platform = await storage.getPlatform(platformId);
        if (!platform || platform.userId !== workspaceOwnerId) {
          return res.status(403).json({ message: "Unauthorized" });
        }
        
        trainings = await storage.getConversationTrainingsByPlatformId(platformId);
      } else {
        // Get all trainings for user, grouped by platform
        const platforms = await storage.getPlatformsByUserId(workspaceOwnerId);
        const allTrainings = await Promise.all(
          platforms.map(platform => storage.getConversationTrainingsByPlatformId(platform.id))
        );
        trainings = allTrainings.flat();
      }
      
      res.status(200).json(trainings);
    } catch (error) {
      console.error("Error fetching conversation trainings:", error);
      res.status(500).json({ message: "Error fetching conversation trainings" });
    }
  });
  
  app.get("/api/conversation-trainings/:id", authMiddleware, async (req, res) => {
    try {
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const trainingId = parseInt(req.params.id);
      const training = await storage.getConversationTraining(trainingId);
      
      if (!training) {
        return res.status(404).json({ message: "Training not found" });
      }
      
      // Check if user has access to this training
      const platform = await storage.getPlatform(training.platformId);
      if (!platform || platform.userId !== workspaceOwnerId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      res.status(200).json(training);
    } catch (error) {
      console.error("Error fetching conversation training:", error);
      res.status(500).json({ message: "Error fetching conversation training" });
    }
  });
  
  app.post("/api/conversation-trainings", authMiddleware, requireWorkspaceRole("admin"), async (req, res) => {
    try {
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      const result = insertConversationTrainingSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: fromZodError(result.error).message });
      }
      
      // Check if user has access to the platform
      const platform = await storage.getPlatform(result.data.platformId);
      if (!platform || platform.userId !== workspaceOwnerId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      // Create the training record
      const training = await storage.createConversationTraining({
        ...result.data,
        userId: workspaceOwnerId,
        status: "pending"
      });
      
      res.status(201).json(training);
      
      // Process training asynchronously
      processTraining(training.id).catch(err => {
        console.error(`Error processing training ${training.id}:`, err);
      });
    } catch (error) {
      console.error("Error creating conversation training:", error);
      res.status(500).json({ message: "Error creating conversation training" });
    }
  });
  
  // Helper function to process training asynchronously
  async function processTraining(trainingId: number) {
    try {
      // Get the training record
      const training = await storage.getConversationTraining(trainingId);
      if (!training) {
        console.error(`Training ${trainingId} not found`);
        return;
      }
      
      // Update status to 'in_progress' and set startedAt
      await storage.updateConversationTraining(trainingId, { 
        status: "in_progress", 
        startedAt: new Date() 
      });
      
      // Get platform to determine its type
      const platform = await storage.getPlatform(training.platformId);
      if (!platform) {
        throw new Error(`Platform ${training.platformId} not found`);
      }
      
      // Get AI configuration to update later
      const aiConfig = await storage.getActiveAiConfiguration(training.userId);
      if (!aiConfig) {
        throw new Error(`No active AI configuration found for user ${training.userId}`);
      }
      
      // Get conversations from the platform
      const conversations = await storage.getConversationsByPlatformId(training.platformId);
      if (conversations.length === 0) {
        // No conversations to process
        await storage.updateConversationTraining(trainingId, {
          status: "completed",
          completedAt: new Date(),
          processedConversations: 0,
          totalConversations: 0
        });
        return;
      }
      
      // Filter out conversations that don't have enough messages
      const validConversations = await Promise.all(
        conversations.map(async (conversation) => {
          const messages = await storage.getMessagesByConversationId(conversation.id);
          if (messages.length >= 3) { // Need at least 3 messages for meaningful training
            return {
              id: conversation.id,
              messages: messages.map(msg => ({ 
                sender: msg.sender, 
                content: msg.content 
              })),
              platformType: platform.type
            };
          }
          return null;
        })
      );
      
      // Filter out null entries
      const conversationsToProcess = validConversations.filter((
        conversation
      ): conversation is {
        id: number;
        messages: { sender: string; content: string }[];
        platformType: string;
      } => conversation !== null);
      
      // Update total conversations count
      await storage.updateConversationTraining(trainingId, {
        totalConversations: conversationsToProcess.length
      });
      
      if (conversationsToProcess.length === 0) {
        // No valid conversations to process
        await storage.updateConversationTraining(trainingId, {
          status: "completed",
          completedAt: new Date(),
          processedConversations: 0
        });
        return;
      }
      
      // Process conversations in batches to avoid rate limits
      const batchSize = 5;
      const trainingResults = [];
      
      for (let i = 0; i < conversationsToProcess.length; i += batchSize) {
        const batch = conversationsToProcess.slice(i, i + batchSize);
        const batchResult = await trainOnConversations(batch);
        trainingResults.push(...batchResult.results);
        
        // Update progress
        await storage.updateConversationTraining(trainingId, {
          processedConversations: Math.min(i + batchSize, conversationsToProcess.length),
          lastTrainedConversationId: batch[batch.length - 1].id
        });
        
        // Add a delay between batches to avoid rate limits
        if (i + batchSize < conversationsToProcess.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      // Filter successful results
      const successfulResults = trainingResults.filter(result => result.success && result.analysis);
      
      if (successfulResults.length === 0) {
        // No successful results
        await storage.updateConversationTraining(trainingId, {
          status: "error",
          completedAt: new Date(),
          errorMessage: "No conversations could be processed successfully"
        });
        return;
      }
      
      // Generate improved system prompt based on the results
      const analyses = successfulResults.map(result => result.analysis);
      const improvedPromptResult = await generateImprovedSystemPrompt(aiConfig.systemPrompt || "", analyses);
      
      if (improvedPromptResult.success) {
        // Update AI configuration with improved prompt
        await storage.updateAiConfiguration(aiConfig.id, {
          systemPrompt: improvedPromptResult.improvedPrompt
        });
        
        // Mark training as completed
        await storage.updateConversationTraining(trainingId, {
          status: "completed",
          completedAt: new Date()
        });
      } else {
        // Mark training as error
        await storage.updateConversationTraining(trainingId, {
          status: "error",
          completedAt: new Date(),
          errorMessage: "Failed to generate improved system prompt"
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred during training";
      console.error(`Error processing training ${trainingId}:`, error);
      // Update training record with error
      await storage.updateConversationTraining(trainingId, {
        status: "error",
        completedAt: new Date(),
        errorMessage
      });
    }
  }




  // Email Whitelist Management API endpoints
  app.get("/api/email-whitelist", authMiddleware, requireWorkspaceRole("admin"), async (req, res) => {
    try {
      const whitelistedEmails = await storage.getWhitelistedEmails();
      res.json(whitelistedEmails);
    } catch (error) {
      console.error("Error fetching email whitelist:", error);
      res.status(500).json({ message: "Error fetching email whitelist" });
    }
  });

  app.post("/api/email-whitelist", authMiddleware, requireWorkspaceRole("admin"), async (req, res) => {
    try {
      const { email } = req.body;
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      
      const normalizedEmail = String(email).toLowerCase().trim();

      // Check if email is already whitelisted
      const isAlreadyWhitelisted = await storage.isEmailWhitelisted(normalizedEmail);
      if (isAlreadyWhitelisted) {
        return res.status(400).json({ message: "Email is already whitelisted" });
      }

      // Enforce seat limits based on the current user's subscription tier.
      {
        const ownerUser =
          workspaceOwnerId === req.user!.id ? (req.user as any) : await storage.getUser(workspaceOwnerId);
        const entitlements = getEntitlementsForUser(ownerUser as any);
        const seatUsage = await getSeatUsageForOwner(workspaceOwnerId);

        if (!hasSeatCapacity(seatUsage, entitlements)) {
          return res.status(402).json(buildSeatLimitError(seatUsage, entitlements));
        }
      }

      const whitelistEntry = await storage.addEmailToWhitelist(normalizedEmail, workspaceOwnerId);
      res.status(201).json(whitelistEntry);
    } catch (error) {
      console.error("Error adding email to whitelist:", error);
      res.status(500).json({ message: "Error adding email to whitelist" });
    }
  });

  app.delete("/api/email-whitelist/:email", authMiddleware, requireWorkspaceRole("admin"), async (req, res) => {
    try {
      const email = decodeURIComponent(req.params.email);
      const success = await storage.removeEmailFromWhitelist(email);
      
      if (!success) {
        return res.status(404).json({ message: "Email not found in whitelist" });
      }

      res.json({ message: "Email removed from whitelist successfully" });
    } catch (error) {
      console.error("Error removing email from whitelist:", error);
      res.status(500).json({ message: "Error removing email from whitelist" });
    }
  });

  // URL Content Extraction API endpoint
  app.post("/api/extract-url-content", authMiddleware, requireWorkspaceRole("admin"), async (req, res) => {
    try {
      const { url } = req.body;
      
      if (!url) {
        return res.status(400).json({ message: "URL is required" });
      }

      console.log(`Extracting content from URL: ${url}`);
      const extracted = await extractUrlContentFromUrl(String(url));
      console.log(`Successfully extracted ${extracted.content.length} characters from ${url}`);
      res.json({ 
        title: extracted.title,
        content: extracted.content,
        sourceUrl: extracted.finalUrl,
        extractedAt: new Date().toISOString()
      });
      
    } catch (error: any) {
      console.error("Error extracting URL content:", error);
      
      if (error.name === 'AbortError' || error.code === 'ENOTFOUND') {
        return res.status(400).json({ 
          message: "Could not connect to the website. Please check the URL and try again." 
        });
      }

      const message = String(error?.message || "Failed to extract content from URL");
      const looksClientError =
        /invalid|only http|not allowed|private|resolve|non-html|meaningful content|failed to fetch/i.test(message);
      res.status(looksClientError ? 400 : 500).json({
        message: looksClientError ? message : "Failed to extract content from URL",
        error: message,
      });
    }
  });

  // Test endpoint for relevance detection system
  app.post("/api/test-relevance", authMiddleware, requireWorkspaceRole("admin"), async (req, res) => {
    try {
      const { message, knowledgeBaseId } = req.body;
      const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
      
      if (!message) {
        return res.status(400).json({ message: "Message is required" });
      }

      const { checkMessageRelevance } = await import("./lib/openai");
      const relevanceResult = await checkMessageRelevance(message, workspaceOwnerId, knowledgeBaseId);
      
      res.json({
        message,
        userId: workspaceOwnerId,
        knowledgeBaseId,
        ...relevanceResult
      });
    } catch (error) {
      console.error("Error testing relevance detection:", error);
      res.status(500).json({ message: "Error testing relevance detection" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}


