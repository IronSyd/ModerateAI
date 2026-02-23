import type { Express, Request, Response, NextFunction } from "express";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { and, count, desc, eq, gte, ilike, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

import { db } from "../db";
import { storage } from "../storage";
import {
  evaluateLeadPromptEligibility,
  generateKnowledgeBasedResponse,
  type EvaluateLeadPromptEligibilityResult,
  type LeadIntentScope,
} from "../lib/openai";
import { sendEmail } from "../emailService";
import { chatHistoryManager } from "../lib/chatHistoryManager";
import { recordOpsEvent } from "../lib/ops-monitor";
import { getWorkspaceOwnerId, hasWorkspaceRole, type WorkspaceRole } from "../workspace";
import { getEntitlementsForUser, isInternalAccountRole } from "../billing/entitlements";
import { chatConfigurations, conversations, messages, platforms, websiteLeads, widgetRateLimits } from "@shared/schema";

type LeadStatus = "new" | "contacted" | "qualified" | "converted" | "disqualified" | "spam";
type LeadIntentPreset = "conservative" | "balanced" | "aggressive";
type LeadPromptMode = "none" | "cta" | "form";

type WidgetConfig = {
  widgetTitle: string;
  welcomeMessage: string;
  primaryColor: string;
  position: "bottom-right" | "bottom-left";
  collectVisitorInfo: boolean;
  leadCaptureEnabled: boolean;
  leadPromptAfterMessages: number;
  leadPromptMessage: string;
  requireLeadEmail: boolean;
  leadIntentPreset: LeadIntentPreset;
  leadIntentScope: LeadIntentScope;
  allowedDomains: string[];
};

type WidgetLeadPromptPayload = {
  mode: LeadPromptMode;
  show: boolean;
  message: string;
  requireEmail: boolean;
  ctaLabel?: string;
  dismissLabel?: string;
  reason?: string;
};

type WidgetUsageSummary = {
  telegramGroupsUsed: number;
  telegramGroupLimit: number | null;
  discordServersUsed: number;
  discordServerLimit: number | null;
  websiteDomainsUsed: number;
  websiteDomainLimit: number | null;
  aiResponsesUsedToday: number;
  aiResponsesPerDay: number | null;
  aiResponsesResetAt: string;
};

type WidgetSessionTokenPayload = {
  token: string;
  platformId: number;
  ownerId: number;
  resolvedHost: string | null;
  sessionId: string;
  iat: number;
  exp: number;
};

const DEFAULT_WIDGET_CONFIG: WidgetConfig = {
  widgetTitle: "Chat with ModerateAI",
  welcomeMessage: "Hi there. How can we help?",
  primaryColor: "#3B82F6",
  position: "bottom-right",
  collectVisitorInfo: true,
  leadCaptureEnabled: true,
  leadPromptAfterMessages: 2,
  leadPromptMessage: "Want a follow-up from our team? Share your name and email.",
  requireLeadEmail: true,
  leadIntentPreset: "balanced",
  leadIntentScope: "commercial_and_escalation",
  allowedDomains: [],
};

const LEAD_STATUS_VALUES: LeadStatus[] = ["new", "contacted", "qualified", "converted", "disqualified", "spam"];
const RATE_LIMIT_DB_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastRateLimitDbCleanupAt = 0;
let widgetRateLimitTableReady = false;
let widgetRateLimitTableInitInFlight: Promise<void> | null = null;

const WIDGET_BOOTSTRAP_RATE_LIMIT = Number.parseInt(process.env.WIDGET_BOOTSTRAP_RATE_LIMIT ?? "60", 10) || 60;
const WIDGET_CHAT_RATE_LIMIT = Number.parseInt(process.env.WIDGET_CHAT_RATE_LIMIT ?? "40", 10) || 40;
const WIDGET_LEAD_RATE_LIMIT = Number.parseInt(process.env.WIDGET_LEAD_RATE_LIMIT ?? "12", 10) || 12;
const WIDGET_RATE_LIMIT_WINDOW_MS =
  Number.parseInt(process.env.WIDGET_RATE_LIMIT_WINDOW_MS ?? "60000", 10) || 60_000;
const WIDGET_STRICT_SESSION_BINDING_ENABLED = parseBooleanEnv(
  process.env.WIDGET_STRICT_SESSION_BINDING_ENABLED,
  false,
);
const WIDGET_REQUIRE_SESSION_ID_FOR_LEAD = parseBooleanEnv(process.env.WIDGET_REQUIRE_SESSION_ID_FOR_LEAD, false);
const WIDGET_RATE_LIMIT_USE_SESSION_KEY = parseBooleanEnv(process.env.WIDGET_RATE_LIMIT_USE_SESSION_KEY, true);
const WIDGET_LEAD_DEDUP_WINDOW_HOURS = parsePositiveInt(process.env.WIDGET_LEAD_DEDUP_WINDOW_HOURS, 24);
const WIDGET_SESSION_TOKEN_TTL_SECONDS = parsePositiveInt(process.env.WIDGET_SESSION_TOKEN_TTL_SECONDS, 60 * 60);
const WIDGET_SESSION_TOKEN_SECRET = String(
  process.env.WIDGET_SESSION_TOKEN_SECRET ?? process.env.SESSION_SECRET ?? "widget-development-secret",
).trim();

const DEFAULT_RATE_LIMIT_MESSAGE = "Too many requests. Please slow down and try again shortly.";
const WIDGET_KB_SETUP_MESSAGE =
  "This chat is not configured for this website yet. Please contact the site administrator.";

function generateWidgetToken(): string {
  return `wgt_${randomBytes(24).toString("hex")}`;
}

function generateSessionId(): string {
  return `w_${randomBytes(12).toString("hex")}`;
}

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function base64UrlEncode(value: Buffer | string): string {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

function getEpochSecondsNow(): number {
  return Math.floor(Date.now() / 1000);
}

function sanitizeSessionId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (normalized.length < 2 || normalized.length > 120) return null;
  return normalized;
}

function signWidgetSessionToken(payload: WidgetSessionTokenPayload): string {
  const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
  const signature = createHmac("sha256", WIDGET_SESSION_TOKEN_SECRET).update(payloadEncoded).digest();
  return `${payloadEncoded}.${base64UrlEncode(signature)}`;
}

function verifyWidgetSessionToken(token: string): { ok: true; payload: WidgetSessionTokenPayload } | { ok: false; reason: string } {
  const normalized = String(token ?? "").trim();
  if (!normalized) return { ok: false, reason: "missing" };
  const segments = normalized.split(".");
  if (segments.length !== 2) return { ok: false, reason: "malformed" };

  const [payloadSegment, signatureSegment] = segments;
  if (!payloadSegment || !signatureSegment) {
    return { ok: false, reason: "malformed" };
  }

  const expectedSignature = createHmac("sha256", WIDGET_SESSION_TOKEN_SECRET).update(payloadSegment).digest();
  let providedSignature: Buffer;
  try {
    providedSignature = base64UrlDecode(signatureSegment);
  } catch {
    return { ok: false, reason: "invalid_signature_encoding" };
  }

  if (providedSignature.length !== expectedSignature.length) {
    return { ok: false, reason: "signature_length_mismatch" };
  }
  if (!timingSafeEqual(providedSignature, expectedSignature)) {
    return { ok: false, reason: "signature_mismatch" };
  }

  let parsedPayload: unknown;
  try {
    parsedPayload = JSON.parse(base64UrlDecode(payloadSegment).toString("utf8"));
  } catch {
    return { ok: false, reason: "invalid_payload_encoding" };
  }

  const candidate = parsedPayload as Partial<WidgetSessionTokenPayload> | null;
  if (!candidate || typeof candidate !== "object") {
    return { ok: false, reason: "invalid_payload_type" };
  }

  const tokenValue = typeof candidate.token === "string" ? candidate.token.trim() : "";
  const platformId = Number(candidate.platformId ?? 0);
  const ownerId = Number(candidate.ownerId ?? 0);
  const sessionId = sanitizeSessionId(candidate.sessionId);
  const iat = Number(candidate.iat ?? 0);
  const exp = Number(candidate.exp ?? 0);
  const resolvedHost =
    candidate.resolvedHost === null || candidate.resolvedHost === undefined
      ? null
      : normalizeDomainValue(String(candidate.resolvedHost ?? ""));

  if (!tokenValue || !Number.isFinite(platformId) || platformId <= 0 || !Number.isFinite(ownerId) || ownerId <= 0 || !sessionId) {
    return { ok: false, reason: "invalid_payload_fields" };
  }
  if (!Number.isFinite(iat) || !Number.isFinite(exp) || exp <= iat) {
    return { ok: false, reason: "invalid_payload_timestamps" };
  }
  if (exp < getEpochSecondsNow()) {
    return { ok: false, reason: "expired" };
  }

  return {
    ok: true,
    payload: {
      token: tokenValue,
      platformId: Math.round(platformId),
      ownerId: Math.round(ownerId),
      resolvedHost,
      sessionId,
      iat: Math.round(iat),
      exp: Math.round(exp),
    },
  };
}

function issueWidgetSessionToken(input: {
  token: string;
  platformId: number;
  ownerId: number;
  resolvedHost: string | null;
  sessionId: string;
}): { sessionToken: string; sessionTokenExpiresAt: string } {
  const now = getEpochSecondsNow();
  const payload: WidgetSessionTokenPayload = {
    token: input.token,
    platformId: input.platformId,
    ownerId: input.ownerId,
    resolvedHost: input.resolvedHost,
    sessionId: input.sessionId,
    iat: now,
    exp: now + WIDGET_SESSION_TOKEN_TTL_SECONDS,
  };
  return {
    sessionToken: signWidgetSessionToken(payload),
    sessionTokenExpiresAt: new Date(payload.exp * 1000).toISOString(),
  };
}

function validateWidgetSessionTokenForRequest(input: {
  providedToken: unknown;
  expectedToken: string;
  expectedPlatformId: number;
  expectedOwnerId: number;
  requestHost: string | null;
}): { ok: true; payload: WidgetSessionTokenPayload } | { ok: false; reason: string } {
  if (typeof input.providedToken !== "string") {
    return { ok: false, reason: "missing" };
  }

  const verified = verifyWidgetSessionToken(input.providedToken);
  if (!verified.ok) return verified;

  const payload = verified.payload;
  if (payload.token !== input.expectedToken) {
    return { ok: false, reason: "token_mismatch" };
  }
  if (payload.platformId !== input.expectedPlatformId) {
    return { ok: false, reason: "platform_mismatch" };
  }
  if (payload.ownerId !== input.expectedOwnerId) {
    return { ok: false, reason: "owner_mismatch" };
  }
  if (payload.resolvedHost && payload.resolvedHost !== input.requestHost) {
    return { ok: false, reason: "host_mismatch" };
  }
  if (!payload.resolvedHost && input.requestHost && WIDGET_STRICT_SESSION_BINDING_ENABLED) {
    return { ok: false, reason: "host_missing_in_token" };
  }
  return { ok: true, payload };
}

function getSupportUrl(): string | null {
  const url = String(process.env.VITE_SUPPORT_TELEGRAM_URL ?? "").trim();
  return url || null;
}

function buildWebsiteDomainLimitMessage(limit: number): string {
  const plural = limit === 1 ? "" : "s";
  const supportUrl = getSupportUrl();
  const supportLine = supportUrl ? ` Contact support: ${supportUrl}` : "";
  return `This workspace can only use ${limit} website destination${plural} on the current plan.${supportLine}`;
}

function buildDailyAiLimitMessage(limit: number): string {
  const supportUrl = getSupportUrl();
  if (supportUrl) {
    return `This workspace has reached its daily AI response limit (${limit}/day). Contact support to continue: ${supportUrl}`;
  }
  return `This workspace has reached its daily AI response limit (${limit}/day). Please contact support to continue.`;
}

function normalizeText(value: unknown, fallback: string, maxLength = 300): string {
  const v = typeof value === "string" ? value.trim() : "";
  if (!v) return fallback;
  return v.slice(0, maxLength);
}

function normalizeBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function normalizeLeadIntentPreset(value: unknown, fallback: LeadIntentPreset): LeadIntentPreset {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "conservative" || normalized === "balanced" || normalized === "aggressive") {
    return normalized;
  }
  return fallback;
}

