import { storage } from "../storage";
import { getEntitlementsForUser, normalizePlan, type Entitlements, type Plan } from "./entitlements";
import type { ChatConfiguration, Platform } from "@shared/schema";

export type DestinationKind = "telegram_group" | "discord_server" | "website_domain";

type EnforceDestinationLimitParams = {
  platformId: number;
  destinationExternalId: string;
  kind: DestinationKind;
  onLimitExceededOnce?: (message: string) => Promise<void>;
};

type EnforceDestinationLimitResult = {
  allowed: boolean;
  plan: Plan;
  limit: number | null;
};

const DESTINATION_NOTICE_CONFIG_KEY = "destinationLimitNotices";

type PlatformConfigWithNotices = Record<string, unknown> & {
  destinationLimitNotices?: Record<string, string>;
};

function toObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toPlatformConfig(platform: Platform): PlatformConfigWithNotices {
  const parsed = toObject(platform.config);
  if (!parsed) return {};
  return parsed as PlatformConfigWithNotices;
}

function getDestinationLimit(entitlements: Entitlements, kind: DestinationKind): number | null {
  if (kind === "telegram_group") return entitlements.telegramGroupLimit;
  if (kind === "discord_server") return entitlements.discordServerLimit;
  return entitlements.websiteDomainLimit;
}

function chatConfigMatchesKind(config: ChatConfiguration, kind: DestinationKind): boolean {
  if (kind === "telegram_group") {
    return config.chatType === "group" || config.chatType === "supergroup";
  }
  if (kind === "discord_server") {
    return config.chatType === "server";
  }
  return config.chatType === "website_domain";
}

function buildDestinationLimitUpgradeMessage(kind: DestinationKind, limit: number): string {
  const label = kind === "telegram_group" ? "Telegram group" : kind === "discord_server" ? "Discord server" : "website";
  const plural = limit === 1 ? "" : "s";
  const supportUrl = String(process.env.VITE_SUPPORT_TELEGRAM_URL ?? "").trim();
  const supportLine = supportUrl ? ` Contact support: ${supportUrl}` : "";
  return `This workspace has reached its ${label} limit (${limit} allowed destination${plural}) on the current plan. Ask your workspace admin to upgrade for additional access.${supportLine}`;
}

async function notifyLimitExceededOnce(
  platform: Platform,
  destinationKey: string,
  message: string,
  notify: (message: string) => Promise<void>,
): Promise<void> {
  const currentConfig = toPlatformConfig(platform);
  const existingNoticesRaw = toObject(currentConfig[DESTINATION_NOTICE_CONFIG_KEY]);
  const existingNotices: Record<string, string> = existingNoticesRaw
    ? Object.fromEntries(
        Object.entries(existingNoticesRaw)
          .filter(([, value]) => typeof value === "string")
          .map(([key, value]) => [key, value as string]),
      )
    : {};

  if (existingNotices[destinationKey]) return;

  await notify(message);

  const updatedNotices = {
    ...existingNotices,
    [destinationKey]: new Date().toISOString(),
  };

  await storage.updatePlatform(platform.id, {
    config: {
      ...currentConfig,
      [DESTINATION_NOTICE_CONFIG_KEY]: updatedNotices,
    },
  } as any);
}

export async function enforceDestinationLimit({
  platformId,
  destinationExternalId,
  kind,
  onLimitExceededOnce,
}: EnforceDestinationLimitParams): Promise<EnforceDestinationLimitResult> {
  const platform = await storage.getPlatform(platformId);
  if (!platform) {
    return { allowed: true, plan: "free", limit: null };
  }

  const ownerUser = await storage.getUser(platform.userId);
  if (!ownerUser) {
    return { allowed: true, plan: "free", limit: null };
  }

  const plan = normalizePlan((ownerUser as any).plan);
  const entitlements = getEntitlementsForUser(ownerUser as any);
  const limit = getDestinationLimit(entitlements, kind);
  if (limit === null) {
    return { allowed: true, plan, limit };
  }

  const allConfigs = await storage.getChatConfigurationsByPlatformId(platformId);
  const relevantConfigs = allConfigs
    .filter((config) => config.isActive && chatConfigMatchesKind(config as ChatConfiguration, kind))
    .sort((a, b) => {
      const byCreatedAt = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (byCreatedAt !== 0) return byCreatedAt;
      return a.id - b.id;
    });

  const normalizedDestinationId = String(destinationExternalId);
  const existingIndex = relevantConfigs.findIndex((config) => String(config.externalId) === normalizedDestinationId);
  const allowed = existingIndex >= 0 ? existingIndex < limit : relevantConfigs.length < limit;

  if (!allowed && onLimitExceededOnce) {
    const destinationKey = `${kind}:${normalizedDestinationId}`;
    const message = buildDestinationLimitUpgradeMessage(kind, limit);
    await notifyLimitExceededOnce(platform, destinationKey, message, onLimitExceededOnce);
  }

  return { allowed, plan, limit };
}

