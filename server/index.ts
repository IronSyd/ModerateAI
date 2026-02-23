import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { db } from "./db";
import { authRateLimits } from "@shared/schema";
import { lt, sql } from "drizzle-orm";
import {
  initializeAllBots as initializeAllTelegramBots,
  startAppOwnedBot as startTelegramAppOwnedBot,
  getTelegramDestinationLockAdapter,
} from "./lib/telegram";
import {
  initializeAllBots as initializeAllDiscordBots,
  startAppOwnedBot as startDiscordAppOwnedBot,
  getDiscordDestinationLockAdapter,
} from "./lib/discord";
import { scheduleConversationRetentionSweep } from "./retention";
import { recordOpsEvent } from "./lib/ops-monitor";
import { scheduleDestinationLockSweep, scheduleScheduledAutoLockSweep } from "./lib/destination-locks";
import { scheduleAdminHistoryBackfillOnStartup } from "./lib/chatHistoryBackfill";
import { scheduleAdminHistoryAutoAnalysisSweep } from "./lib/adminHistoryAutoAnalysis";
import { scheduleKnowledgeUrlSyncSweep } from "./lib/kb-url-sync";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { createClient, type RedisClientType } from "redis";
import compression from "compression";

const app = express();

type TrustProxySetting = boolean | number | string;

type AuthRateLimitScope = "login" | "signup";
type AuthRateLimitBackend = "postgres" | "redis";

type AuthRateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
  backend: AuthRateLimitBackend;
};

const AUTH_RATE_LIMIT_WINDOW_MS = parsePositiveInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000);
const AUTH_RATE_LIMIT_MAX = parsePositiveInt(process.env.AUTH_RATE_LIMIT_MAX, 20);
const AUTH_RATE_LIMIT_CLEANUP_INTERVAL_MS = parsePositiveInt(
  process.env.AUTH_RATE_LIMIT_CLEANUP_INTERVAL_MS,
  5 * 60 * 1000,
);
const AUTH_RATE_LIMIT_MESSAGE = "Too many login attempts, please try again later.";
const AUTH_RATE_LIMIT_BYPASS_HEADER = "x-auth-rate-limit-test-bypass";
const AUTH_RATE_LIMIT_TEST_BYPASS_TOKEN = String(process.env.AUTH_RATE_LIMIT_TEST_BYPASS_TOKEN ?? "").trim();
const AUTH_RATE_LIMIT_BACKEND = parseAuthRateLimitBackend(process.env.AUTH_RATE_LIMIT_BACKEND);
const AUTH_RATE_LIMIT_REDIS_URL = String(process.env.AUTH_RATE_LIMIT_REDIS_URL ?? process.env.REDIS_URL ?? "").trim();
const AUTH_RATE_LIMIT_REDIS_PREFIX =
  String(process.env.AUTH_RATE_LIMIT_REDIS_PREFIX ?? "moderateai:auth_rate_limits").trim() ||
  "moderateai:auth_rate_limits";
const AUTH_RATE_LIMIT_REDIS_FALLBACK_TO_POSTGRES = parseBooleanEnv(
  process.env.AUTH_RATE_LIMIT_REDIS_FALLBACK_TO_POSTGRES,
  true,
);
const TRUST_PROXY_SETTING = parseTrustProxySetting(process.env.TRUST_PROXY);

app.set("trust proxy", TRUST_PROXY_SETTING);

let authRateLimitTableReady = false;
let authRateLimitTableInitInFlight: Promise<void> | null = null;
let lastAuthRateLimitDbCleanupAt = 0;
let authRateLimitRedisClient: RedisClientType | null = null;
let authRateLimitRedisInitInFlight: Promise<RedisClientType> | null = null;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function parseAuthRateLimitBackend(value: string | undefined): AuthRateLimitBackend {
  return String(value ?? "postgres").trim().toLowerCase() === "redis" ? "redis" : "postgres";
}

function parseTrustProxySetting(value: string | undefined): TrustProxySetting {
  const normalized = String(value ?? "").trim();
  if (!normalized) return 1;
  if (["1", "true", "yes", "on"].includes(normalized.toLowerCase())) return true;
  if (["0", "false", "no", "off"].includes(normalized.toLowerCase())) return false;
  const asNumber = Number.parseInt(normalized, 10);
  if (Number.isFinite(asNumber) && asNumber >= 0) return asNumber;
  return normalized;
}