function normalizeLeadIntentScope(value: unknown, fallback: LeadIntentScope): LeadIntentScope {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "commercial" || normalized === "commercial_and_escalation") {
    return normalized;
  }
  return fallback;
}

function normalizeDomainValue(input: string): string | null {
  const raw = input.trim().toLowerCase();
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
}

function normalizeDomains(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const items = input
    .map((item) => (typeof item === "string" ? normalizeDomainValue(item) : null))
    .filter((item): item is string => Boolean(item));
  return Array.from(new Set(items));
}

function normalizeWidgetConfig(input: unknown): WidgetConfig {
  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const positionRaw = normalizeText(source.position, DEFAULT_WIDGET_CONFIG.position, 40).toLowerCase();
  return {
    widgetTitle: normalizeText(source.widgetTitle, DEFAULT_WIDGET_CONFIG.widgetTitle, 120),
    welcomeMessage: normalizeText(source.welcomeMessage, DEFAULT_WIDGET_CONFIG.welcomeMessage, 300),
    primaryColor: normalizeText(source.primaryColor, DEFAULT_WIDGET_CONFIG.primaryColor, 20),
    position: positionRaw === "bottom-left" ? "bottom-left" : "bottom-right",
    collectVisitorInfo: normalizeBool(source.collectVisitorInfo, DEFAULT_WIDGET_CONFIG.collectVisitorInfo),
    leadCaptureEnabled: normalizeBool(source.leadCaptureEnabled, DEFAULT_WIDGET_CONFIG.leadCaptureEnabled),
    leadPromptAfterMessages: normalizeInt(
      source.leadPromptAfterMessages,
      DEFAULT_WIDGET_CONFIG.leadPromptAfterMessages,
      1,
      12,
    ),
    leadPromptMessage: normalizeText(source.leadPromptMessage, DEFAULT_WIDGET_CONFIG.leadPromptMessage, 240),
    requireLeadEmail: normalizeBool(source.requireLeadEmail, DEFAULT_WIDGET_CONFIG.requireLeadEmail),
    leadIntentPreset: normalizeLeadIntentPreset(source.leadIntentPreset, DEFAULT_WIDGET_CONFIG.leadIntentPreset),
    leadIntentScope: normalizeLeadIntentScope(source.leadIntentScope, DEFAULT_WIDGET_CONFIG.leadIntentScope),
    allowedDomains: normalizeDomains(source.allowedDomains),
  };
}

function startOfLocalDay(now = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfNextLocalDay(now = new Date()): Date {
  const d = startOfLocalDay(now);
  d.setDate(d.getDate() + 1);
  return d;
}

function normalizeDestinationDomains(domains: string[]): string[] {
  const normalized = domains
    .map((domain) => normalizeDomainValue(domain))
    .filter((domain): domain is string => Boolean(domain));
  return Array.from(new Set(normalized));
}

function getWidgetClientIp(req: Request): string {
  const direct = String(req.ip ?? "").trim();
  if (direct) return direct;
  const socketAddress = String(req.socket?.remoteAddress ?? "").trim();
  return socketAddress || "unknown";
}

async function maybeCleanupRateLimitRows(now: Date): Promise<void> {
  const nowMs = now.getTime();
  if (nowMs - lastRateLimitDbCleanupAt < RATE_LIMIT_DB_CLEANUP_INTERVAL_MS) return;
  lastRateLimitDbCleanupAt = nowMs;

  try {
    await db.delete(widgetRateLimits).where(lt(widgetRateLimits.expiresAt, now));
  } catch (error) {
    console.error("Widget rate-limit cleanup failed:", error);
  }
}

async function ensureWidgetRateLimitTable(): Promise<void> {
  if (widgetRateLimitTableReady) return;
  if (widgetRateLimitTableInitInFlight) {
    await widgetRateLimitTableInitInFlight;
    return;
  }

  widgetRateLimitTableInitInFlight = (async () => {
    await db.execute(sql`
      create table if not exists widget_rate_limits (
        "key" text primary key,
        scope text not null,
        count integer not null default 0,
        window_start timestamp not null,
        expires_at timestamp not null,
        created_at timestamp not null default now(),
        updated_at timestamp not null default now()
      )
    `);
    await db.execute(sql`
      create index if not exists idx_widget_rate_limits_expires_at
      on widget_rate_limits (expires_at)
    `);
    widgetRateLimitTableReady = true;
  })();

  try {
    await widgetRateLimitTableInitInFlight;
  } finally {
    widgetRateLimitTableInitInFlight = null;
  }
}

async function consumeRateLimit(key: string, scope: string, maxRequests: number, windowMs: number): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}> {
  await ensureWidgetRateLimitTable();

  const now = new Date();
  const nowMs = now.getTime();
  const windowStartMs = Math.floor(nowMs / windowMs) * windowMs;
  const resetAt = windowStartMs + windowMs;
  const bucketKey = `${key}:${windowStartMs}`;
  const windowStart = new Date(windowStartMs);
  const expiresAt = new Date(resetAt);

  await maybeCleanupRateLimitRows(now);

  const [row] = await db
    .insert(widgetRateLimits)
    .values({
      key: bucketKey,
      scope,
      count: 1,
      windowStart,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: widgetRateLimits.key,
      set: {
        count: sql`${widgetRateLimits.count} + 1`,
        updatedAt: now,
      },
    })
    .returning({
      count: widgetRateLimits.count,
      expiresAt: widgetRateLimits.expiresAt,
    });

  const currentCount = Number(row?.count ?? 1);
  const resetAtMs = row?.expiresAt ? new Date(row.expiresAt).getTime() : resetAt;
  const remaining = Math.max(maxRequests - currentCount, 0);
  const retryAfterSeconds = Math.max(Math.ceil((resetAtMs - nowMs) / 1000), 1);

  return {
    allowed: currentCount <= maxRequests,
    remaining,
    resetAt: resetAtMs,
    retryAfterSeconds,
  };
}

function applyRateLimitHeaders(
  res: Response,
  maxRequests: number,
  remaining: number,
  resetAt: number,
  retryAfterSeconds?: number,
): void {
  res.setHeader("X-RateLimit-Limit", String(maxRequests));
  res.setHeader("X-RateLimit-Remaining", String(remaining));
  res.setHeader("X-RateLimit-Reset", String(Math.floor(resetAt / 1000)));
  if (retryAfterSeconds !== undefined) {
    res.setHeader("Retry-After", String(retryAfterSeconds));
  }
}

function widgetRateLimit(scope: "bootstrap" | "chat" | "lead") {
  const maxRequests =
    scope === "bootstrap" ? WIDGET_BOOTSTRAP_RATE_LIMIT : scope === "chat" ? WIDGET_CHAT_RATE_LIMIT : WIDGET_LEAD_RATE_LIMIT;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = String(req.params.token ?? "").trim();
      const clientIp = getWidgetClientIp(req);
      const sessionComponent =
        WIDGET_RATE_LIMIT_USE_SESSION_KEY
          ? scope === "bootstrap"
            ? sanitizeSessionId(req.query.sessionId) ?? "anon"
            : sanitizeSessionId((req.body as Record<string, unknown> | undefined)?.sessionId) ??
            (() => {
              const rawSessionToken = String((req.body as Record<string, unknown> | undefined)?.sessionToken ?? "").trim();
              if (!rawSessionToken) return null;
              const parsed = verifyWidgetSessionToken(rawSessionToken);
              return parsed.ok ? sanitizeSessionId(parsed.payload.sessionId) : null;
            })() ??
            "anon"
          : "ip";
      const key = `${scope}:${token}:${clientIp}:${sessionComponent}`;
      const result = await consumeRateLimit(key, scope, maxRequests, WIDGET_RATE_LIMIT_WINDOW_MS);

      applyRateLimitHeaders(
        res,
        maxRequests,
        result.remaining,
        result.resetAt,
        result.allowed ? undefined : result.retryAfterSeconds,
      );

      if (!result.allowed) {
        recordOpsEvent(
          "WIDGET_RATE_LIMIT_429",
          {
            scope,
            tokenPrefix: token.slice(0, 12),
            clientIp,
            remaining: result.remaining,
          },
          { bucketKey: `WIDGET_RATE_LIMIT_429:${scope}` },
        );

        return res.status(429).json({
          code: "RATE_LIMITED",
          message: DEFAULT_RATE_LIMIT_MESSAGE,
        });
      }

      return next();
    } catch (error) {
      console.error("Widget rate-limit check failed:", error);
      return res.status(503).json({
        code: "RATE_LIMIT_UNAVAILABLE",
        message: "Rate limiting is temporarily unavailable. Please retry shortly.",
      });
    }
  };
}

function mergeWidgetConfig(current: unknown, patch: Partial<WidgetConfig>): WidgetConfig {
  const base = normalizeWidgetConfig(current);
  return normalizeWidgetConfig({
    ...base,
    ...patch,
    allowedDomains: patch.allowedDomains ?? base.allowedDomains,
  });
}

function isLeadIntentInScope(intentScope: LeadIntentScope, intentType: EvaluateLeadPromptEligibilityResult["intentType"]): boolean {
  if (intentType === "commercial") return true;
  return intentScope === "commercial_and_escalation" && intentType === "escalation";
}

function getLeadPromptThresholds(preset: LeadIntentPreset): { formThreshold: number; softThreshold: number } {
  if (preset === "conservative") {
    return { formThreshold: 0.78, softThreshold: 0.55 };
  }
  if (preset === "aggressive") {
    return { formThreshold: 0.55, softThreshold: 0.35 };
  }
  return { formThreshold: 0.65, softThreshold: 0.45 };
}

