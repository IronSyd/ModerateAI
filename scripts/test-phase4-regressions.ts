import "dotenv/config";
import assert from "node:assert/strict";
import { eq, inArray } from "drizzle-orm";
import { db } from "../server/db";
import { conversations, messages, moderationActions, platforms, users } from "../shared/schema";

type ApiResult = {
  status: number;
  body: unknown;
  headers: Headers;
};

type SeededUser = {
  id: number;
  email: string;
  cookie: string;
};

const BASE_URL = String(process.env.TEST_BASE_URL || process.env.FRONTEND_URL || "http://localhost:5000").replace(
  /\/+$/,
  "",
);
const PASSWORD = "Phase4RegressPass123!";
const AUTH_RATE_LIMIT_TEST_BYPASS_TOKEN = String(process.env.AUTH_RATE_LIMIT_TEST_BYPASS_TOKEN ?? "").trim();
const AUTH_RATE_LIMIT_TEST_BYPASS_HEADER = "x-auth-rate-limit-test-bypass";

function extractCookie(headers: Headers): string {
  const getSetCookie = (headers as any).getSetCookie as ((this: Headers) => string[]) | undefined;
  const fromArray = typeof getSetCookie === "function" ? getSetCookie.call(headers) : [];
  if (fromArray.length > 0) {
    return fromArray.map((entry) => entry.split(";")[0]).join("; ");
  }

  const single = headers.get("set-cookie");
  if (!single) return "";
  return single
    .split(",")
    .map((entry) => entry.trim())
    .map((entry) => entry.split(";")[0])
    .filter(Boolean)
    .join("; ");
}