function logRuntimeMode(): void {
  const mode = String(process.env.NODE_ENV ?? app.get("env") ?? "development");
  log(`runtime mode: ${mode}`, "startup");
  if (mode !== "production") {
    log(
      "WARNING: Development mode is slower. Use `npm run start:prod` or `docker compose up --build` for performance testing.",
      "startup",
    );
  }
}

function getClientIp(req: Request): string {
  const forwardedRaw = req.headers["x-forwarded-for"];
  const forwarded = Array.isArray(forwardedRaw) ? forwardedRaw[0] : String(forwardedRaw ?? "");
  const candidate = forwarded.split(",")[0]?.trim();
  const realIp = String(req.headers["x-real-ip"] ?? "").trim();
  return candidate || realIp || req.ip || "unknown";
}

async function ensureAuthRateLimitTable(): Promise<void> {
  if (authRateLimitTableReady) return;
  if (authRateLimitTableInitInFlight) {
    await authRateLimitTableInitInFlight;
    return;
  }

  authRateLimitTableInitInFlight = (async () => {
    await db.execute(sql`
      create table if not exists auth_rate_limits (
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
      create index if not exists idx_auth_rate_limits_expires_at
      on auth_rate_limits (expires_at)
    `);
    authRateLimitTableReady = true;
  })();

  try {
    await authRateLimitTableInitInFlight;
  } finally {
    authRateLimitTableInitInFlight = null;
  }
}

async function maybeCleanupAuthRateLimitRows(now: Date): Promise<void> {
  const nowMs = now.getTime();
  if (nowMs - lastAuthRateLimitDbCleanupAt < AUTH_RATE_LIMIT_CLEANUP_INTERVAL_MS) return;
  lastAuthRateLimitDbCleanupAt = nowMs;

  try {
    await db.delete(authRateLimits).where(lt(authRateLimits.expiresAt, now));
  } catch (error) {
    console.error("Auth rate-limit cleanup failed:", error);
  }
}

async function consumeAuthRateLimitPostgres(scope: AuthRateLimitScope, clientKey: string): Promise<AuthRateLimitResult> {
  await ensureAuthRateLimitTable();

  const now = new Date();
  const nowMs = now.getTime();
  const windowStartMs = Math.floor(nowMs / AUTH_RATE_LIMIT_WINDOW_MS) * AUTH_RATE_LIMIT_WINDOW_MS;
  const resetAt = windowStartMs + AUTH_RATE_LIMIT_WINDOW_MS;
  const bucketKey = `auth:${scope}:${clientKey}:${windowStartMs}`;
  const windowStart = new Date(windowStartMs);
  const expiresAt = new Date(resetAt);

  await maybeCleanupAuthRateLimitRows(now);

  const [row] = await db
    .insert(authRateLimits)
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
      target: authRateLimits.key,
      set: {
        count: sql`${authRateLimits.count} + 1`,
        updatedAt: now,
      },
    })
    .returning({
      count: authRateLimits.count,
      expiresAt: authRateLimits.expiresAt,
    });

  const currentCount = Number(row?.count ?? 1);
  const resetAtMs = row?.expiresAt ? new Date(row.expiresAt).getTime() : resetAt;
  const remaining = Math.max(AUTH_RATE_LIMIT_MAX - currentCount, 0);
  const retryAfterSeconds = Math.max(Math.ceil((resetAtMs - nowMs) / 1000), 1);

  return {
    allowed: currentCount <= AUTH_RATE_LIMIT_MAX,
    remaining,
    resetAt: resetAtMs,
    retryAfterSeconds,
    backend: "postgres",
  };
}

async function getAuthRateLimitRedisClient(): Promise<RedisClientType> {
  if (!AUTH_RATE_LIMIT_REDIS_URL) {
    throw new Error("AUTH_RATE_LIMIT_REDIS_URL (or REDIS_URL) is required when AUTH_RATE_LIMIT_BACKEND=redis");
  }

  if (authRateLimitRedisClient?.isOpen) return authRateLimitRedisClient;
  if (authRateLimitRedisInitInFlight) return authRateLimitRedisInitInFlight;

  authRateLimitRedisInitInFlight = (async () => {
    const client = createClient({ url: AUTH_RATE_LIMIT_REDIS_URL });
    client.on("error", (error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Auth rate-limit Redis client error:", message);
    });
    await client.connect();
    authRateLimitRedisClient = client as RedisClientType;
    return authRateLimitRedisClient;
  })();

  try {
    return await authRateLimitRedisInitInFlight;
  } finally {
    authRateLimitRedisInitInFlight = null;
  }
}

