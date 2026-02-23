import { createHash } from "crypto";
import { lookup as dnsLookup } from "dns/promises";
import { isIP } from "net";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import {
  knowledgeBases,
  knowledgeDocuments,
  knowledgeUrlSources,
  knowledgeUrlSyncRuns,
  type KnowledgeDocument,
  type KnowledgeUrlSource,
} from "@shared/schema";
import { db } from "../db";
import { storage } from "../storage";
import { getEntitlementsForUser } from "../billing/entitlements";
import { recordOpsEvent } from "./ops-monitor";

type TriggerType = "manual" | "scheduled";
type RunStatus = "queued" | "running" | "success" | "partial" | "failed";
type SourceStatus = "active" | "paused" | "error";
type SyncMode = "manual" | "scheduled";
type ScheduleRecurrence = "daily" | "weekly";

export type NormalizedKnowledgeUrlSourceInput = {
  name: string | null;
  seedUrl: string;
  host: string;
  pathPrefix: string;
  status: SourceStatus;
  syncMode: SyncMode;
  scheduleRecurrence: ScheduleRecurrence | null;
  scheduleDaysOfWeek: number[] | null;
  scheduleTime: string | null;
  scheduleTimezone: string;
};

type ExtractedPage = {
  finalUrl: string;
  normalizedUrl: string;
  canonicalUrl: string | null;
  title: string;
  titleExtractedFrom: "title" | "h1" | "hostname";
  content: string;
  discoveredLinks: string[];
  contentHash: string;
  httpStatus: number;
  etag: string | null;
  lastModified: string | null;
};

type SyncPageSummary = {
  url: string;
  status: "created" | "updated" | "unchanged" | "skipped" | "error" | "stale";
  reason?: string;
};

type SyncRunMutableState = {
  discovered: Set<string>;
  fetched: number;
  created: number;
  updated: number;
  unchanged: number;
  stale: number;
  skipped: number;
  warnings: number;
  errors: number;
  pages: SyncPageSummary[];
  startedAtMs: number;
  stoppedForQuota: boolean;
  stoppedForQuotaMessage: string | null;
  stoppedForTimeLimit: boolean;
};

export type KnowledgeUrlSyncTriggerResult =
  | { status: "started"; runId: number | null; force: boolean; message: string }
  | { status: "already_running"; runId: number | null; message: string }
  | { status: "already_completed"; runId: number | null; message: string; canForce: true }
  | { status: "error"; message: string };

const DEFAULT_USER_AGENT = "ModerateAI-Bot/1.0 (+https://ModerateAI.com)";
const MAX_PAGE_SUMMARY_ITEMS = 200;
const MAX_PAGES_PER_RUN = parsePositiveIntEnv("KB_URL_SYNC_MAX_PAGES_PER_RUN", 200);
const MAX_DEPTH = parsePositiveIntEnv("KB_URL_SYNC_MAX_DEPTH", 4);
const MAX_RUN_MS = parsePositiveIntEnv("KB_URL_SYNC_MAX_RUN_MS", 5 * 60 * 1000);
const PAGE_TIMEOUT_MS = parsePositiveIntEnv("KB_URL_SYNC_PAGE_TIMEOUT_MS", 10_000);
const HTML_RESPONSE_MAX_BYTES = parsePositiveIntEnv("KB_URL_SYNC_HTML_MAX_BYTES", 2 * 1024 * 1024);
const SWEEP_INTERVAL_MS = parsePositiveIntEnv("KB_URL_SYNC_SWEEP_INTERVAL_MS", 60_000);
const SCHEDULER_ENABLED = parseBooleanEnv("KB_URL_SYNC_SCHEDULER_ENABLED", process.env.NODE_ENV !== "production");
const GLOBAL_CONCURRENCY = parsePositiveIntEnv("KB_URL_SYNC_GLOBAL_CONCURRENCY", 2);
const STARTUP_DELAY_MS = parsePositiveIntEnv("KB_URL_SYNC_STARTUP_DELAY_MS", 20_000);

const runningSourceIds = new Set<number>();
let sweepRunning = false;

const DISALLOWED_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const TRACKING_PARAM_PREFIXES = ["utm_"];
const TRACKING_PARAMS = new Set(["fbclid", "gclid", "msclkid"]);

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

export function normalizePathPrefix(input: string | undefined | null): string {
  const raw = String(input ?? "").trim();
  if (!raw) return "/";
  let value = raw.startsWith("/") ? raw : `/${raw}`;
  value = value.replace(/\/{2,}/g, "/");
  if (value.length > 1 && value.endsWith("/")) value = value.slice(0, -1);
  return value;
}

function sanitizeUrlPath(pathname: string): string {
  let path = pathname || "/";
  path = path.replace(/\/{2,}/g, "/");
  if (!path.startsWith("/")) path = `/${path}`;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return path;
}