async function apiRequest(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    cookie?: string;
    headers?: Record<string, string>;
    disableAuthBypass?: boolean;
  } = {},
): Promise<ApiResult> {
  const headers: Record<string, string> = { ...(options.headers ?? {}) };
  if (options.body !== undefined && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  if (options.cookie) headers.Cookie = options.cookie;
  if (AUTH_RATE_LIMIT_TEST_BYPASS_TOKEN && !options.disableAuthBypass) {
    headers[AUTH_RATE_LIMIT_TEST_BYPASS_HEADER] = AUTH_RATE_LIMIT_TEST_BYPASS_TOKEN;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  let body: unknown = text;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  } else {
    body = null;
  }

  return {
    status: response.status,
    body,
    headers: response.headers,
  };
}

async function createAndLoginUser(email: string, fullName: string): Promise<SeededUser> {
  const signup = await apiRequest("/api/signup", {
    method: "POST",
    body: { email, fullName, password: PASSWORD },
  });
  assert.equal(signup.status, 201, `Expected signup 201, got ${signup.status} (${JSON.stringify(signup.body)})`);

  const login = await apiRequest("/api/login", {
    method: "POST",
    body: { email, password: PASSWORD },
  });
  assert.equal(login.status, 200, `Expected login 200, got ${login.status} (${JSON.stringify(login.body)})`);
  const cookie = extractCookie(login.headers);
  assert.ok(cookie, `Expected session cookie for ${email}`);

  const [userRow] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  assert.ok(userRow?.id, `Expected user row for ${email}`);
  return { id: userRow.id, email, cookie };
}

async function setPlan(userId: number, plan: "standard" | "pro"): Promise<void> {
  await db
    .update(users)
    .set({
      plan,
      planStatus: "active",
      planSelectedAt: new Date(),
      planUpdatedAt: new Date(),
      trialEndsAt: null,
      paidThroughAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      billingSuspendedAt: null,
      billingSuspendedReason: null,
      billingSuspendedBy: null,
    } as any)
    .where(eq(users.id, userId));
}

async function main() {
  const seed = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
  const createdUserIds: number[] = [];

  console.log(`Running Phase 4 regressions against ${BASE_URL}`);

  try {
    const user = await createAndLoginUser(`phase4-${seed}@example.com`, "Phase4 User");
    createdUserIds.push(user.id);
    await setPlan(user.id, "standard");

    const [platform] = await db
      .insert(platforms)
      .values({
        userId: user.id,
        type: "telegram",
        name: `Phase4 Telegram ${seed}`,
        status: "active",
        config: {},
        authToken: null,
        createdAt: new Date(),
      } as any)
      .returning({ id: platforms.id });
    assert.ok(platform?.id, "Expected platform row");

    const [conversation] = await db
      .insert(conversations)
      .values({
        platformId: platform.id,
        externalUserId: `phase4-user-${seed}`,
        externalUsername: "phase4",
        externalId: `phase4-conv-${seed}`,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .returning({ id: conversations.id });
    assert.ok(conversation?.id, "Expected conversation row");

    // Seed message metadata intentionally with different counts so we can prove analytics
    // read from moderation_actions (not message metadata).
    const [seedMessage] = await db
      .insert(messages)
      .values({
        conversationId: conversation.id,
        sender: "user",
        content: "phase4 seed message",
        createdAt: new Date(),
        metadata: { blocked: "content", action: "content_filtered" } as any,
      })
      .returning({ id: messages.id });
    assert.ok(seedMessage?.id, "Expected seed message row");

    const now = new Date();
    await db.insert(moderationActions).values([
      {
        ownerUserId: user.id,
        platformId: platform.id,
        conversationId: conversation.id,
        messageId: seedMessage.id,
        platformType: "telegram",
        action: "content_filtered",
        ruleSource: "custom_rule",
        reason: "Matched custom blocked keyword rule",
        automatic: true,
        actorUserId: null,
        metadata: { test: true, idx: 1 } as any,
        createdAt: now,
      },
      {
        ownerUserId: user.id,
        platformId: platform.id,
        conversationId: conversation.id,
        messageId: seedMessage.id,
        platformType: "telegram",
        action: "content_filtered",
        ruleSource: "ai_automation",
        reason: "Blocked by advanced moderation automation",
        automatic: true,
        actorUserId: null,
        metadata: { test: true, idx: 2 } as any,
        createdAt: now,
      },
      {
        ownerUserId: user.id,
        platformId: platform.id,
        conversationId: conversation.id,
        messageId: seedMessage.id,
        platformType: "telegram",
        action: "spam_blocked",
        ruleSource: "spam_heuristic",
        reason: "Blocked by spam heuristic",
        automatic: true,
        actorUserId: null,
        metadata: { test: true, idx: 3 } as any,
        createdAt: now,
      },
    ] as any);

    console.log("Test 1: moderation actions API returns filtered results");
    const moderationLog = await apiRequest(
      `/api/moderation/actions?platformId=${platform.id}&action=content_filtered&limit=50`,
      { cookie: user.cookie },
    );
    assert.equal(
      moderationLog.status,
      200,
      `Expected moderation actions endpoint 200, got ${moderationLog.status} (${JSON.stringify(moderationLog.body)})`,
    );
    const moderationPayload = (moderationLog.body ?? {}) as Record<string, any>;
    assert.equal(
      Number(moderationPayload.count ?? 0),
      2,
      `Expected 2 content_filtered rows, got ${JSON.stringify(moderationPayload)}`,
    );

    console.log("Test 2: deep analytics endpoint is gated to Pro");
    const deepBlocked = await apiRequest(`/api/analytics/deep?days=7`, { cookie: user.cookie });
    assert.equal(
      deepBlocked.status,
      403,
      `Expected deep analytics 403 on standard plan, got ${deepBlocked.status} (${JSON.stringify(deepBlocked.body)})`,
    );

    console.log("Test 3: platform analytics moderation stats use moderation_actions table");
    const analytics = await apiRequest(`/api/platforms/${platform.id}/analytics`, { cookie: user.cookie });
    assert.equal(
      analytics.status,
      200,
      `Expected analytics endpoint 200, got ${analytics.status} (${JSON.stringify(analytics.body)})`,
    );
    const analyticsPayload = (analytics.body ?? {}) as Record<string, any>;
    const moderationStats = (analyticsPayload.moderationActions ?? {}) as Record<string, any>;

    // Expected from moderation_actions table: 2 content_filtered, 1 spam_blocked.
    assert.equal(
      Number(moderationStats.contentFiltered ?? 0),
      2,
      `Expected contentFiltered=2 from moderation_actions table, got ${JSON.stringify(analyticsPayload)}`,
    );
    assert.equal(
      Number(moderationStats.spamBlocked ?? 0),
      1,
      `Expected spamBlocked=1 from moderation_actions table, got ${JSON.stringify(analyticsPayload)}`,
    );

    console.log("Test 4: deep analytics endpoint returns aggregated payload on Pro");
    await setPlan(user.id, "pro");
    const deepAnalytics = await apiRequest(`/api/analytics/deep?days=7`, { cookie: user.cookie });
    assert.equal(
      deepAnalytics.status,
      200,
      `Expected deep analytics 200 on pro plan, got ${deepAnalytics.status} (${JSON.stringify(deepAnalytics.body)})`,
    );
    const deepPayload = (deepAnalytics.body ?? {}) as Record<string, any>;
    assert.equal(
      Number(deepPayload.windowDays ?? 0),
      7,
      `Expected deep analytics windowDays=7, got ${JSON.stringify(deepPayload)}`,
    );
    assert.ok(Array.isArray(deepPayload.dailyTrend), `Expected dailyTrend array, got ${JSON.stringify(deepPayload)}`);
    assert.equal(
      Number((deepPayload.totals ?? {}).moderationEvents ?? 0) >= 3,
      true,
      `Expected moderationEvents >= 3, got ${JSON.stringify(deepPayload)}`,
    );

    console.log("Test 5: auth limiter emits 429 and optional bypass token skips limiter");
    const numericSeed = Number.parseInt(seed, 10) || Date.now();
    const ipSuffix = (numericSeed % 200) + 20;
    const spoofedIp = `198.51.100.${ipSuffix}`;
    const invalidEmail = `phase4-rate-limit-${seed}@example.com`;
    const invalidPassword = "not-the-right-password";

    const firstAttempt = await apiRequest("/api/login", {
      method: "POST",
      body: { email: invalidEmail, password: invalidPassword },
      headers: { "x-forwarded-for": spoofedIp },
      disableAuthBypass: true,
    });
    assert.equal(
      firstAttempt.status,
      401,
      `Expected first invalid login to return 401, got ${firstAttempt.status} (${JSON.stringify(firstAttempt.body)})`,
    );

    const limitHeaderRaw = Number(firstAttempt.headers.get("x-ratelimit-limit") ?? "20");
    const authLimit = Number.isFinite(limitHeaderRaw) && limitHeaderRaw > 0 ? Math.round(limitHeaderRaw) : 20;

    let blockedAttempt: ApiResult | null = null;
    for (let i = 0; i < authLimit + 1; i += 1) {
      const attempt = await apiRequest("/api/login", {
        method: "POST",
        body: { email: invalidEmail, password: invalidPassword },
        headers: { "x-forwarded-for": spoofedIp },
        disableAuthBypass: true,
      });

      if (attempt.status === 429) {
        blockedAttempt = attempt;
        break;
      }
    }

    assert.ok(
      blockedAttempt?.status === 429,
      `Expected at least one 429 from auth limiter, got ${blockedAttempt?.status ?? "none"}`,
    );

    if (AUTH_RATE_LIMIT_TEST_BYPASS_TOKEN) {
      const bypassAttempt = await apiRequest("/api/login", {
        method: "POST",
        body: { email: invalidEmail, password: invalidPassword },
        headers: { "x-forwarded-for": spoofedIp },
      });
      assert.equal(
        bypassAttempt.status,
        401,
        `Expected bypassed auth request to skip limiter and return 401, got ${bypassAttempt.status} (${JSON.stringify(
          bypassAttempt.body,
        )})`,
      );
    } else {
      console.log("AUTH_RATE_LIMIT_TEST_BYPASS_TOKEN not set; bypass assertion skipped.");
    }

    console.log("Phase 4 regression checks passed.");
  } finally {
    if (createdUserIds.length > 0) {
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }
  }
}

main().catch((error) => {
  console.error("Phase 4 regression checks failed:", error);
  process.exitCode = 1;
});