async function consumeAuthRateLimitRedis(scope: AuthRateLimitScope, clientKey: string): Promise<AuthRateLimitResult> {
  const client = await getAuthRateLimitRedisClient();
  const nowMs = Date.now();
  const windowStartMs = Math.floor(nowMs / AUTH_RATE_LIMIT_WINDOW_MS) * AUTH_RATE_LIMIT_WINDOW_MS;
  const resetAt = windowStartMs + AUTH_RATE_LIMIT_WINDOW_MS;
  const bucketKey = `${AUTH_RATE_LIMIT_REDIS_PREFIX}:${scope}:${clientKey}:${windowStartMs}`;

  const currentCount = Number(await client.incr(bucketKey));
  if (currentCount === 1) {
    await client.pExpire(bucketKey, AUTH_RATE_LIMIT_WINDOW_MS);
  }

  const ttlMsRaw = Number(await client.pTTL(bucketKey));
  const ttlMs = Number.isFinite(ttlMsRaw) && ttlMsRaw > 0 ? ttlMsRaw : resetAt - nowMs;
  const resetAtMs = nowMs + ttlMs;
  const remaining = Math.max(AUTH_RATE_LIMIT_MAX - currentCount, 0);
  const retryAfterSeconds = Math.max(Math.ceil(ttlMs / 1000), 1);

  return {
    allowed: currentCount <= AUTH_RATE_LIMIT_MAX,
    remaining,
    resetAt: resetAtMs,
    retryAfterSeconds,
    backend: "redis",
  };
}

async function consumeAuthRateLimit(scope: AuthRateLimitScope, clientKey: string): Promise<AuthRateLimitResult> {
  if (AUTH_RATE_LIMIT_BACKEND === "redis") {
    try {
      return await consumeAuthRateLimitRedis(scope, clientKey);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      recordOpsEvent(
        "AUTH_RATE_LIMIT_FAILURE",
        {
          scope,
          backend: "redis",
          message,
          fallbackBackend: AUTH_RATE_LIMIT_REDIS_FALLBACK_TO_POSTGRES ? "postgres" : null,
        },
        { bucketKey: `AUTH_RATE_LIMIT_FAILURE:redis:${scope}` },
      );

      if (!AUTH_RATE_LIMIT_REDIS_FALLBACK_TO_POSTGRES) {
        throw error;
      }

      console.warn("Auth rate-limit Redis backend unavailable, falling back to Postgres:", message);
    }
  }

  return consumeAuthRateLimitPostgres(scope, clientKey);
}

function applyAuthRateLimitHeaders(
  res: Response,
  remaining: number,
  resetAt: number,
  retryAfterSeconds?: number,
): void {
  res.setHeader("X-RateLimit-Limit", String(AUTH_RATE_LIMIT_MAX));
  res.setHeader("X-RateLimit-Remaining", String(remaining));
  res.setHeader("X-RateLimit-Reset", String(Math.floor(resetAt / 1000)));
  if (retryAfterSeconds !== undefined) {
    res.setHeader("Retry-After", String(retryAfterSeconds));
  }
}

function isAuthRateLimitBypassed(req: Request): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (!AUTH_RATE_LIMIT_TEST_BYPASS_TOKEN) return false;
  const headerToken = String(req.get(AUTH_RATE_LIMIT_BYPASS_HEADER) ?? "").trim();
  return headerToken.length > 0 && headerToken === AUTH_RATE_LIMIT_TEST_BYPASS_TOKEN;
}