export function isValidHhMm(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

function sanitizeScheduleDays(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  const unique = new Set<number>();
  for (const day of value) {
    const parsed = Number(day);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 6) continue;
    unique.add(parsed);
  }
  const arr = Array.from(unique).sort((a, b) => a - b);
  return arr.length > 0 ? arr : null;
}

export function isValidIanaTimezoneOrUtc(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function normalizeScheduleTimezone(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (raw && isValidIanaTimezoneOrUtc(raw)) return raw;
  return "UTC";
}

function stripTrackingParams(searchParams: URLSearchParams): URLSearchParams {
  const out = new URLSearchParams();
  for (const [key, val] of Array.from(searchParams.entries())) {
    const lowerKey = key.toLowerCase();
    if (TRACKING_PARAMS.has(lowerKey)) continue;
    if (TRACKING_PARAM_PREFIXES.some((prefix) => lowerKey.startsWith(prefix))) continue;
    out.append(key, val);
  }
  return out;
}

export function normalizeUrlForCrawl(input: string): string {
  const url = new URL(input);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only HTTP and HTTPS URLs are supported");
  }
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  url.pathname = sanitizeUrlPath(url.pathname);
  const filtered = stripTrackingParams(url.searchParams);
  url.search = filtered.toString() ? `?${filtered.toString()}` : "";
  return url.toString();
}

export function isHostAllowedForSource(url: URL, host: string, pathPrefix: string): boolean {
  if (url.hostname.toLowerCase() !== host.toLowerCase()) return false;
  const path = sanitizeUrlPath(url.pathname);
  if (pathPrefix === "/") return true;
  return path === pathPrefix || path.startsWith(`${pathPrefix}/`);
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return null;
  return (((parts[0] << 24) >>> 0) + ((parts[1] << 16) >>> 0) + ((parts[2] << 8) >>> 0) + (parts[3] >>> 0)) >>> 0;
}

function isPrivateIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return true;
  const inRange = (start: number, end: number) => n >= start && n <= end;
  return (
    inRange(ipv4ToInt("10.0.0.0")!, ipv4ToInt("10.255.255.255")!) ||
    inRange(ipv4ToInt("172.16.0.0")!, ipv4ToInt("172.31.255.255")!) ||
    inRange(ipv4ToInt("192.168.0.0")!, ipv4ToInt("192.168.255.255")!) ||
    inRange(ipv4ToInt("127.0.0.0")!, ipv4ToInt("127.255.255.255")!) ||
    inRange(ipv4ToInt("169.254.0.0")!, ipv4ToInt("169.254.255.255")!)
  );
}

function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("::ffff:127.") ||
    normalized.startsWith("::ffff:10.") ||
    normalized.startsWith("::ffff:192.168.") ||
    normalized.startsWith("::ffff:169.254.") ||
    /^::ffff:172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)
  );
}

async function assertSafeRemoteUrl(url: URL): Promise<void> {
  const hostname = url.hostname.toLowerCase();
  if (DISALLOWED_HOSTS.has(hostname)) throw new Error("Host is not allowed");
  if (hostname.endsWith(".local")) throw new Error("Local network hostnames are not allowed");

  const directIpVersion = isIP(hostname);
  if (directIpVersion === 4 && isPrivateIpv4(hostname)) throw new Error("Private IPv4 addresses are not allowed");
  if (directIpVersion === 6 && isPrivateIpv6(hostname)) throw new Error("Private IPv6 addresses are not allowed");

  const records = await dnsLookup(hostname, { all: true });
  if (!records.length) throw new Error("Host could not be resolved");
  for (const record of records) {
    if (record.family === 4 && isPrivateIpv4(record.address)) {
      throw new Error("Resolved host points to a private IPv4 address");
    }
    if (record.family === 6 && isPrivateIpv6(record.address)) {
      throw new Error("Resolved host points to a private IPv6 address");
    }
  }
}

type ExtractOptions = { timeoutMs?: number; userAgent?: string };