function buildLeadPromptPayload(
  config: WidgetConfig,
  mode: LeadPromptMode,
  reason: string,
  options?: Partial<Pick<WidgetLeadPromptPayload, "ctaLabel" | "dismissLabel">>,
): WidgetLeadPromptPayload {
  return {
    mode,
    show: mode !== "none",
    message: config.leadPromptMessage,
    requireEmail: config.requireLeadEmail,
    ctaLabel: mode === "cta" ? options?.ctaLabel ?? "Share details" : undefined,
    dismissLabel: mode === "cta" ? options?.dismissLabel ?? "No thanks" : undefined,
    reason,
  };
}

function resolveLeadPromptMode(input: {
  config: WidgetConfig;
  minimumGatePassed: boolean;
  hasExistingLead: boolean;
  eligibility: EvaluateLeadPromptEligibilityResult | null;
}): WidgetLeadPromptPayload {
  const { config, minimumGatePassed, hasExistingLead, eligibility } = input;

  if (!config.collectVisitorInfo) {
    return buildLeadPromptPayload(config, "none", "visitor_info_collection_disabled");
  }

  if (!config.leadCaptureEnabled) {
    return buildLeadPromptPayload(config, "none", "lead_capture_disabled");
  }

  if (!minimumGatePassed) {
    return buildLeadPromptPayload(config, "none", "minimum_message_gate_not_met");
  }

  if (hasExistingLead) {
    return buildLeadPromptPayload(config, "none", "lead_already_captured");
  }

  if (!eligibility) {
    return buildLeadPromptPayload(config, "none", "eligibility_not_evaluated");
  }

  if (!isLeadIntentInScope(config.leadIntentScope, eligibility.intentType)) {
    return buildLeadPromptPayload(config, "none", `intent_out_of_scope:${eligibility.intentType}`);
  }

  const { formThreshold, softThreshold } = getLeadPromptThresholds(config.leadIntentPreset);
  const intentConfidence = Number(eligibility.intentConfidence ?? 0);
  const answeredConfidence = Number(eligibility.answeredConfidence ?? 0);

  if (eligibility.answered && intentConfidence >= formThreshold && answeredConfidence >= formThreshold) {
    return buildLeadPromptPayload(config, "form", `strong_signal:${eligibility.reason}`);
  }

  if (
    eligibility.uncertain ||
    (intentConfidence >= softThreshold && answeredConfidence >= softThreshold)
  ) {
    return buildLeadPromptPayload(config, "cta", `soft_signal:${eligibility.reason}`);
  }

  return buildLeadPromptPayload(config, "none", `confidence_below_threshold:${eligibility.reason}`);
}

async function syncWebsiteDestinationConfigs(platformId: number, domains: string[]): Promise<void> {
  const desiredDomains = normalizeDestinationDomains(domains);
  const desired = new Set(desiredDomains);
  const existing = await storage.getChatConfigurationsByPlatformId(platformId);
  const websiteConfigs = existing.filter((config) => config.chatType === "website_domain");
  const byDomain = new Map<string, (typeof websiteConfigs)[number]>();

  for (const config of websiteConfigs) {
    byDomain.set(String(config.externalId).toLowerCase(), config);
  }

  for (const config of websiteConfigs) {
    const configDomain = String(config.externalId).toLowerCase();
    const shouldBeActive = desired.has(configDomain);
    if (config.isActive !== shouldBeActive) {
      await storage.updateChatConfiguration(config.id, {
        isActive: shouldBeActive,
        updatedAt: new Date(),
      } as any);
    }
  }

  for (const domain of desiredDomains) {
    const normalized = domain.toLowerCase();
    const existingConfig = byDomain.get(normalized);
    if (!existingConfig) {
      await storage.createChatConfiguration({
        platformId,
        externalId: normalized,
        chatType: "website_domain",
        chatName: normalized,
        aiConfigurationId: null,
        knowledgeBaseId: null,
        settings: {
          source: "widget",
          domain: normalized,
        } as any,
        isActive: true,
      } as any);
      continue;
    }

    if (existingConfig.chatName !== normalized) {
      await storage.updateChatConfiguration(existingConfig.id, {
        chatName: normalized,
        updatedAt: new Date(),
      } as any);
    }
  }
}

async function getWorkspaceAiResponsesToday(workspaceOwnerId: number, now = new Date()): Promise<number> {
  const start = startOfLocalDay(now);
  const rows = await db
    .select({ total: count() })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .innerJoin(platforms, eq(conversations.platformId, platforms.id))
    .where(and(eq(messages.sender, "ai"), eq(platforms.userId, workspaceOwnerId), gte(messages.createdAt, start)));

  return Number(rows[0]?.total ?? 0);
}

async function getPlatformDestinationUsageForOwner(ownerId: number): Promise<{
  telegramGroupsUsed: number;
  discordServersUsed: number;
  websiteDomainsUsed: number;
}> {
  const rows = await db
    .select({
      platformType: platforms.type,
      chatType: chatConfigurations.chatType,
      total: count(),
    })
    .from(chatConfigurations)
    .innerJoin(platforms, eq(chatConfigurations.platformId, platforms.id))
    .where(and(eq(platforms.userId, ownerId), eq(chatConfigurations.isActive, true)))
    .groupBy(platforms.type, chatConfigurations.chatType);

  let telegramGroupsUsed = 0;
  let discordServersUsed = 0;
  let websiteDomainsUsed = 0;

  for (const row of rows) {
    const platformType = String(row.platformType ?? "");
    const chatType = String(row.chatType ?? "");
    const total = Number(row.total ?? 0);

    if (platformType === "telegram") {
      if (chatType === "group" || chatType === "supergroup") {
        telegramGroupsUsed += total;
      }
      continue;
    }

    if (platformType === "discord") {
      if (chatType === "server") {
        discordServersUsed += total;
      }
      continue;
    }

    if (platformType === "website") {
      if (chatType === "website_domain") {
        websiteDomainsUsed += total;
      }
    }
  }

  return { telegramGroupsUsed, discordServersUsed, websiteDomainsUsed };
}

async function buildWidgetUsageSummary(
  ownerUser: NonNullable<Awaited<ReturnType<typeof storage.getUser>>>,
  config: WidgetConfig,
): Promise<WidgetUsageSummary> {
  const entitlements = getEntitlementsForUser(ownerUser as any);
  const now = new Date();
  const { telegramGroupsUsed, discordServersUsed, websiteDomainsUsed: websiteCountFromConfigs } =
    await getPlatformDestinationUsageForOwner(ownerUser.id);
  const websiteDomainsUsed =
    websiteCountFromConfigs > 0 ? websiteCountFromConfigs : normalizeDestinationDomains(config.allowedDomains).length;
  const aiResponsesUsedToday = await getWorkspaceAiResponsesToday(ownerUser.id, now);
  const internalAccount = isInternalAccountRole(String(ownerUser.role ?? "").toLowerCase());

  return {
    telegramGroupsUsed,
    telegramGroupLimit: entitlements.telegramGroupLimit,
    discordServersUsed,
    discordServerLimit: entitlements.discordServerLimit,
    websiteDomainsUsed,
    websiteDomainLimit: entitlements.websiteDomainLimit,
    aiResponsesUsedToday,
    aiResponsesPerDay: internalAccount ? null : entitlements.aiResponsesPerDay,
    aiResponsesResetAt: startOfNextLocalDay(now).toISOString(),
  };
}

function getRequestBaseUrl(req: Request): string {
  const frontendUrl = String(process.env.FRONTEND_URL ?? "").trim();
  if (frontendUrl) return frontendUrl.replace(/\/+$/, "");
  return `${req.protocol}://${req.get("host")}`.replace(/\/+$/, "");
}

function buildEmbedSnippet(baseUrl: string, token: string, position: "bottom-right" | "bottom-left"): string {
  return `<script src="${baseUrl}/widget/embed.js" data-moderateai-token="${token}" data-moderateai-position="${position}" defer></script>`;
}

function extractHost(value?: string | null): string | null {
  if (!value) return null;
  return normalizeDomainValue(value);
}

function getWidgetHostCandidates(origin?: string, pageUrl?: string): string[] {
  const candidates = [extractHost(pageUrl), extractHost(origin)].filter((v): v is string => Boolean(v));
  return Array.from(new Set(candidates));
}

function resolveWidgetRequestHost(origin?: string, pageUrl?: string): string | null {
  return getWidgetHostCandidates(origin, pageUrl)[0] ?? null;
}

type WebsiteDomainChatConfig = Awaited<ReturnType<typeof storage.getChatConfigurationsByPlatformId>>[number];

function matchWebsiteDomainConfig(
  host: string,
  configs: WebsiteDomainChatConfig[],
): WebsiteDomainChatConfig | null {
  const matches = configs
    .filter((config) => {
      const domain = String(config.externalId ?? "").trim().toLowerCase();
      if (!domain) return false;
      return host === domain || host.endsWith(`.${domain}`);
    })
    .sort((a, b) => String(b.externalId ?? "").length - String(a.externalId ?? "").length);

  return matches[0] ?? null;
}

async function resolveWebsiteDomainChatConfig(
  platformId: number,
  origin?: string,
  pageUrl?: string,
): Promise<{
  requestHost: string | null;
  mappedDomain: string | null;
  config: WebsiteDomainChatConfig | null;
}> {
  const hostCandidates = getWidgetHostCandidates(origin, pageUrl);
  const allConfigs = await storage.getChatConfigurationsByPlatformId(platformId);
  const websiteConfigs = allConfigs.filter(
    (config) => config.chatType === "website_domain" && Boolean(config.isActive),
  );

  if (hostCandidates.length === 0 || websiteConfigs.length === 0) {
    return {
      requestHost: hostCandidates[0] ?? null,
      mappedDomain: null,
      config: null,
    };
  }

  for (const host of hostCandidates) {
    const matchedConfig = matchWebsiteDomainConfig(host, websiteConfigs);
    if (matchedConfig) {
      return {
        requestHost: host,
        mappedDomain: String(matchedConfig.externalId ?? "").toLowerCase() || null,
        config: matchedConfig,
      };
    }
  }

  return {
    requestHost: hostCandidates[0] ?? null,
    mappedDomain: null,
    config: null,
  };
}

function isAllowedByDomain(config: WidgetConfig, origin?: string, pageUrl?: string): boolean {
  if (!config.allowedDomains.length) return true;
  const candidates = getWidgetHostCandidates(origin, pageUrl);
  if (!candidates.length) return false;
  return candidates.some((host) =>
    config.allowedDomains.some((allowed) => host === allowed || host.endsWith(`.${allowed}`)),
  );
}

