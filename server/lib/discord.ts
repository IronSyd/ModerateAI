import { 
  Client, 
  IntentsBitField, 
  TextChannel, 
  Message, 
  ChatInputCommandInteraction,
  Events, 
  ApplicationCommandOptionType,
  GatewayIntentBits,
  ChannelType,
  Partials,
  Collection,
  DMChannel,
  PermissionsBitField,
} from 'discord.js';
import { storage } from '../storage';
import { db } from '../db';
import { chatConfigurations, integrationClaimCodes, platforms } from '@shared/schema';
import { and, eq, gt, isNull, ne, or, sql } from 'drizzle-orm';
import { chatHistoryManager } from './chatHistoryManager';
import { moderateContent, generateAIResponse } from './openai';
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
} from './destination-locks';

// Map of platform IDs to Discord clients
const discordClients = new Map<number, Client>();

// Is this a demo token?
const isDemoToken = (token: string) => {
  // Skip the length check, as real tokens can be any length
  return token === 'discord-token-partial' || token.startsWith('demo-') || token === 'demo-discord-token';
};

const DISCORD_CLAIM_CODE_REGEX = /^(?:\/|!)claim\s+([A-Z0-9-]{4,32})$/i;
const DISCORD_LOCK_COMMAND_REGEX = /^(?:\/|!)lock(?:\s+([^\s]+))?(?:\s+(.+))?$/i;
const DISCORD_UNLOCK_COMMAND_REGEX = /^(?:\/|!)unlock(?:\s+(.+))?$/i;
const DISCORD_UNCLAIMED_HINT_COOLDOWN_MS =
  Math.max(1, Number.parseInt(String(process.env.INTEGRATION_UNCLAIMED_HINT_COOLDOWN_MINUTES ?? "60"), 10)) *
  60 *
  1000;
const DEFAULT_APP_OWNED_DISCORD_INVITE_PERMISSIONS = new PermissionsBitField([
  PermissionsBitField.Flags.ViewChannel,
  PermissionsBitField.Flags.SendMessages,
  PermissionsBitField.Flags.ReadMessageHistory,
  PermissionsBitField.Flags.AddReactions,
  PermissionsBitField.Flags.EmbedLinks,
  PermissionsBitField.Flags.AttachFiles,
  PermissionsBitField.Flags.ManageMessages,
]).bitfield.toString();
const APP_OWNED_DISCORD_INVITE_PERMISSIONS =
  String(process.env.DISCORD_APP_BOT_INVITE_PERMISSIONS ?? "").trim() || DEFAULT_APP_OWNED_DISCORD_INVITE_PERMISSIONS;
const appOwnedDiscordHintSentAt = new Map<string, number>();
const byobDiscordHintSentAt = new Map<string, number>();
let appOwnedDiscordClient: Client | null = null;
let appOwnedDiscordStartPromise: Promise<{ success: boolean; message: string }> | null = null;
type AppOwnedDiscordBotPublicInfo = {
  clientId?: string;
  userId?: string;
  username?: string;
  tag?: string;
  invitePermissions?: string;
  inviteUrl?: string;
};
let appOwnedDiscordPublicInfo: AppOwnedDiscordBotPublicInfo | null = null;

type DiscordConfigGuild = {
  id: string;
  name: string;
  memberCount?: number;
};

type DiscordConfigChannel = {
  id: string;
  name: string;
  type: string;
  guildId?: string;
  guildName?: string;
  moderationEnabled?: boolean;
  active?: boolean;
};

type DiscordGuildInventory = {
  guildId: string;
  guildName: string;
  memberCount: number | null;
  channels: DiscordConfigChannel[];
};

type DiscordChannelSyncMode = "app_owned_claim" | "app_owned_sync" | "byob_enable" | "byob_sync";

export type DiscordDiscoveredServer = {
  guildId: string;
  guildName: string;
  memberCount?: number;
  textChannelCount: number;
  isConfigured: boolean;
  isActive: boolean;
  channelsUnavailable: boolean;
};

export type DiscordServerSyncSummary = {
  synced: number;
  failed: number;
  skipped: number;
};

function shouldSendDiscordHint(key: string): boolean {
  const now = Date.now();
  const lastSentAt = appOwnedDiscordHintSentAt.get(key) ?? 0;
  if (now - lastSentAt < DISCORD_UNCLAIMED_HINT_COOLDOWN_MS) return false;
  appOwnedDiscordHintSentAt.set(key, now);
  return true;
}

function shouldSendByobDiscordHint(key: string): boolean {
  const now = Date.now();
  const lastSentAt = byobDiscordHintSentAt.get(key) ?? 0;
  if (now - lastSentAt < DISCORD_UNCLAIMED_HINT_COOLDOWN_MS) return false;
  byobDiscordHintSentAt.set(key, now);
  return true;
}

function hasBaselineInappropriateContent(text: string): boolean {
  const blockedKeywords = ['scam', 'hack', 'virus'];
  const normalized = String(text ?? '').toLowerCase();
  return blockedKeywords.some((keyword) => normalized.includes(keyword));
}

async function runDiscordModerationAutomation(
  text: string,
  strictness: number,
  metadata: Record<string, unknown>,
): Promise<boolean> {
  try {
    const moderationResult = await moderateContent(text, strictness);
    return Boolean(moderationResult.flagged);
  } catch (error) {
    recordOpsEvent("MODERATION_CHECK_FAILED", {
      platform: "discord",
      ...metadata,
      stage: "advanced_automation",
    });
    console.warn("Discord advanced moderation check failed (fail-open):", error);
    return false;
  }
}

function getDiscordClientForPlatform(platform: { id: number; botOwnershipMode?: string }): Client | null {
  if (platform.botOwnershipMode === "app_owned") {
    return appOwnedDiscordClient;
  }
  return discordClients.get(platform.id) ?? null;
}

function parseDiscordLockCommand(contentRaw: string): {
  command: "lock" | "unlock" | null;
  durationMinutes: number | null;
  reason: string | null;
} {
  const content = String(contentRaw ?? "").trim();
  if (!content) {
    return { command: null, durationMinutes: null, reason: null };
  }

  const unlockMatch = content.match(DISCORD_UNLOCK_COMMAND_REGEX);
  if (unlockMatch) {
    return {
      command: "unlock",
      durationMinutes: null,
      reason: unlockMatch[1] ? unlockMatch[1].trim() : null,
    };
  }

  const lockMatch = content.match(DISCORD_LOCK_COMMAND_REGEX);
  if (!lockMatch) {
    return { command: null, durationMinutes: null, reason: null };
  }

  return {
    command: "lock",
    durationMinutes: parseLockDurationToken(lockMatch[1] ?? null),
    reason: lockMatch[2] ? lockMatch[2].trim() : null,
  };
}

type DiscordPermissionState = true | false | null;

function resolvePermissionState(
  overwrite: { allow: PermissionsBitField; deny: PermissionsBitField } | null | undefined,
  flag: bigint,
): DiscordPermissionState {
  if (!overwrite) return null;
  if (overwrite.allow.has(flag)) return true;
  if (overwrite.deny.has(flag)) return false;
  return null;
}

function permissionStateToApiValue(value: DiscordPermissionState): boolean | null {
  if (value === true) return true;
  if (value === false) return false;
  return null;
}

async function ensureDiscordClientForLock(platform: { id: number; botOwnershipMode?: string }): Promise<Client | null> {
  let client = getDiscordClientForPlatform(platform);
  if (!client && platform.botOwnershipMode === "app_owned") {
    await startAppOwnedBot();
    client = getDiscordClientForPlatform(platform);
  }
  return client;
}

async function isDiscordPlatformAdmin(message: Message): Promise<boolean> {
  if (!message.guild || !message.member) return false;
  const member = message.member;
  return (
    member.permissions.has(PermissionsBitField.Flags.Administrator) ||
    member.permissions.has(PermissionsBitField.Flags.ManageGuild)
  );
}

type DiscordAdminCacheEntry = {
  value: boolean;
  expiresAt: number;
};

const discordTrainingAdminCache = new Map<string, DiscordAdminCacheEntry>();

function getDiscordTrainingAdminCacheKey(platformId: number, guildId: string, userId: string): string {
  return `discord:${platformId}:${guildId}:${userId}`;
}

function readDiscordTrainingAdminCache(key: string): boolean | null {
  const hit = discordTrainingAdminCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    discordTrainingAdminCache.delete(key);
    return null;
  }
  return hit.value;
}

function writeDiscordTrainingAdminCache(key: string, value: boolean): void {
  discordTrainingAdminCache.set(key, {
    value,
    expiresAt: Date.now() + adminHistoryAdminCheckCacheTtlMs,
  });
}

function isDiscordTrainingAdminPermissions(member: { permissions: PermissionsBitField } | null | undefined): boolean {
  if (!member) return false;
  return (
    member.permissions.has(PermissionsBitField.Flags.Administrator) ||
    member.permissions.has(PermissionsBitField.Flags.ManageGuild) ||
    member.permissions.has(PermissionsBitField.Flags.ManageMessages)
  );
}

async function fallbackDiscordTrainingAdmin(platformId: number, userId: string, reason: string): Promise<boolean> {
  const platform = await storage.getPlatform(platformId);
  const admins = Array.isArray((platform?.config as any)?.admins) ? (platform?.config as any).admins.map(String) : [];
  const matched = admins.includes(String(userId));
  recordOpsEvent("ADMIN_HISTORY_ADMIN_DETECTION_FALLBACK_USED", {
    platform: "discord",
    platformId,
    reason,
    matched,
  }, { bucketKey: `ADMIN_HISTORY_ADMIN_DETECTION_FALLBACK_USED:discord:${platformId}` });
  return matched;
}

export async function isDiscordUserTrainingAdmin(params: {
  platformId: number;
  guildId: string;
  userId: string;
  member?: any | null;
}): Promise<boolean> {
  const guildId = String(params.guildId ?? "").trim();
  const userId = String(params.userId ?? "").trim();
  if (!guildId || !userId) return false;

  const cacheKey = getDiscordTrainingAdminCacheKey(params.platformId, guildId, userId);
  const cached = readDiscordTrainingAdminCache(cacheKey);
  if (cached !== null) return cached;

  if (params.member && isDiscordTrainingAdminPermissions(params.member)) {
    writeDiscordTrainingAdminCache(cacheKey, true);
    return true;
  }

  try {
    const platform = await storage.getPlatform(params.platformId);
    let client = platform ? getDiscordClientForPlatform(platform) : null;
    if (!client && platform?.botOwnershipMode === "app_owned") {
      try {
        await startAppOwnedBot();
      } catch {
        // fall through to fallback
      }
      client = platform ? getDiscordClientForPlatform(platform) : null;
    }

    if (client) {
      try {
        const guild = client.guilds.cache.get(guildId) ?? await client.guilds.fetch(guildId);
        const member = guild.members.cache.get(userId) ?? await guild.members.fetch(userId);
        const isAdmin = isDiscordTrainingAdminPermissions(member);
        writeDiscordTrainingAdminCache(cacheKey, isAdmin);
        return isAdmin;
      } catch (error) {
        console.warn("Discord admin detection failed, using fallback list:", error);
        const fallback = await fallbackDiscordTrainingAdmin(params.platformId, userId, "discord_member_fetch_failed");
        writeDiscordTrainingAdminCache(cacheKey, fallback);
        return fallback;
      }
    }

    const fallback = await fallbackDiscordTrainingAdmin(params.platformId, userId, "discord_client_unavailable");
    writeDiscordTrainingAdminCache(cacheKey, fallback);
    return fallback;
  } catch (error) {
    console.warn("Discord training admin detection error:", error);
    return false;
  }
}

type DiscordLockChannelSnapshot = {
  channelId: string;
  channelName: string;
  hadOverwrite: boolean;
  sendMessages: DiscordPermissionState;
  sendMessagesInThreads: DiscordPermissionState;
};

async function resolveDiscordLockTargetChannels(
  client: Client,
  chatConfig: any,
): Promise<Array<{ id: string; name: string; channel: any }>> {
  const guildId = String(chatConfig.externalId ?? "").trim();
  const guild = client.guilds.cache.get(guildId) ?? (await client.guilds.fetch(guildId).catch(() => null));
  if (!guild) return [];

  const settings = (chatConfig.settings as any) ?? {};
  const enabledChannels = (settings.enabledChannels as Record<string, boolean> | undefined) ?? {};
  const enabledChannelIds = Object.entries(enabledChannels)
    .filter(([, enabled]) => enabled === true)
    .map(([channelId]) => channelId)
    .filter(Boolean);

  const targets: Array<{ id: string; name: string; channel: any }> = [];
  for (const channelId of enabledChannelIds) {
    const channel =
      guild.channels.cache.get(channelId) ??
      (await guild.channels.fetch(channelId).catch(() => null));
    if (!channel) continue;
    if (channel.type !== ChannelType.GuildText) continue;
    targets.push({
      id: channel.id,
      name: String((channel as any).name ?? channel.id),
      channel,
    });
  }
  return targets;
}

