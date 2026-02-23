import TelegramBot from 'node-telegram-bot-api';
import { storage } from '../storage';
import { db } from '../db';
import { chatConfigurations, integrationClaimCodes, platforms } from '@shared/schema';
import { and, eq, gt, isNull, ne, or, sql } from 'drizzle-orm';
import { generateAIResponse, generateKnowledgeBasedResponse, checkMessageRelevance, moderateContent } from './openai';
import { chatHistoryManager } from './chatHistoryManager';
import { enforceDestinationLimit } from '../billing/destination-limits';
import { recordModerationAction } from './moderation-actions';
import { recordAuditEvent } from './audit';
import { recordOpsEvent } from './ops-monitor';
import {
  adminHistoryAdminCheckCacheTtlMs,
  botTimedLocksEnabled,
  integrationClaimDestinationLockEnabled,
  integrationSafetyHardeningEnabled,
} from '../config/runtime-flags';
import {
  canUseAdvancedModerationAutomation,
  containsBlockedKeyword,
  getModerationSignal,
  getWorkspaceModerationPolicyForPlatform,
  isMessageBlockedByModeration,
} from './moderation';
import {
  createOrExtendDestinationLock,
  normalizeLockSettings,
  parseLockDurationToken,
  unlockDestinationByChatConfiguration,
  type DestinationLockAdapter,
  type DestinationLockSource,
} from './destination-locks';

// Helper functions for content moderation
async function checkForInappropriateContent(text: string, blockedKeywords: string[] = []): Promise<boolean> {
  // Simple content filtering - in production this would use AI or external services
  const inappropriateWords = ['scam', 'hack', 'virus', ...blockedKeywords];
  const lowercaseText = text.toLowerCase();
  return inappropriateWords.some(word => lowercaseText.includes(word)) || containsBlockedKeyword(text, {
    blockedKeywords,
    allowedKeywords: [],
    spamSensitivity: 50,
    strictness: 50,
  });
}

type TelegramAdminCacheEntry = {
  value: boolean;
  expiresAt: number;
};

const telegramTrainingAdminCache = new Map<string, TelegramAdminCacheEntry>();

function getTelegramTrainingAdminCacheKey(platformId: number, chatId: string, userId: string): string {
  return `telegram:${platformId}:${chatId}:${userId}`;
}

function readTelegramTrainingAdminCache(key: string): boolean | null {
  const hit = telegramTrainingAdminCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    telegramTrainingAdminCache.delete(key);
    return null;
  }
  return hit.value;
}

function writeTelegramTrainingAdminCache(key: string, value: boolean): void {
  telegramTrainingAdminCache.set(key, {
    value,
    expiresAt: Date.now() + adminHistoryAdminCheckCacheTtlMs,
  });
}

function fallbackTelegramTrainingAdmin(platformConfig: any, userId: string, platformId: number, reason: string): boolean {
  const admins = Array.isArray(platformConfig?.admins) ? platformConfig.admins.map(String) : [];
  const matched = admins.includes(String(userId));
  recordOpsEvent("ADMIN_HISTORY_ADMIN_DETECTION_FALLBACK_USED", {
    platform: "telegram",
    platformId,
    reason,
    matched,
  }, { bucketKey: `ADMIN_HISTORY_ADMIN_DETECTION_FALLBACK_USED:telegram:${platformId}` });
  return matched;
}

export async function isTelegramUserTrainingAdmin(params: {
  userId: string;
  chatId: string;
  platformId: number;
  bot?: any | null;
}): Promise<boolean> {
  const normalizedUserId = String(params.userId ?? "").trim();
  const normalizedChatId = String(params.chatId ?? "").trim();
  if (!normalizedUserId || !normalizedChatId) return false;

  const cacheKey = getTelegramTrainingAdminCacheKey(params.platformId, normalizedChatId, normalizedUserId);
  const cached = readTelegramTrainingAdminCache(cacheKey);
  if (cached !== null) return cached;

  try {
    const platform = await storage.getPlatform(params.platformId);
    const platformConfig = (platform?.config as any) || {};

    let bot = params.bot ?? (platform ? getTelegramBotForPlatform(platform) : null);
    if (!bot && platform?.botOwnershipMode === "app_owned") {
      try {
        await startAppOwnedBot();
      } catch {
        // fall back below
      }
      bot = params.bot ?? (platform ? getTelegramBotForPlatform(platform) : null);
    }

    if (bot && typeof bot.getChatMember === "function") {
      try {
        const member = await bot.getChatMember(normalizedChatId, normalizedUserId);
        const status = String(member?.status ?? "");
        const isAdmin = status === "administrator" || status === "creator";
        writeTelegramTrainingAdminCache(cacheKey, isAdmin);
        return isAdmin;
      } catch (error) {
        console.warn("Telegram admin detection failed, using fallback list:", error);
        const fallback = fallbackTelegramTrainingAdmin(platformConfig, normalizedUserId, params.platformId, "telegram_get_chat_member_failed");
        writeTelegramTrainingAdminCache(cacheKey, fallback);
        return fallback;
      }
    }

    const fallback = fallbackTelegramTrainingAdmin(platformConfig, normalizedUserId, params.platformId, "telegram_bot_unavailable");
    writeTelegramTrainingAdminCache(cacheKey, fallback);
    return fallback;
  } catch (error) {
    console.error('Error checking Telegram training admin status:', error);
    return false;
  }
}

async function checkIfUserIsAdmin(
  userId: string,
  chatId: string,
  platformId: number,
  bot?: any | null,
): Promise<boolean> {
  return isTelegramUserTrainingAdmin({ userId, chatId, platformId, bot });
}

// Global map to store all active bot instances
const activeBots = new Map<number, any>();
const CLAIM_CODE_REGEX = /^\/claim(?:@\w+)?\s+([A-Z0-9-]{4,32})$/i;
const APP_OWNED_CLAIM_HINT_COOLDOWN_MS =
  Math.max(1, Number.parseInt(String(process.env.INTEGRATION_UNCLAIMED_HINT_COOLDOWN_MINUTES ?? "60"), 10)) *
  60 *
  1000;
const appOwnedHintSentAt = new Map<string, number>();
let appOwnedBot: any = null;
let appOwnedBotStartPromise: Promise<{ success: boolean; message: string }> | null = null;
type AppOwnedTelegramBotPublicInfo = {
  username?: string;
  botId?: number;
};
let appOwnedBotPublicInfo: AppOwnedTelegramBotPublicInfo | null = null;

function shouldSendAppOwnedHint(key: string): boolean {
  const now = Date.now();
  const lastSentAt = appOwnedHintSentAt.get(key) ?? 0;
  if (now - lastSentAt < APP_OWNED_CLAIM_HINT_COOLDOWN_MS) return false;
  appOwnedHintSentAt.set(key, now);
  return true;
}

async function runTelegramModerationAutomation(
  text: string,
  strictness: number,
  metadata: Record<string, unknown>,
): Promise<boolean> {
  try {
    const moderationResult = await moderateContent(text, strictness);
    return Boolean(moderationResult.flagged);
  } catch (error) {
    recordOpsEvent("MODERATION_CHECK_FAILED", {
      platform: "telegram",
      ...metadata,
      stage: "advanced_automation",
    });
    console.warn("Telegram advanced moderation check failed (fail-open):", error);
    return false;
  }
}

function getTelegramBotForPlatform(platform: { id: number; botOwnershipMode?: string }): any | null {
  if (platform.botOwnershipMode === "app_owned") {
    return appOwnedBot;
  }
  return activeBots.get(platform.id) ?? null;
}