function buildWidgetTrainingInsightsPrompt(insights: Awaited<ReturnType<typeof chatHistoryManager.getContextualInsights>>): string {
  if (!insights.length) return "";

  let block =
    "\n\nAPPROVED RESPONSE CORRECTION INSIGHTS:\n" +
    "Use these destination-specific corrections when they match the visitor's intent, while staying aligned to the knowledge base.\n";

  insights.slice(0, 5).forEach((insight, index) => {
    const context = (insight.context && typeof insight.context === "object" ? insight.context : {}) as Record<string, any>;
    const correctedResponse = String(context.correctedResponse ?? "").trim();
    const note = String(context.annotation ?? "").trim();
    block += `\n${index + 1}. Pattern: ${String(insight.pattern ?? "")}\n`;
    if (correctedResponse) {
      block += `Preferred response: ${correctedResponse.slice(0, 400)}\n`;
    }
    if (note) {
      block += `Correction note: ${note.slice(0, 250)}\n`;
    }
    block += `Confidence: ${Math.max(0, Math.min(100, Number(insight.confidence ?? 0)))}%\n`;
  });

  return block;
}

async function ensureWebsitePlatform(workspaceOwnerId: number) {
  const owned = await storage.getPlatformsByUserId(workspaceOwnerId);
  let website = owned.find((platform) => platform.type === "website");

  if (!website) {
    website = await storage.createPlatform({
      userId: workspaceOwnerId,
      type: "website",
      name: "ModerateAI Website",
      status: "active",
      authToken: generateWidgetToken(),
      config: DEFAULT_WIDGET_CONFIG as any,
    } as any);
    return website;
  }

  const update: Record<string, unknown> = {};
  const normalizedConfig = normalizeWidgetConfig(website.config);
  if (JSON.stringify(normalizedConfig) !== JSON.stringify(website.config ?? {})) {
    update.config = normalizedConfig;
  }
  if (!website.authToken) {
    update.authToken = generateWidgetToken();
  }

  if (Object.keys(update).length > 0) {
    const updated = await storage.updatePlatform(website.id, update as any);
    website = updated ?? website;
  }

  return website;
}

type WidgetResolveResult =
  | { error: string; status: number }
  | {
      platform: NonNullable<Awaited<ReturnType<typeof storage.getPlatformByToken>>>;
      owner: NonNullable<Awaited<ReturnType<typeof storage.getUser>>>;
      config: WidgetConfig;
      requestHost: string | null;
    };

async function resolveWidgetPlatformByToken(
  token: string,
  origin?: string,
  pageUrl?: string,
): Promise<WidgetResolveResult> {
  const platform = await storage.getPlatformByToken(token);
  if (!platform || platform.type !== "website") {
    return { error: "Widget not found", status: 404 as const };
  }

  if (platform.status === "inactive" || platform.status === "not_connected") {
    return { error: "Widget is inactive", status: 403 as const };
  }

  const owner = await storage.getUser(platform.userId);
  if (!owner || !owner.isActive || owner.isBanned) {
    return { error: "Workspace is unavailable", status: 403 as const };
  }

  const config = normalizeWidgetConfig(platform.config);
  const requestHost = resolveWidgetRequestHost(origin, pageUrl);
  if (!isAllowedByDomain(config, origin, pageUrl)) {
    return { error: "This domain is not allowed for this widget token", status: 403 as const };
  }

  return { platform, owner, config, requestHost };
}

function resolveWidgetSessionContext(input: {
  providedSessionId?: unknown;
  providedSessionToken?: unknown;
  expectedToken: string;
  expectedPlatformId: number;
  expectedOwnerId: number;
  requestHost: string | null;
}): { ok: true; sessionId: string; sessionToken: string; sessionTokenExpiresAt: string; tokenSource: "signed" | "legacy" } | {
  ok: false;
  status: number;
  reason: string;
  message: string;
} {
  const validatedToken = validateWidgetSessionTokenForRequest({
    providedToken: input.providedSessionToken,
    expectedToken: input.expectedToken,
    expectedPlatformId: input.expectedPlatformId,
    expectedOwnerId: input.expectedOwnerId,
    requestHost: input.requestHost,
  });

  const hasProvidedToken = typeof input.providedSessionToken === "string" && input.providedSessionToken.trim().length > 0;
  if (!validatedToken.ok && hasProvidedToken && WIDGET_STRICT_SESSION_BINDING_ENABLED) {
    return {
      ok: false,
      status: 403,
      reason: `session_token_invalid:${validatedToken.reason}`,
      message: "Session validation failed. Please reload the widget.",
    };
  }
  if (WIDGET_STRICT_SESSION_BINDING_ENABLED && !hasProvidedToken) {
    return {
      ok: false,
      status: 403,
      reason: "session_token_missing",
      message: "Session validation is required. Please reload the widget.",
    };
  }

  const sessionId =
    validatedToken.ok
      ? validatedToken.payload.sessionId
      : sanitizeSessionId(input.providedSessionId) ?? generateSessionId();
  const issued = issueWidgetSessionToken({
    token: input.expectedToken,
    platformId: input.expectedPlatformId,
    ownerId: input.expectedOwnerId,
    resolvedHost: input.requestHost,
    sessionId,
  });

  return {
    ok: true,
    sessionId,
    sessionToken: issued.sessionToken,
    sessionTokenExpiresAt: issued.sessionTokenExpiresAt,
    tokenSource: validatedToken.ok ? "signed" : "legacy",
  };
}