const discordLockAdapter: DestinationLockAdapter = {
  applyLock: async ({ chatConfig, platform, reason }) => {
    const client = await ensureDiscordClientForLock(platform);
    if (!client) {
      return { ok: false, warning: "Discord bot is not connected for this workspace." };
    }

    const guildId = String(chatConfig.externalId ?? "").trim();
    const guild = client.guilds.cache.get(guildId) ?? (await client.guilds.fetch(guildId).catch(() => null));
    if (!guild) {
      return { ok: false, warning: "Discord server not found in bot scope." };
    }

    const targets = await resolveDiscordLockTargetChannels(client, chatConfig);
    if (targets.length === 0) {
      return { ok: false, warning: "No enabled text channels found to lock for this server." };
    }

    const everyoneRoleId = guild.roles.everyone.id;
    const snapshots: DiscordLockChannelSnapshot[] = [];
    const appliedChannelIds: string[] = [];

    try {
      for (const target of targets) {
        const overwrite = target.channel.permissionOverwrites.cache.get(everyoneRoleId);
        const snapshot: DiscordLockChannelSnapshot = {
          channelId: target.id,
          channelName: target.name,
          hadOverwrite: Boolean(overwrite),
          sendMessages: resolvePermissionState(overwrite ?? null, PermissionsBitField.Flags.SendMessages),
          sendMessagesInThreads: resolvePermissionState(
            overwrite ?? null,
            PermissionsBitField.Flags.SendMessagesInThreads,
          ),
        };
        snapshots.push(snapshot);

        await target.channel.permissionOverwrites.edit(
          everyoneRoleId,
          {
            SendMessages: false,
            SendMessagesInThreads: false,
          },
          {
            reason: reason ? `ModerateAI lock: ${reason}` : "ModerateAI timed lock",
          },
        );
        appliedChannelIds.push(target.id);
      }
    } catch (error: any) {
      // Roll back partial updates for safety.
      for (const channelId of appliedChannelIds) {
        const snapshot = snapshots.find((entry) => entry.channelId === channelId);
        const channel =
          guild.channels.cache.get(channelId) ??
          (await guild.channels.fetch(channelId).catch(() => null));
        if (!channel || !snapshot || channel.type !== ChannelType.GuildText) continue;
        try {
          if (!snapshot.hadOverwrite) {
            await channel.permissionOverwrites.delete(everyoneRoleId, "ModerateAI lock rollback");
          } else {
            await channel.permissionOverwrites.edit(
              everyoneRoleId,
              {
                SendMessages: permissionStateToApiValue(snapshot.sendMessages),
                SendMessagesInThreads: permissionStateToApiValue(snapshot.sendMessagesInThreads),
              },
              {
                reason: "ModerateAI lock rollback",
              },
            );
          }
        } catch {
          // Best-effort rollback.
        }
      }

      return {
        ok: false,
        warning: error?.message || "Failed to apply Discord lock to all enabled channels.",
      };
    }

    const noticeChannel = targets[0]?.channel;
    if (noticeChannel) {
      try {
        await noticeChannel.send(
          `Server lock enabled${reason ? `: ${reason}` : "."} Non-admin members are temporarily read-only in enabled channels.`,
        );
      } catch (error) {
        console.warn("Failed sending Discord lock notice:", error);
      }
    }

    return {
      ok: true,
      permissionSnapshot: {
        guildId,
        everyoneRoleId,
        channels: snapshots,
      },
      noticeChannelExternalId: noticeChannel?.id ?? null,
    };
  },
  releaseLock: async ({ chatConfig, platform, lock, releaseReason }) => {
    const client = await ensureDiscordClientForLock(platform);
    if (!client) {
      return { ok: false, warning: "Discord bot is not connected for this workspace." };
    }

    const snapshotRoot = (lock.permissionSnapshot as any) ?? {};
    const guildId = String(snapshotRoot.guildId ?? chatConfig.externalId ?? "").trim();
    const guild = client.guilds.cache.get(guildId) ?? (await client.guilds.fetch(guildId).catch(() => null));
    if (!guild) {
      return { ok: false, warning: "Discord server not found while unlocking." };
    }

    const everyoneRoleId = String(snapshotRoot.everyoneRoleId ?? guild.roles.everyone.id);
    const snapshots = Array.isArray(snapshotRoot.channels)
      ? (snapshotRoot.channels as DiscordLockChannelSnapshot[])
      : [];

    for (const snapshot of snapshots) {
      const channel =
        guild.channels.cache.get(snapshot.channelId) ??
        (await guild.channels.fetch(snapshot.channelId).catch(() => null));
      if (!channel || channel.type !== ChannelType.GuildText) continue;

      if (!snapshot.hadOverwrite) {
        await channel.permissionOverwrites.delete(everyoneRoleId, "ModerateAI unlock restore");
      } else {
        await channel.permissionOverwrites.edit(
          everyoneRoleId,
          {
            SendMessages: permissionStateToApiValue(snapshot.sendMessages),
            SendMessagesInThreads: permissionStateToApiValue(snapshot.sendMessagesInThreads),
          },
          {
            reason: "ModerateAI unlock restore",
          },
        );
      }
    }

    const noticeChannelId = String(lock.noticeChannelExternalId ?? "").trim();
    const noticeChannel =
      (noticeChannelId
        ? guild.channels.cache.get(noticeChannelId) ?? (await guild.channels.fetch(noticeChannelId).catch(() => null))
        : null) ?? null;
    if (noticeChannel && noticeChannel.type === ChannelType.GuildText) {
      try {
        await noticeChannel.send(`Server lock released.${releaseReason ? ` ${releaseReason}` : ""}`);
      } catch (error) {
        console.warn("Failed sending Discord unlock notice:", error);
      }
    }

    return { ok: true };
  },
};

export function getDiscordDestinationLockAdapter(): DestinationLockAdapter {
  return discordLockAdapter;
}

function buildDiscordInviteUrl(clientId: string, permissions: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    permissions,
    scope: "bot applications.commands",
  });
  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}

function setAppOwnedDiscordPublicInfo(client: Client): void {
  const configuredClientId = String(process.env.DISCORD_APP_BOT_CLIENT_ID ?? "").trim();
  const resolvedClientId =
    configuredClientId ||
    String(client.application?.id ?? "").trim() ||
    String(client.user?.id ?? "").trim();
  const permissions = APP_OWNED_DISCORD_INVITE_PERMISSIONS;

  appOwnedDiscordPublicInfo = {
    clientId: resolvedClientId || undefined,
    userId: client.user?.id ? String(client.user.id) : undefined,
    username: client.user?.username ? String(client.user.username) : undefined,
    tag: client.user?.tag ? String(client.user.tag) : undefined,
    invitePermissions: permissions,
    inviteUrl: resolvedClientId ? buildDiscordInviteUrl(resolvedClientId, permissions) : undefined,
  };
}

function normalizeGuildFromConfig(raw: any): DiscordConfigGuild | null {
  const id = String(raw?.id ?? raw?.guildId ?? "").trim();
  if (!id) return null;
  return {
    id,
    name: String(raw?.name ?? raw?.guildName ?? "Discord Server").trim() || "Discord Server",
    memberCount:
      typeof raw?.memberCount === "number" && Number.isFinite(raw.memberCount) ? Number(raw.memberCount) : undefined,
  };
}

function normalizeChannelFromConfig(raw: any, fallbackGuildId?: string, fallbackGuildName?: string): DiscordConfigChannel | null {
  const id = String(raw?.id ?? "").trim();
  if (!id) return null;
  const guildId = String(raw?.guildId ?? fallbackGuildId ?? "").trim();
  const guildName = String(raw?.guildName ?? fallbackGuildName ?? "").trim();
  return {
    id,
    name: String(raw?.name ?? "unknown-channel").trim() || "unknown-channel",
    type: String(raw?.type ?? "text").trim() || "text",
    guildId: guildId || undefined,
    guildName: guildName || undefined,
    moderationEnabled: typeof raw?.moderationEnabled === "boolean" ? raw.moderationEnabled : undefined,
    active: typeof raw?.active === "boolean" ? raw.active : undefined,
  };
}

function extractCachedGuilds(platformConfig: any): DiscordConfigGuild[] {
  const rows = Array.isArray(platformConfig?.servers) ? platformConfig.servers : [];
  const guilds: DiscordConfigGuild[] = [];
  for (const row of rows) {
    const normalized = normalizeGuildFromConfig(row);
    if (normalized) guilds.push(normalized);
  }
  if (guilds.length === 0 && platformConfig?.serverId) {
    const fallbackGuild = normalizeGuildFromConfig({
      id: platformConfig.serverId,
      name: platformConfig.serverName,
      memberCount: platformConfig.memberCount,
    });
    if (fallbackGuild) guilds.push(fallbackGuild);
  }
  return guilds;
}

function extractCachedChannels(platformConfig: any): DiscordConfigChannel[] {
  const rows = Array.isArray(platformConfig?.channels) ? platformConfig.channels : [];
  const channels: DiscordConfigChannel[] = [];
  for (const row of rows) {
    const normalized = normalizeChannelFromConfig(
      row,
      platformConfig?.serverId ? String(platformConfig.serverId) : undefined,
      platformConfig?.serverName ? String(platformConfig.serverName) : undefined,
    );
    if (normalized) channels.push(normalized);
  }
  return channels;
}

function toGuildInventory(guild: DiscordConfigGuild, channels: DiscordConfigChannel[]): DiscordGuildInventory {
  return {
    guildId: guild.id,
    guildName: guild.name,
    memberCount: typeof guild.memberCount === "number" ? guild.memberCount : null,
    channels,
  };
}

function getTextChannels(channels: DiscordConfigChannel[]): DiscordConfigChannel[] {
  return channels.filter((channel) => channel.type === "text");
}

function dedupeGuilds(guilds: DiscordConfigGuild[]): DiscordConfigGuild[] {
  const seen = new Set<string>();
  const out: DiscordConfigGuild[] = [];
  for (const guild of guilds) {
    if (!guild.id || seen.has(guild.id)) continue;
    seen.add(guild.id);
    out.push(guild);
  }
  return out;
}

function upsertGuild(guilds: DiscordConfigGuild[], nextGuild: DiscordConfigGuild): DiscordConfigGuild[] {
  const next = guilds.filter((guild) => guild.id !== nextGuild.id);
  next.push(nextGuild);
  return next;
}

async function getLiveGuildInventoryForClient(client: Client, guildId: string): Promise<DiscordGuildInventory | null> {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return null;
  const rawChannels = await fetchChannels(client, guildId);
  const channels: DiscordConfigChannel[] = rawChannels
    .map((channel) =>
      normalizeChannelFromConfig(channel, guild.id, guild.name),
    )
    .filter((channel): channel is DiscordConfigChannel => Boolean(channel));
  return {
    guildId: guild.id,
    guildName: guild.name,
    memberCount: typeof guild.memberCount === "number" ? guild.memberCount : null,
    channels,
  };
}

async function resolveGuildInventoryForPlatform(platformId: number, guildId: string): Promise<DiscordGuildInventory | null> {
  const platform = await storage.getPlatform(platformId);
  if (!platform || platform.type !== "discord") return null;

  const mode = (platform.botOwnershipMode ?? "byob") as "app_owned" | "byob";
  const platformConfig = (platform.config as any) ?? {};
  const cachedGuilds = extractCachedGuilds(platformConfig);
  const cachedChannels = extractCachedChannels(platformConfig);

  const liveClient = mode === "app_owned" ? appOwnedDiscordClient : discordClients.get(platformId) ?? null;
  if (liveClient) {
    const liveInventory = await getLiveGuildInventoryForClient(liveClient, guildId);
    if (liveInventory) {
      return liveInventory;
    }
  }

  const cachedGuild = cachedGuilds.find((guild) => guild.id === guildId);
  if (!cachedGuild) return null;
  const guildChannels = cachedChannels.filter((channel) => channel.guildId === guildId);
  return toGuildInventory(cachedGuild, guildChannels);
}

async function syncGuildChannelsIntoPlatformConfig(
  platformId: number,
  guildInventory: DiscordGuildInventory,
): Promise<void> {
  const platform = await storage.getPlatform(platformId);
  if (!platform) return;
  const platformConfig = (platform.config as any) ?? {};
  const cachedGuilds = extractCachedGuilds(platformConfig);
  const cachedChannels = extractCachedChannels(platformConfig);

  const guilds = upsertGuild(cachedGuilds, {
    id: guildInventory.guildId,
    name: guildInventory.guildName,
    memberCount: guildInventory.memberCount ?? undefined,
  });

  const channelsWithoutGuild = cachedChannels.filter((channel) => channel.guildId !== guildInventory.guildId);
  const normalizedGuildChannels = guildInventory.channels.map((channel) => ({
    ...channel,
    guildId: guildInventory.guildId,
    guildName: guildInventory.guildName,
  }));

  await storage.updatePlatform(platformId, {
    config: {
      ...platformConfig,
      servers: dedupeGuilds(guilds),
      channels: [...channelsWithoutGuild, ...normalizedGuildChannels],
      lastRefreshed: new Date().toISOString(),
    } as any,
  });
}

function buildEnabledChannelsMap(
  channelIds: string[],
  existingMap: Record<string, boolean>,
  mode: DiscordChannelSyncMode,
  claimChannelId?: string,
): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  const uniqueChannelIds = Array.from(new Set(channelIds.filter(Boolean)));

  if (mode === "app_owned_claim") {
    for (const channelId of uniqueChannelIds) {
      map[channelId] = false;
    }
    if (claimChannelId) {
      map[claimChannelId] = true;
    }
    return map;
  }

  if (mode === "byob_enable") {
    for (const channelId of uniqueChannelIds) {
      map[channelId] = false;
    }
    return map;
  }

  for (const channelId of uniqueChannelIds) {
    map[channelId] = existingMap[channelId] === true;
  }
  return map;
}