function buildTelegramReadOnlyPermissions(): Record<string, boolean> {
  return {
    can_send_messages: false,
    can_send_audios: false,
    can_send_documents: false,
    can_send_photos: false,
    can_send_videos: false,
    can_send_video_notes: false,
    can_send_voice_notes: false,
    can_send_polls: false,
    can_send_other_messages: false,
    can_add_web_page_previews: false,
    can_change_info: false,
    can_invite_users: false,
    can_pin_messages: false,
  };
}

function buildTelegramDefaultOpenPermissions(): Record<string, boolean> {
  return {
    can_send_messages: true,
    can_send_audios: true,
    can_send_documents: true,
    can_send_photos: true,
    can_send_videos: true,
    can_send_video_notes: true,
    can_send_voice_notes: true,
    can_send_polls: true,
    can_send_other_messages: true,
    can_add_web_page_previews: true,
    can_change_info: false,
    can_invite_users: true,
    can_pin_messages: false,
  };
}

function parseTelegramPermissionsSnapshot(
  permissions: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!permissions || typeof permissions !== "object") {
    return { hadPermissionsObject: false, permissions: null };
  }
  return {
    hadPermissionsObject: true,
    permissions,
  };
}

function extractTelegramCommand(payload: string): {
  command: "lock" | "unlock" | null;
  durationMinutes: number | null;
  reason: string | null;
} {
  const normalized = String(payload ?? "").trim();
  if (!normalized) {
    return { command: null, durationMinutes: null, reason: null };
  }

  const unlockMatch = normalized.match(/^\/unlock(?:@\w+)?(?:\s+(.+))?$/i);
  if (unlockMatch) {
    return {
      command: "unlock",
      durationMinutes: null,
      reason: unlockMatch[1] ? unlockMatch[1].trim() : null,
    };
  }

  const lockMatch = normalized.match(/^\/lock(?:@\w+)?(?:\s+([^\s]+))?(?:\s+(.+))?$/i);
  if (!lockMatch) {
    return { command: null, durationMinutes: null, reason: null };
  }

  const durationMinutes = parseLockDurationToken(lockMatch[1] ?? null);
  return {
    command: "lock",
    durationMinutes,
    reason: lockMatch[2] ? lockMatch[2].trim() : null,
  };
}

const telegramLockAdapter: DestinationLockAdapter = {
  applyLock: async ({ chatConfig, platform, reason }) => {
    let bot = getTelegramBotForPlatform(platform);
    if (!bot && platform.botOwnershipMode === "app_owned") {
      await startAppOwnedBot();
      bot = getTelegramBotForPlatform(platform);
    }
    if (!bot) {
      return { ok: false, warning: "Telegram bot is not connected for this workspace." };
    }

    const chatId = chatConfig.externalId;
    try {
      const chat = await bot.getChat(chatId);
      const snapshot = parseTelegramPermissionsSnapshot((chat as any)?.permissions);
      await bot.setChatPermissions(chatId, buildTelegramReadOnlyPermissions());

      await bot.sendMessage(
        Number(chatId),
        `Group locked by moderation${reason ? `: ${reason}` : "."} Non-admin members are temporarily read-only.`,
      );

      return {
        ok: true,
        permissionSnapshot: snapshot,
      };
    } catch (error: any) {
      return {
        ok: false,
        warning: error?.message || "Failed to apply Telegram group lock. Check bot permissions.",
      };
    }
  },
  releaseLock: async ({ chatConfig, platform, lock, releaseReason }) => {
    let bot = getTelegramBotForPlatform(platform);
    if (!bot && platform.botOwnershipMode === "app_owned") {
      await startAppOwnedBot();
      bot = getTelegramBotForPlatform(platform);
    }
    if (!bot) {
      return { ok: false, warning: "Telegram bot is not connected for this workspace." };
    }

    const chatId = chatConfig.externalId;
    const snapshot = (lock.permissionSnapshot ?? {}) as Record<string, any>;
    const hadPermissionsObject = Boolean(snapshot.hadPermissionsObject);
    const snapshotPermissions = snapshot.permissions && typeof snapshot.permissions === "object"
      ? snapshot.permissions
      : null;

    try {
      if (hadPermissionsObject && snapshotPermissions) {
        await bot.setChatPermissions(chatId, snapshotPermissions);
      } else {
        await bot.setChatPermissions(chatId, buildTelegramDefaultOpenPermissions());
      }

      await bot.sendMessage(
        Number(chatId),
        `Group unlocked.${releaseReason ? ` ${releaseReason}` : ""}`,
      );
      return { ok: true };
    } catch (error: any) {
      return {
        ok: false,
        warning: error?.message || "Failed to restore Telegram group permissions.",
      };
    }
  },
};

export function getTelegramDestinationLockAdapter(): DestinationLockAdapter {
  return telegramLockAdapter;
}

async function isTelegramPlatformAdmin(bot: any, chatId: string, userId: string): Promise<boolean> {
  try {
    const member = await bot.getChatMember(chatId, userId);
    return member?.status === "administrator" || member?.status === "creator";
  } catch (error) {
    console.warn("Failed checking Telegram admin role for lock command:", error);
    return false;
  }
}

async function tryHandleTelegramLockCommand(params: {
  bot: any;
  msg: any;
  platformId: number;
  chatConfig: any;
}): Promise<boolean> {
  const text = String(params.msg?.text ?? "").trim();
  if (!text.startsWith("/lock") && !text.startsWith("/unlock")) {
    return false;
  }

  if (!botTimedLocksEnabled) {
    await params.bot.sendMessage(params.msg.chat.id, "Timed locking is currently disabled.");
    return true;
  }

  const parsed = extractTelegramCommand(text);
  if (!parsed.command) {
    return false;
  }

  const requesterId = String(params.msg?.from?.id ?? "").trim();
  if (!requesterId) {
    await params.bot.sendMessage(params.msg.chat.id, "Could not resolve requester identity.");
    return true;
  }

  const isAdmin = await isTelegramPlatformAdmin(params.bot, String(params.msg.chat.id), requesterId);
  if (!isAdmin) {
    await params.bot.sendMessage(params.msg.chat.id, "Only Telegram group admins can lock or unlock this group.");
    return true;
  }

  const platform = await storage.getPlatform(params.platformId);
  if (!platform) {
    await params.bot.sendMessage(params.msg.chat.id, "Workspace platform configuration not found.");
    return true;
  }

  if (parsed.command === "lock") {
    if (!parsed.durationMinutes) {
      await params.bot.sendMessage(
        params.msg.chat.id,
        "Usage: /lock <duration> [reason]. Example: /lock 15m raid cleanup",
      );
      return true;
    }

    const lockResult = await createOrExtendDestinationLock({
      chatConfig: params.chatConfig,
      platform,
      source: "manual_chat",
      durationMinutes: parsed.durationMinutes,
      reason: parsed.reason,
      actor: {
        requestedByPlatformUserId: requesterId,
        requestedByPlatformUsername: params.msg?.from?.username || params.msg?.from?.first_name || null,
      },
      adapter: telegramLockAdapter,
      metadata: {
        requestedVia: "telegram_command",
      },
    });

    if (!lockResult.ok) {
      await params.bot.sendMessage(
        params.msg.chat.id,
        lockResult.warning || "Failed to lock this group. Check bot permissions and try again.",
      );
      return true;
    }

    if (lockResult.alreadyLocked && !lockResult.extended) {
      await params.bot.sendMessage(params.msg.chat.id, "Group is already locked for an equal or longer duration.");
      return true;
    }
    if (lockResult.extended) {
      await params.bot.sendMessage(params.msg.chat.id, "Group lock duration has been extended.");
      return true;
    }
    await params.bot.sendMessage(params.msg.chat.id, "Group lock applied.");
    return true;
  }

  const unlockResult = await unlockDestinationByChatConfiguration({
    chatConfig: params.chatConfig,
    platform,
    adapter: telegramLockAdapter,
    reason: parsed.reason || "Unlocked by Telegram group admin command.",
    source: "manual_chat",
  });

  if (!unlockResult.ok) {
    await params.bot.sendMessage(
      params.msg.chat.id,
      unlockResult.warning || "Failed to unlock this group. Check bot permissions and try again.",
    );
    return true;
  }

  if (unlockResult.alreadyUnlocked) {
    await params.bot.sendMessage(params.msg.chat.id, "Group is already unlocked.");
    return true;
  }

  await params.bot.sendMessage(params.msg.chat.id, "Group unlocked.");
  return true;
}