export async function extractUrlContentFromUrl(urlInput: string, opts: ExtractOptions = {}): Promise<ExtractedPage> {
  const normalizedInput = normalizeUrlForCrawl(urlInput);
  const parsedInput = new URL(normalizedInput);
  await assertSafeRemoteUrl(parsedInput);

  const response = await fetch(normalizedInput, {
    headers: { "User-Agent": opts.userAgent || DEFAULT_USER_AGENT, Accept: "text/html,*/*;q=0.8" },
    redirect: "follow",
    signal: AbortSignal.timeout(opts.timeoutMs ?? PAGE_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch content: ${response.status} ${response.statusText}`);
  }

  const finalUrl = new URL(normalizeUrlForCrawl(response.url || normalizedInput));
  await assertSafeRemoteUrl(finalUrl);

  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  if (!contentType.includes("text/html")) {
    throw new Error(`Non-HTML content skipped (${contentType || "unknown content-type"})`);
  }

  const contentLength = Number.parseInt(String(response.headers.get("content-length") || ""), 10);
  if (Number.isFinite(contentLength) && contentLength > HTML_RESPONSE_MAX_BYTES) {
    throw new Error(`HTML response too large (${contentLength} bytes)`);
  }
  const html = await response.text();
  if (Buffer.byteLength(html, "utf8") > HTML_RESPONSE_MAX_BYTES) {
    throw new Error("HTML response exceeded size limit");
  }

  const { parse } = await import("node-html-parser");
  const root = parse(html);

  let titleSource: "title" | "h1" | "hostname" = "hostname";
  let title = root.querySelector("title")?.text?.trim() || "";
  if (title) titleSource = "title";
  if (!title) {
    const h1 = root.querySelector("h1")?.text?.trim();
    if (h1) {
      title = h1;
      titleSource = "h1";
    } else {
      title = `Content from ${finalUrl.hostname}`;
    }
  }

  root.querySelectorAll("script, style, nav, footer, header").forEach((el) => el.remove());

  const mainSelectors = ["main", "article", '[role="main"]', ".content", "#content", ".post", ".article"];
  let mainContent: any = null;
  for (const selector of mainSelectors) {
    mainContent = root.querySelector(selector);
    if (mainContent) break;
  }
  if (!mainContent) {
    const bodyContent = root.querySelector("body");
    if (bodyContent) {
      bodyContent
        .querySelectorAll("header, nav, aside, footer, .nav, .navbar, .menu, .sidebar, .advertisement, .ads")
        .forEach((el) => el.remove());
      mainContent = bodyContent;
    } else {
      mainContent = root;
    }
  }

  let content = "";
  if (mainContent) {
    const contentElements = mainContent.querySelectorAll(
      "h1, h2, h3, h4, h5, h6, p, div, li, td, th, blockquote, article, section",
    );
    const textParts: string[] = [];
    const processedTexts = new Set<string>();
    contentElements.forEach((el: any) => {
      const text = String(el.text ?? "").trim();
      if (!text || text.length <= 10 || processedTexts.has(text)) return;
      const isSubtext = textParts.some((existingText) => existingText.includes(text));
      if (isSubtext) return;
      processedTexts.add(text);
      textParts.push(text);
    });
    content = textParts.join("\n\n");
    if (!content || content.length < 50) content = String(mainContent.text ?? "");
  }

  content = content
    .replace(/\s+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/([.!?])\s*([A-Z])/g, "$1\n\n$2")
    .trim();

  if (content.length > 20_000) {
    content = `${content.substring(0, 20_000)}\n\n[Content truncated due to length - extracted first 20,000 characters]`;
  }
  if (!content || content.length < 20) {
    throw new Error(
      "Could not extract meaningful content from the webpage. The page might be heavily JavaScript-dependent or have restricted access.",
    );
  }

  const canonicalHref = root.querySelector('link[rel="canonical"]')?.getAttribute("href");
  let canonicalUrl: string | null = null;
  if (canonicalHref) {
    try {
      canonicalUrl = normalizeUrlForCrawl(new URL(canonicalHref, finalUrl).toString());
    } catch {
      canonicalUrl = null;
    }
  }

  const discoveredLinks = root
    .querySelectorAll("a[href]")
    .map((el: any) => String(el.getAttribute("href") ?? "").trim())
    .filter(Boolean)
    .map((href: string) => {
      try {
        return new URL(href, finalUrl).toString();
      } catch {
        return null;
      }
    })
    .filter((u: string | null): u is string => !!u);

  return {
    finalUrl: finalUrl.toString(),
    normalizedUrl: finalUrl.toString(),
    canonicalUrl,
    title,
    titleExtractedFrom: titleSource,
    content,
    discoveredLinks,
    contentHash: createHash("sha256").update(`${title}\n${content}`, "utf8").digest("hex"),
    httpStatus: response.status,
    etag: response.headers.get("etag"),
    lastModified: response.headers.get("last-modified"),
  };
}

export function normalizeKnowledgeUrlSourceInput(input: {
  seedUrl?: unknown;
  pathPrefix?: unknown;
  name?: unknown;
  status?: unknown;
  syncMode?: unknown;
  scheduleRecurrence?: unknown;
  scheduleDaysOfWeek?: unknown;
  scheduleTime?: unknown;
  scheduleTimezone?: unknown;
}): NormalizedKnowledgeUrlSourceInput {
  const seedRaw = String(input.seedUrl ?? "").trim();
  if (!seedRaw) throw new Error("seedUrl is required");
  const normalizedSeedUrl = normalizeUrlForCrawl(seedRaw);
  const seedUrl = new URL(normalizedSeedUrl);
  const host = seedUrl.hostname.toLowerCase();
  const pathPrefix = normalizePathPrefix(input.pathPrefix as string | undefined);
  if (!isHostAllowedForSource(seedUrl, host, pathPrefix)) {
    throw new Error("seedUrl must be under the configured pathPrefix on the same host");
  }

  const status = String(input.status ?? "active") as SourceStatus;
  if (!["active", "paused", "error"].includes(status)) throw new Error("Invalid source status");
  const syncMode = String(input.syncMode ?? "manual") as SyncMode;
  if (!["manual", "scheduled"].includes(syncMode)) throw new Error("Invalid syncMode");
  let scheduleRecurrence = input.scheduleRecurrence == null ? null : (String(input.scheduleRecurrence) as ScheduleRecurrence);
  if (scheduleRecurrence !== null && !["daily", "weekly"].includes(scheduleRecurrence)) {
    throw new Error("scheduleRecurrence must be daily or weekly");
  }
  let scheduleDaysOfWeek = sanitizeScheduleDays(input.scheduleDaysOfWeek);
  let scheduleTime = input.scheduleTime == null ? null : String(input.scheduleTime).trim();
  if (scheduleTime && !isValidHhMm(scheduleTime)) throw new Error("scheduleTime must be HH:mm");
  const scheduleTimezone = normalizeScheduleTimezone(input.scheduleTimezone);

  if (syncMode === "scheduled") {
    if (!scheduleRecurrence) throw new Error("scheduleRecurrence is required for scheduled sources");
    if (!scheduleTime) throw new Error("scheduleTime is required for scheduled sources");
    if (scheduleRecurrence === "weekly" && (!scheduleDaysOfWeek || scheduleDaysOfWeek.length === 0)) {
      throw new Error("scheduleDaysOfWeek is required for weekly scheduled sources");
    }
    if (scheduleRecurrence === "daily") scheduleDaysOfWeek = null;
  } else {
    scheduleRecurrence = null;
    scheduleDaysOfWeek = null;
    scheduleTime = null;
  }

  const label = (() => {
    const raw = String(input.name ?? "").trim();
    if (raw) return raw;
    return `${host}${pathPrefix}`;
  })();

  return {
    name: label,
    seedUrl: normalizedSeedUrl,
    host,
    pathPrefix,
    status,
    syncMode,
    scheduleRecurrence,
    scheduleDaysOfWeek,
    scheduleTime,
    scheduleTimezone,
  };
}

// --- sync engine and scheduler functions are appended below ---

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0=Sun..6=Sat
};

function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = fmt.formatToParts(date);
  const byType = new Map(parts.map((p) => [p.type, p.value]));
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    year: Number(byType.get("year")),
    month: Number(byType.get("month")),
    day: Number(byType.get("day")),
    hour: Number(byType.get("hour")),
    minute: Number(byType.get("minute")),
    weekday: weekdayMap[String(byType.get("weekday"))] ?? 0,
  };
}

function localDateKey(parts: ZonedParts): string {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function parseHhMm(time: string): { hour: number; minute: number } {
  const [h, m] = time.split(":").map((n) => Number.parseInt(n, 10));
  return { hour: h, minute: m };
}

function isSourceDue(source: KnowledgeUrlSource, now: Date): boolean {
  if (source.status !== "active" || source.syncMode !== "scheduled") return false;
  const recurrence = (source.scheduleRecurrence as ScheduleRecurrence | null) ?? null;
  const scheduleTime = source.scheduleTime ?? null;
  if (!recurrence || !scheduleTime || !isValidHhMm(scheduleTime)) return false;
  const timeZone = source.scheduleTimezone || "UTC";
  const nowParts = getZonedParts(now, timeZone);
  const { hour, minute } = parseHhMm(scheduleTime);
  const isPastTime = nowParts.hour > hour || (nowParts.hour === hour && nowParts.minute >= minute);
  if (!isPastTime) return false;

  if (recurrence === "weekly") {
    const days = Array.isArray(source.scheduleDaysOfWeek) ? (source.scheduleDaysOfWeek as number[]) : [];
    if (!days.includes(nowParts.weekday)) return false;
  }

  if (!source.lastRunAt) return true;
  const lastParts = getZonedParts(new Date(source.lastRunAt), timeZone);
  return localDateKey(lastParts) !== localDateKey(nowParts);
}

function buildCrawlPageKey(page: ExtractedPage): string {
  return page.canonicalUrl || page.normalizedUrl;
}

function safeDocMetadata(meta: unknown): Record<string, any> {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return {};
  return { ...(meta as Record<string, any>) };
}

function getDocCrawlSourceId(doc: KnowledgeDocument): number | null {
  const metadata = safeDocMetadata(doc.metadata);
  const value = metadata.crawlSourceId;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getDocCrawlPageKey(doc: KnowledgeDocument): string | null {
  const metadata = safeDocMetadata(doc.metadata);
  const value = metadata.crawlPageKey;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function getWorkspaceKbUsageBytes(workspaceOwnerId: number): Promise<number> {
  const rows = await db
    .select({
      bytes: sql<number>`coalesce(sum(octet_length(${knowledgeDocuments.content}) + octet_length(${knowledgeDocuments.title})), 0)`,
    })
    .from(knowledgeDocuments)
    .innerJoin(knowledgeBases, eq(knowledgeDocuments.knowledgeBaseId, knowledgeBases.id))
    .where(eq(knowledgeBases.userId, workspaceOwnerId));
  return Number(rows[0]?.bytes ?? 0);
}

function pushPageSummary(state: SyncRunMutableState, item: SyncPageSummary) {
  if (state.pages.length < MAX_PAGE_SUMMARY_ITEMS) state.pages.push(item);
}

function isQuotaExceeded(limitBytes: number | null, usedBytes: number, deltaBytes: number): boolean {
  if (limitBytes === null) return false;
  return usedBytes + deltaBytes > limitBytes;
}

async function upsertCrawledDocumentsForSource(
  source: KnowledgeUrlSource,
  pages: ExtractedPage[],
  state: SyncRunMutableState,
): Promise<void> {
  const ownerUser = await storage.getUser(source.workspaceOwnerId);
  const entitlements = getEntitlementsForUser(ownerUser as any);
  const limitMb = entitlements.knowledgeBaseMb;
  const limitBytes = limitMb === null ? null : limitMb * 1024 * 1024;
  let usedBytes = await getWorkspaceKbUsageBytes(source.workspaceOwnerId);

  const existingDocs = await storage.getKnowledgeDocumentsByKnowledgeBaseId(source.knowledgeBaseId);
  const sourceDocs = existingDocs.filter((doc) => getDocCrawlSourceId(doc) === source.id);
  const byPageKey = new Map<string, KnowledgeDocument>();
  for (const doc of sourceDocs) {
    const pageKey = getDocCrawlPageKey(doc);
    if (pageKey) byPageKey.set(pageKey, doc);
  }

  const nowIso = new Date().toISOString();
  const seenPageKeys = new Set<string>();

  for (const page of pages) {
    const pageKey = buildCrawlPageKey(page);
    seenPageKeys.add(pageKey);
    const existing = byPageKey.get(pageKey);
    const sourceUrl = page.finalUrl;

    const nextMetadata = {
      ...(existing ? safeDocMetadata(existing.metadata) : {}),
      sourceType: "url_crawl",
      sourceUrl,
      normalizedUrl: page.normalizedUrl,
      canonicalUrl: page.canonicalUrl,
      crawlSourceId: source.id,
      crawlPageKey: pageKey,
      syncStatus: "active",
      lastFetchedAt: nowIso,
      lastSeenAt: nowIso,
      etag: page.etag,
      lastModified: page.lastModified,
      contentHash: page.contentHash,
      httpStatus: page.httpStatus,
      titleExtractedFrom: page.titleExtractedFrom,
      parserVersion: "url-sync-v1",
    };

    if (!existing) {
      const incomingBytes = Buffer.byteLength(page.title, "utf8") + Buffer.byteLength(page.content, "utf8");
      if (isQuotaExceeded(limitBytes, usedBytes, incomingBytes)) {
        state.stoppedForQuota = true;
        state.stoppedForQuotaMessage = `Knowledge base storage limit reached for your plan${limitMb ? ` (${limitMb}MB)` : ""}.`;
        pushPageSummary(state, { url: sourceUrl, status: "skipped", reason: "quota_limit_reached" });
        state.warnings += 1;
        break;
      }
      await storage.createKnowledgeDocument({
        knowledgeBaseId: source.knowledgeBaseId,
        title: page.title,
        content: page.content,
        metadata: nextMetadata,
      });
      usedBytes += incomingBytes;
      state.created += 1;
      pushPageSummary(state, { url: sourceUrl, status: "created" });
      continue;
    }

    const existingMetadata = safeDocMetadata(existing.metadata);
    const existingHash = typeof existingMetadata.contentHash === "string" ? existingMetadata.contentHash : null;
    const shouldUpdate =
      existing.title !== page.title ||
      existing.content !== page.content ||
      existingMetadata.syncStatus !== "active" ||
      existingHash !== page.contentHash;

    if (shouldUpdate) {
      const oldBytes =
        Buffer.byteLength(String(existing.title ?? ""), "utf8") + Buffer.byteLength(String(existing.content ?? ""), "utf8");
      const newBytes = Buffer.byteLength(page.title, "utf8") + Buffer.byteLength(page.content, "utf8");
      const delta = Math.max(0, newBytes - oldBytes);
      if (isQuotaExceeded(limitBytes, usedBytes, delta)) {
        state.stoppedForQuota = true;
        state.stoppedForQuotaMessage = `Knowledge base storage limit reached for your plan${limitMb ? ` (${limitMb}MB)` : ""}.`;
        pushPageSummary(state, { url: sourceUrl, status: "skipped", reason: "quota_limit_reached" });
        state.warnings += 1;
        break;
      }
      await storage.updateKnowledgeDocument(existing.id, {
        title: page.title,
        content: page.content,
        metadata: nextMetadata,
      } as any);
      usedBytes = Math.max(0, usedBytes - oldBytes) + newBytes;
      state.updated += 1;
      pushPageSummary(state, { url: sourceUrl, status: "updated" });
    } else {
      await storage.updateKnowledgeDocument(existing.id, { metadata: nextMetadata } as any);
      state.unchanged += 1;
      pushPageSummary(state, { url: sourceUrl, status: "unchanged" });
    }
  }

  for (const doc of sourceDocs) {
    const pageKey = getDocCrawlPageKey(doc);
    if (!pageKey || seenPageKeys.has(pageKey)) continue;
    const metadata = safeDocMetadata(doc.metadata);
    if (metadata.syncStatus === "stale") continue;
    await storage.updateKnowledgeDocument(doc.id, {
      metadata: {
        ...metadata,
        sourceType: "url_crawl",
        crawlSourceId: source.id,
        syncStatus: "stale",
        lastFetchedAt: nowIso,
        parserVersion: "url-sync-v1",
      },
    } as any);
    state.stale += 1;
    pushPageSummary(state, { url: String(metadata.sourceUrl || doc.title || `doc:${doc.id}`), status: "stale" });
    recordOpsEvent("KB_URL_SYNC_PAGE_MARKED_STALE", {
      sourceId: source.id,
      knowledgeBaseId: source.knowledgeBaseId,
      workspaceOwnerId: source.workspaceOwnerId,
    });
  }
}

async function crawlSourcePages(source: KnowledgeUrlSource, state: SyncRunMutableState): Promise<ExtractedPage[]> {
  const pages: ExtractedPage[] = [];
  const queued = new Set<string>();
  const queue: Array<{ url: string; depth: number }> = [{ url: source.seedUrl, depth: 0 }];
  queued.add(source.seedUrl);
  state.discovered.add(source.seedUrl);

  while (queue.length > 0) {
    if (pages.length >= MAX_PAGES_PER_RUN) break;
    if (Date.now() - state.startedAtMs > MAX_RUN_MS) {
      state.stoppedForTimeLimit = true;
      break;
    }

    const current = queue.shift()!;
    if (current.depth > MAX_DEPTH) continue;

    try {
      const page = await extractUrlContentFromUrl(current.url, { timeoutMs: PAGE_TIMEOUT_MS, userAgent: DEFAULT_USER_AGENT });
      if (!isHostAllowedForSource(new URL(page.finalUrl), source.host, source.pathPrefix)) {
        state.skipped += 1;
        state.warnings += 1;
        pushPageSummary(state, { url: current.url, status: "skipped", reason: "outside_scope_after_redirect" });
        continue;
      }
      pages.push(page);
      state.fetched += 1;

      for (const rawLink of page.discoveredLinks) {
        try {
          const normalized = normalizeUrlForCrawl(rawLink);
          const parsed = new URL(normalized);
          if (!isHostAllowedForSource(parsed, source.host, source.pathPrefix)) continue;
          if (queued.has(normalized)) continue;
          if (current.depth + 1 > MAX_DEPTH) continue;
          queue.push({ url: normalized, depth: current.depth + 1 });
          queued.add(normalized);
          state.discovered.add(normalized);
        } catch {
          continue;
        }
      }
    } catch (error: any) {
      const message = String(error?.message || "unknown error");
      if (message.toLowerCase().includes("non-html")) {
        state.skipped += 1;
        state.warnings += 1;
        pushPageSummary(state, { url: current.url, status: "skipped", reason: message });
        recordOpsEvent("KB_URL_SYNC_PAGE_SKIPPED_NON_HTML", {
          sourceId: source.id,
          knowledgeBaseId: source.knowledgeBaseId,
          workspaceOwnerId: source.workspaceOwnerId,
          url: current.url,
        });
      } else {
        state.errors += 1;
        pushPageSummary(state, { url: current.url, status: "error", reason: message });
        recordOpsEvent("KB_URL_SYNC_PAGE_FETCH_FAILED", {
          sourceId: source.id,
          knowledgeBaseId: source.knowledgeBaseId,
          workspaceOwnerId: source.workspaceOwnerId,
          url: current.url,
          error: message,
        });
      }
    }
  }

  return pages;
}

async function updateRunAndSourceCompletion(
  source: KnowledgeUrlSource,
  runId: number,
  status: RunStatus,
  state: SyncRunMutableState,
  extraError?: string | null,
) {
  const summary = {
    pages: state.pages,
    stoppedForQuota: state.stoppedForQuota,
    stoppedForQuotaMessage: state.stoppedForQuotaMessage,
    stoppedForTimeLimit: state.stoppedForTimeLimit,
  };
  const completedAt = new Date();

  await db
    .update(knowledgeUrlSyncRuns)
    .set({
      status,
      completedAt,
      pagesDiscovered: state.discovered.size,
      pagesFetched: state.fetched,
      pagesCreated: state.created,
      pagesUpdated: state.updated,
      pagesUnchanged: state.unchanged,
      pagesMarkedStale: state.stale,
      pagesSkipped: state.skipped,
      errorsCount: state.errors,
      warningsCount: state.warnings,
      summary,
      updatedAt: completedAt,
    })
    .where(eq(knowledgeUrlSyncRuns.id, runId));

  await db
    .update(knowledgeUrlSources)
    .set({
      lastRunAt: completedAt,
      lastSuccessAt: status === "success" || status === "partial" ? completedAt : source.lastSuccessAt,
      lastRunStatus: status === "queued" || status === "running" ? "failed" : status,
      lastError: extraError ?? state.stoppedForQuotaMessage ?? (status === "failed" ? "Sync failed" : null),
      status: status === "failed" ? "error" : source.status,
      updatedAt: completedAt,
    })
    .where(eq(knowledgeUrlSources.id, source.id));
}

async function createRunForSource(source: KnowledgeUrlSource, triggerType: TriggerType, triggeredByUserId: number | null) {
  const now = new Date();
  const [run] = await db
    .insert(knowledgeUrlSyncRuns)
    .values({
      sourceId: source.id,
      knowledgeBaseId: source.knowledgeBaseId,
      workspaceOwnerId: source.workspaceOwnerId,
      triggeredByUserId,
      triggerType,
      status: "queued",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return run;
}

async function setRunRunning(runId: number) {
  const now = new Date();
  await db
    .update(knowledgeUrlSyncRuns)
    .set({ status: "running", startedAt: now, updatedAt: now })
    .where(eq(knowledgeUrlSyncRuns.id, runId));
}

async function executeSourceSync(sourceId: number, triggerType: TriggerType, triggeredByUserId: number | null): Promise<void> {
  const [source] = await db.select().from(knowledgeUrlSources).where(eq(knowledgeUrlSources.id, sourceId)).limit(1);
  if (!source) {
    runningSourceIds.delete(sourceId);
    return;
  }

  const run = await createRunForSource(source, triggerType, triggeredByUserId);
  recordOpsEvent("KB_URL_SYNC_RUN_STARTED", {
    sourceId: source.id,
    knowledgeBaseId: source.knowledgeBaseId,
    workspaceOwnerId: source.workspaceOwnerId,
    triggerType,
    runId: run.id,
  });

  const state: SyncRunMutableState = {
    discovered: new Set(),
    fetched: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    stale: 0,
    skipped: 0,
    warnings: 0,
    errors: 0,
    pages: [],
    startedAtMs: Date.now(),
    stoppedForQuota: false,
    stoppedForQuotaMessage: null,
    stoppedForTimeLimit: false,
  };

  try {
    await setRunRunning(run.id);
    const pages = await crawlSourcePages(source, state);
    await upsertCrawledDocumentsForSource(source, pages, state);

    const finalStatus: RunStatus =
      state.errors > 0 && state.fetched === 0
        ? "failed"
        : state.stoppedForQuota || state.stoppedForTimeLimit || state.errors > 0
          ? "partial"
          : "success";

    await updateRunAndSourceCompletion(source, run.id, finalStatus, state, null);

    if (finalStatus === "success" || finalStatus === "partial") {
      recordOpsEvent("KB_URL_SYNC_RUN_COMPLETED", {
        sourceId: source.id,
        knowledgeBaseId: source.knowledgeBaseId,
        workspaceOwnerId: source.workspaceOwnerId,
        triggerType,
        runId: run.id,
        pagesCreated: state.created,
        pagesUpdated: state.updated,
        pagesUnchanged: state.unchanged,
        pagesMarkedStale: state.stale,
        pagesSkipped: state.skipped,
        errorsCount: state.errors,
        warningsCount: state.warnings,
        status: finalStatus,
      });
      if (state.stoppedForQuota) {
        recordOpsEvent("KB_URL_SYNC_QUOTA_LIMIT_REACHED", {
          sourceId: source.id,
          knowledgeBaseId: source.knowledgeBaseId,
          workspaceOwnerId: source.workspaceOwnerId,
          runId: run.id,
        });
      }
    } else {
      recordOpsEvent("KB_URL_SYNC_RUN_FAILED", {
        sourceId: source.id,
        knowledgeBaseId: source.knowledgeBaseId,
        workspaceOwnerId: source.workspaceOwnerId,
        triggerType,
        runId: run.id,
      });
    }
  } catch (error: any) {
    const message = String(error?.message || "Sync failed");
    state.errors += 1;
    await updateRunAndSourceCompletion(source, run.id, "failed", state, message);
    recordOpsEvent("KB_URL_SYNC_RUN_FAILED", {
      sourceId: source.id,
      knowledgeBaseId: source.knowledgeBaseId,
      workspaceOwnerId: source.workspaceOwnerId,
      triggerType,
      runId: run.id,
      error: message,
    });
  } finally {
    runningSourceIds.delete(sourceId);
  }
}

export async function triggerKnowledgeUrlSourceSync(
  sourceId: number,
  options: { triggerType: TriggerType; triggeredByUserId: number | null } = { triggerType: "manual", triggeredByUserId: null },
): Promise<KnowledgeUrlSyncTriggerResult> {
  if (runningSourceIds.has(sourceId)) {
    const [latestRun] = await db
      .select()
      .from(knowledgeUrlSyncRuns)
      .where(eq(knowledgeUrlSyncRuns.sourceId, sourceId))
      .orderBy(desc(knowledgeUrlSyncRuns.createdAt))
      .limit(1);
    return {
      status: "already_running",
      runId: latestRun?.id ?? null,
      message: "A sync is already running for this source.",
    };
  }

  const [source] = await db.select().from(knowledgeUrlSources).where(eq(knowledgeUrlSources.id, sourceId)).limit(1);
  if (!source) return { status: "error", message: "URL source not found" };

  runningSourceIds.add(sourceId);
  void executeSourceSync(sourceId, options.triggerType, options.triggeredByUserId);
  return { status: "started", runId: null, force: false, message: "URL sync started." };
}

export async function getKnowledgeUrlSourceById(sourceId: number): Promise<KnowledgeUrlSource | undefined> {
  const [source] = await db.select().from(knowledgeUrlSources).where(eq(knowledgeUrlSources.id, sourceId)).limit(1);
  return source;
}

export async function getKnowledgeUrlSourcesForKnowledgeBase(
  knowledgeBaseId: number,
  workspaceOwnerId: number,
): Promise<Array<KnowledgeUrlSource & { latestRun?: any | null }>> {
  const sources = await db
    .select()
    .from(knowledgeUrlSources)
    .where(and(eq(knowledgeUrlSources.knowledgeBaseId, knowledgeBaseId), eq(knowledgeUrlSources.workspaceOwnerId, workspaceOwnerId)))
    .orderBy(desc(knowledgeUrlSources.updatedAt));

  if (sources.length === 0) return [];

  const runs = await db
    .select()
    .from(knowledgeUrlSyncRuns)
    .where(
      and(
        eq(knowledgeUrlSyncRuns.knowledgeBaseId, knowledgeBaseId),
        eq(knowledgeUrlSyncRuns.workspaceOwnerId, workspaceOwnerId),
      ),
    )
    .orderBy(desc(knowledgeUrlSyncRuns.createdAt));

  const latestBySource = new Map<number, any>();
  for (const run of runs) {
    if (!latestBySource.has(run.sourceId)) latestBySource.set(run.sourceId, run);
  }
  return sources.map((source) => ({ ...source, latestRun: latestBySource.get(source.id) ?? null }));
}

export async function getKnowledgeUrlSyncRunsBySourceId(sourceId: number, limit = 20): Promise<any[]> {
  return db
    .select()
    .from(knowledgeUrlSyncRuns)
    .where(eq(knowledgeUrlSyncRuns.sourceId, sourceId))
    .orderBy(desc(knowledgeUrlSyncRuns.createdAt))
    .limit(limit);
}

export async function getKnowledgeUrlSyncRunById(runId: number): Promise<any | undefined> {
  const [run] = await db.select().from(knowledgeUrlSyncRuns).where(eq(knowledgeUrlSyncRuns.id, runId)).limit(1);
  return run;
}

async function runDueKnowledgeUrlSyncSweep(): Promise<{ processed: number; started: number }> {
  if (sweepRunning) return { processed: 0, started: 0 };
  sweepRunning = true;
  try {
    const now = new Date();
    const candidateSources = await db
      .select()
      .from(knowledgeUrlSources)
      .where(and(eq(knowledgeUrlSources.status, "active"), eq(knowledgeUrlSources.syncMode, "scheduled")))
      .orderBy(asc(knowledgeUrlSources.id));

    let processed = 0;
    let started = 0;
    let remainingGlobal = GLOBAL_CONCURRENCY;
    for (const source of candidateSources) {
      processed += 1;
      if (remainingGlobal <= 0) break;
      if (runningSourceIds.has(source.id)) continue;
      if (!isSourceDue(source, now)) continue;
      const result = await triggerKnowledgeUrlSourceSync(source.id, { triggerType: "scheduled", triggeredByUserId: null });
      if (result.status === "started") {
        started += 1;
        remainingGlobal -= 1;
      }
    }
    return { processed, started };
  } finally {
    sweepRunning = false;
  }
}

export function scheduleKnowledgeUrlSyncSweep(logFn: (line: string) => void): NodeJS.Timeout | null {
  if (!SCHEDULER_ENABLED) {
    logFn("knowledge url sync scheduler: disabled");
    return null;
  }

  const run = async () => {
    try {
      const result = await runDueKnowledgeUrlSyncSweep();
      if (result.started > 0) {
        logFn(`knowledge url sync sweep: checked=${result.processed}, started=${result.started}`);
      }
    } catch (error: any) {
      logFn(`knowledge url sync sweep error: ${error?.message || "unknown error"}`);
    }
  };

  setTimeout(() => {
    void run();
  }, STARTUP_DELAY_MS);

  return setInterval(() => {
    void run();
  }, SWEEP_INTERVAL_MS);
}