async function syncChatConfigChannelState(
  configId: number,
  guildChannels: DiscordConfigChannel[],
  mode: DiscordChannelSyncMode,
  claimChannelId?: string,
): Promise<void> {
  const config = await storage.getChatConfiguration(configId);
  if (!config) return;
  const currentSettings = (config.settings as any) ?? {};
  const existingEnabledChannels = (currentSettings.enabledChannels as Record<string, boolean> | undefined) ?? {};
  const textChannelIds = getTextChannels(guildChannels).map((channel) => channel.id);
  const enabledChannels = buildEnabledChannelsMap(textChannelIds, existingEnabledChannels, mode, claimChannelId);

  await storage.updateChatConfiguration(configId, {
    settings: {
      ...currentSettings,
      enabledChannels,
      totalChannels: textChannelIds.length,
    },
  } as any);
}

async function syncDiscordServerByConfig(
  platformId: number,
  config: any,
  mode: DiscordChannelSyncMode,
  claimChannelId?: string,
): Promise<boolean> {
  try {
    const guildId = String(config.externalId ?? "").trim();
    if (!guildId) return false;
    const guildInventory = await resolveGuildInventoryForPlatform(platformId, guildId);
    if (!guildInventory) return false;
    await syncGuildChannelsIntoPlatformConfig(platformId, guildInventory);
    await syncChatConfigChannelState(config.id, guildInventory.channels, mode, claimChannelId);
    return true;
  } catch (error) {
    console.warn("Failed syncing Discord guild inventory", { platformId, externalId: config.externalId, error });
    recordOpsEvent("DISCORD_INVENTORY_SYNC_FAILED", {
      platformId,
      guildId: config.externalId,
      reason: "sync_failed",
    });
    return false;
  }
}

export async function getDiscoveredServersForPlatform(platformId: number): Promise<DiscordDiscoveredServer[]> {
  const platform = await storage.getPlatform(platformId);
  if (!platform || platform.type !== "discord") return [];

  const mode = (platform.botOwnershipMode ?? "byob") as "app_owned" | "byob";
  const platformConfig = (platform.config as any) ?? {};
  const cachedGuilds = extractCachedGuilds(platformConfig);
  const cachedChannels = extractCachedChannels(platformConfig);
  const chatConfigs = (await storage.getChatConfigurationsByPlatformId(platformId)).filter(
    (config) => config.chatType === "server",
  );
  const configByGuildId = new Map(chatConfigs.map((config) => [String(config.externalId), config]));

  const guildInventoryById = new Map<string, DiscordGuildInventory>();

  if (mode === "app_owned") {
    const claimedGuildIds = Array.from(new Set(chatConfigs.map((config) => String(config.externalId).trim()).filter(Boolean)));
    for (const guildId of claimedGuildIds) {
      const liveInventory = appOwnedDiscordClient ? await getLiveGuildInventoryForClient(appOwnedDiscordClient, guildId) : null;
      if (liveInventory) {
        guildInventoryById.set(guildId, liveInventory);
        continue;
      }
      const cachedGuild = cachedGuilds.find((guild) => guild.id === guildId);
      if (cachedGuild) {
        guildInventoryById.set(guildId, toGuildInventory(cachedGuild, cachedChannels.filter((channel) => channel.guildId === guildId)));
      } else {
        const config = configByGuildId.get(guildId);
        guildInventoryById.set(guildId, {
          guildId,
          guildName: String(config?.chatName ?? "Discord Server"),
          memberCount: null,
          channels: [],
        });
      }
    }
  } else {
    const liveClient = discordClients.get(platformId) ?? null;
    if (liveClient) {
      const liveGuilds = Array.from(liveClient.guilds.cache.values());
      for (const guild of liveGuilds) {
        const inventory = await getLiveGuildInventoryForClient(liveClient, guild.id);
        if (inventory) guildInventoryById.set(guild.id, inventory);
      }
    }

    for (const cachedGuild of cachedGuilds) {
      if (guildInventoryById.has(cachedGuild.id)) continue;
      guildInventoryById.set(
        cachedGuild.id,
        toGuildInventory(cachedGuild, cachedChannels.filter((channel) => channel.guildId === cachedGuild.id)),
      );
    }
  }

  const discovered: DiscordDiscoveredServer[] = [];
  for (const inventory of Array.from(guildInventoryById.values())) {
    const guildId = String(inventory.guildId);
    const textChannelCount = getTextChannels(inventory.channels).length;
    const config = configByGuildId.get(guildId);
    const settings = (config?.settings as any) ?? {};
    const enabledChannels = (settings.enabledChannels as Record<string, boolean> | undefined) ?? {};
    const totalChannels = Number(settings.totalChannels ?? 0);
    const channelsUnavailable =
      textChannelCount === 0 && (totalChannels > 0 || Object.keys(enabledChannels).length > 0);

    discovered.push({
      guildId,
      guildName: inventory.guildName,
      memberCount: inventory.memberCount ?? undefined,
      textChannelCount,
      isConfigured: Boolean(config),
      isActive: Boolean(config?.isActive),
      channelsUnavailable,
    });
  }

  return discovered.sort((a, b) => a.guildName.localeCompare(b.guildName));
}

export async function enableByobDiscordServer(
  platformId: number,
  guildIdRaw: string,
): Promise<{ configId: number; created: boolean; guildName: string; textChannelCount: number }> {
  const guildId = String(guildIdRaw ?? "").trim();
  recordOpsEvent("DISCORD_SERVER_ENABLE_REQUEST", { platformId, guildId });

  if (!guildId) {
    recordOpsEvent("DISCORD_SERVER_ENABLE_DENIED", { platformId, guildId, reason: "missing_guild_id" });
    throw new Error("Guild ID is required");
  }

  const platform = await storage.getPlatform(platformId);
  if (!platform || platform.type !== "discord") {
    recordOpsEvent("DISCORD_SERVER_ENABLE_DENIED", { platformId, guildId, reason: "invalid_platform" });
    throw new Error("Discord platform not found");
  }

  if ((platform.botOwnershipMode ?? "byob") !== "byob") {
    recordOpsEvent("DISCORD_SERVER_ENABLE_DENIED", { platformId, guildId, reason: "mode_not_byob" });
    throw new Error("Server enablement is only available in BYOB mode");
  }

  const guildInventory = await resolveGuildInventoryForPlatform(platformId, guildId);
  if (!guildInventory) {
    recordOpsEvent("DISCORD_SERVER_ENABLE_DENIED", { platformId, guildId, reason: "guild_not_discovered" });
    throw new Error("Server not found in discovered inventory");
  }

  const limitCheck = await enforceDestinationLimit({
    platformId,
    destinationExternalId: guildId,
    kind: "discord_server",
  });
  if (!limitCheck.allowed) {
    recordOpsEvent("DISCORD_SERVER_ENABLE_DENIED", { platformId, guildId, reason: "destination_limit_reached" });
    if (typeof limitCheck.limit === "number") {
      throw new Error(`Server limit reached for this plan (${limitCheck.limit} max).`);
    }
    throw new Error("Server limit reached for this plan.");
  }

  await syncGuildChannelsIntoPlatformConfig(platformId, guildInventory);
  const existingConfig = await storage.getChatConfigurationByPlatformAndExternalId(platformId, guildId);
  const textChannels = getTextChannels(guildInventory.channels);
  const textChannelIds = textChannels.map((channel) => channel.id);

  if (!existingConfig) {
    const enabledChannels = buildEnabledChannelsMap(textChannelIds, {}, "byob_enable");
    const created = await storage.createChatConfiguration({
      platformId,
      externalId: guildId,
      chatType: "server",
      chatName: guildInventory.guildName,
      aiConfigurationId: null,
      knowledgeBaseId: null,
      settings: {
        respondToMentions: true,
        respondToCommands: true,
        privateResponses: false,
        contentFilteringEnabled: true,
        proactiveResponses: true,
        enabledChannels,
        totalChannels: textChannels.length,
      },
      isActive: true,
    } as any);

    recordOpsEvent("DISCORD_SERVER_ENABLED", { platformId, guildId, created: true, textChannelCount: textChannels.length });
    return {
      configId: created.id,
      created: true,
      guildName: guildInventory.guildName,
      textChannelCount: textChannels.length,
    };
  }

  await storage.updateChatConfiguration(existingConfig.id, {
    isActive: true,
    chatName: guildInventory.guildName,
  } as any);
  await syncChatConfigChannelState(existingConfig.id, guildInventory.channels, "byob_sync");

  recordOpsEvent("DISCORD_SERVER_ENABLED", { platformId, guildId, created: false, textChannelCount: textChannels.length });
  return {
    configId: existingConfig.id,
    created: false,
    guildName: guildInventory.guildName,
    textChannelCount: textChannels.length,
  };
}

export async function syncDiscordServerConfigurations(
  platformId: number,
  mode?: "app_owned" | "byob",
): Promise<DiscordServerSyncSummary> {
  const platform = await storage.getPlatform(platformId);
  if (!platform || platform.type !== "discord") {
    return { synced: 0, failed: 0, skipped: 0 };
  }

  const resolvedMode = mode ?? ((platform.botOwnershipMode ?? "byob") as "app_owned" | "byob");
  const chatConfigs = (await storage.getChatConfigurationsByPlatformId(platformId)).filter(
    (config) => config.chatType === "server",
  );

  if (chatConfigs.length === 0) {
    return { synced: 0, failed: 0, skipped: 0 };
  }

  let synced = 0;
  let failed = 0;

  for (const config of chatConfigs) {
    const ok = await syncDiscordServerByConfig(
      platformId,
      config,
      resolvedMode === "app_owned" ? "app_owned_sync" : "byob_sync",
    );
    if (ok) synced += 1;
    else failed += 1;
  }

  return {
    synced,
    failed,
    skipped: 0,
  };
}

async function resolveAppOwnedDiscordPlatformId(guildId: string): Promise<number | null> {
  const rows = await db
    .select({ platformId: chatConfigurations.platformId })
    .from(chatConfigurations)
    .innerJoin(platforms, eq(chatConfigurations.platformId, platforms.id))
    .where(
      and(
        eq(platforms.type, 'discord'),
        eq(platforms.botOwnershipMode, 'app_owned'),
        eq(platforms.status, 'active'),
        eq(chatConfigurations.externalId, guildId),
        eq(chatConfigurations.chatType, 'server'),
        eq(chatConfigurations.isActive, true),
      ),
    )
    .limit(1);

  return rows[0]?.platformId ?? null;
}

async function isDiscordDestinationAlreadyClaimedElsewhere(platformId: number, guildId: string): Promise<boolean> {
  const rows = await db
    .select({ id: chatConfigurations.id })
    .from(chatConfigurations)
    .innerJoin(platforms, eq(chatConfigurations.platformId, platforms.id))
    .where(
      and(
        eq(platforms.type, 'discord'),
        eq(platforms.botOwnershipMode, 'app_owned'),
        eq(chatConfigurations.externalId, guildId),
        eq(chatConfigurations.chatType, 'server'),
        eq(chatConfigurations.isActive, true),
        ne(chatConfigurations.platformId, platformId),
      ),
    )
    .limit(1);

  return rows.length > 0;
}