function buildWidgetFrameHtml(token: string): string {
  const safeToken = JSON.stringify(token);
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>ModerateAI Widget</title>
<style>
*{box-sizing:border-box}html,body{margin:0;height:100%;font-family:Segoe UI,Arial,sans-serif;background:transparent}
#root{height:100%;display:flex;flex-direction:column;border:1px solid rgba(96,165,250,.45);border-radius:14px;overflow:hidden;background:linear-gradient(145deg,rgba(2,10,30,.98),rgba(5,26,72,.96));color:#e2e8f0}
#head{padding:12px 14px;font-weight:700;font-size:14px;border-bottom:1px solid rgba(96,165,250,.3);background:rgba(12,74,180,.25)}
#msgs{flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:8px}
.msg{max-width:86%;font-size:13px;line-height:1.4;padding:8px 10px;border-radius:10px;white-space:pre-wrap;word-break:break-word}
.user{align-self:flex-end;background:#2563eb;color:#fff}.ai{align-self:flex-start;background:rgba(30,41,59,.9);border:1px solid rgba(148,163,184,.25)}
#leadCta{display:none;margin:0 12px 10px;padding:10px;border-radius:10px;border:1px solid rgba(96,165,250,.35);background:rgba(9,30,77,.56)}
#leadCta p{margin:0 0 8px;font-size:12px;color:#cbd5e1}
#leadCtaActions{display:flex;gap:8px}
#leadCtaOpen,#leadCtaDismiss{flex:1;border-radius:8px;padding:8px 10px;font-size:12px;font-weight:700;cursor:pointer}
#leadCtaOpen{border:none;background:#3b82f6;color:#fff}
#leadCtaDismiss{border:1px solid rgba(148,163,184,.35);background:rgba(2,6,23,.55);color:#e2e8f0}
#lead{display:none;margin:0 12px 10px;padding:10px;border-radius:10px;border:1px solid rgba(96,165,250,.4);background:rgba(9,30,77,.65)}
#lead h4{margin:0 0 8px;font-size:13px}#lead p{margin:0 0 8px;font-size:12px;color:#cbd5e1}
#lead input{width:100%;margin-bottom:6px;border-radius:8px;border:1px solid rgba(148,163,184,.35);background:rgba(2,6,23,.85);color:#f8fafc;padding:7px 9px;font-size:12px}
#lead button{width:100%;border:none;border-radius:8px;padding:8px 10px;font-size:12px;font-weight:700;cursor:pointer;background:#3b82f6;color:#fff}
#leadStatus{display:none;font-size:11px;margin-top:6px;color:#93c5fd}
#composer{border-top:1px solid rgba(96,165,250,.25);padding:10px;display:flex;gap:8px;background:rgba(2,6,23,.55)}
#text{flex:1;border-radius:8px;border:1px solid rgba(148,163,184,.35);background:rgba(2,6,23,.85);color:#f8fafc;padding:9px 10px;font-size:13px}
#send{border:none;border-radius:8px;padding:0 14px;font-size:13px;font-weight:700;cursor:pointer;background:#3b82f6;color:#fff}
</style>
</head>
<body>
<div id="root">
<div id="head">ModerateAI</div>
<div id="msgs"></div>
<div id="leadCta">
  <p id="leadPromptCta">Want a follow-up from our team? Share your name and email.</p>
  <div id="leadCtaActions">
    <button id="leadCtaOpen" type="button">Share details</button>
    <button id="leadCtaDismiss" type="button">No thanks</button>
  </div>
</div>
<div id="lead">
  <h4>Share your details</h4>
  <p id="leadPrompt">We can follow up with more help.</p>
  <input id="leadName" placeholder="Name (optional)" />
  <input id="leadEmail" placeholder="Email" />
  <input id="leadCompany" placeholder="Company (optional)" />
  <button id="leadSubmit">Send details</button>
  <div id="leadStatus"></div>
</div>
<div id="composer">
  <input id="text" placeholder="Type your message..." />
  <button id="send">Send</button>
</div>
</div>
<script>
(function(){
  var token=${safeToken};
  var qs=new URLSearchParams(location.search);
  var parentOrigin=qs.get('origin')||'';
  var pageUrl=qs.get('page')||'';
  var pageTitle=qs.get('title')||'';
  var hostKey=(function(){
    try{
      var base=pageUrl||parentOrigin||window.location.href||'';
      var parsed=new URL(base,window.location.href);
      return String(parsed.hostname||'unknown').toLowerCase();
    }catch(_){
      return 'unknown';
    }
  })();
  var storageFallbackUsed=false;
  var memoryStore={};
  function storageGet(key){
    try{
      return window.localStorage.getItem(key);
    }catch(_){
      storageFallbackUsed=true;
      return Object.prototype.hasOwnProperty.call(memoryStore,key)?String(memoryStore[key]):null;
    }
  }
  function storageSet(key,value){
    try{
      window.localStorage.setItem(key,String(value));
      return;
    }catch(_){
      storageFallbackUsed=true;
      memoryStore[key]=String(value);
    }
  }
  function storageRemove(key){
    try{
      window.localStorage.removeItem(key);
      return;
    }catch(_){
      storageFallbackUsed=true;
      delete memoryStore[key];
    }
  }
  function getSessionKey(){return 'moderateai_widget_session_'+token+'_'+hostKey;}
  function getSessionTokenKey(){return 'moderateai_widget_session_token_'+token+'_'+hostKey;}
  function getLeadKey(){return 'moderateai_widget_lead_'+token+'_'+hostKey+'_'+sessionId;}
  function getLeadDismissKey(){return 'moderateai_widget_lead_dismissed_'+token+'_'+hostKey+'_'+sessionId;}
  var msgs=document.getElementById('msgs');
  var head=document.getElementById('head');
  var text=document.getElementById('text');
  var send=document.getElementById('send');
  var leadCta=document.getElementById('leadCta');
  var leadPromptCta=document.getElementById('leadPromptCta');
  var leadCtaOpen=document.getElementById('leadCtaOpen');
  var leadCtaDismiss=document.getElementById('leadCtaDismiss');
  var lead=document.getElementById('lead');
  var leadPrompt=document.getElementById('leadPrompt');
  var leadName=document.getElementById('leadName');
  var leadEmail=document.getElementById('leadEmail');
  var leadCompany=document.getElementById('leadCompany');
  var leadSubmit=document.getElementById('leadSubmit');
  var leadStatus=document.getElementById('leadStatus');
  var sessionId=storageGet(getSessionKey())||('w_'+Math.random().toString(36).slice(2)+Date.now().toString(36));
  var sessionToken=storageGet(getSessionTokenKey())||'';
  storageSet(getSessionKey(),sessionId);
  if(sessionToken){storageSet(getSessionTokenKey(),sessionToken);}
  var hasLead=false;
  var leadDismissed=false;
  var ctaVisible=false;
  var formVisible=false;
  var leadRequireEmail=false;
  var cfg=null; var sending=false;

  function add(role,content){var n=document.createElement('div');n.className='msg '+(role==='user'?'user':'ai');n.textContent=content;msgs.appendChild(n);msgs.scrollTop=msgs.scrollHeight;}
  function persistSession(){storageSet(getSessionKey(),sessionId);if(sessionToken){storageSet(getSessionTokenKey(),sessionToken);}else{storageRemove(getSessionTokenKey());}}
  function refreshLeadState(){hasLead=storageGet(getLeadKey())==='1';leadDismissed=storageGet(getLeadDismissKey())==='1';}
  function setLeadDismissed(){leadDismissed=true;storageSet(getLeadDismissKey(),'1');hideLeadPrompts();}
  function hideLeadPrompts(){lead.style.display='none';leadCta.style.display='none';ctaVisible=false;formVisible=false;}
  function showLeadPrompt(payload){
    if(hasLead||leadDismissed||!cfg||!cfg.leadCaptureEnabled){hideLeadPrompts();return;}
    if(payload&&payload.message){leadPrompt.textContent=payload.message;leadPromptCta.textContent=payload.message;}
    leadRequireEmail=Boolean(payload&&Object.prototype.hasOwnProperty.call(payload,'requireEmail')?payload.requireEmail:cfg.requireLeadEmail);
    if(payload&&payload.ctaLabel&&leadCtaOpen){leadCtaOpen.textContent=String(payload.ctaLabel);}
    if(payload&&payload.dismissLabel&&leadCtaDismiss){leadCtaDismiss.textContent=String(payload.dismissLabel);}
    var mode='none';
    if(payload&&payload.mode){mode=String(payload.mode);}
    else if(payload&&payload.show){mode='form';}
    if(mode==='form'){
      lead.style.display='block';
      leadCta.style.display='none';
      formVisible=true;
      ctaVisible=false;
      return;
    }
    if(mode==='cta'){
      leadCta.style.display='block';
      lead.style.display='none';
      ctaVisible=true;
      formVisible=false;
      return;
    }
    hideLeadPrompts();
  }
  function leadMsg(msg,color){leadStatus.style.display='block';leadStatus.style.color=color||'#93c5fd';leadStatus.textContent=msg;}

  async function bootstrap(){
    try{
      var bootstrapUrl='/api/widget/'+encodeURIComponent(token)+'/bootstrap?origin='+encodeURIComponent(parentOrigin)+'&pageUrl='+encodeURIComponent(pageUrl)+'&sessionId='+encodeURIComponent(sessionId);
      var r=await fetch(bootstrapUrl,{credentials:'omit'});
      if(!r.ok){add('ai','This widget is unavailable right now.');return;}
      var d=await r.json();
      cfg=d.config||{};
      leadRequireEmail=Boolean(cfg&&cfg.requireLeadEmail);
      if(d.sessionId&&d.sessionId!==sessionId){sessionId=d.sessionId;}
      if(typeof d.sessionToken==='string'&&d.sessionToken.trim()){sessionToken=String(d.sessionToken).trim();}
      persistSession();
      refreshLeadState();
      head.textContent=cfg.widgetTitle||'ModerateAI';
      if(cfg.primaryColor){send.style.background=cfg.primaryColor;leadSubmit.style.background=cfg.primaryColor;}
      if(cfg.welcomeMessage){add('ai',cfg.welcomeMessage);}
    }catch(_){add('ai','Connection error. Please try again later.');}
  }

  async function sendMessage(){
    var msg=String(text.value||'').trim();
    if(!msg||sending)return;
    if(ctaVisible&&!formVisible&&!leadDismissed&&!hasLead){setLeadDismissed();}
    sending=true;text.value='';add('user',msg);
    try{
      var r=await fetch('/api/widget/'+encodeURIComponent(token)+'/chat',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',body:JSON.stringify({message:msg,sessionId:sessionId,sessionToken:sessionToken||undefined,origin:parentOrigin,pageUrl:pageUrl,pageTitle:pageTitle,storageFallbackUsed:storageFallbackUsed})});
      if(!r.ok){add('ai','We hit an issue. Please try again.');return;}
      var d=await r.json();
      if(d.sessionId&&d.sessionId!==sessionId){sessionId=d.sessionId;}
      if(typeof d.sessionToken==='string'&&d.sessionToken.trim()){sessionToken=String(d.sessionToken).trim();}
      persistSession();
      refreshLeadState();
      add('ai',d.reply||'Thanks, we received your message.');
      if(d.limitReached&&d.quota&&d.quota.retryAt){
        add('ai','Daily limit reached. Resets: '+String(d.quota.retryAt));
      }
      showLeadPrompt(d.leadPrompt||null);
    }catch(_){add('ai','Network error. Please try again.');}
    finally{sending=false;}
  }

  async function submitLead(){
    if(!cfg||!cfg.leadCaptureEnabled||hasLead)return;
    var name=String(leadName.value||'').trim();
    var email=String(leadEmail.value||'').trim();
    var company=String(leadCompany.value||'').trim();
    if(leadRequireEmail&&!email){leadMsg('Email is required.','#fca5a5');return;}
    if(!name&&!email){leadMsg('Add at least a name or email.','#fca5a5');return;}
    leadSubmit.disabled=true;leadMsg('Sending...','#93c5fd');
    try{
      var r=await fetch('/api/widget/'+encodeURIComponent(token)+'/lead',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',body:JSON.stringify({sessionId:sessionId,sessionToken:sessionToken||undefined,name:name,email:email,company:company,origin:parentOrigin,pageUrl:pageUrl,pageTitle:pageTitle,storageFallbackUsed:storageFallbackUsed})});
      if(!r.ok){var d=await r.json().catch(function(){return null;});leadMsg((d&&d.message)||'Could not submit details.','#fca5a5');return;}
      hasLead=true;storageSet(getLeadKey(),'1');leadMsg('Thanks. Our team will follow up.','#86efac');setTimeout(function(){hideLeadPrompts();},900);
    }catch(_){leadMsg('Could not submit details.','#fca5a5');}
    finally{leadSubmit.disabled=false;}
  }

  send.addEventListener('click',sendMessage);
  text.addEventListener('keydown',function(e){if(e.key==='Enter')sendMessage();});
  leadCtaOpen.addEventListener('click',function(){if(leadDismissed||hasLead)return;leadCta.style.display='none';lead.style.display='block';ctaVisible=false;formVisible=true;});
  leadCtaDismiss.addEventListener('click',function(){setLeadDismissed();});
  leadSubmit.addEventListener('click',submitLead);
  refreshLeadState();
  bootstrap();
})();
</script>
</body>
</html>`;
}

function buildEmbedScript(): string {
  return `(function(){
  var script=document.currentScript;
  if(!script){var scripts=document.querySelectorAll('script[data-moderateai-token]');script=scripts[scripts.length-1]||null;}
  if(!script)return;
  var token=script.getAttribute('data-moderateai-token');
  if(!token){console.error('[ModerateAI] Missing data-moderateai-token');return;}
  var scriptUrl=new URL(script.src,window.location.href);
  var baseUrl=(script.getAttribute('data-moderateai-base-url')||'').trim()||scriptUrl.origin;
  var pos=(script.getAttribute('data-moderateai-position')||'bottom-right').toLowerCase();
  var left=pos==='bottom-left';

  var root=document.createElement('div');
  root.style.position='fixed';root.style.zIndex='2147483000';root.style.bottom='20px';
  if(left)root.style.left='20px';else root.style.right='20px';

  var panel=document.createElement('div');
  panel.style.display='none';panel.style.width='360px';panel.style.height='560px';panel.style.marginBottom='12px';
  panel.style.borderRadius='14px';panel.style.overflow='hidden';panel.style.boxShadow='0 22px 46px rgba(2,6,23,.52)';
  panel.style.background='rgba(2,6,23,.95)';panel.style.border='1px solid rgba(96,165,250,.35)';

  var frame=document.createElement('iframe');
  frame.src=baseUrl+'/widget/frame/'+encodeURIComponent(token)+'?origin='+encodeURIComponent(window.location.origin)+'&page='+encodeURIComponent(window.location.href)+'&title='+encodeURIComponent(document.title||'');
  frame.title='ModerateAI Website Widget';frame.style.width='100%';frame.style.height='100%';frame.style.border='0';frame.loading='lazy';
  panel.appendChild(frame);

  var btn=document.createElement('button');
  btn.type='button';btn.setAttribute('aria-label','Open chat widget');
  btn.style.width='58px';btn.style.height='58px';btn.style.borderRadius='50%';btn.style.border='1px solid rgba(96,165,250,.45)';
  btn.style.background='linear-gradient(145deg,#1d4ed8,#3b82f6)';btn.style.color='#fff';btn.style.boxShadow='0 16px 32px rgba(2,6,23,.45)';
  btn.style.cursor='pointer';btn.style.display='grid';btn.style.placeItems='center';
  btn.innerHTML='<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 10.5H16M8 14H13M7.8 20L4 21V6.8C4 5.81 4.81 5 5.8 5H18.2C19.19 5 20 5.81 20 6.8V17.2C20 18.19 19.19 19 18.2 19H9.6L7.8 20Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  var open=false;
  btn.addEventListener('click',function(){open=!open;panel.style.display=open?'block':'none';btn.style.transform=open?'scale(.96)':'scale(1)';});

  root.appendChild(panel);root.appendChild(btn);document.body.appendChild(root);
})();`;
}

export function registerWidgetRoutes(app: Express) {
  const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  };

  const requireWorkspaceRole = (required: WorkspaceRole) => {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      if (!hasWorkspaceRole(req.user as any, required)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      next();
    };
  };

  const patchConfigSchema = z.object({
    status: z.enum(["active", "inactive", "setup_required", "not_connected"]).optional(),
    domain: z.string().trim().max(255).optional().nullable(),
    config: z
      .object({
        widgetTitle: z.string().trim().min(1).max(120).optional(),
        welcomeMessage: z.string().trim().min(1).max(300).optional(),
        primaryColor: z.string().trim().min(3).max(20).optional(),
        position: z.enum(["bottom-right", "bottom-left"]).optional(),
        collectVisitorInfo: z.boolean().optional(),
        leadCaptureEnabled: z.boolean().optional(),
        leadPromptAfterMessages: z.number().int().min(1).max(12).optional(),
        leadPromptMessage: z.string().trim().min(1).max(240).optional(),
        requireLeadEmail: z.boolean().optional(),
        leadIntentPreset: z.enum(["conservative", "balanced", "aggressive"]).optional(),
        leadIntentScope: z.enum(["commercial", "commercial_and_escalation"]).optional(),
        allowedDomains: z.array(z.string().trim().min(1).max(255)).optional(),
      })
      .optional(),
  });

  const widgetChatSchema = z.object({
    message: z.string().trim().min(1).max(2000),
    sessionId: z.string().trim().min(2).max(120).optional(),
    sessionToken: z.string().trim().min(20).max(2048).optional(),
    origin: z.string().trim().max(500).optional(),
    pageUrl: z.string().trim().max(2000).optional(),
    pageTitle: z.string().trim().max(300).optional(),
    storageFallbackUsed: z.boolean().optional(),
    visitor: z
      .object({
        name: z.string().trim().max(120).optional(),
        email: z.string().trim().email().max(255).optional(),
      })
      .optional(),
  });

  const leadCaptureSchema = z.object({
    sessionId: z.string().trim().min(2).max(120).optional(),
    sessionToken: z.string().trim().min(20).max(2048).optional(),
    name: z.string().trim().max(120).optional(),
    email: z.string().trim().email().max(255).optional(),
    phone: z.string().trim().max(50).optional(),
    company: z.string().trim().max(120).optional(),
    notes: z.string().trim().max(1000).optional(),
    origin: z.string().trim().max(500).optional(),
    pageUrl: z.string().trim().max(2000).optional(),
    pageTitle: z.string().trim().max(300).optional(),
    storageFallbackUsed: z.boolean().optional(),
  });

  const leadStatusUpdateSchema = z.object({
    status: z.enum(LEAD_STATUS_VALUES as [LeadStatus, ...LeadStatus[]]),
  });

  app.get("/api/widget/config", authMiddleware, requireWorkspaceRole("admin"), async (req, res) => {
    try {
      const ownerId = getWorkspaceOwnerId(req.user as any);
      const platform = await ensureWebsitePlatform(ownerId);
      const ownerUser = ownerId === req.user!.id ? (req.user as any) : await storage.getUser(ownerId);
      if (!ownerUser) {
        return res.status(404).json({ message: "Workspace owner not found" });
      }
      const config = normalizeWidgetConfig(platform.config);
      const usage = await buildWidgetUsageSummary(ownerUser as any, config);
      const baseUrl = getRequestBaseUrl(req);
      const token = String(platform.authToken ?? "");

      return res.json({
        platformId: platform.id,
        status: platform.status,
        token,
        config,
        domain: config.allowedDomains[0] ?? null,
        scriptUrl: `${baseUrl}/widget/embed.js`,
        frameUrl: `${baseUrl}/widget/frame/${encodeURIComponent(token)}`,
        embedSnippet: buildEmbedSnippet(baseUrl, token, config.position),
        usage,
      });
    } catch (error: any) {
      console.error("Error fetching widget config:", error);
      return res.status(500).json({ message: error?.message || "Failed to fetch widget config" });
    }
  });

  app.get("/api/widget/usage", authMiddleware, requireWorkspaceRole("viewer"), async (req, res) => {
    try {
      const ownerId = getWorkspaceOwnerId(req.user as any);
      const platform = await ensureWebsitePlatform(ownerId);
      const ownerUser = ownerId === req.user!.id ? (req.user as any) : await storage.getUser(ownerId);
      if (!ownerUser) {
        return res.status(404).json({ message: "Workspace owner not found" });
      }

      const config = normalizeWidgetConfig(platform.config);
      const usage = await buildWidgetUsageSummary(ownerUser as any, config);

      return res.json({
        platformId: platform.id,
        status: platform.status,
        usage,
      });
    } catch (error: any) {
      console.error("Error fetching widget usage:", error);
      return res.status(500).json({ message: error?.message || "Failed to fetch widget usage" });
    }
  });

  app.patch("/api/widget/config", authMiddleware, requireWorkspaceRole("admin"), async (req, res) => {
    try {
      const parsed = patchConfigSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).message });
      }

      const ownerId = getWorkspaceOwnerId(req.user as any);
      const platform = await ensureWebsitePlatform(ownerId);
      const ownerUser = ownerId === req.user!.id ? (req.user as any) : await storage.getUser(ownerId);
      if (!ownerUser) {
        return res.status(404).json({ message: "Workspace owner not found" });
      }

      const patch = { ...(parsed.data.config ?? {}) } as Partial<WidgetConfig>;
      if (parsed.data.domain !== undefined) {
        const domain = parsed.data.domain ? normalizeDomainValue(parsed.data.domain) : null;
        patch.allowedDomains = domain ? [domain] : [];
      }

      const mergedConfig = mergeWidgetConfig(platform.config, patch);
      const entitlements = getEntitlementsForUser(ownerUser as any);
      const normalizedDomains = normalizeDestinationDomains(mergedConfig.allowedDomains);
      const websiteDomainLimit = entitlements.websiteDomainLimit;

      if (websiteDomainLimit !== null && normalizedDomains.length > websiteDomainLimit) {
        return res.status(402).json({
          code: "WEBSITE_DOMAIN_LIMIT_REACHED",
          limit: websiteDomainLimit,
          requested: normalizedDomains.length,
          message: buildWebsiteDomainLimitMessage(websiteDomainLimit),
        });
      }

      mergedConfig.allowedDomains = normalizedDomains;
      const payload: Record<string, unknown> = { config: mergedConfig };
      if (parsed.data.status) payload.status = parsed.data.status;

      const updated = await storage.updatePlatform(platform.id, payload as any);
      if (!updated) {
        return res.status(500).json({ message: "Failed to update widget config" });
      }

      await syncWebsiteDestinationConfigs(updated.id, mergedConfig.allowedDomains);
      const usage = await buildWidgetUsageSummary(ownerUser as any, mergedConfig);

      const baseUrl = getRequestBaseUrl(req);
      const token = String(updated.authToken ?? "");
      return res.json({
        platformId: updated.id,
        status: updated.status,
        token,
        config: mergedConfig,
        domain: mergedConfig.allowedDomains[0] ?? null,
        scriptUrl: `${baseUrl}/widget/embed.js`,
        frameUrl: `${baseUrl}/widget/frame/${encodeURIComponent(token)}`,
        embedSnippet: buildEmbedSnippet(baseUrl, token, mergedConfig.position),
        usage,
      });
    } catch (error: any) {
      console.error("Error updating widget config:", error);
      return res.status(500).json({ message: error?.message || "Failed to update widget config" });
    }
  });

  app.get("/api/widget/leads", authMiddleware, requireWorkspaceRole("moderator"), async (req, res) => {
    try {
      const ownerId = getWorkspaceOwnerId(req.user as any);
      const query = String(req.query.q ?? "").trim();
      const statusFilter = String(req.query.status ?? "").trim().toLowerCase();
      const limitRaw = Number(req.query.limit ?? 200);
      const limit = Number.isFinite(limitRaw) ? Math.min(500, Math.max(1, Math.round(limitRaw))) : 200;

      const filters: any[] = [eq(websiteLeads.userId, ownerId)];
      if (LEAD_STATUS_VALUES.includes(statusFilter as LeadStatus)) {
        filters.push(eq(websiteLeads.status, statusFilter));
      }
      if (query) {
        const q = `%${query}%`;
        filters.push(
          or(
            ilike(websiteLeads.fullName, q),
            ilike(websiteLeads.email, q),
            ilike(websiteLeads.company, q),
            ilike(websiteLeads.notes, q),
          ),
        );
      }

      const rows = await db
        .select()
        .from(websiteLeads)
        .where(and(...filters))
        .orderBy(desc(websiteLeads.createdAt))
        .limit(limit);

      return res.json(rows);
    } catch (error: any) {
      console.error("Error fetching widget leads:", error);
      return res.status(500).json({ message: error?.message || "Failed to fetch widget leads" });
    }
  });

  app.patch("/api/widget/leads/:id/status", authMiddleware, requireWorkspaceRole("admin"), async (req, res) => {
    try {
      const parsed = leadStatusUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).message });
      }

      const ownerId = getWorkspaceOwnerId(req.user as any);
      const leadId = Number.parseInt(req.params.id, 10);
      if (!Number.isFinite(leadId)) {
        return res.status(400).json({ message: "Invalid lead ID" });
      }

      const [updated] = await db
        .update(websiteLeads)
        .set({ status: parsed.data.status, updatedAt: new Date() })
        .where(and(eq(websiteLeads.id, leadId), eq(websiteLeads.userId, ownerId)))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: "Lead not found" });
      }

      return res.json(updated);
    } catch (error: any) {
      console.error("Error updating lead status:", error);
      return res.status(500).json({ message: error?.message || "Failed to update lead" });
    }
  });

  app.get("/api/widget/:token/bootstrap", widgetRateLimit("bootstrap"), async (req, res) => {
    try {
      const token = String(req.params.token ?? "").trim();
      if (!token) return res.status(400).json({ message: "Token is required" });

      const origin = String(req.query.origin ?? "").trim();
      const pageUrl = String(req.query.pageUrl ?? "").trim();
      const resolved = await resolveWidgetPlatformByToken(token, origin, pageUrl);
      if ("error" in resolved) {
        return res.status(resolved.status).json({ message: resolved.error });
      }

      const sessionId = sanitizeSessionId(req.query.sessionId) ?? generateSessionId();
      const issued = issueWidgetSessionToken({
        token,
        platformId: resolved.platform.id,
        ownerId: resolved.owner.id,
        resolvedHost: resolved.requestHost,
        sessionId,
      });
      recordOpsEvent(
        "WIDGET_SESSION_TOKEN_ISSUED",
        {
          ownerUserId: resolved.owner.id,
          platformId: resolved.platform.id,
          sessionId,
          resolvedHost: resolved.requestHost,
        },
        { bucketKey: `WIDGET_SESSION_TOKEN_ISSUED:${resolved.platform.id}` },
      );
      return res.json({
        sessionId,
        sessionToken: issued.sessionToken,
        sessionTokenExpiresAt: issued.sessionTokenExpiresAt,
        resolvedHost: resolved.requestHost,
        config: resolved.config,
      });
    } catch (error: any) {
      console.error("Error bootstrapping widget:", error);
      return res.status(500).json({ message: error?.message || "Failed to bootstrap widget" });
    }
  });

  app.post("/api/widget/:token/chat", widgetRateLimit("chat"), async (req, res) => {
    try {
      const token = String(req.params.token ?? "").trim();
      if (!token) return res.status(400).json({ message: "Token is required" });

      const parsed = widgetChatSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).message });
      }

      const origin = parsed.data.origin ?? "";
      const pageUrl = parsed.data.pageUrl ?? "";
      const resolved = await resolveWidgetPlatformByToken(token, origin, pageUrl);
      if ("error" in resolved) {
        return res.status(resolved.status).json({ message: resolved.error });
      }

      const sessionContext = resolveWidgetSessionContext({
        providedSessionId: parsed.data.sessionId,
        providedSessionToken: parsed.data.sessionToken,
        expectedToken: token,
        expectedPlatformId: resolved.platform.id,
        expectedOwnerId: resolved.owner.id,
        requestHost: resolved.requestHost,
      });
      if (!sessionContext.ok) {
        const sessionFailureCode =
          sessionContext.reason.includes("host_") || sessionContext.reason.includes("source_")
            ? "WIDGET_SOURCE_BINDING_REJECTED"
            : "WIDGET_SESSION_TOKEN_INVALID";
        recordOpsEvent(
          sessionFailureCode,
          {
            ownerUserId: resolved.owner.id,
            platformId: resolved.platform.id,
            reason: sessionContext.reason,
            requestHost: resolved.requestHost,
          },
          { bucketKey: `WIDGET_SESSION_VALIDATION:${resolved.platform.id}` },
        );
        return res.status(sessionContext.status).json({ message: sessionContext.message });
      }
      if (sessionContext.tokenSource === "legacy") {
        const hasProvidedToken =
          typeof parsed.data.sessionToken === "string" && parsed.data.sessionToken.trim().length > 0;
        if (hasProvidedToken) {
          recordOpsEvent(
            "WIDGET_SESSION_TOKEN_INVALID",
            {
              ownerUserId: resolved.owner.id,
              platformId: resolved.platform.id,
              reason: "invalid_but_legacy_fallback",
              requestHost: resolved.requestHost,
              sessionId: sessionContext.sessionId,
            },
            { bucketKey: `WIDGET_SESSION_TOKEN_INVALID:${resolved.platform.id}` },
          );
        }
      }
      if (parsed.data.storageFallbackUsed) {
        recordOpsEvent(
          "WIDGET_STORAGE_FALLBACK_USED",
          {
            ownerUserId: resolved.owner.id,
            platformId: resolved.platform.id,
            sessionId: sessionContext.sessionId,
            requestHost: resolved.requestHost,
          },
          { bucketKey: `WIDGET_STORAGE_FALLBACK_USED:${resolved.platform.id}` },
        );
      }

      const sessionId = sessionContext.sessionId;
      const visitorName = parsed.data.visitor?.name?.trim() || null;
      const visitorEmail = parsed.data.visitor?.email?.trim() || null;

      let [conversation] = await db
        .select()
        .from(conversations)
        .where(and(eq(conversations.platformId, resolved.platform.id), eq(conversations.externalUserId, sessionId)))
        .orderBy(desc(conversations.updatedAt))
        .limit(1);

      if (!conversation) {
        conversation = await storage.createConversation({
          platformId: resolved.platform.id,
          externalUserId: sessionId,
          externalUsername: visitorName ?? "Website Visitor",
          externalId: sessionId,
          status: "active",
        } as any);
      }

      await storage.createMessage({
        conversationId: conversation.id,
        content: parsed.data.message,
        sender: "user",
        metadata: {
          channel: "website_widget",
          origin: origin || null,
          pageUrl: pageUrl || null,
          pageTitle: parsed.data.pageTitle || null,
          visitorName,
          visitorEmail,
        },
      } as any);

      const kbRoute = await resolveWebsiteDomainChatConfig(resolved.platform.id, origin, pageUrl);
      const blockedResponse = async (
        reason: "domain_unmapped" | "knowledge_base_not_assigned" | "knowledge_base_unavailable",
        eventCode: "WIDGET_KB_ROUTE_UNMAPPED_DOMAIN" | "WIDGET_KB_ROUTE_NO_KB_ASSIGNED" | "WIDGET_KB_ROUTE_KB_UNAVAILABLE",
        details: Record<string, unknown> = {},
      ) => {
        recordOpsEvent(
          eventCode,
          {
            ownerUserId: resolved.owner.id,
            platformId: resolved.platform.id,
            requestHost: kbRoute.requestHost,
            mappedDomain: kbRoute.mappedDomain,
            sessionId,
            ...details,
          },
          { bucketKey: `${eventCode}:${resolved.platform.id}:${kbRoute.requestHost ?? "unknown"}` },
        );

        await storage.createMessage({
          conversationId: conversation.id,
          content: WIDGET_KB_SETUP_MESSAGE,
          sender: "system",
          metadata: {
            channel: "website_widget",
            reason,
            requestHost: kbRoute.requestHost,
            mappedDomain: kbRoute.mappedDomain,
            knowledgeBaseId: kbRoute.config?.knowledgeBaseId ?? null,
          },
        } as any);
        await storage.updateConversation(conversation.id, { updatedAt: new Date() } as any);

        const leadPrompt = buildLeadPromptPayload(resolved.config, "none", `kb_routing_blocked:${reason}`);
        recordOpsEvent(
          "WIDGET_LEAD_PROMPT_SUPPRESSED",
          {
            ownerUserId: resolved.owner.id,
            platformId: resolved.platform.id,
            sessionId,
            reason: leadPrompt.reason,
          },
          { bucketKey: `WIDGET_LEAD_PROMPT_SUPPRESSED:${resolved.platform.id}` },
        );

        return res.json({
          sessionId,
          sessionToken: sessionContext.sessionToken,
          sessionTokenExpiresAt: sessionContext.sessionTokenExpiresAt,
          resolvedHost: resolved.requestHost,
          conversationId: conversation.id,
          reply: WIDGET_KB_SETUP_MESSAGE,
          blockedByKbRouting: true,
          kbRouting: {
            blocked: true,
            reason,
            requestHost: kbRoute.requestHost,
            mappedDomain: kbRoute.mappedDomain,
            knowledgeBaseId: kbRoute.config?.knowledgeBaseId ?? null,
          },
          leadPrompt,
        });
      };

      if (!kbRoute.config) {
        return blockedResponse("domain_unmapped", "WIDGET_KB_ROUTE_UNMAPPED_DOMAIN");
      }

      const selectedKnowledgeBaseId = kbRoute.config.knowledgeBaseId;
      if (!selectedKnowledgeBaseId) {
        return blockedResponse("knowledge_base_not_assigned", "WIDGET_KB_ROUTE_NO_KB_ASSIGNED");
      }

      const selectedKnowledgeBase = await storage.getKnowledgeBase(selectedKnowledgeBaseId);
      if (
        !selectedKnowledgeBase ||
        selectedKnowledgeBase.userId !== resolved.owner.id ||
        !selectedKnowledgeBase.isActive
      ) {
        return blockedResponse("knowledge_base_unavailable", "WIDGET_KB_ROUTE_KB_UNAVAILABLE", {
          knowledgeBaseId: selectedKnowledgeBaseId,
          kbState: selectedKnowledgeBase
            ? selectedKnowledgeBase.userId !== resolved.owner.id
              ? "not_owned_by_workspace"
              : "inactive"
            : "missing",
        });
      }

      const selectedKnowledgeBaseDocuments = await storage.getKnowledgeDocumentsByKnowledgeBaseId(selectedKnowledgeBase.id);
      if (selectedKnowledgeBaseDocuments.length === 0) {
        return blockedResponse("knowledge_base_unavailable", "WIDGET_KB_ROUTE_KB_UNAVAILABLE", {
          knowledgeBaseId: selectedKnowledgeBase.id,
          kbState: "empty",
        });
      }

      const entitlements = getEntitlementsForUser(resolved.owner as any);
      const dailyLimit = Number(entitlements.aiResponsesPerDay ?? 0);
      if (Number.isFinite(dailyLimit) && dailyLimit > 0) {
        const now = new Date();
        const usedToday = await getWorkspaceAiResponsesToday(resolved.owner.id, now);
        if (usedToday >= dailyLimit) {
          recordOpsEvent("WIDGET_DAILY_QUOTA_REACHED", {
            ownerUserId: resolved.owner.id,
            plan: String((resolved.owner as any).plan ?? "free"),
            dailyLimit,
            usedToday,
          });

          const limitMessage = buildDailyAiLimitMessage(dailyLimit);
          await storage.createMessage({
            conversationId: conversation.id,
            content: limitMessage,
            sender: "system",
            metadata: {
              channel: "website_widget",
              reason: "daily_ai_limit_reached",
              dailyLimit,
              usedToday,
            },
          } as any);

          const leadPrompt = buildLeadPromptPayload(resolved.config, "none", "daily_quota_reached");
          recordOpsEvent(
            "WIDGET_LEAD_PROMPT_SUPPRESSED",
            {
              ownerUserId: resolved.owner.id,
              platformId: resolved.platform.id,
              sessionId,
              reason: leadPrompt.reason,
            },
            { bucketKey: `WIDGET_LEAD_PROMPT_SUPPRESSED:${resolved.platform.id}` },
          );

          return res.json({
            sessionId,
            sessionToken: sessionContext.sessionToken,
            sessionTokenExpiresAt: sessionContext.sessionTokenExpiresAt,
            resolvedHost: resolved.requestHost,
            conversationId: conversation.id,
            reply: limitMessage,
            limitReached: true,
            quota: {
              used: usedToday,
              limit: dailyLimit,
              retryAt: startOfNextLocalDay(now).toISOString(),
            },
            leadPrompt,
          });
        }
      }

      const convoMessages = await storage.getMessagesByConversationId(conversation.id);
      const history = convoMessages
        .filter((entry) => entry.sender === "user" || entry.sender === "ai")
        .slice(-16)
        .map((entry) => ({
          role: entry.sender === "ai" ? "assistant" : "user",
          content: entry.content,
        }));

      const aiConfig = await storage.getActiveAiConfiguration(resolved.platform.userId);
      const contextualInsights = await chatHistoryManager.getContextualInsights(
        kbRoute.config.id,
        parsed.data.message,
        { channel: "website_widget", requestHost: resolved.requestHost, pageUrl },
      );
      const insightPromptBlock = buildWidgetTrainingInsightsPrompt(contextualInsights);
      let reply = "Thanks for your message. Our team will follow up shortly.";

      try {
        reply = await generateKnowledgeBasedResponse(
          parsed.data.message,
          history,
          `${aiConfig?.systemPrompt || "You are a helpful website support assistant."}${insightPromptBlock}`,
          aiConfig?.responseStyle ?? 60,
          aiConfig?.responseLength ?? 55,
          resolved.platform.userId,
          selectedKnowledgeBase.id,
        );
      } catch (error) {
        console.error("Widget AI generation failed:", error);
      }

      await storage.createMessage({
        conversationId: conversation.id,
        content: reply,
        sender: "ai",
        metadata: { channel: "website_widget" },
      } as any);

      for (const insight of contextualInsights) {
        try {
          await chatHistoryManager.updateInsightMetrics(insight.id, true);
        } catch (metricError) {
          console.warn("Failed to update widget training insight metrics:", metricError);
        }
      }

      await storage.updateConversation(conversation.id, { updatedAt: new Date() } as any);

      const userMessageCount = convoMessages.filter((entry) => entry.sender === "user").length;
      const minimumGatePassed = userMessageCount >= resolved.config.leadPromptAfterMessages;

      const existingLead = await db
        .select({ id: websiteLeads.id })
        .from(websiteLeads)
        .where(and(eq(websiteLeads.platformId, resolved.platform.id), eq(websiteLeads.sessionId, sessionId)))
        .limit(1);

      let leadEligibility: EvaluateLeadPromptEligibilityResult | null = null;
      if (
        resolved.config.collectVisitorInfo &&
        resolved.config.leadCaptureEnabled &&
        minimumGatePassed &&
        existingLead.length === 0
      ) {
        leadEligibility = await evaluateLeadPromptEligibility({
          latestUserMessage: parsed.data.message,
          assistantReply: reply,
          recentHistory: history.slice(-8),
          intentScope: resolved.config.leadIntentScope,
        });
      }

      const leadPrompt = resolveLeadPromptMode({
        config: resolved.config,
        minimumGatePassed,
        hasExistingLead: existingLead.length > 0,
        eligibility: leadEligibility,
      });

      if (leadPrompt.mode === "form") {
        recordOpsEvent(
          "WIDGET_LEAD_PROMPT_FORM",
          {
            ownerUserId: resolved.owner.id,
            platformId: resolved.platform.id,
            sessionId,
            reason: leadPrompt.reason,
          },
          { bucketKey: `WIDGET_LEAD_PROMPT_FORM:${resolved.platform.id}` },
        );
      } else if (leadPrompt.mode === "cta") {
        recordOpsEvent(
          "WIDGET_LEAD_PROMPT_CTA",
          {
            ownerUserId: resolved.owner.id,
            platformId: resolved.platform.id,
            sessionId,
            reason: leadPrompt.reason,
          },
          { bucketKey: `WIDGET_LEAD_PROMPT_CTA:${resolved.platform.id}` },
        );
      } else {
        recordOpsEvent(
          "WIDGET_LEAD_PROMPT_SUPPRESSED",
          {
            ownerUserId: resolved.owner.id,
            platformId: resolved.platform.id,
            sessionId,
            reason: leadPrompt.reason,
          },
          { bucketKey: `WIDGET_LEAD_PROMPT_SUPPRESSED:${resolved.platform.id}` },
        );
      }

      return res.json({
        sessionId,
        sessionToken: sessionContext.sessionToken,
        sessionTokenExpiresAt: sessionContext.sessionTokenExpiresAt,
        resolvedHost: resolved.requestHost,
        conversationId: conversation.id,
        reply,
        leadPrompt,
      });
    } catch (error: any) {
      console.error("Error handling widget chat:", error);
      return res.status(500).json({ message: error?.message || "Failed to process widget chat" });
    }
  });

  app.post("/api/widget/:token/lead", widgetRateLimit("lead"), async (req, res) => {
    try {
      const token = String(req.params.token ?? "").trim();
      if (!token) return res.status(400).json({ message: "Token is required" });

      const parsed = leadCaptureSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).message });
      }

      const origin = parsed.data.origin ?? "";
      const pageUrl = parsed.data.pageUrl ?? "";
      const resolved = await resolveWidgetPlatformByToken(token, origin, pageUrl);
      if ("error" in resolved) {
        return res.status(resolved.status).json({ message: resolved.error });
      }

      const sessionContext = resolveWidgetSessionContext({
        providedSessionId: parsed.data.sessionId,
        providedSessionToken: parsed.data.sessionToken,
        expectedToken: token,
        expectedPlatformId: resolved.platform.id,
        expectedOwnerId: resolved.owner.id,
        requestHost: resolved.requestHost,
      });
      if (!sessionContext.ok) {
        const sessionFailureCode =
          sessionContext.reason.includes("host_") || sessionContext.reason.includes("source_")
            ? "WIDGET_SOURCE_BINDING_REJECTED"
            : "WIDGET_SESSION_TOKEN_INVALID";
        recordOpsEvent(
          sessionFailureCode,
          {
            ownerUserId: resolved.owner.id,
            platformId: resolved.platform.id,
            reason: sessionContext.reason,
            requestHost: resolved.requestHost,
          },
          { bucketKey: `WIDGET_SESSION_VALIDATION:${resolved.platform.id}` },
        );
        return res.status(sessionContext.status).json({ message: sessionContext.message });
      }
      if (sessionContext.tokenSource === "legacy") {
        const hasProvidedToken =
          typeof parsed.data.sessionToken === "string" && parsed.data.sessionToken.trim().length > 0;
        if (hasProvidedToken) {
          recordOpsEvent(
            "WIDGET_SESSION_TOKEN_INVALID",
            {
              ownerUserId: resolved.owner.id,
              platformId: resolved.platform.id,
              reason: "invalid_but_legacy_fallback",
              requestHost: resolved.requestHost,
              sessionId: sessionContext.sessionId,
            },
            { bucketKey: `WIDGET_SESSION_TOKEN_INVALID:${resolved.platform.id}` },
          );
        }
      }
      if (parsed.data.storageFallbackUsed) {
        recordOpsEvent(
          "WIDGET_STORAGE_FALLBACK_USED",
          {
            ownerUserId: resolved.owner.id,
            platformId: resolved.platform.id,
            sessionId: sessionContext.sessionId,
            requestHost: resolved.requestHost,
          },
          { bucketKey: `WIDGET_STORAGE_FALLBACK_USED:${resolved.platform.id}` },
        );
      }

      if (!resolved.config.leadCaptureEnabled) {
        return res.status(403).json({ message: "Lead capture is disabled for this widget" });
      }

      const providedSessionId = sanitizeSessionId(parsed.data.sessionId);
      if (WIDGET_REQUIRE_SESSION_ID_FOR_LEAD && !providedSessionId && sessionContext.tokenSource !== "signed") {
        return res.status(400).json({ message: "Session is required before submitting lead details" });
      }

      const fullName = parsed.data.name?.trim() || null;
      const email = parsed.data.email?.trim() || null;
      const phone = parsed.data.phone?.trim() || null;
      const company = parsed.data.company?.trim() || null;
      const notes = parsed.data.notes?.trim() || null;
      const sessionId = sessionContext.sessionId;

      if (!fullName && !email) {
        return res.status(400).json({ message: "Name or email is required" });
      }
      if (resolved.config.requireLeadEmail && !email) {
        return res.status(400).json({ message: "Email is required for this widget" });
      }

      const dedupSessionId = providedSessionId ?? (sessionContext.tokenSource === "signed" ? sessionContext.sessionId : null);
      const dedupWindowStart = new Date(Date.now() - WIDGET_LEAD_DEDUP_WINDOW_HOURS * 60 * 60 * 1000);
      const dedupFilters = [eq(websiteLeads.platformId, resolved.platform.id), gte(websiteLeads.createdAt, dedupWindowStart)];
      const canDedup = Boolean(dedupSessionId || email);
      if (dedupSessionId) {
        dedupFilters.push(eq(websiteLeads.sessionId, dedupSessionId));
      } else if (email) {
        dedupFilters.push(eq(websiteLeads.email, email));
      }

      let existingLead: any = null;
      if (canDedup) {
        [existingLead] = await db
          .select()
          .from(websiteLeads)
          .where(and(...dedupFilters))
          .orderBy(desc(websiteLeads.createdAt))
          .limit(1);
      }

      if (existingLead) {
        const leadUpdates: Record<string, unknown> = {};
        if (!existingLead.fullName && fullName) leadUpdates.fullName = fullName;
        if (!existingLead.email && email) leadUpdates.email = email;
        if (!existingLead.phone && phone) leadUpdates.phone = phone;
        if (!existingLead.company && company) leadUpdates.company = company;
        if (!existingLead.notes && notes) leadUpdates.notes = notes;
        if (!existingLead.sourceUrl && pageUrl) leadUpdates.sourceUrl = pageUrl;
        if (!existingLead.sourceTitle && parsed.data.pageTitle) leadUpdates.sourceTitle = parsed.data.pageTitle;

        if (Object.keys(leadUpdates).length > 0) {
          leadUpdates.updatedAt = new Date();
          const [updatedLead] = await db
            .update(websiteLeads)
            .set(leadUpdates)
            .where(eq(websiteLeads.id, existingLead.id))
            .returning();
          existingLead = updatedLead ?? existingLead;
        }

        recordOpsEvent(
          "WIDGET_LEAD_DEDUP_HIT",
          {
            ownerUserId: resolved.owner.id,
            platformId: resolved.platform.id,
            sessionId,
            leadId: existingLead.id,
          },
          { bucketKey: `WIDGET_LEAD_DEDUP_HIT:${resolved.platform.id}` },
        );

        return res.status(200).json({
          ...existingLead,
          deduplicated: true,
          sessionId,
          sessionToken: sessionContext.sessionToken,
          sessionTokenExpiresAt: sessionContext.sessionTokenExpiresAt,
          resolvedHost: resolved.requestHost,
        });
      }

      const [created] = await db
        .insert(websiteLeads)
        .values({
          userId: resolved.platform.userId,
          platformId: resolved.platform.id,
          sessionId,
          fullName,
          email,
          phone,
          company,
          notes,
          sourceUrl: pageUrl || null,
          sourceTitle: parsed.data.pageTitle || null,
          status: "new",
          metadata: { origin: origin || null },
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      if (resolved.owner.email) {
        const summary = [
          `Name: ${fullName ?? "n/a"}`,
          `Email: ${email ?? "n/a"}`,
          `Company: ${company ?? "n/a"}`,
          `Phone: ${phone ?? "n/a"}`,
          `URL: ${pageUrl || "n/a"}`,
          `Notes: ${notes ?? "n/a"}`,
        ].join("\\n");

        void sendEmail({
          to: resolved.owner.email,
          subject: "New website lead captured",
          text: `A new lead was captured from your widget.\\n\\n${summary}`,
        });
      }

      return res.status(201).json({
        ...created,
        deduplicated: false,
        sessionId,
        sessionToken: sessionContext.sessionToken,
        sessionTokenExpiresAt: sessionContext.sessionTokenExpiresAt,
        resolvedHost: resolved.requestHost,
      });
    } catch (error: any) {
      console.error("Error capturing widget lead:", error);
      return res.status(500).json({ message: error?.message || "Failed to capture lead" });
    }
  });

  app.get("/widget/embed.js", (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=300");
    res.type("application/javascript").send(buildEmbedScript());
  });

  app.get("/widget/frame/:token", (req, res) => {
    const token = String(req.params.token ?? "").trim();
    if (!token) return res.status(400).send("Missing token");
    res.setHeader("Cache-Control", "no-store");
    res.type("text/html").send(buildWidgetFrameHtml(token));
  });
}