async function resolveAppOwnedTelegramPlatformId(chatId: string): Promise<number | null> {
  const rows = await db
    .select({ platformId: chatConfigurations.platformId })
    .from(chatConfigurations)
    .innerJoin(platforms, eq(chatConfigurations.platformId, platforms.id))
    .where(
      and(
        eq(platforms.type, 'telegram'),
        eq(platforms.botOwnershipMode, 'app_owned'),
        eq(platforms.status, 'active'),
        eq(chatConfigurations.externalId, chatId),
        eq(chatConfigurations.isActive, true),
        or(eq(chatConfigurations.chatType, 'group'), eq(chatConfigurations.chatType, 'supergroup')),
      ),
    )
    .limit(1);

  return rows[0]?.platformId ?? null;
}

async function isTelegramDestinationAlreadyClaimedElsewhere(platformId: number, chatId: string): Promise<boolean> {
  const rows = await db
    .select({ id: chatConfigurations.id })
    .from(chatConfigurations)
    .innerJoin(platforms, eq(chatConfigurations.platformId, platforms.id))
    .where(
      and(
        eq(platforms.type, 'telegram'),
        eq(platforms.botOwnershipMode, 'app_owned'),
        eq(chatConfigurations.externalId, chatId),
        eq(chatConfigurations.isActive, true),
        ne(chatConfigurations.platformId, platformId),
      ),
    )
    .limit(1);

  return rows.length > 0;
}

async function sendTelegramAppOwnedUnclaimedHint(bot: any, msg: any): Promise<void> {
  const chatId = String(msg.chat?.id ?? '');
  if (!chatId) return;
  const key = `telegram:${chatId}`;
  if (!shouldSendAppOwnedHint(key)) return;

  await bot.sendMessage(
    msg.chat.id,
    'This group is not linked to a workspace yet. Ask your workspace admin to generate a claim code in ModerateAI, then run `/claim YOUR_CODE` in this group.',
    {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    },
  );
  recordOpsEvent(
    'INTEGRATION_UNCLAIMED_HINT',
    { platform: 'telegram', destinationExternalId: chatId },
    { bucketKey: `INTEGRATION_UNCLAIMED_HINT:telegram:${chatId}` },
  );
}