async function handleDiscordClaimCommand(message: Message, claimCodeRaw: string): Promise<void> {
  recordOpsEvent('INTEGRATION_CLAIM_ATTEMPT', { platform: 'discord' });
  const guildId = message.guildId;
  if (!guildId) {
    await message.reply('Run this command inside the target Discord server.');
    recordOpsEvent('INTEGRATION_CLAIM_FAILURE', { platform: 'discord', reason: 'no_guild' });
    return;
  }

  const normalizedCode = String(claimCodeRaw ?? '').trim().toUpperCase();
  if (!normalizedCode) {
    await message.reply('Usage: /claim YOUR_CODE or !claim YOUR_CODE');
    return;
  }

  const claim = await storage.getIntegrationClaimCodeByCode(normalizedCode);
  if (!claim || claim.platformType !== 'discord') {
    await message.reply('Invalid claim code. Generate a new one from ModerateAI.');
    recordOpsEvent('INTEGRATION_CLAIM_FAILURE', { platform: 'discord', reason: 'invalid_code' });
    return;
  }

  const now = new Date();
  if (claim.revokedAt || claim.usedAt || new Date(claim.expiresAt).getTime() <= now.getTime()) {
    await message.reply('Claim code is expired or already used. Generate a new one from ModerateAI.');
    recordOpsEvent('INTEGRATION_CLAIM_FAILURE', { platform: 'discord', reason: 'expired_or_used' });
    return;
  }

  const targetPlatform = await storage.getPlatform(claim.platformId);
  if (!targetPlatform || targetPlatform.type !== 'discord' || targetPlatform.botOwnershipMode !== 'app_owned') {
    await message.reply('Claim target is no longer valid. Generate a new claim code.');
    recordOpsEvent('INTEGRATION_CLAIM_FAILURE', { platform: 'discord', reason: 'invalid_target' });
    return;
  }

  const memberPermissions = message.member?.permissions;
  const canManageGuild = Boolean(
    memberPermissions?.has(PermissionsBitField.Flags.ManageGuild) ||
      memberPermissions?.has(PermissionsBitField.Flags.Administrator),
  );
  if (!canManageGuild) {
    await message.reply('Only server admins can claim this destination.');
    recordOpsEvent('INTEGRATION_CLAIM_FAILURE', { platform: 'discord', reason: 'not_admin' });
    return;
  }

  const limitCheck = await enforceDestinationLimit({
    platformId: targetPlatform.id,
    destinationExternalId: guildId,
    kind: 'discord_server',
    onLimitExceededOnce: async (limitMessage) => {
      await message.reply(limitMessage);
    },
  });
  if (!limitCheck.allowed) {
    return;
  }
  const serverName = message.guild?.name || 'Discord Server';
  let targetConfigId: number | null = null;
  let claimFinalizeStatus: 'ok' | 'conflict' | 'consume_failed' = 'ok';

  if (integrationSafetyHardeningEnabled) {
    const finalizeResult = await db.transaction(async (tx) => {
      if (integrationClaimDestinationLockEnabled) {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext('moderateai:discord_claim'), hashtext(${guildId}))`,
        );
      }

      const conflicts = await tx
        .select({ id: chatConfigurations.id })
        .from(chatConfigurations)
        .innerJoin(platforms, eq(chatConfigurations.platformId, platforms.id))
        .where(
          and(
            eq(platforms.type, 'discord'),
            eq(platforms.botOwnershipMode, 'app_owned'),
            eq(chatConfigurations.externalId, guildId),
            eq(chatConfigurations.chatType, 'server'),
            eq(chatConfigurations.isActive, true),
            ne(chatConfigurations.platformId, targetPlatform.id),
          ),
        )
        .limit(1);

      if (conflicts.length > 0) {
        return { status: 'conflict' as const, configId: null as number | null };
      }

      const [existingConfig] = await tx
        .select()
        .from(chatConfigurations)
        .where(
          and(
            eq(chatConfigurations.platformId, targetPlatform.id),
            eq(chatConfigurations.externalId, guildId),
          ),
        )
        .limit(1);

      let localConfigId: number;
      if (!existingConfig) {
        const [createdConfig] = await tx
          .insert(chatConfigurations)
          .values({
            platformId: targetPlatform.id,
            externalId: guildId,
            chatType: 'server',
            chatName: serverName,
            aiConfigurationId: null,
            knowledgeBaseId: null,
            settings: {
              respondToMentions: true,
              respondToCommands: true,
              privateResponses: false,
              contentFilteringEnabled: true,
              proactiveResponses: true,
              enabledChannels: { [message.channel.id]: true },
              totalChannels: 1,
            },
            isActive: true,
          } as any)
          .returning({ id: chatConfigurations.id });
        localConfigId = createdConfig.id;
      } else {
        localConfigId = existingConfig.id;
        if (!existingConfig.isActive || existingConfig.chatName !== serverName) {
          await tx
            .update(chatConfigurations)
            .set({
              isActive: true,
              chatName: serverName,
              updatedAt: new Date(),
            } as any)
            .where(eq(chatConfigurations.id, existingConfig.id));
        }
      }

      const [consumed] = await tx
        .update(integrationClaimCodes)
        .set({
          usedAt: now,
          usedExternalId: guildId,
          usedByPlatformUserId: String(message.author.id),
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
        return { status: 'consume_failed' as const, configId: null as number | null };
      }

      if (targetPlatform.status !== 'active') {
        await tx
          .update(platforms)
          .set({ status: 'active' } as any)
          .where(eq(platforms.id, targetPlatform.id));
      }

      return { status: 'ok' as const, configId: localConfigId };
    });

    claimFinalizeStatus = finalizeResult.status;
    targetConfigId = finalizeResult.configId;
  } else {
    if (await isDiscordDestinationAlreadyClaimedElsewhere(targetPlatform.id, guildId)) {
      claimFinalizeStatus = 'conflict';
    } else {
      const existingConfig = await storage.getChatConfigurationByPlatformAndExternalId(targetPlatform.id, guildId);
      targetConfigId = existingConfig?.id ?? null;
      if (!existingConfig) {
        const createdConfig = await storage.createChatConfiguration({
          platformId: targetPlatform.id,
          externalId: guildId,
          chatType: 'server',
          chatName: serverName,
          aiConfigurationId: null,
          knowledgeBaseId: null,
          settings: {
            respondToMentions: true,
            respondToCommands: true,
            privateResponses: false,
            contentFilteringEnabled: true,
            proactiveResponses: true,
            enabledChannels: { [message.channel.id]: true },
            totalChannels: 1,
          },
          isActive: true,
        } as any);
        targetConfigId = createdConfig.id;
      } else if (!existingConfig.isActive || existingConfig.chatName !== serverName) {
        await storage.updateChatConfiguration(existingConfig.id, {
          isActive: true,
          chatName: serverName,
        } as any);
      }

      const consumed = await storage.markIntegrationClaimCodeUsed(claim.id, {
        usedAt: now,
        usedExternalId: guildId,
        usedByPlatformUserId: String(message.author.id),
      });
      if (!consumed) {
        claimFinalizeStatus = 'consume_failed';
      } else if (targetPlatform.status !== 'active') {
        await storage.updatePlatform(targetPlatform.id, { status: 'active' } as any);
      }
    }
  }

  if (claimFinalizeStatus === 'conflict') {
    await message.reply(
      'This Discord server is already linked to another workspace. Ask support if you need reassignment.',
    );
    recordOpsEvent('INTEGRATION_CLAIM_FAILURE', { platform: 'discord', reason: 'already_claimed_elsewhere' });
    if (integrationSafetyHardeningEnabled) {
      recordOpsEvent('INTEGRATION_CLAIM_CONFLICT', { platform: 'discord', destinationExternalId: guildId });
    }
    return;
  }

  if (claimFinalizeStatus === 'consume_failed') {
    await message.reply('Claim code is expired or already used. Generate a new one from ModerateAI.');
    recordOpsEvent('INTEGRATION_CLAIM_FAILURE', { platform: 'discord', reason: 'expired_or_used' });
    if (integrationSafetyHardeningEnabled) {
      recordOpsEvent('INTEGRATION_CLAIM_CONSUME_FAILED', { platform: 'discord', destinationExternalId: guildId });
    }
    return;
  }

  if (targetConfigId) {
    const syncOk = await syncDiscordServerByConfig(
      targetPlatform.id,
      { id: targetConfigId, externalId: guildId },
      "app_owned_claim",
      message.channel.id,
    );
    if (!syncOk) {
      recordOpsEvent("DISCORD_INVENTORY_SYNC_FAILED", {
        platformId: targetPlatform.id,
        guildId,
        reason: "claim_command_sync_failed",
      });
    }
  }

  await recordAuditEvent({
    ownerUserId: claim.workspaceOwnerId,
    actorUserId: claim.createdByUserId,
    action: 'integration.claim_code_used',
    targetType: 'platform',
    targetId: String(targetPlatform.id),
    details: {
      platformType: 'discord',
      destinationExternalId: guildId,
      claimCodeSuffix: normalizedCode.slice(-4),
      claimedByDiscordUserId: String(message.author.id),
      claimedAt: now.toISOString(),
    },
  });

  await message.reply('Claim successful. This Discord server is now linked to your ModerateAI workspace.');
}

async function handleDiscordClaimInteraction(
  interaction: ChatInputCommandInteraction,
  claimCodeRaw: string,
): Promise<void> {
  recordOpsEvent('INTEGRATION_CLAIM_ATTEMPT', { platform: 'discord' });
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({ content: 'Run this command inside the target Discord server.', ephemeral: true });
    recordOpsEvent('INTEGRATION_CLAIM_FAILURE', { platform: 'discord', reason: 'no_guild' });
    return;
  }

  const normalizedCode = String(claimCodeRaw ?? '').trim().toUpperCase();
  if (!normalizedCode) {
    await interaction.reply({ content: 'Usage: /claim code:YOUR_CODE', ephemeral: true });
    return;
  }

  const claim = await storage.getIntegrationClaimCodeByCode(normalizedCode);
  if (!claim || claim.platformType !== 'discord') {
    await interaction.reply({ content: 'Invalid claim code. Generate a new one from ModerateAI.', ephemeral: true });
    recordOpsEvent('INTEGRATION_CLAIM_FAILURE', { platform: 'discord', reason: 'invalid_code' });
    return;
  }

  const now = new Date();
  if (claim.revokedAt || claim.usedAt || new Date(claim.expiresAt).getTime() <= now.getTime()) {
    await interaction.reply({
      content: 'Claim code is expired or already used. Generate a new one from ModerateAI.',
      ephemeral: true,
    });
    recordOpsEvent('INTEGRATION_CLAIM_FAILURE', { platform: 'discord', reason: 'expired_or_used' });
    return;
  }

  const targetPlatform = await storage.getPlatform(claim.platformId);
  if (!targetPlatform || targetPlatform.type !== 'discord' || targetPlatform.botOwnershipMode !== 'app_owned') {
    await interaction.reply({ content: 'Claim target is no longer valid. Generate a new claim code.', ephemeral: true });
    recordOpsEvent('INTEGRATION_CLAIM_FAILURE', { platform: 'discord', reason: 'invalid_target' });
    return;
  }

  const canManageGuild = Boolean(
    interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild) ||
      interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator),
  );
  if (!canManageGuild) {
    await interaction.reply({ content: 'Only server admins can claim this destination.', ephemeral: true });
    recordOpsEvent('INTEGRATION_CLAIM_FAILURE', { platform: 'discord', reason: 'not_admin' });
    return;
  }

  const limitCheck = await enforceDestinationLimit({
    platformId: targetPlatform.id,
    destinationExternalId: guildId,
    kind: 'discord_server',
    onLimitExceededOnce: async (limitMessage) => {
      await interaction.reply({ content: limitMessage, ephemeral: true });
    },
  });
  if (!limitCheck.allowed) {
    return;
  }
  const serverName = interaction.guild?.name || 'Discord Server';
  let targetConfigId: number | null = null;
  let claimFinalizeStatus: 'ok' | 'conflict' | 'consume_failed' = 'ok';

  if (integrationSafetyHardeningEnabled) {
    const finalizeResult = await db.transaction(async (tx) => {
      if (integrationClaimDestinationLockEnabled) {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext('moderateai:discord_claim'), hashtext(${guildId}))`,
        );
      }

      const conflicts = await tx
        .select({ id: chatConfigurations.id })
        .from(chatConfigurations)
        .innerJoin(platforms, eq(chatConfigurations.platformId, platforms.id))
        .where(
          and(
            eq(platforms.type, 'discord'),
            eq(platforms.botOwnershipMode, 'app_owned'),
            eq(chatConfigurations.externalId, guildId),
            eq(chatConfigurations.chatType, 'server'),
            eq(chatConfigurations.isActive, true),
            ne(chatConfigurations.platformId, targetPlatform.id),
          ),
        )
        .limit(1);

      if (conflicts.length > 0) {
        return { status: 'conflict' as const, configId: null as number | null };
      }

      const [existingConfig] = await tx
        .select()
        .from(chatConfigurations)
        .where(
          and(
            eq(chatConfigurations.platformId, targetPlatform.id),
            eq(chatConfigurations.externalId, guildId),
          ),
        )
        .limit(1);

      let localConfigId: number;
      if (!existingConfig) {
        const [createdConfig] = await tx
          .insert(chatConfigurations)
          .values({
            platformId: targetPlatform.id,
            externalId: guildId,
            chatType: 'server',
            chatName: serverName,
            aiConfigurationId: null,
            knowledgeBaseId: null,
            settings: {
              respondToMentions: true,
              respondToCommands: true,
              privateResponses: false,
              contentFilteringEnabled: true,
              proactiveResponses: true,
              enabledChannels: interaction.channelId ? { [interaction.channelId]: true } : {},
              totalChannels: interaction.channelId ? 1 : 0,
            },
            isActive: true,
          } as any)
          .returning({ id: chatConfigurations.id });
        localConfigId = createdConfig.id;
      } else {
        localConfigId = existingConfig.id;
        if (!existingConfig.isActive || existingConfig.chatName !== serverName) {
          await tx
            .update(chatConfigurations)
            .set({
              isActive: true,
              chatName: serverName,
              updatedAt: new Date(),
            } as any)
            .where(eq(chatConfigurations.id, existingConfig.id));
        }
      }

      const [consumed] = await tx
        .update(integrationClaimCodes)
        .set({
          usedAt: now,
          usedExternalId: guildId,
          usedByPlatformUserId: String(interaction.user.id),
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
        return { status: 'consume_failed' as const, configId: null as number | null };
      }

      if (targetPlatform.status !== 'active') {
        await tx
          .update(platforms)
          .set({ status: 'active' } as any)
          .where(eq(platforms.id, targetPlatform.id));
      }

      return { status: 'ok' as const, configId: localConfigId };
    });

    claimFinalizeStatus = finalizeResult.status;
    targetConfigId = finalizeResult.configId;
  } else {
    if (await isDiscordDestinationAlreadyClaimedElsewhere(targetPlatform.id, guildId)) {
      claimFinalizeStatus = 'conflict';
    } else {
      const existingConfig = await storage.getChatConfigurationByPlatformAndExternalId(targetPlatform.id, guildId);
      targetConfigId = existingConfig?.id ?? null;
      if (!existingConfig) {
        const createdConfig = await storage.createChatConfiguration({
          platformId: targetPlatform.id,
          externalId: guildId,
          chatType: 'server',
          chatName: serverName,
          aiConfigurationId: null,
          knowledgeBaseId: null,
          settings: {
            respondToMentions: true,
            respondToCommands: true,
            privateResponses: false,
            contentFilteringEnabled: true,
            proactiveResponses: true,
            enabledChannels: interaction.channelId ? { [interaction.channelId]: true } : {},
            totalChannels: interaction.channelId ? 1 : 0,
          },
          isActive: true,
        } as any);
        targetConfigId = createdConfig.id;
      } else if (!existingConfig.isActive || existingConfig.chatName !== serverName) {
        await storage.updateChatConfiguration(existingConfig.id, {
          isActive: true,
          chatName: serverName,
        } as any);
      }

      const consumed = await storage.markIntegrationClaimCodeUsed(claim.id, {
        usedAt: now,
        usedExternalId: guildId,
        usedByPlatformUserId: String(interaction.user.id),
      });
      if (!consumed) {
        claimFinalizeStatus = 'consume_failed';
      } else if (targetPlatform.status !== 'active') {
        await storage.updatePlatform(targetPlatform.id, { status: 'active' } as any);
      }
    }
  }

  if (claimFinalizeStatus === 'conflict') {
    await interaction.reply({
      content: 'This Discord server is already linked to another workspace. Ask support if you need reassignment.',
      ephemeral: true,
    });
    recordOpsEvent('INTEGRATION_CLAIM_FAILURE', { platform: 'discord', reason: 'already_claimed_elsewhere' });
    if (integrationSafetyHardeningEnabled) {
      recordOpsEvent('INTEGRATION_CLAIM_CONFLICT', { platform: 'discord', destinationExternalId: guildId });
    }
    return;
  }

  if (claimFinalizeStatus === 'consume_failed') {
    await interaction.reply({
      content: 'Claim code is expired or already used. Generate a new one from ModerateAI.',
      ephemeral: true,
    });
    recordOpsEvent('INTEGRATION_CLAIM_FAILURE', { platform: 'discord', reason: 'expired_or_used' });
    if (integrationSafetyHardeningEnabled) {
      recordOpsEvent('INTEGRATION_CLAIM_CONSUME_FAILED', { platform: 'discord', destinationExternalId: guildId });
    }
    return;
  }

  if (targetConfigId) {
    const syncOk = await syncDiscordServerByConfig(
      targetPlatform.id,
      { id: targetConfigId, externalId: guildId },
      "app_owned_claim",
      interaction.channelId || undefined,
    );
    if (!syncOk) {
      recordOpsEvent("DISCORD_INVENTORY_SYNC_FAILED", {
        platformId: targetPlatform.id,
        guildId,
        reason: "claim_interaction_sync_failed",
      });
    }
  }

  await recordAuditEvent({
    ownerUserId: claim.workspaceOwnerId,
    actorUserId: claim.createdByUserId,
    action: 'integration.claim_code_used',
    targetType: 'platform',
    targetId: String(targetPlatform.id),
    details: {
      platformType: 'discord',
      destinationExternalId: guildId,
      claimCodeSuffix: normalizedCode.slice(-4),
      claimedByDiscordUserId: String(interaction.user.id),
      claimedAt: now.toISOString(),
    },
  });

  await interaction.reply({
    content: 'Claim successful. This Discord server is now linked to your ModerateAI workspace.',
    ephemeral: true,
  });
}