function authLimiter(scope: AuthRateLimitScope) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (isAuthRateLimitBypassed(req)) {
      return next();
    }

    try {
      const clientIp = getClientIp(req);
      const result = await consumeAuthRateLimit(scope, clientIp);
      applyAuthRateLimitHeaders(
        res,
        result.remaining,
        result.resetAt,
        result.allowed ? undefined : result.retryAfterSeconds,
      );

      if (!result.allowed) {
        recordOpsEvent(
          "AUTH_RATE_LIMIT_429",
          {
            scope,
            backend: result.backend,
            clientIp,
            remaining: result.remaining,
          },
          { bucketKey: `AUTH_RATE_LIMIT_429:${scope}:${result.backend}` },
        );
        return res.status(429).json({ message: AUTH_RATE_LIMIT_MESSAGE });
      }

      return next();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      recordOpsEvent(
        "AUTH_RATE_LIMIT_FAILURE",
        {
          scope,
          backend: AUTH_RATE_LIMIT_BACKEND,
          message,
        },
        { bucketKey: `AUTH_RATE_LIMIT_FAILURE:${scope}` },
      );
      console.error("Auth rate-limit check failed:", error);
      return res.status(503).json({
        message: "Authentication is temporarily unavailable. Please retry shortly.",
      });
    }
  };
}

// Security middleware - CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === "production" 
    ? [process.env.FRONTEND_URL || "https://yourapp.replit.app"] 
    : ["http://localhost:5000", "http://127.0.0.1:5000"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(
  compression({
    threshold: 1024,
  }),
);

// Rate limiting middleware - more generous for normal usage
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "production" ? 1000 : 10000, // Much higher limits
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for static assets in development
    return process.env.NODE_ENV === "development" && !req.path.startsWith('/api');
  }
});

// Apply rate limiting
app.use(limiter);
app.use("/api/login", authLimiter("login"));
app.use("/api/signup", authLimiter("signup"));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse && process.env.NODE_ENV === "development") {
        // Only log response data in development for security
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "...";
      }

      log(logLine);
    }
  });

  next();
});


(async () => {
  logRuntimeMode();
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = process.env.NODE_ENV === "production" 
      ? "Internal Server Error" 
      : err.message || "Internal Server Error";

    console.error('Application error:', err.message);
    res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  const listenOptions = {
    port,
    host: "0.0.0.0",
    ...(process.platform === "win32" ? {} : { reusePort: true }),
  };

  server.listen({
    ...listenOptions,
  }, () => {
    log(`serving on port ${port}`);
    log("SPAM_PROTECTION_GLOBAL_DISABLED");
    
    // Initialize any active Telegram bots
    initializeAllTelegramBots()
      .then(() => log('Initialized active Telegram bots'))
      .catch(err => log(`Error initializing Telegram bots: ${err.message}`));

    startTelegramAppOwnedBot()
      .then((result) => log(result.success ? result.message : `Telegram app-owned bot: ${result.message}`))
      .catch(err => log(`Error starting Telegram app-owned bot: ${err.message}`));
      
    // Initialize any active Discord bots
    initializeAllDiscordBots()
      .then(() => log('Initialized active Discord bots'))
      .catch(err => log(`Error initializing Discord bots: ${err.message}`));

    startDiscordAppOwnedBot()
      .then((result) => log(result.success ? result.message : `Discord app-owned bot: ${result.message}`))
      .catch(err => log(`Error starting Discord app-owned bot: ${err.message}`));

    // Daily cleanup for tier-based conversation history retention.
    scheduleConversationRetentionSweep((line) => log(line));

    // Timed destination lock sweep.
    scheduleDestinationLockSweep(
      (platformType) => {
        if (platformType === "telegram") return getTelegramDestinationLockAdapter();
        if (platformType === "discord") return getDiscordDestinationLockAdapter();
        return null;
      },
      (line) => log(line),
    );

    // Scheduled auto-lock sweep (admin-defined lock windows).
    scheduleScheduledAutoLockSweep(
      (platformType) => {
        if (platformType === "telegram") return getTelegramDestinationLockAdapter();
        if (platformType === "discord") return getDiscordDestinationLockAdapter();
        return null;
      },
      (line) => log(line),
    );

    // One-time historical backfill for admin-history learning (best-effort).
    scheduleAdminHistoryBackfillOnStartup((line) => log(line));

    // Recurring auto-analysis of newly ingested admin messages.
    scheduleAdminHistoryAutoAnalysisSweep((line) => log(line));

    // Scheduled KB URL crawl/re-sync sweep.
    scheduleKnowledgeUrlSyncSweep((line) => log(line));
  });
})();