async function handleTelegramClaimCommand(bot: any, msg: any, claimCodeRaw: string): Promise<void> {
  const normalizedCode = String(claimCodeRaw ?? '').trim().toUpperCase();
  recordOpsEvent('INTEGRATION_CLAIM_ATTEMPT', { platform: 'telegram' });
  const isGroupChat = msg.chat?.type === 'group' || msg.chat?.type === 'supergroup';
  if (!isGroupChat) {
    await bot.sendMessage(msg.chat.id, 'Run this command inside the target Telegram group.');
    recordOpsEvent('INTEGRATION_CLAIM_FAILURE', { platform: 'telegram', reason: 'not_group' });
    return;
  }

  if (!normalizedCode) {
    await bot.sendMessage(msg.chat.id, 'Usage: /claim YOUR_CODE');
    return;
  }

  const claim = await storage.getIntegrationClaimCodeByCode(normalizedCode);
  if (!claim || claim.platformType !== 'telegram') {
    await bot.sendMessage(msg.chat.id, 'Invalid claim code. Generate a new one from ModerateAI.');
    recordOpsEvent('INTEGRATION_CLAIM_FAILURE', { platform: 'telegram', reason: 'invalid_code' });
    return;
  }

  const now = new Date();
  if (claim.revokedAt || claim.usedAt || new Date(claim.expiresAt).getTime() <= now.getTime()) {
    await bot.sendMessage(msg.chat.id, 'Claim code is expired or already used. Generate a new one from ModerateAI.');
    recordOpsEvent('INTEGRATION_CLAIM_FAILURE', { platform: 'telegram', reason: 'expired_or_used' });
    return;
  }

  const targetPlatform = await storage.getPlatform(claim.platformId);
  if (!targetPlatform || targetPlatform.type !== 'telegram' || targetPlatform.botOwnershipMode !== 'app_owned') {
    await bot.sendMessage(msg.chat.id, 'Claim target is no longer valid. Generate a new claim code.');
    recordOpsEvent('INTEGRATION_CLAIM_FAILURE', { platform: 'telegram', reason: 'invalid_target' });
    return;
  }

  const requesterId = msg.from?.id;
  if (!requesterId) {
    await bot.sendMessage(msg.chat.id, 'Could not validate your Telegram account. Try again.');
    recordOpsEvent('INTEGRATION_CLAIM_FAILURE', { platform: 'telegram', reason: 'missing_requester' });
    return;
  }

  try {
    const member = await bot.getChatMember(msg.chat.id, requesterId);
    const status = String((member as any)?.status ?? '');
    if (status !== 'administrator' && status !== 'creator') {
      await bot.sendMessage(msg.chat.id, 'Only Telegram group admins can claim this destination.');
      recordOpsEvent('INTEGRATION_CLAIM_FAILURE', { platform: 'telegram', reason: 'not_admin' });
      return;
    }
  } catch (error) {
    console.warn('Failed to verify Telegram admin privileges for claim:', error);
    await bot.sendMessage(msg.chat.id, 'Could not verify admin privileges. Ensure the bot can read group members.');
    recordOpsEvent('INTEGRATION_CLAIM_FAILURE', { platform: 'telegram', reason: 'admin_check_failed' });
    return;
  }

  const destinationExternalId = String(msg.chat.id);
  const limitCheck = await enforceDestinationLimit({
    platformId: targetPlatform.id,
    destinationExternalId,
    kind: 'telegram_group',
    onLimitExceededOnce: async (limitMessage) => {
      await bot.sendMessage(msg.chat.id, limitMessage, { disable_web_page_preview: true });
    },
  });
  if (!limitCheck.allowed) {
    return;
  }
  const chatName = msg.chat?.title || `Group ${destinationExternalId}`;
  let claimFinalizeStatus: 'ok' | 'conflict' | 'consume_failed' = 'ok';

  if (integrationSafetyHardeningEnabled) {
    claimFinalizeStatus = await db.transaction(async (tx) => {
      if (integrationClaimDestinationLockEnabled) {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext('moderateai:telegram_claim'), hashtext(${destinationExternalId}))`,
        );
      }

      const conflicts = await tx
        .select({ id: chatConfigurations.id })
        .from(chatConfigurations)
        .innerJoin(platforms, eq(chatConfigurations.platformId, platforms.id))
        .where(
          and(
            eq(platforms.type, 'telegram'),
            eq(platforms.botOwnershipMode, 'app_owned'),
            eq(chatConfigurations.externalId, destinationExternalId),
            eq(chatConfigurations.isActive, true),
            ne(chatConfigurations.platformId, targetPlatform.id),
          ),
        )
        .limit(1);

      if (conflicts.length > 0) {
        return 'conflict' as const;
      }

      const [existingChatConfig] = await tx
        .select()
        .from(chatConfigurations)
        .where(
          and(
            eq(chatConfigurations.platformId, targetPlatform.id),
            eq(chatConfigurations.externalId, destinationExternalId),
          ),
        )
        .limit(1);

      if (!existingChatConfig) {
        const platformConfig = (targetPlatform.config as any) || {};
        await tx.insert(chatConfigurations).values({
          platformId: targetPlatform.id,
          externalId: destinationExternalId,
          chatType: msg.chat.type === 'supergroup' ? 'supergroup' : 'group',
          chatName,
          aiConfigurationId: null,
          knowledgeBaseId: null,
          settings: {
            groupMode: platformConfig.groupMode !== undefined ? platformConfig.groupMode : true,
            privateChatMode: false,
            mentionOnly: platformConfig.mentionOnly !== undefined ? platformConfig.mentionOnly : true,
            contentFilteringEnabled:
              platformConfig.contentFilteringEnabled !== undefined ? platformConfig.contentFilteringEnabled : true,
            spamProtectionEnabled: false,
            proactiveResponses: platformConfig.proactiveResponses !== undefined ? platformConfig.proactiveResponses : true,
            welcomeMessage: platformConfig.welcomeMessage || null,
          },
          isActive: true,
        } as any);
      } else if (!existingChatConfig.isActive || existingChatConfig.chatName !== chatName) {
        await tx
          .update(chatConfigurations)
          .set({
            isActive: true,
            chatName,
            updatedAt: new Date(),
          } as any)
          .where(eq(chatConfigurations.id, existingChatConfig.id));
      }

      const [consumed] = await tx
        .update(integrationClaimCodes)
        .set({
          usedAt: now,
          usedExternalId: destinationExternalId,
          usedByPlatformUserId: String(requesterId),
        })
        .where(
          and(
            eq(integrationClaimCodes.id, claim.id),
            isNull(integrationClaimCodes.usedAt),
            isNull(integrationClaimCodes.revokedAt),
            gt(integrationClaimCodes.expiresAt, now),
          ),
        )
        .returning({ id: integrationClaimCodes.id });

      if (!consumed) {
        return 'consume_failed' as const;
      }

      if (targetPlatform.status !== 'active') {
        await tx
          .update(platforms)
          .set({ status: 'active' } as any)
          .where(eq(platforms.id, targetPlatform.id));
      }

      return 'ok' as const;
    });
  } else {
    if (await isTelegramDestinationAlreadyClaimedElsewhere(targetPlatform.id, destinationExternalId)) {
      claimFinalizeStatus = 'conflict';
    } else {
      const existingChatConfig = await storage.getChatConfigurationByPlatformAndExternalId(
        targetPlatform.id,
        destinationExternalId,
      );
      if (!existingChatConfig) {
        const platformConfig = (targetPlatform.config as any) || {};
        await storage.createChatConfiguration({
          platformId: targetPlatform.id,
          externalId: destinationExternalId,
          chatType: msg.chat.type === 'supergroup' ? 'supergroup' : 'group',
          chatName,
          aiConfigurationId: null,
          knowledgeBaseId: null,
          settings: {
            groupMode: platformConfig.groupMode !== undefined ? platformConfig.groupMode : true,
            privateChatMode: false,
            mentionOnly: platformConfig.mentionOnly !== undefined ? platformConfig.mentionOnly : true,
            contentFilteringEnabled:
              platformConfig.contentFilteringEnabled !== undefined ? platformConfig.contentFilteringEnabled : true,
            spamProtectionEnabled: false,
            proactiveResponses: platformConfig.proactiveResponses !== undefined ? platformConfig.proactiveResponses : true,
            welcomeMessage: platformConfig.welcomeMessage || null,
          },
          isActive: true,
        } as any);
      } else if (!existingChatConfig.isActive || existingChatConfig.chatName !== chatName) {
        await storage.updateChatConfiguration(existingChatConfig.id, {
          isActive: true,
          chatName,
        } as any);
      }

      const consumed = await storage.markIntegrationClaimCodeUsed(claim.id, {
        usedAt: now,
        usedExternalId: destinationExternalId,
        usedByPlatformUserId: String(requesterId),
      });
      if (!consumed) {
        claimFinalizeStatus = 'consume_failed';
      } else if (targetPlatform.status !== 'active') {
        await storage.updatePlatform(targetPlatform.id, { status: 'active' } as any);
      }
    }
  }

  if (claimFinalizeStatus === 'conflict') {
    await bot.sendMessage(
      msg.chat.id,
      'This Telegram group is already linked to another workspace. Ask support if you need it reassigned.',
    );
    recordOpsEvent('INTEGRATION_CLAIM_FAILURE', { platform: 'telegram', reason: 'already_claimed_elsewhere' });
    if (integrationSafetyHardeningEnabled) {
      recordOpsEvent('INTEGRATION_CLAIM_CONFLICT', { platform: 'telegram', destinationExternalId });
    }
    return;
  }

  if (claimFinalizeStatus === 'consume_failed') {
    await bot.sendMessage(msg.chat.id, 'Claim code is expired or already used. Generate a new one from ModerateAI.');
    recordOpsEvent('INTEGRATION_CLAIM_FAILURE', { platform: 'telegram', reason: 'expired_or_used' });
    if (integrationSafetyHardeningEnabled) {
      recordOpsEvent('INTEGRATION_CLAIM_CONSUME_FAILED', { platform: 'telegram', destinationExternalId });
    }
    return;
  }

  await recordAuditEvent({
    ownerUserId: claim.workspaceOwnerId,
    actorUserId: claim.createdByUserId,
    action: 'integration.claim_code_used',
    targetType: 'platform',
    targetId: String(targetPlatform.id),
    details: {
      platformType: 'telegram',
      destinationExternalId,
      claimCodeSuffix: normalizedCode.slice(-4),
      claimedByTelegramUserId: String(requesterId),
      claimedAt: now.toISOString(),
    },
  });

  await bot.sendMessage(
    msg.chat.id,
    'Claim successful. This Telegram group is now linked to your ModerateAI workspace.',
  );
}

async function handleAppOwnedTelegramMessage(bot: any, msg: any, platformId: number): Promise<void> {
  if (!msg.text) return;

  const chatId = String(msg.chat?.id ?? '');
  const isGroupChat = msg.chat?.type === 'group' || msg.chat?.type === 'supergroup';
  const isPrivateChat = msg.chat?.type === 'private';
  if (!chatId || (!isGroupChat && !isPrivateChat)) return;

  const chatConfig = await storage.getChatConfigurationByPlatformAndExternalId(platformId, chatId);
  if (!chatConfig) return;

  if (await tryHandleTelegramLockCommand({ bot, msg, platformId, chatConfig })) {
    return;
  }

  if (botTimedLocksEnabled) {
    const activeLock = await storage.getActiveDestinationLockByChatConfiguration(chatConfig.id);
    if (activeLock) {
      return;
    }
  }

  if (!chatConfig.isActive) return;

  const config = (chatConfig.settings as any) || {};
  if (isPrivateChat) return;

  const botInfo = await bot.getMe();
  const botUsername = String(botInfo.username || '').toLowerCase();
  const text = String(msg.text || '');
  const isBotMentioned = botUsername.length > 0 && text.toLowerCase().includes(`@${botUsername}`);

  if (isGroupChat && config.mentionOnly && !isBotMentioned) {
    const platform = await storage.getPlatform(platformId);
    const userId = platform?.userId || 0;
    const proactiveEnabled = config.proactiveResponses !== false;
    if (!proactiveEnabled) return;

    const relevance = await checkMessageRelevance(text, userId, chatConfig.knowledgeBaseId || undefined);
    if (!relevance.isRelevant) return;
  }

  if (isGroupChat) {
    const limitCheck = await enforceDestinationLimit({
      platformId,
      destinationExternalId: chatId,
      kind: 'telegram_group',
      onLimitExceededOnce: async (limitMessage) => {
        await bot.sendMessage(msg.chat.id, limitMessage, { disable_web_page_preview: true });
      },
    });
    if (!limitCheck.allowed) return;
  }

  const platform = await storage.getPlatform(platformId);

  const externalUserId = msg.from?.id?.toString() || 'unknown';
  const externalUsername = msg.from?.username || msg.from?.first_name || 'unknown';
  let conversation = await storage.getConversationByPlatformExternalAndUser(
    platformId,
    chatId,
    externalUserId,
  );
  if (!conversation) {
    conversation = await storage.createConversation({
      platformId,
      externalUserId,
      externalUsername,
      externalId: chatId,
      status: 'active',
    });
  }

  const historyLearningEnabled = await chatHistoryManager.isHistoryLearningEnabled(chatConfig.id);
  if (historyLearningEnabled) {
    const isAdminTrainingSource = await checkIfUserIsAdmin(externalUserId, chatId, platformId, bot);
    await chatHistoryManager.storeChatMessage(
      chatConfig.id,
      platformId,
      externalUserId,
      text,
      isAdminTrainingSource ? "admin" : "user",
      isAdminTrainingSource,
      {
        username: externalUsername,
        messageId: msg.message_id?.toString(),
        chatType: msg.chat?.type ?? null,
        sourceMessageId: null,
        sentAt: msg.date ? new Date(Number(msg.date) * 1000) : undefined,
        threadContext: {
          chatId,
          chatName: msg.chat?.title || msg.chat?.first_name || `chat ${chatId}`,
          timestamp: msg.date ? new Date(Number(msg.date) * 1000) : new Date(),
        },
      },
    );
  }

  const moderationPolicy = await getWorkspaceModerationPolicyForPlatform(platformId);
  if (text && config.contentFilteringEnabled) {
    let moderationSignal = getModerationSignal({
      blockedByCustomRules: false,
      blockedByAdvancedAutomation: false,
    });

    if (!integrationSafetyHardeningEnabled) {
      const hasBaselineInappropriateContent = await checkForInappropriateContent(text);
      const blockedByCustomRules = containsBlockedKeyword(text, moderationPolicy.rules);
      const canRunAdvancedAutomation = canUseAdvancedModerationAutomation(moderationPolicy);
      let blockedByAdvancedAutomation = false;
      if (!hasBaselineInappropriateContent && !blockedByCustomRules && canRunAdvancedAutomation) {
        const moderationResult = await moderateContent(text, moderationPolicy.strictness);
        blockedByAdvancedAutomation = moderationResult.flagged;
      }

      moderationSignal = getModerationSignal({
        blockedByCustomRules: hasBaselineInappropriateContent || blockedByCustomRules,
        blockedByAdvancedAutomation,
      });
    } else {
      try {
        const hasBaselineInappropriateContent = await checkForInappropriateContent(text);
        const blockedByCustomRules = containsBlockedKeyword(text, moderationPolicy.rules);
        const canRunAdvancedAutomation = canUseAdvancedModerationAutomation(moderationPolicy);
        let blockedByAdvancedAutomation = false;

        if (!hasBaselineInappropriateContent && !blockedByCustomRules && canRunAdvancedAutomation) {
          blockedByAdvancedAutomation = await runTelegramModerationAutomation(text, moderationPolicy.strictness, {
            platformId,
            destinationExternalId: chatId,
          });
        }

        moderationSignal = getModerationSignal({
          blockedByCustomRules: hasBaselineInappropriateContent || blockedByCustomRules,
          blockedByAdvancedAutomation,
        });
      } catch (error) {
        recordOpsEvent("MODERATION_CHECK_FAILED", {
          platform: "telegram",
          platformId,
          destinationExternalId: chatId,
          stage: "content_filtering",
        });
        console.warn("Telegram moderation evaluation failed (fail-open):", error);
      }
    }

    if (isMessageBlockedByModeration(moderationSignal)) {
      if (isGroupChat) {
        await bot.deleteMessage(msg.chat.id, msg.message_id);
        await bot.sendMessage(msg.chat.id, 'Message removed by moderation policy.', {
          reply_to_message_id: msg.message_id,
        });
      }
      return;
    }
  }

  await storage.createMessage({
    conversationId: conversation.id,
    content: text,
    sender: 'user',
    metadata: {
      timestamp: msg.date,
      chatId: msg.chat.id,
      messageId: msg.message_id,
    },
  });

  await bot.sendChatAction(msg.chat.id, 'typing');

  const ownerUserId = platform?.userId || 0;
  const aiConfig = chatConfig.aiConfigurationId
    ? await storage.getAiConfiguration(chatConfig.aiConfigurationId)
    : await storage.getActiveAiConfiguration(ownerUserId);
  const knowledgeBase = chatConfig.knowledgeBaseId
    ? await storage.getKnowledgeBase(chatConfig.knowledgeBaseId)
    : await storage.getActiveKnowledgeBase(ownerUserId);

  const priorMessages = await storage.getMessagesByConversationId(conversation.id);
  const conversationHistory = priorMessages.slice(-10).map((historyMessage) => ({
    role: historyMessage.sender === 'user' ? 'user' : 'assistant',
    content: historyMessage.content,
  }));

  const contextualInsights = await chatHistoryManager.getContextualInsights(
    chatConfig.id,
    text,
    { conversationHistory, chatType: msg.chat?.type ?? 'group' },
  );

  let enhancedSystemPrompt = aiConfig?.systemPrompt || 'You are a helpful assistant.';
  enhancedSystemPrompt += `\n\nACCURACY GUIDELINES:
1. Prioritize official knowledge base information when available
2. Use validated admin conversation insights as supplementary factual information
3. Admin insights can provide additional context not yet documented in knowledge base
4. When knowledge base and admin insights conflict, note both perspectives
5. Always indicate the source of information (knowledge base vs admin experience)`;

  if (contextualInsights.length > 0) {
    const insightsText = contextualInsights
      .map((insight) => `- ${insight.pattern} (confidence: ${Math.round(insight.confidence)}%)`)
      .join('\n');
    enhancedSystemPrompt += `\n\nValidated insights from admin interactions:\n${insightsText}`;
  }

  const assignedKnowledgeBaseId = chatConfig.knowledgeBaseId ?? undefined;
  const aiResponse = knowledgeBase
    ? await generateKnowledgeBasedResponse(
        text,
        conversationHistory as any,
        enhancedSystemPrompt,
        aiConfig?.responseStyle || 50,
        aiConfig?.responseLength || 50,
        ownerUserId,
        assignedKnowledgeBaseId,
      )
    : await generateAIResponse(
        text,
        conversationHistory as any,
        enhancedSystemPrompt,
        aiConfig?.responseStyle || 50,
        aiConfig?.responseLength || 50,
      );

  for (const insight of contextualInsights) {
    await chatHistoryManager.updateInsightMetrics(insight.id, true);
  }

  await bot.sendMessage(msg.chat.id, aiResponse, {
    reply_to_message_id: msg.message_id,
  });

  await storage.createMessage({
    conversationId: conversation.id,
    content: aiResponse,
    sender: 'ai',
    metadata: null,
  });
}

export async function startAppOwnedBot(): Promise<{ success: boolean; message: string }> {
  const token = String(process.env.TELEGRAM_APP_BOT_TOKEN ?? '').trim();
  if (!token) {
    return {
      success: false,
      message: 'TELEGRAM_APP_BOT_TOKEN is not configured.',
    };
  }

  if (appOwnedBot) {
    if (!appOwnedBotPublicInfo && typeof appOwnedBot.getMe === "function") {
      try {
        const info = await appOwnedBot.getMe();
        const username = String(info?.username ?? "").trim();
        appOwnedBotPublicInfo = {
          username: username || undefined,
          botId: Number.isFinite(Number(info?.id)) ? Number(info.id) : undefined,
        };
      } catch (error) {
        console.warn("Failed to refresh app-owned Telegram bot metadata:", error);
      }
    }
    return {
      success: true,
      message: 'Telegram app-owned bot already running.',
    };
  }

  if (appOwnedBotStartPromise) {
    return appOwnedBotStartPromise;
  }

  appOwnedBotStartPromise = (async () => {
    const bot = new TelegramBot(token, {
      polling: true,
      filepath: false,
    });

    bot.on('message', async (msg: any) => {
      try {
        const text = String(msg.text ?? '').trim();
        const claimMatch = text.match(CLAIM_CODE_REGEX);
        if (claimMatch) {
          await handleTelegramClaimCommand(bot, msg, claimMatch[1]);
          return;
        }

        const isGroupChat = msg.chat?.type === 'group' || msg.chat?.type === 'supergroup';
        if (!isGroupChat) return;

        const chatId = String(msg.chat?.id ?? '');
        if (!chatId) return;

        const resolvedPlatformId = await resolveAppOwnedTelegramPlatformId(chatId);
        if (!resolvedPlatformId) {
          await sendTelegramAppOwnedUnclaimedHint(bot, msg);
          return;
        }

        await handleAppOwnedTelegramMessage(bot, msg, resolvedPlatformId);
      } catch (error) {
        console.error('Error handling app-owned Telegram message:', error);
      }
    });

    try {
      const info = await bot.getMe();
      const username = String(info?.username ?? "").trim();
      appOwnedBotPublicInfo = {
        username: username || undefined,
        botId: Number.isFinite(Number(info?.id)) ? Number(info.id) : undefined,
      };
    } catch (error) {
      console.warn("Failed to fetch app-owned Telegram bot metadata:", error);
    }

    appOwnedBot = bot;
    return {
      success: true,
      message: 'Telegram app-owned bot started.',
    };
  })();

  try {
    return await appOwnedBotStartPromise;
  } finally {
    appOwnedBotStartPromise = null;
  }
}

/**
 * Initialize a Telegram bot with the given token 
 */
export async function initializeBot(platformId: number, token: string): Promise<{ success: boolean; message: string; botInfo?: { botName: string; botUsername: string; botId: number } }> {
  try {
    // Validate token by creating a bot instance and getting bot info
    const bot = new TelegramBot(token, { polling: false });
    
    // Try to get bot info to verify the token is valid
    const botInfo = await bot.getMe();
    
    if (!botInfo || !botInfo.id) {
      return { 
        success: false, 
        message: 'Invalid bot token. Please check your token and try again.' 
      };
    }
    
    // Properly configure the bot for long polling
    const activatedBot = new TelegramBot(token, { 
      polling: true,
      filepath: false // Don't save downloaded files
    });
    
    // Register message handler
    activatedBot.on('message', async (msg: any) => {
      try {
        console.log(`Telegram message received from ${msg.from?.username || 'unknown user'}: ${msg.text}`);
        
        // Get or create chat-specific configuration
        const chatId = msg.chat.id.toString();
        const chatType = msg.chat.type === 'group' || msg.chat.type === 'supergroup' ? 'group' : msg.chat.type;
        const chatName = msg.chat.title || msg.chat.first_name || `${chatType} ${chatId}`;
        const isIncomingGroupChat = msg.chat.type === 'group' || msg.chat.type === 'supergroup';

        if (isIncomingGroupChat) {
          const limitCheck = await enforceDestinationLimit({
            platformId,
            destinationExternalId: chatId,
            kind: 'telegram_group',
            onLimitExceededOnce: async (limitMessage) => {
              await activatedBot.sendMessage(msg.chat.id, limitMessage, {
                disable_web_page_preview: true,
              });
            },
          });

          if (!limitCheck.allowed) {
            console.log(`Telegram destination blocked by plan limit for platform ${platformId}, chat ${chatId}`);
            return;
          }
        }
        
        let chatConfig = await storage.getChatConfigurationByPlatformAndExternalId(platformId, chatId);
        
        // Create default chat configuration if it doesn't exist
        if (!chatConfig) {
          console.log(`Creating new chat configuration for ${chatType}: ${chatName}`);
          
          // Get platform settings to use as defaults
          const platform = await storage.getPlatform(platformId);
          const platformConfig = (platform?.config as any) || {};
          
          chatConfig = await storage.createChatConfiguration({
            platformId,
            externalId: chatId,
            chatType,
            chatName,
            aiConfigurationId: null, // Will use default
            knowledgeBaseId: null, // Will use default
            settings: {
              groupMode: platformConfig.groupMode !== undefined ? platformConfig.groupMode : true,
              privateChatMode: false,
              mentionOnly: platformConfig.mentionOnly !== undefined ? platformConfig.mentionOnly : (chatType === 'group'),
              contentFilteringEnabled: platformConfig.contentFilteringEnabled !== undefined ? platformConfig.contentFilteringEnabled : true,
              spamProtectionEnabled: false,
              proactiveResponses: platformConfig.proactiveResponses !== undefined ? platformConfig.proactiveResponses : true,
              welcomeMessage: platformConfig.welcomeMessage || null
            },
            isActive: true
          });
        }
        
        const config = chatConfig.settings as any || {};
        if (await tryHandleTelegramLockCommand({ bot: activatedBot, msg, platformId, chatConfig })) {
          return;
        }

        if (botTimedLocksEnabled) {
          const activeLock = await storage.getActiveDestinationLockByChatConfiguration(chatConfig.id);
          if (activeLock) {
            return;
          }
        }

        if (!chatConfig.isActive) {
          console.log('Skipping message - chat configuration is inactive');
          return;
        }
        
        // Check if bot should respond based on configuration
        const isGroupChat = msg.chat.type === 'group' || msg.chat.type === 'supergroup';
        const isPrivateChat = msg.chat.type === 'private';
        const botUsername = (await activatedBot.getMe()).username;
        const isBotMentioned = msg.text && botUsername && msg.text.toLowerCase().includes(`@${botUsername.toLowerCase()}`);
        
        // Apply response logic based on settings
        if (isPrivateChat) {
          console.log('Skipping private message - Private Chat Mode is disabled');
          return;
        }
        
        // Check if we should skip based on mention requirements
        if (isGroupChat && config.mentionOnly && !isBotMentioned) {
          // If mention-only mode is enabled but bot is not mentioned,
          // check if the message is relevant to the knowledge base for proactive response
          const platform = await storage.getPlatform(platformId);
          const userId = platform?.userId || 1;
          
          // Check if proactive responses are enabled and if message is relevant
          const proactiveEnabled = config.proactiveResponses !== false; // Default to enabled if not set
          
          if (proactiveEnabled) {
            console.log('Checking message relevance for proactive response...');
            const { checkMessageRelevance } = await import("../lib/openai");
            const relevanceCheck = await checkMessageRelevance(
              msg.text,
              userId,
              chatConfig.knowledgeBaseId
            );
            
            console.log(`Relevance check result: ${relevanceCheck.isRelevant} (score: ${relevanceCheck.relevanceScore}, reason: ${relevanceCheck.reason})`);
            
            if (!relevanceCheck.isRelevant) {
              console.log('Skipping group message - Not mentioned and not relevant to knowledge base');
              return;
            }
            
            console.log('Proceeding with proactive response - message is relevant to knowledge base');
          } else {
            console.log('Skipping group message - Mention Only mode enabled, bot not mentioned, and proactive responses disabled');
            return;
          }
        }
        
        // Find or create conversation first before any processing
        const externalUserId = msg.from?.id.toString() || 'unknown';
        const externalUsername = msg.from?.username || msg.from?.first_name || 'unknown';
        
        // Store chat history if history learning is enabled
        const historyLearningEnabled = await chatHistoryManager.isHistoryLearningEnabled(chatConfig.id);
        if (historyLearningEnabled && msg.text) {
          const isAdmin = await checkIfUserIsAdmin(externalUserId, msg.chat.id.toString(), platformId, activatedBot);
          
          await chatHistoryManager.storeChatMessage(
            chatConfig.id,
            platformId,
            externalUserId,
            msg.text,
            isAdmin ? "admin" : "user",
            isAdmin,
            {
              username: externalUsername,
              messageId: msg.message_id?.toString(),
              chatType: chatType,
              sentAt: msg.date ? new Date(Number(msg.date) * 1000) : undefined,
              threadContext: {
                chatId: chatId,
                chatName: chatName,
                timestamp: new Date(msg.date * 1000)
              }
            }
          );
        }
        
        // Get existing or create new conversation for this chat
        let conversation = await storage.getConversationByPlatformExternalAndUser(
          platformId,
          chatId,
          externalUserId,
        );
        
        if (!conversation) {
          conversation = await storage.createConversation({
            platformId,
            externalUserId,
            externalUsername,
            externalId: chatId,
            status: 'active'
          });
          
          // Send welcome message if configured
          if (config.welcomeMessage) {
            activatedBot.sendMessage(msg.chat.id, config.welcomeMessage);
            
            await storage.createMessage({
              conversationId: conversation.id,
              content: config.welcomeMessage,
              sender: 'ai',
              metadata: null
            });
          }
        }
        const moderationPolicy = await getWorkspaceModerationPolicyForPlatform(platformId);

        // Content filtering checks
        if (msg.text && config.contentFilteringEnabled) {
          let blockedByKeywordRule = false;
          let blockedByBaselineFilter = false;
          let moderationSignal = getModerationSignal({
            blockedByCustomRules: false,
            blockedByAdvancedAutomation: false,
          });

          if (!integrationSafetyHardeningEnabled) {
            blockedByBaselineFilter = await checkForInappropriateContent(msg.text);
            blockedByKeywordRule = containsBlockedKeyword(msg.text, moderationPolicy.rules);
            const canRunAdvancedAutomation = canUseAdvancedModerationAutomation(moderationPolicy);
            let blockedByAdvancedAutomation = false;

            if (!blockedByBaselineFilter && !blockedByKeywordRule && canRunAdvancedAutomation) {
              const moderationResult = await moderateContent(msg.text, moderationPolicy.strictness);
              blockedByAdvancedAutomation = moderationResult.flagged;
            }

            moderationSignal = getModerationSignal({
              blockedByCustomRules: blockedByBaselineFilter || blockedByKeywordRule,
              blockedByAdvancedAutomation,
            });
          } else {
            try {
              blockedByBaselineFilter = await checkForInappropriateContent(msg.text);
              blockedByKeywordRule = containsBlockedKeyword(msg.text, moderationPolicy.rules);
              const canRunAdvancedAutomation = canUseAdvancedModerationAutomation(moderationPolicy);
              let blockedByAdvancedAutomation = false;

              if (!blockedByBaselineFilter && !blockedByKeywordRule && canRunAdvancedAutomation) {
                blockedByAdvancedAutomation = await runTelegramModerationAutomation(
                  msg.text,
                  moderationPolicy.strictness,
                  {
                    platformId,
                    destinationExternalId: chatId,
                  },
                );
              }

              moderationSignal = getModerationSignal({
                blockedByCustomRules: blockedByBaselineFilter || blockedByKeywordRule,
                blockedByAdvancedAutomation,
              });
            } catch (error) {
              recordOpsEvent("MODERATION_CHECK_FAILED", {
                platform: "telegram",
                platformId,
                destinationExternalId: chatId,
                stage: "content_filtering",
              });
              console.warn("Telegram moderation evaluation failed (fail-open):", error);
            }
          }

          if (isMessageBlockedByModeration(moderationSignal)) {
            console.log('Message blocked by content filter');

            const blockedMessage = await storage.createMessage({
              conversationId: conversation.id,
              content: msg.text,
              sender: 'user',
              metadata: {
                timestamp: msg.date,
                chatId: msg.chat.id,
                messageId: msg.message_id,
                blocked: 'content',
                action: 'content_filtered',
                moderationPreset: moderationPolicy.preset,
                strictness: moderationPolicy.strictness,
                blockedByCustomRules: moderationSignal.blockedByCustomRules,
                blockedByAdvancedAutomation: moderationSignal.blockedByAdvancedAutomation,
              }
            });

            if (moderationPolicy.ownerUserId) {
              const ruleSource = moderationSignal.blockedByAdvancedAutomation
                ? 'ai_automation'
                : blockedByKeywordRule
                  ? 'custom_rule'
                  : 'baseline_filter';

              await recordModerationAction({
                ownerUserId: moderationPolicy.ownerUserId,
                platformId,
                conversationId: conversation.id,
                messageId: blockedMessage.id,
                platformType: 'telegram',
                action: 'content_filtered',
                ruleSource,
                reason: moderationSignal.blockedByAdvancedAutomation
                  ? 'Blocked by advanced moderation automation'
                  : blockedByKeywordRule
                    ? 'Matched custom blocked keyword rule'
                    : 'Blocked by baseline inappropriate-content filter',
                automatic: true,
                metadata: {
                  chatId: String(msg.chat.id),
                  externalMessageId: String(msg.message_id),
                  moderationPreset: moderationPolicy.preset,
                  strictness: moderationPolicy.strictness,
                  blockedByCustomRules: moderationSignal.blockedByCustomRules,
                  blockedByAdvancedAutomation: moderationSignal.blockedByAdvancedAutomation,
                },
              });
            }

            if (isGroupChat) {
              await activatedBot.deleteMessage(msg.chat.id, msg.message_id);
              await activatedBot.sendMessage(
                msg.chat.id,
                'Message removed by moderation policy.',
                { reply_to_message_id: msg.message_id },
              );
            }
            return;
          }
        }

        // Skip empty messages
        if (!msg.text) return;
        
        // Store user message
        await storage.createMessage({
          conversationId: conversation.id,
          content: msg.text,
          sender: 'user',
          metadata: {
            timestamp: msg.date,
            chatId: msg.chat.id,
            messageId: msg.message_id
          }
        });
        
        // Show typing indicator
        activatedBot.sendChatAction(msg.chat.id, 'typing');
        
        try {
          // Get chat-specific or default AI configuration
          let activeConfig;
          if (chatConfig.aiConfigurationId) {
            activeConfig = await storage.getAiConfiguration(chatConfig.aiConfigurationId);
          } else {
            // Fallback to platform owner's default AI configuration
            const platform = await storage.getPlatform(platformId);
            activeConfig = await storage.getActiveAiConfiguration(platform?.userId || 1);
          }
          
          // Get chat-specific or default knowledge base
          let knowledgeBase;
          if (chatConfig.knowledgeBaseId) {
            knowledgeBase = await storage.getKnowledgeBase(chatConfig.knowledgeBaseId);
          } else {
            // Fallback to platform owner's default knowledge base
            const platform = await storage.getPlatform(platformId);
            knowledgeBase = await storage.getActiveKnowledgeBase(platform?.userId || 1);
          }
          
          // Get conversation history
          const messages = await storage.getMessagesByConversationId(conversation.id);
          
          // Convert the messages to the format expected by the AI
          const conversationHistory = messages.slice(-10).map(msg => ({
            role: msg.sender === "user" ? "user" : "assistant",
            content: msg.content
          }));
          
          // Get training insights to enhance the response
          const contextualInsights = await chatHistoryManager.getContextualInsights(
            chatConfig.id,
            msg.text,
            { conversationHistory, chatType }
          );
          
          // Enhance system prompt with training insights if available
          let enhancedSystemPrompt = activeConfig?.systemPrompt || 'You are a helpful assistant.';
          
          // Combine knowledge base and admin insights for accuracy
          enhancedSystemPrompt += `\n\nACCURACY GUIDELINES:
1. Prioritize official knowledge base information when available
2. Use validated admin conversation insights as supplementary factual information
3. Admin insights can provide additional context not yet documented in knowledge base
4. When knowledge base and admin insights conflict, note both perspectives
5. Always indicate the source of information (knowledge base vs admin experience)`;
          
          if (contextualInsights.length > 0) {
            const insightsText = contextualInsights.map(insight => 
              `- ${insight.pattern} (confidence: ${Math.round(insight.confidence)}%)`
            ).join('\n');
            
            enhancedSystemPrompt += `\n\nValidated insights from admin interactions:\n${insightsText}`;
          }
          
          // Generate AI response with proper parameters - use knowledge-based response if knowledge base is available
          let aiResponse;
          const platform = await storage.getPlatform(platformId);
          const userId = platform?.userId || 1;
          
          if (knowledgeBase) {
            const { generateKnowledgeBasedResponse } = await import("../lib/openai");
            aiResponse = await generateKnowledgeBasedResponse(
              msg.text,
              conversationHistory,
              enhancedSystemPrompt,
              activeConfig?.responseStyle || 50,
              activeConfig?.responseLength || 50,
              userId,
              chatConfig.knowledgeBaseId ?? undefined,
            );
          } else {
            const { generateAIResponse } = await import("../lib/openai");
            aiResponse = await generateAIResponse(
              msg.text,
              conversationHistory,
              enhancedSystemPrompt,
              activeConfig?.responseStyle || 50,
              activeConfig?.responseLength || 50
            );
          }
          
          // Update insight metrics based on response success (simplified - in production you'd track user feedback)
          for (const insight of contextualInsights) {
            await chatHistoryManager.updateInsightMetrics(insight.id, true);
          }
          
          // Send response
          // Send AI response as a reply to the original message for better context
          await activatedBot.sendMessage(msg.chat.id, aiResponse, {
            reply_to_message_id: msg.message_id
          });
          
          // Store AI response in database
          await storage.createMessage({
            conversationId: conversation.id,
            content: aiResponse,
            sender: 'ai',
            metadata: null
          });
        } catch (error) {
          console.error(`Error generating AI response:`, error);
          
          // Create a more detailed error message for debugging
          let errorMessage = "I'm sorry, I'm having trouble processing your message right now.";
          
          if (process.env.NODE_ENV === 'development') {
            // Only show detailed errors in development
            errorMessage += " Error: " + (error instanceof Error ? error.message : String(error));
          }
          
          // Send a fallback response with more details in development
          await activatedBot.sendMessage(msg.chat.id, errorMessage, {
            reply_to_message_id: msg.message_id
          });
          return;
        }
        
      } catch (error) {
        console.error('Error handling Telegram message:', error);
        activatedBot.sendMessage(msg.chat.id, 'Sorry, I encountered an error processing your message. Please try again later.', {
          reply_to_message_id: msg.message_id
        });
      }
    });
    
    // Handle commands
    activatedBot.onText(/\/help/, (msg: any) => {
      activatedBot.sendMessage(msg.chat.id, 
        'I am an AI assistant powered by ModerateAI. I can help answer questions and provide information.\n\n' +
        'Available commands:\n' +
        '/help - Show this help message\n' +
        '/about - Information about this bot',
        { reply_to_message_id: msg.message_id }
      );
    });
    
    activatedBot.onText(/\/about/, (msg: any) => {
      activatedBot.sendMessage(msg.chat.id, 
        'I am an AI assistant powered by ModerateAI - an AI-powered customer support and community moderation platform.\n\n' +
        'I can answer questions, provide information, and help moderate conversations.',
        { reply_to_message_id: msg.message_id }
      );
    });
    
    // Store the bot instance
    activeBots.set(platformId, activatedBot);
    
    return { 
      success: true, 
      message: `Bot @${botInfo.username} connected successfully!`,
      botInfo: {
        botName: botInfo.first_name,
        botUsername: botInfo.username,
        botId: botInfo.id
      }
    };
  } catch (error: any) {
    console.error('Error initializing Telegram bot:', error);
    return { 
      success: false, 
      message: `Failed to initialize bot: ${error.message}` 
    };
  }
}

/**
 * Stop and remove a Telegram bot
 */
export function disconnectBot(platformId: number): { success: boolean; message: string } {
  try {
    // Get the bot instance
    const bot = activeBots.get(platformId);
    
    if (!bot) {
      return { 
        success: false, 
        message: 'Bot not found or already disconnected.' 
      };
    }
    
    // Stop polling and remove all listeners
    bot.stopPolling();
    bot.removeAllListeners();
    
    // Remove from active bots
    activeBots.delete(platformId);
    
    return { 
      success: true, 
      message: 'Bot disconnected successfully.' 
    };
  } catch (error: any) {
    console.error('Error disconnecting Telegram bot:', error);
    return { 
      success: false, 
      message: `Failed to disconnect bot: ${error.message}` 
    };
  }
}

/**
 * Get all active bots
 */
export function getActiveBots(): Map<number, any> {
  return activeBots;
}

export function getAppOwnedBotPublicInfo(): AppOwnedTelegramBotPublicInfo | null {
  const envUsernameRaw = String(process.env.TELEGRAM_APP_BOT_USERNAME ?? "").trim();
  const envUsername = envUsernameRaw.replace(/^@/, "");
  const username = appOwnedBotPublicInfo?.username ?? (envUsername || undefined);
  const botId = appOwnedBotPublicInfo?.botId;

  if (!username && !botId) {
    return null;
  }

  return {
    username,
    botId,
  };
}

/**
 * Initialize all active bots from database
 */
export async function initializeAllBots(): Promise<void> {
  try {
    // Get all platforms with type 'telegram' and status 'active'
    const telegramPlatforms = await storage.getPlatformsByType('telegram');
    const activePlatforms = telegramPlatforms.filter(p => p.status === 'active' && p.authToken);
    
    console.log(`Initializing ${activePlatforms.length} Telegram bots...`);
    
    // Initialize each active bot
    for (const platform of activePlatforms) {
      if (platform.authToken) {
        const result = await initializeBot(platform.id, platform.authToken);
        console.log(`Bot for platform ${platform.id}: ${result.message}`);
      }
    }
  } catch (error) {
    console.error('Error initializing Telegram bots:', error);
  }
}