async function sendDiscordUnclaimedHint(message: Message): Promise<void> {
  const guildId = message.guildId;
  if (!guildId) return;
  const key = `discord:${guildId}`;
  if (!shouldSendDiscordHint(key)) return;
  await message.reply(
    'This server is not linked to a workspace yet. Ask your workspace admin to generate a claim code in ModerateAI, then run `/claim YOUR_CODE` or `!claim YOUR_CODE`.',
  );
  recordOpsEvent(
    'INTEGRATION_UNCLAIMED_HINT',
    { platform: 'discord', destinationExternalId: guildId },
    { bucketKey: `INTEGRATION_UNCLAIMED_HINT:discord:${guildId}` },
  );
}

async function sendDiscordByobEnableHint(message: Message, platformId: number): Promise<void> {
  const guildId = message.guildId;
  if (!guildId) return;
  const key = `discord:byob:${platformId}:${guildId}`;
  if (!shouldSendByobDiscordHint(key)) return;
  await message.reply(
    "This server is not enabled yet. Enable it in ModerateAI (Discord > Servers) and then enable at least one channel.",
  );
  recordOpsEvent(
    "DISCORD_UNENABLED_SERVER_HINT_SENT",
    { platformId, destinationExternalId: guildId },
    { bucketKey: `DISCORD_UNENABLED_SERVER_HINT_SENT:${platformId}:${guildId}` },
  );
}

async function tryHandleDiscordLockCommand(params: {
  message: Message;
  platformId: number;
  chatConfig: any;
}): Promise<boolean> {
  const content = String(params.message.content ?? "").trim();
  if (!content.startsWith("!lock") && !content.startsWith("!unlock") && !content.startsWith("/lock") && !content.startsWith("/unlock")) {
    return false;
  }

  if (!botTimedLocksEnabled) {
    await params.message.reply("Timed locking is currently disabled.");
    return true;
  }

  const parsed = parseDiscordLockCommand(content);
  if (!parsed.command) return false;

  if (!(await isDiscordPlatformAdmin(params.message))) {
    await params.message.reply("Only Discord server admins can lock or unlock this server.");
    return true;
  }

  const platform = await storage.getPlatform(params.platformId);
  if (!platform) {
    await params.message.reply("Workspace platform configuration not found.");
    return true;
  }

  if (parsed.command === "lock") {
    if (!parsed.durationMinutes) {
      await params.message.reply("Usage: !lock <duration> [reason]. Example: !lock 15m raid cleanup");
      return true;
    }

    const lockResult = await createOrExtendDestinationLock({
      chatConfig: params.chatConfig,
      platform,
      source: "manual_chat",
      durationMinutes: parsed.durationMinutes,
      reason: parsed.reason,
      actor: {
        requestedByPlatformUserId: String(params.message.author.id),
        requestedByPlatformUsername: params.message.author.username || params.message.member?.displayName || null,
      },
      adapter: discordLockAdapter,
      metadata: {
        requestedVia: "discord_command",
        channelId: params.message.channel.id,
      },
    });

    if (!lockResult.ok) {
      await params.message.reply(lockResult.warning || "Failed to apply server lock.");
      return true;
    }
    if (lockResult.alreadyLocked && !lockResult.extended) {
      await params.message.reply("Server is already locked for an equal or longer duration.");
      return true;
    }
    if (lockResult.extended) {
      await params.message.reply("Server lock duration has been extended.");
      return true;
    }
    await params.message.reply("Server lock applied.");
    return true;
  }

  const unlockResult = await unlockDestinationByChatConfiguration({
    chatConfig: params.chatConfig,
    platform,
    adapter: discordLockAdapter,
    reason: parsed.reason || "Unlocked by Discord server admin command.",
    source: "manual_chat",
  });

  if (!unlockResult.ok) {
    await params.message.reply(unlockResult.warning || "Failed to unlock this server.");
    return true;
  }
  if (unlockResult.alreadyUnlocked) {
    await params.message.reply("Server is already unlocked.");
    return true;
  }
  await params.message.reply("Server unlocked.");
  return true;
}

async function tryHandleDiscordLockInteraction(interaction: ChatInputCommandInteraction): Promise<boolean> {
  if (interaction.commandName !== "lock" && interaction.commandName !== "unlock") {
    return false;
  }

  if (!interaction.guildId || !interaction.memberPermissions) {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    }
    return true;
  }

  if (!botTimedLocksEnabled) {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: "Timed locking is currently disabled.", ephemeral: true });
    }
    return true;
  }

  const hasAdminPermission =
    interaction.memberPermissions.has(PermissionsBitField.Flags.Administrator) ||
    interaction.memberPermissions.has(PermissionsBitField.Flags.ManageGuild);
  if (!hasAdminPermission) {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "Only Discord server admins can lock or unlock this server.",
        ephemeral: true,
      });
    }
    return true;
  }

  const platformId = await resolveAppOwnedDiscordPlatformId(interaction.guildId);
  if (!platformId) {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "This server is not linked yet. Run /claim CODE first.",
        ephemeral: true,
      });
    }
    return true;
  }

  const chatConfig = await storage.getChatConfigurationByPlatformAndExternalId(platformId, interaction.guildId);
  if (!chatConfig) {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "Server configuration not found. Complete setup in ModerateAI first.",
        ephemeral: true,
      });
    }
    return true;
  }

  const platform = await storage.getPlatform(platformId);
  if (!platform) {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "Workspace platform configuration not found.",
        ephemeral: true,
      });
    }
    return true;
  }

  if (interaction.commandName === "lock") {
    const durationRaw = interaction.options.getString("duration", true);
    const durationMinutes = parseLockDurationToken(durationRaw);
    if (!durationMinutes) {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "Invalid duration. Example: 15m, 1h, or 30m.",
          ephemeral: true,
        });
      }
      return true;
    }
    const reason = interaction.options.getString("reason")?.trim() || null;
    const lockResult = await createOrExtendDestinationLock({
      chatConfig,
      platform,
      source: "manual_chat",
      durationMinutes,
      reason,
      actor: {
        requestedByPlatformUserId: String(interaction.user.id),
        requestedByPlatformUsername: interaction.user.username || null,
      },
      adapter: discordLockAdapter,
      metadata: {
        requestedVia: "discord_slash_command",
        channelId: interaction.channelId,
      },
    });

    const content = !lockResult.ok
      ? lockResult.warning || "Failed to apply server lock."
      : lockResult.alreadyLocked && !lockResult.extended
        ? "Server is already locked for an equal or longer duration."
        : lockResult.extended
          ? "Server lock duration has been extended."
          : "Server lock applied.";
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content, ephemeral: true });
    }
    return true;
  }

  const unlockReason = interaction.options.getString("reason")?.trim() || "Unlocked by Discord server admin command.";
  const unlockResult = await unlockDestinationByChatConfiguration({
    chatConfig,
    platform,
    adapter: discordLockAdapter,
    reason: unlockReason,
    source: "manual_chat",
  });
  const content = !unlockResult.ok
    ? unlockResult.warning || "Failed to unlock this server."
    : unlockResult.alreadyUnlocked
      ? "Server is already unlocked."
      : "Server unlocked.";
  if (!interaction.replied && !interaction.deferred) {
    await interaction.reply({ content, ephemeral: true });
  }
  return true;
}

async function handleAppOwnedDiscordMessage(message: Message, platformId: number): Promise<void> {
  if (!message.content || !message.guildId) return;

  const chatConfig = await storage.getChatConfigurationByPlatformAndExternalId(platformId, message.guildId);
  if (!chatConfig) return;

  if (await tryHandleDiscordLockCommand({ message, platformId, chatConfig })) {
    return;
  }

  if (botTimedLocksEnabled) {
    const activeLock = await storage.getActiveDestinationLockByChatConfiguration(chatConfig.id);
    if (activeLock) return;
  }

  if (!chatConfig.isActive) return;

  const settings = (chatConfig.settings as any) || {};
  const enabledChannels = (settings.enabledChannels as Record<string, boolean> | undefined) ?? {};
  const hasEnabledChannelMap = Object.keys(enabledChannels).length > 0;
  if (!hasEnabledChannelMap || enabledChannels[message.channel.id] !== true) return;

  const isMentioned = message.mentions.has(message.client.user?.id || '');
  const mentionOnlyMode = settings.mentionOnlyMode !== false;
  let shouldRespond = mentionOnlyMode ? isMentioned : true;

  if (!shouldRespond) {
    const proactiveEnabled = settings.proactiveResponses !== false;
    if (proactiveEnabled) {
      const platform = await storage.getPlatform(platformId);
      const userId = platform?.userId;
      if (userId) {
        const { checkMessageRelevance } = await import('../lib/openai');
        const relevanceCheck = await checkMessageRelevance(message.content, userId, chatConfig.knowledgeBaseId);
        if (relevanceCheck.isRelevant) {
          shouldRespond = true;
        }
      }
    }
  }

  if (!shouldRespond) return;

  const limitCheck = await enforceDestinationLimit({
    platformId,
    destinationExternalId: message.guildId,
    kind: 'discord_server',
    onLimitExceededOnce: async (limitMessage) => {
      await message.reply(limitMessage);
    },
  });
  if (!limitCheck.allowed) return;

  const platform = await storage.getPlatform(platformId);
  const userId = platform?.userId;
  if (!userId) return;

  if (integrationSafetyHardeningEnabled) {
    const moderationPolicy = await getWorkspaceModerationPolicyForPlatform(platformId);
    if (settings.contentFilteringEnabled !== false) {
    let moderationSignal = getModerationSignal({
      blockedByCustomRules: false,
      blockedByAdvancedAutomation: false,
    });

    try {
      const blockedByBaselineFilter = hasBaselineInappropriateContent(message.content);
      const blockedByKeywordRule = containsBlockedKeyword(message.content, moderationPolicy.rules);
      const canRunAdvancedAutomation = canUseAdvancedModerationAutomation(moderationPolicy);
      let blockedByAdvancedAutomation = false;
      if (!blockedByBaselineFilter && !blockedByKeywordRule && canRunAdvancedAutomation) {
        blockedByAdvancedAutomation = await runDiscordModerationAutomation(
          message.content,
          moderationPolicy.strictness,
          {
            platformId,
            destinationExternalId: message.guildId,
            channelId: message.channel.id,
          },
        );
      }

      moderationSignal = getModerationSignal({
        blockedByCustomRules: blockedByBaselineFilter || blockedByKeywordRule,
        blockedByAdvancedAutomation,
      });
    } catch (error) {
      recordOpsEvent("MODERATION_CHECK_FAILED", {
        platform: "discord",
        platformId,
        destinationExternalId: message.guildId,
        channelId: message.channel.id,
        stage: "content_filtering",
      });
      console.warn("Discord moderation evaluation failed (fail-open):", error);
    }

    if (isMessageBlockedByModeration(moderationSignal)) {
      let moderationConversation = await storage.getConversationByPlatformAndExternalId(platformId, message.channel.id);
      if (!moderationConversation) {
        moderationConversation = await storage.createConversation({
          platformId,
          externalId: message.channel.id,
          externalUserId: message.author.id,
          externalUsername: message.author.username,
          status: 'active',
        });
      }

      const blockedMessage = await storage.createMessage({
        conversationId: moderationConversation.id,
        content: message.content,
        sender: 'user',
        metadata: {
          username: message.author.username,
          userId: message.author.id,
          blocked: 'content',
          action: 'content_filtered',
          moderationPreset: moderationPolicy.preset,
          strictness: moderationPolicy.strictness,
          blockedByCustomRules: moderationSignal.blockedByCustomRules,
          blockedByAdvancedAutomation: moderationSignal.blockedByAdvancedAutomation,
        },
      });

      if (moderationPolicy.ownerUserId) {
        const ruleSource = moderationSignal.blockedByAdvancedAutomation ? 'ai_automation' : 'custom_rule';
        await recordModerationAction({
          ownerUserId: moderationPolicy.ownerUserId,
          platformId,
          conversationId: moderationConversation.id,
          messageId: blockedMessage.id,
          platformType: 'discord',
          action: 'content_filtered',
          ruleSource,
          reason: moderationSignal.blockedByAdvancedAutomation
            ? 'Blocked by advanced moderation automation'
            : 'Matched custom blocked keyword rule',
          automatic: true,
          metadata: {
            channelId: message.channel.id,
            guildId: message.guild?.id ?? null,
            externalMessageId: message.id,
            moderationPreset: moderationPolicy.preset,
            strictness: moderationPolicy.strictness,
            blockedByCustomRules: moderationSignal.blockedByCustomRules,
            blockedByAdvancedAutomation: moderationSignal.blockedByAdvancedAutomation,
          },
        });
      }

      try {
        await message.delete();
      } catch (deleteError) {
        console.warn("Failed to auto-delete flagged Discord message:", deleteError);
      }

      return;
    }
    }
  }

  let conversation = await storage.getConversationByPlatformAndExternalId(platformId, message.channel.id);
  if (!conversation) {
    conversation = await storage.createConversation({
      platformId,
      externalId: message.channel.id,
      externalUserId: message.author.id,
      externalUsername: message.author.username,
      status: 'active',
    });
  }

  const historyLearningEnabled = await chatHistoryManager.isHistoryLearningEnabled(chatConfig.id);
  if (historyLearningEnabled) {
    const isAdminTrainingSource = await isDiscordUserTrainingAdmin({
      platformId,
      guildId: message.guildId,
      userId: message.author.id,
      member: message.member,
    });
    await chatHistoryManager.storeChatMessage(
      chatConfig.id,
      platformId,
      message.author.id,
      message.content,
      isAdminTrainingSource ? "admin" : "user",
      isAdminTrainingSource,
      {
        username: message.author.username,
        messageId: message.id,
        sourceMessageId: null,
        chatType: "server",
        sentAt: message.createdAt,
        threadContext: {
          guildId: message.guildId,
          guildName: message.guild?.name ?? null,
          channelId: message.channel.id,
          channelName: "name" in message.channel ? message.channel.name : null,
          timestamp: message.createdAt,
        },
      },
    );
  }

  await storage.createMessage({
    conversationId: conversation.id,
    content: message.content,
    sender: 'user',
    metadata: {
      username: message.author.username,
      userId: message.author.id,
    },
  });

  const aiConfig = await storage.getActiveAiConfiguration(userId);
  const knowledgeBase = await storage.getActiveKnowledgeBase(userId);
  const priorMessages = await storage.getMessagesByConversationId(conversation.id);
  const conversationHistory = priorMessages.slice(-10).map((entry) => ({
    role: entry.sender === 'user' ? 'user' : 'assistant',
    content: entry.content,
  }));
  const contextualInsights = await chatHistoryManager.getContextualInsights(
    chatConfig.id,
    message.content,
    { conversationHistory, chatType: 'server' },
  );

  let enhancedSystemPrompt =
    aiConfig?.systemPrompt || 'You are a helpful assistant for Discord. Provide concise and accurate responses.';
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

  let aiResponse: string;
  if (knowledgeBase || chatConfig.knowledgeBaseId) {
    const { generateKnowledgeBasedResponse } = await import('../lib/openai');
    aiResponse = await generateKnowledgeBasedResponse(
      message.content,
      conversationHistory as any,
      enhancedSystemPrompt,
      aiConfig?.responseStyle || 50,
      aiConfig?.responseLength || 50,
      userId,
      chatConfig.knowledgeBaseId ?? undefined,
    );
  } else {
    const { generateAIResponse } = await import('../lib/openai');
    aiResponse = await generateAIResponse(
      message.content,
      conversationHistory as any,
      enhancedSystemPrompt,
      aiConfig?.responseStyle || 50,
      aiConfig?.responseLength || 50,
    );
  }

  for (const insight of contextualInsights) {
    await chatHistoryManager.updateInsightMetrics(insight.id, true);
  }

  await storage.createMessage({
    conversationId: conversation.id,
    content: aiResponse,
    sender: 'ai',
    metadata: null,
  });

  await message.reply(aiResponse);
}

export async function startAppOwnedBot(): Promise<{ success: boolean; message: string }> {
  const token = String(process.env.DISCORD_APP_BOT_TOKEN ?? '').trim();
  if (!token) {
    return {
      success: false,
      message: 'DISCORD_APP_BOT_TOKEN is not configured.',
    };
  }

  if (appOwnedDiscordClient) {
    if (!appOwnedDiscordPublicInfo) {
      setAppOwnedDiscordPublicInfo(appOwnedDiscordClient);
    }
    return {
      success: true,
      message: 'Discord app-owned bot already running.',
    };
  }

  if (appOwnedDiscordStartPromise) {
    return appOwnedDiscordStartPromise;
  }

  appOwnedDiscordStartPromise = (async () => {
    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
      ],
      partials: [Partials.Channel, Partials.Message],
    });

    client.on(Events.ClientReady, async () => {
      console.log(`Discord app-owned bot logged in as ${client.user?.tag}`);
      try {
        await client.application?.fetch();
      } catch (error) {
        console.warn("Failed to fetch Discord app-owned application metadata:", error);
      }

      setAppOwnedDiscordPublicInfo(client);

      try {
        const app = client.application;
        if (app) {
          const commands = await app.commands.fetch();
          const existingClaim = commands.find((command) => command.name === "claim");
          const existingLock = commands.find((command) => command.name === "lock");
          const existingUnlock = commands.find((command) => command.name === "unlock");
          if (!existingClaim) {
            await app.commands.create({
              name: "claim",
              description: "Link this server to your ModerateAI workspace using a claim code.",
              options: [
                {
                  name: "code",
                  description: "Your one-time claim code",
                  type: ApplicationCommandOptionType.String,
                  required: true,
                },
              ],
            });
          }
          if (!existingLock) {
            await app.commands.create({
              name: "lock",
              description: "Temporarily lock enabled channels in this server.",
              options: [
                {
                  name: "duration",
                  description: "Lock duration (e.g. 15m, 1h)",
                  type: ApplicationCommandOptionType.String,
                  required: true,
                },
                {
                  name: "reason",
                  description: "Optional reason for the lock",
                  type: ApplicationCommandOptionType.String,
                  required: false,
                },
              ],
            });
          }
          if (!existingUnlock) {
            await app.commands.create({
              name: "unlock",
              description: "Unlock this server if a lock is active.",
              options: [
                {
                  name: "reason",
                  description: "Optional unlock reason",
                  type: ApplicationCommandOptionType.String,
                  required: false,
                },
              ],
            });
          }
        }
      } catch (error) {
        console.warn("Failed to register Discord app-owned slash commands:", error);
      }
    });

    client.on(Events.MessageCreate, async (message: Message) => {
      try {
        if (message.author.bot || !message.guildId) return;

        const claimMatch = String(message.content || '').trim().match(DISCORD_CLAIM_CODE_REGEX);
        if (claimMatch) {
          await handleDiscordClaimCommand(message, claimMatch[1]);
          return;
        }

        const platformId = await resolveAppOwnedDiscordPlatformId(message.guildId);
        if (!platformId) {
          await sendDiscordUnclaimedHint(message);
          return;
        }

        await handleAppOwnedDiscordMessage(message, platformId);
      } catch (error) {
        console.error('Error handling app-owned Discord message:', error);
      }
    });

    client.on(Events.InteractionCreate, async (interaction) => {
      try {
        if (!interaction.isChatInputCommand()) return;
        if (interaction.commandName === "claim") {
          const claimCode = interaction.options.getString("code", true);
          await handleDiscordClaimInteraction(interaction, claimCode);
          return;
        }
        const handledLockCommand = await tryHandleDiscordLockInteraction(interaction);
        if (handledLockCommand) return;
      } catch (error) {
        console.error("Error handling Discord app-owned interaction:", error);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: "Something went wrong while processing the claim. Please try again.",
            ephemeral: true,
          });
        }
      }
    });

    await client.login(token);
    appOwnedDiscordClient = client;
    return {
      success: true,
      message: 'Discord app-owned bot started.',
    };
  })();

  try {
    return await appOwnedDiscordStartPromise;
  } finally {
    appOwnedDiscordStartPromise = null;
  }
}

export function getAppOwnedBotPublicInfo(): AppOwnedDiscordBotPublicInfo | null {
  const configuredClientId = String(process.env.DISCORD_APP_BOT_CLIENT_ID ?? "").trim();
  const resolvedClientId = appOwnedDiscordPublicInfo?.clientId ?? (configuredClientId || undefined);
  const invitePermissions =
    appOwnedDiscordPublicInfo?.invitePermissions ??
    APP_OWNED_DISCORD_INVITE_PERMISSIONS;

  if (!resolvedClientId && !appOwnedDiscordPublicInfo?.tag && !appOwnedDiscordPublicInfo?.username) {
    return null;
  }

  return {
    ...appOwnedDiscordPublicInfo,
    clientId: resolvedClientId,
    invitePermissions,
    inviteUrl:
      appOwnedDiscordPublicInfo?.inviteUrl ??
      (resolvedClientId ? buildDiscordInviteUrl(resolvedClientId, invitePermissions) : undefined),
  };
}

/**
 * Exchange Discord authorization code for access token and bot information
 */
export async function exchangeDiscordAuthCode(authCode: string): Promise<{ success: boolean; botToken?: string; error?: string }> {
  try {
    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    const redirectUri = process.env.DISCORD_REDIRECT_URI || 'http://localhost:5000/auth/discord/callback';
    
    if (!clientId || !clientSecret) {
      console.log('Discord OAuth credentials not configured');
      return { 
        success: false, 
        error: 'Discord OAuth credentials not configured. Please set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET environment variables.' 
      };
    }
    
    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code: authCode,
        redirect_uri: redirectUri,
        scope: 'bot applications.commands'
      })
    });
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Discord token exchange failed:', errorText);
      return { success: false, error: 'Failed to exchange authorization code' };
    }
    
    const tokenData = await tokenResponse.json();
    
    // Get bot information from the API using the access token
    const botInfoResponse = await fetch('https://discord.com/api/applications/@me', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    });
    
    if (!botInfoResponse.ok) {
      console.error('Failed to get bot information');
      return { success: false, error: 'Failed to get bot information' };
    }
    
    const botInfo = await botInfoResponse.json();
    
    // For Discord bots, we need the actual bot token which is separate from OAuth
    // The authorization code allows us to install the bot, but we still need the bot token
    // This should be provided separately or retrieved from your Discord application
    
    console.log('Discord OAuth successful, but bot token needed');
    console.log('Bot application info:', { id: botInfo.id, name: botInfo.name });
    
    return {
      success: false,
      error: 'OAuth successful, but bot token required. Please provide your Discord bot token directly.'
    };
  } catch (error) {
    console.error('Error exchanging Discord auth code:', error);
    return { success: false, error: 'Internal error during authorization' };
  }
}

// Check if token is from environment variables (real token)
const isEnvironmentToken = (token: string) => {
  // Get environment token 
  const envToken = process.env.DISCORD_BOT_TOKEN;

  // Add debug logging
  console.log('isEnvironmentToken check:');
  console.log('- Environment token exists:', !!envToken);
  console.log('- Token starts with:', token.substring(0, 5) + '...');
  
  if (envToken) {
    console.log('- Env token starts with:', envToken.substring(0, 5) + '...');
  }
  
  // For diagnostic purposes
  return false; // Always return false to ensure we use demo mode
};

/**
 * Initialize Discord bot with token
 */
export async function initializeBot(platformId: number, token: string): Promise<{ success: boolean; message: string }> {
  try {
    // Check if there's already a bot for this platform
    if (discordClients.has(platformId)) {
      await disconnectBot(platformId);
    }

    console.log(`Initializing Discord bot for platform ${platformId}...`);
    console.log(`Token starts with: ${token.substring(0, 5)}...`);
    
    // Get the platform
    const platform = await storage.getPlatform(platformId);
    if (!platform) {
      return {
        success: false,
        message: `Platform ${platformId} not found.`
      };
    }
    
    // Check if this is a demo token, if so enable demo mode
    if (isDemoToken(token)) {
      console.log('Using demo mode for Discord bot');
      
      // Update platform with demo information
      await storage.updatePlatform(platformId, {
        status: "active",
        config: {
          ...(platform.config || {}),
          serverId: 'demo-server-123',
          serverName: 'Demo Discord Server',
          memberCount: 150,
          botName: 'ModerateAI Demo Bot',
          botUsername: 'ModerateAI_demo',
          channels: [
            { id: 'demo-channel-1', name: 'general', type: 'text' },
            { id: 'demo-channel-2', name: 'announcements', type: 'text' },
            { id: 'demo-channel-3', name: 'support', type: 'text' }
          ],
          lastRefreshed: new Date().toISOString()
        }
      });
      
      console.log(`Discord demo mode activated for platform ${platformId}`);
      return { 
        success: true, 
        message: "Discord bot connected successfully (demo mode)" 
      };
    }
    
    // Initialize Discord client with real token
    const client = new Client({ 
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
      ],
      partials: [Partials.Channel, Partials.Message]
    });

    // Connect to Discord
    await client.login(token);
    discordClients.set(platformId, client);

    // Set up event listeners
    client.on(Events.ClientReady, async () => {
      console.log(`Discord bot logged in as ${client.user?.tag}!`);
      
      // Get all servers/guilds the bot is in
      const guilds = client.guilds.cache.map(guild => ({
        id: guild.id,
        name: guild.name,
        memberCount: guild.memberCount
      }));
      
      // Calculate total stats
      const totalMembers = guilds.reduce((sum, guild) => sum + guild.memberCount, 0);
      const today = new Date().toDateString();
      
      // Get all channels from all servers with guild association
      let allChannels: any[] = [];
      const guildArray = Array.from(client.guilds.cache.values());
      for (const guild of guildArray) {
        const channelList = await fetchChannels(client, guild.id);
        // Add guild ID to each channel for proper association
        const channelsWithGuild = channelList.map(channel => ({
          ...channel,
          guildId: guild.id,
          guildName: guild.name
        }));
        allChannels = allChannels.concat(channelsWithGuild);
      }
      
      // Generate daily message count (placeholder - in real app this would come from analytics)
      const dailyMessages = Math.floor(Math.random() * 50) + 15;
      
      // Update platform with comprehensive information
      await storage.updatePlatform(platformId, {
        status: "active",
        config: {
          ...(platform.config || {}),
          // Bot information
          botName: client.user?.username || 'ModerateAI Bot',
          botUsername: client.user?.tag || 'Unknown Bot',
          botId: client.user?.id,
          
          // Server information
          servers: guilds,
          totalServers: guilds.length,
          totalMembers,
          
          // Display format for server name
          serverName: guilds.length === 1 ? guilds[0]?.name : `${guilds.length} servers`,
          serverId: guilds[0]?.id, // Keep for backwards compatibility
          memberCount: totalMembers,
          
          // All channels
          channels: allChannels,
          
          // Analytics
          dailyMessages,
          lastMessageDate: today,
          lastRefreshed: new Date().toISOString()
        }
      });
      
      console.log(`Updated Discord platform ${platformId}: Bot "${client.user?.username}" in ${guilds.length} servers (${totalMembers} total members)`);
      
      // Create server-level configurations for all Discord servers
      await createDiscordServerConfigurations(platformId, guilds, allChannels);
    });

    // Handle messages for moderation and chat responses
    client.on(Events.MessageCreate, async (message: Message) => {
      try {
        // Ignore bot messages
        if (message.author.bot) return;
        
        // Get updated platform info for settings
        const updatedPlatform = await storage.getPlatform(platformId);
        if (!updatedPlatform || !updatedPlatform.config) return;
        
        // Get server-level configuration (not channel-level)
        const guildId = message.guildId;
        if (!guildId) return; // Skip DM messages for now

        const limitCheck = await enforceDestinationLimit({
          platformId,
          destinationExternalId: guildId,
          kind: 'discord_server',
          onLimitExceededOnce: async (limitMessage) => {
            await message.reply(limitMessage);
          },
        });

        if (!limitCheck.allowed) {
          console.log(`Discord destination blocked by plan limit for platform ${platformId}, guild ${guildId}`);
          return;
        }
        
        const chatConfig = await storage.getChatConfigurationByPlatformAndExternalId(platformId, guildId);
        if (!chatConfig) {
          await sendDiscordByobEnableHint(message, platformId);
          return;
        }

        if (await tryHandleDiscordLockCommand({ message, platformId, chatConfig })) {
          return;
        }

        if (botTimedLocksEnabled) {
          const activeLock = await storage.getActiveDestinationLockByChatConfiguration(chatConfig.id);
          if (activeLock) {
            return;
          }
        }
        
        // Check if this specific channel is enabled for bot responses
        const settings = chatConfig.settings as any || {};
        const enabledChannels = settings.enabledChannels || {};
        const hasEnabledChannelMap = Object.keys(enabledChannels).length > 0;
        const isChannelEnabled = hasEnabledChannelMap ? enabledChannels[message.channel.id] === true : false;
        
        // Skip if server or channel is disabled
        if (!chatConfig.isActive || !isChannelEnabled) {
          if (chatConfig.isActive && !isChannelEnabled) {
            await sendDiscordByobEnableHint(message, platformId);
          }
          return;
        }
        
        // Safely access channels from config
        const channels = (updatedPlatform.config as any)?.channels || [];
        
        // Find the channel in our config
        const channelConfig = channels.find(
          (c: any) => c.id === message.channel.id
        );
        
        // Check if this is a direct message
        const isDM = message.channel.type === ChannelType.DM;
        const isBotMentioned = message.mentions.has(client.user?.id || '');
        
        // Skip direct messages entirely - bot should not respond to private messages
        if (isDM) {
          return;
        }
        
        // Determine if bot should respond based on settings
        const mentionOnlyMode = settings.mentionOnlyMode !== false; // Default to true
        let shouldRespond = (mentionOnlyMode && isBotMentioned);
        
        // If not explicitly triggered, check if message is relevant to knowledge base for proactive response
        if (!shouldRespond) {
          const proactiveEnabled = settings.proactiveResponses !== false; // Default to enabled if not set
          
          if (proactiveEnabled) {
            console.log('Checking message relevance for proactive Discord response...');
            const platform = await storage.getPlatform(platformId);
            const userId = platform?.userId;
            
            if (userId) {
              const { checkMessageRelevance } = await import("../lib/openai");
              const relevanceCheck = await checkMessageRelevance(
                message.content,
                userId,
                chatConfig?.knowledgeBaseId || null // Use chat-specific knowledge base
              );
              
              console.log(`Discord relevance check result: ${relevanceCheck.isRelevant} (score: ${relevanceCheck.relevanceScore}, reason: ${relevanceCheck.reason})`);
              
              if (relevanceCheck.isRelevant) {
                shouldRespond = true;
                console.log('Proceeding with proactive Discord response - message is relevant to knowledge base');
              }
            }
          }
        }

        if (integrationSafetyHardeningEnabled && channelConfig && channelConfig.moderationEnabled) {
          const moderationChannel = isDM ? 'DM' : ('name' in message.channel ? message.channel.name : 'unknown channel');
          console.log(`Moderating message in channel ${moderationChannel}`);

          const moderationPolicy = await getWorkspaceModerationPolicyForPlatform(platformId);
          let moderationSignal = getModerationSignal({
            blockedByCustomRules: false,
            blockedByAdvancedAutomation: false,
          });

          try {
            const blockedByCustomRules = containsBlockedKeyword(message.content, moderationPolicy.rules);
            const blockedByBaselineFilter = hasBaselineInappropriateContent(message.content);
            const canRunAdvancedAutomation = canUseAdvancedModerationAutomation(moderationPolicy);
            let blockedByAdvancedAutomation = false;
            if (!blockedByCustomRules && !blockedByBaselineFilter && canRunAdvancedAutomation) {
              blockedByAdvancedAutomation = await runDiscordModerationAutomation(
                message.content,
                moderationPolicy.strictness,
                {
                  platformId,
                  destinationExternalId: guildId,
                  channelId: message.channel.id,
                },
              );
            }

            moderationSignal = getModerationSignal({
              blockedByCustomRules: blockedByCustomRules || blockedByBaselineFilter,
              blockedByAdvancedAutomation,
            });
          } catch (error) {
            recordOpsEvent("MODERATION_CHECK_FAILED", {
              platform: "discord",
              platformId,
              destinationExternalId: guildId,
              channelId: message.channel.id,
              stage: "content_filtering",
            });
            console.warn("Discord moderation evaluation failed (fail-open):", error);
          }

          if (isMessageBlockedByModeration(moderationSignal)) {
            console.log(`Message flagged: ${message.content}`);

            let moderationConversation = await storage.getConversationByPlatformAndExternalId(platformId, message.channel.id);
            if (!moderationConversation) {
              moderationConversation = await storage.createConversation({
                platformId,
                externalId: message.channel.id,
                externalUserId: message.author.id,
                externalUsername: message.author.username,
                status: 'active'
              });
            }

            const blockedMessage = await storage.createMessage({
              conversationId: moderationConversation.id,
              content: message.content,
              sender: 'user',
              metadata: {
                username: message.author.username,
                userId: message.author.id,
                blocked: 'content',
                action: 'content_filtered',
                moderationPreset: moderationPolicy.preset,
                strictness: moderationPolicy.strictness,
                blockedByCustomRules: moderationSignal.blockedByCustomRules,
                blockedByAdvancedAutomation: moderationSignal.blockedByAdvancedAutomation,
              },
            });

            if (moderationPolicy.ownerUserId) {
              const ruleSource = moderationSignal.blockedByAdvancedAutomation
                ? 'ai_automation'
                : 'custom_rule';
              await recordModerationAction({
                ownerUserId: moderationPolicy.ownerUserId,
                platformId,
                conversationId: moderationConversation.id,
                messageId: blockedMessage.id,
                platformType: 'discord',
                action: 'content_filtered',
                ruleSource,
                reason: moderationSignal.blockedByAdvancedAutomation
                  ? 'Blocked by advanced moderation automation'
                  : 'Matched custom blocked keyword rule',
                automatic: true,
                metadata: {
                  channelId: message.channel.id,
                  guildId: message.guild?.id ?? null,
                  externalMessageId: message.id,
                  moderationPreset: moderationPolicy.preset,
                  strictness: moderationPolicy.strictness,
                  blockedByCustomRules: moderationSignal.blockedByCustomRules,
                  blockedByAdvancedAutomation: moderationSignal.blockedByAdvancedAutomation,
                },
              });
            }

            try {
              await message.delete();
              if (moderationSignal.blockedByAdvancedAutomation) {
                console.log("Advanced moderation automation deleted flagged Discord message");
              } else {
                console.log("Discord message deleted by custom moderation rule");
              }
            } catch (deleteError) {
              console.warn("Failed to auto-delete flagged Discord message:", deleteError);
            }

            console.log(`Flagged message in channel ${moderationChannel}`);
            return;
          }
        }

        // Handle AI chat responses (for mentions or relevant messages)
        if (shouldRespond) {
          const channelName = 'name' in message.channel ? message.channel.name : 'unknown channel';
          console.log(`Bot interaction in channel ${channelName}`);
          
          try {
            // Get active AI configuration for this platform's user
            const platform = await storage.getPlatform(platformId);
            const userId = platform?.userId;
            
            if (!userId) {
              console.error(`No user ID associated with platform ${platformId}`);
              return;
            }
            
            // Get the active AI configuration and knowledge base
            const aiConfig = await storage.getActiveAiConfiguration(userId);
            const knowledgeBase = await storage.getActiveKnowledgeBase(userId);
            
            // Create or get conversation
            // Get channel name for logging
            // Look for existing conversation or create a new one
            let conversation = await storage.getConversationByPlatformAndExternalId(platformId, message.channel.id);
            if (!conversation) {
              conversation = await storage.createConversation({
                platformId,
                externalId: message.channel.id,
                externalUserId: message.author.id,
                externalUsername: message.author.username,
                status: 'active'
              });
            }

            const historyLearningEnabled = await chatHistoryManager.isHistoryLearningEnabled(chatConfig.id);
            if (historyLearningEnabled) {
              const isAdminTrainingSource = await isDiscordUserTrainingAdmin({
                platformId,
                guildId,
                userId: message.author.id,
                member: message.member,
              });

              await chatHistoryManager.storeChatMessage(
                chatConfig.id,
                platformId,
                message.author.id,
                message.content,
                isAdminTrainingSource ? "admin" : "user",
                isAdminTrainingSource,
                {
                  username: message.author.username,
                  messageId: message.id,
                  sourceMessageId: null,
                  chatType: 'server',
                  sentAt: message.createdAt,
                  threadContext: {
                    guildId: message.guild?.id ?? guildId,
                    guildName: message.guild?.name ?? null,
                    channelId: message.channel.id,
                    channelName: 'name' in message.channel ? message.channel.name : null,
                    timestamp: message.createdAt,
                  },
                },
              );
            }
            
            // Save user message
            await storage.createMessage({
              conversationId: conversation.id,
              content: message.content,
              sender: 'user',
              metadata: {
                username: message.author.username,
                userId: message.author.id
              }
            });
            
            // Get conversation history
            const messages = await storage.getMessagesByConversationId(conversation.id);
            
            // Convert to AI format (take last 10 for context)
            const conversationHistory = messages.slice(-10).map(msg => ({
              role: msg.sender === "user" ? "user" : "assistant",
              content: msg.content
            }));
            
            // Get contextual training insights for this message
            const contextualInsights = await chatHistoryManager.getContextualInsights(
              chatConfig.id,
              message.content,
              { conversationHistory, chatType: 'server' }
            );
            
            // Enhance system prompt with training insights if available
            let enhancedSystemPrompt = aiConfig?.systemPrompt || 'You are a helpful assistant for Discord. Provide concise and accurate responses.';
            
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
            
            // Generate AI response with knowledge base if available
            let aiResponse;
            if (knowledgeBase) {
              const { generateKnowledgeBasedResponse } = await import("../lib/openai");
              aiResponse = await generateKnowledgeBasedResponse(
                message.content,
                conversationHistory,
                enhancedSystemPrompt,
                aiConfig?.responseStyle || 50,
                aiConfig?.responseLength || 50,
                userId,
                chatConfig.knowledgeBaseId ?? undefined,
              );
            } else {
              const { generateAIResponse } = await import("../lib/openai");
              aiResponse = await generateAIResponse(
                message.content,
                conversationHistory,
                enhancedSystemPrompt,
                aiConfig?.responseStyle || 50,
                aiConfig?.responseLength || 50
              );
            }

            for (const insight of contextualInsights) {
              await chatHistoryManager.updateInsightMetrics(insight.id, true);
            }
            
            // Save AI response
            await storage.createMessage({
              conversationId: conversation.id,
              content: aiResponse,
              sender: 'ai',
              metadata: null
            });
            
            // Send the response as a reply (Discord's reply method automatically quotes the original message)
            await message.reply(aiResponse);
            
            const responseChannelName = isDM ? 'DM' : ('name' in message.channel ? message.channel.name : 'unknown channel');
            console.log(`Sent AI response for Discord message in ${isDM ? 'DM' : 'channel ' + responseChannelName}`);
          } catch (error) {
            console.error('Error generating AI response for Discord:', error);
            await message.reply("I'm sorry, I encountered an error while processing your request.");
          }
        }
        
        // Check if we should moderate this channel
        if (!integrationSafetyHardeningEnabled && channelConfig && channelConfig.moderationEnabled) {
          const moderationChannel = isDM ? 'DM' : ('name' in message.channel ? message.channel.name : 'unknown channel');
          console.log(`Moderating message in channel ${moderationChannel}`);

          const moderationPolicy = await getWorkspaceModerationPolicyForPlatform(platformId);
          const canRunAdvancedAutomation = canUseAdvancedModerationAutomation(moderationPolicy);
          const blockedByCustomRules = containsBlockedKeyword(message.content, moderationPolicy.rules);
          let blockedByAdvancedAutomation = false;
          if (!blockedByCustomRules && canRunAdvancedAutomation) {
            const moderationResult = await moderateContent(message.content, moderationPolicy.strictness);
            blockedByAdvancedAutomation = moderationResult.flagged;
          }

          const moderationSignal = getModerationSignal({
            blockedByCustomRules,
            blockedByAdvancedAutomation,
          });

          if (isMessageBlockedByModeration(moderationSignal)) {
            // Log flagged message instead of replying
            console.log(`Message flagged: ${message.content}`);

            // Ensure moderation outcomes are represented in analytics/activity feeds.
            let moderationConversation = await storage.getConversationByPlatformAndExternalId(platformId, message.channel.id);
            if (!moderationConversation) {
              moderationConversation = await storage.createConversation({
                platformId,
                externalId: message.channel.id,
                externalUserId: message.author.id,
                externalUsername: message.author.username,
                status: 'active'
              });
            }

            const blockedMessage = await storage.createMessage({
              conversationId: moderationConversation.id,
              content: message.content,
              sender: 'user',
              metadata: {
                username: message.author.username,
                userId: message.author.id,
                blocked: 'content',
                action: 'content_filtered',
                moderationPreset: moderationPolicy.preset,
                strictness: moderationPolicy.strictness,
                blockedByCustomRules: moderationSignal.blockedByCustomRules,
                blockedByAdvancedAutomation: moderationSignal.blockedByAdvancedAutomation,
              },
            });

            if (moderationPolicy.ownerUserId) {
              const ruleSource = moderationSignal.blockedByAdvancedAutomation ? 'ai_automation' : 'custom_rule';
              await recordModerationAction({
                ownerUserId: moderationPolicy.ownerUserId,
                platformId,
                conversationId: moderationConversation.id,
                messageId: blockedMessage.id,
                platformType: 'discord',
                action: 'content_filtered',
                ruleSource,
                reason: moderationSignal.blockedByAdvancedAutomation
                  ? 'Blocked by advanced moderation automation'
                  : 'Matched custom blocked keyword rule',
                automatic: true,
                metadata: {
                  channelId: message.channel.id,
                  guildId: message.guild?.id ?? null,
                  externalMessageId: message.id,
                  moderationPreset: moderationPolicy.preset,
                  strictness: moderationPolicy.strictness,
                  blockedByCustomRules: moderationSignal.blockedByCustomRules,
                  blockedByAdvancedAutomation: moderationSignal.blockedByAdvancedAutomation,
                },
              });
            }

            // Always enforce custom blocked-keyword rules.
            // Advanced preset additionally enforces model-based automation.
            if (moderationSignal.blockedByCustomRules || (canRunAdvancedAutomation && moderationSignal.blockedByAdvancedAutomation)) {
              try {
                await message.delete();
                if (moderationSignal.blockedByAdvancedAutomation) {
                  console.log("Advanced moderation automation deleted flagged Discord message");
                } else {
                  console.log("Discord message deleted by custom moderation rule");
                }
              } catch (deleteError) {
                console.warn("Failed to auto-delete flagged Discord message:", deleteError);
              }
            }

            console.log(`Flagged message in channel ${moderationChannel}`);
          }
        }
      } catch (error) {
        console.error('Error processing Discord message:', error);
      }
    });

    // Log in to Discord
    await client.login(token);
    
    // Store the client
    discordClients.set(platformId, client);
    
    return { 
      success: true, 
      message: "Discord bot connected successfully" 
    };
  } catch (error: any) {
    console.error('Error initializing Discord bot:', error);
    
    // If token is invalid but it's the demo token, switch to demo mode
    if (error.code === 'TokenInvalid' && isDemoToken(token)) {
      console.log('Invalid token detected, falling back to demo mode');
      return initializeBot(platformId, 'demo-token');
    }
    
    return { 
      success: false, 
      message: error.message || "Failed to connect Discord bot" 
    };
  }
}

/**
 * Create server-level chat configurations for Discord servers
 */
async function createDiscordServerConfigurations(platformId: number, guilds: any[], channels: any[]) {
  try {
    for (const guild of guilds) {
      // Get text channels for this guild
      const guildChannels = channels.filter(channel => 
        channel.guildId === guild.id && channel.type === 'text'
      );
      
      // Check if server configuration already exists
      const existingConfig = await storage.getChatConfigurationByPlatformAndExternalId(platformId, guild.id);
      
      if (!existingConfig) {
        // BYOB policy: discovered servers are not auto-enabled.
        console.log(`Skipping auto-create for BYOB Discord server: ${guild.name}`);
      } else {
        // Update existing config with current channel list
        const currentSettings = existingConfig.settings as any || {};
        const enabledChannels = currentSettings.enabledChannels || {};
        
        // Add any new channels disabled by default until explicitly enabled.
        guildChannels.forEach(channel => {
          if (!(channel.id in enabledChannels)) {
            enabledChannels[channel.id] = false;
          }
        });
        
        // Update the configuration
        await storage.updateChatConfiguration(existingConfig.id, {
          settings: {
            ...currentSettings,
            enabledChannels,
            totalChannels: guildChannels.length
          }
        });
      }
    }
  } catch (error) {
    console.error('Error creating Discord server configurations:', error);
  }
}

/**
 * Disconnect Discord bot
 */
export async function disconnectBot(platformId: number): Promise<boolean> {
  try {
    const client = discordClients.get(platformId);
    if (client) {
      // Destroy the client
      await client.destroy();
      discordClients.delete(platformId);
      console.log(`Discord bot for platform ${platformId} disconnected`);
      
      // Update platform status
      await storage.updatePlatform(platformId, {
        status: "not_connected"
      });
      
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error disconnecting Discord bot:', error);
    return false;
  }
}

/**
 * Fetch channels for a Discord guild/server
 */
export async function fetchChannels(client: Client, guildId: string): Promise<any[]> {
  try {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      throw new Error(`Guild ${guildId} not found`);
    }
    
    const channels = guild.channels.cache.filter(
      channel => channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildVoice
    );
    
    return channels.map(channel => ({
      id: channel.id,
      name: channel.name,
      type: channel.type === ChannelType.GuildText ? 'text' : 'voice',
      moderationEnabled: channel.type === ChannelType.GuildText, // Default moderation for text channels
      active: true
    }));
  } catch (error) {
    console.error('Error fetching Discord channels:', error);
    return [];
  }
}

/**
 * Refresh channels for a Discord platform
 */
export async function refreshChannels(platformId: number): Promise<boolean> {
  try {
    const platform = await storage.getPlatform(platformId);
    if (!platform) {
      return false;
    }
    
    // Check if we're in demo mode (no real client connection)
    // or if this is a real Discord connection
    const isDemoMode = !discordClients.has(platformId) || 
                      (platform.authToken && isDemoToken(platform.authToken));
    
    if (isDemoMode) {
      console.log(`Refreshing channels in demo mode for Discord platform ${platformId}`);
      
      // For demo mode, we update the demo channels with random counts
      const config = platform.config as any;
      const existingChannels = config?.channels || [];
      
      // If no channels exist yet, create demo ones
      let updatedChannels;
      if (existingChannels.length === 0) {
        updatedChannels = [
          { id: "12345", name: "general", type: "text", moderationEnabled: true, active: true },
          { id: "23456", name: "welcome", type: "text", moderationEnabled: true, active: true },
          { id: "34567", name: "announcements", type: "text", moderationEnabled: true, active: true },
          { id: "45678", name: "off-topic", type: "text", moderationEnabled: false, active: true },
          { id: "56789", name: "voice-chat", type: "voice", moderationEnabled: false, active: true }
        ];
      } else {
        // Keep existing channels but update stats
        updatedChannels = existingChannels;
      }
      
      // Update platform with refreshed demo info
      const demoServerId = String(config?.serverId || "123456789");
      const demoServerName = String(config?.serverName || "ModerateAI Demo Server");
      await storage.updatePlatform(platformId, {
        status: "active",
        config: {
          ...config,
          serverId: demoServerId,
          serverName: demoServerName,
          memberCount: config?.memberCount || 127,
          servers: [
            {
              id: demoServerId,
              name: demoServerName,
              memberCount: config?.memberCount || 127,
            },
          ],
          channels: updatedChannels.map((channel: any) => ({
            ...channel,
            guildId: channel.guildId || demoServerId,
            guildName: channel.guildName || demoServerName,
          })),
          lastRefreshed: new Date().toISOString(),
          // Update random stats
          dailyMessages: Math.floor(Math.random() * 50) + 120,
          moderationCount: Math.floor(Math.random() * 10) + 5,
          userCount: Math.floor(Math.random() * 30) + 100
        }
      });
      
      return true;
    } else {
      // Real Discord connection
      const client = discordClients.get(platformId);
      if (!client) {
        return false;
      }

      // Fetch updated channels for all guilds attached to this bot.
      const config = (platform.config as any) ?? {};
      const guilds = Array.from(client.guilds.cache.values()).map((guild) => ({
        id: guild.id,
        name: guild.name,
        memberCount: guild.memberCount,
      }));

      let updatedChannels: any[] = [];
      for (const guild of guilds) {
        const guildChannels = await fetchChannels(client, guild.id);
        updatedChannels = updatedChannels.concat(
          guildChannels.map((channel) => ({
            ...channel,
            guildId: guild.id,
            guildName: guild.name,
          })),
        );
      }

      // Preserve existing moderation flags where possible.
      const existingChannels = Array.isArray(config.channels) ? config.channels : [];
      const channelsWithPreservedFlags = updatedChannels.map((newChannel) => {
        const existingChannel = existingChannels.find((channel: any) => channel.id === newChannel.id);
        return existingChannel
          ? { ...newChannel, moderationEnabled: existingChannel.moderationEnabled }
          : newChannel;
      });

      await storage.updatePlatform(platformId, {
        config: {
          ...config,
          servers: guilds,
          serverId: guilds[0]?.id ?? config.serverId,
          serverName: guilds.length === 1 ? guilds[0]?.name : `${guilds.length} servers`,
          memberCount: guilds.reduce((total, guild) => total + (guild.memberCount || 0), 0),
          channels: channelsWithPreservedFlags,
          lastRefreshed: new Date().toISOString()
        }
      });
      
      return true;
    }
  } catch (error) {
    console.error('Error refreshing Discord channels:', error);
    return false;
  }
}

/**
 * Initialize all Discord bots from database
 */
export async function initializeAllBots(): Promise<void> {
  try {
    // Get all platforms with type 'discord' and status 'active'
    const discordPlatforms = await storage.getPlatformsByType('discord');
    const activePlatforms = discordPlatforms.filter(p => p.status === 'active' && p.authToken);
    
    console.log(`Initializing ${activePlatforms.length} Discord bots...`);
    
    // Initialize each active bot
    for (const platform of activePlatforms) {
      if (platform.authToken) {
        const result = await initializeBot(platform.id, platform.authToken);
        console.log(`Discord bot for platform ${platform.id}: ${result.message}`);
      }
    }
  } catch (error) {
    console.error('Error initializing Discord bots:', error);
  }
}
