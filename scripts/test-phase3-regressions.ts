import "dotenv/config";
import assert from "node:assert/strict";
import { eq, inArray } from "drizzle-orm";
import { db } from "../server/db";
import { conversations, messages, platforms, users } from "../shared/schema";
import {
  canUseAdvancedModerationAutomation,
  getModerationSignal,
  isMessageBlockedByModeration,
} from "../server/lib/moderation";

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
const PASSWORD = "Phase3RegressPass123!";
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

async function apiRequest(path: string, options: { method?: string; body?: unknown; cookie?: string } = {}): Promise<ApiResult> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.cookie) headers.Cookie = options.cookie;
  if (AUTH_RATE_LIMIT_TEST_BYPASS_TOKEN) headers[AUTH_RATE_LIMIT_TEST_BYPASS_HEADER] = AUTH_RATE_LIMIT_TEST_BYPASS_TOKEN;

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

async function setPlan(userId: number, plan: "free" | "standard" | "pro"): Promise<void> {
  const paidThroughAt = plan === "free" ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db
    .update(users)
    .set({
      plan,
      planStatus: "active",
      planSelectedAt: new Date(),
      planUpdatedAt: new Date(),
      trialEndsAt: null,
      paidThroughAt,
      billingSuspendedAt: null,
      billingSuspendedReason: null,
      billingSuspendedBy: null,
    } as any)
    .where(eq(users.id, userId));
}

async function seedPlatformActivity(userId: number, type: "telegram" | "discord", name: string): Promise<number> {
  const [platform] = await db
    .insert(platforms)
    .values({
      userId,
      type,
      name,
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
      externalUserId: `${name}-visitor`,
      externalUsername: "Phase3 Visitor",
      externalId: `${name}-external`,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)
    .returning({ id: conversations.id });
  assert.ok(conversation?.id, "Expected conversation row");

  await db.insert(messages).values([
    {
      conversationId: conversation.id,
      content: `phase3 ${name} user message`,
      sender: "user",
      createdAt: new Date(),
      metadata: { username: "phase3-visitor" } as any,
    },
    {
      conversationId: conversation.id,
      content: `phase3 ${name} ai message`,
      sender: "ai",
      createdAt: new Date(),
      metadata: null,
    },
    {
      conversationId: conversation.id,
      content: `phase3 ${name} blocked message`,
      sender: "user",
      createdAt: new Date(),
      metadata: {
        blocked: "content",
        action: "content_filtered",
        moderationPreset: "advanced",
      } as any,
    },
  ]);

  return platform.id;
}

async function main() {
  const seed = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
  const createdUserIds: number[] = [];

  console.log(`Running Phase 3 regressions against ${BASE_URL}`);

  try {
    console.log("Test 1: analytics tiers are enforced by plan");
    const freeUser = await createAndLoginUser(`phase3-free-${seed}@example.com`, "Phase3 Free");
    const standardUser = await createAndLoginUser(`phase3-standard-${seed}@example.com`, "Phase3 Standard");
    const proUser = await createAndLoginUser(`phase3-pro-${seed}@example.com`, "Phase3 Pro");
    createdUserIds.push(freeUser.id, standardUser.id, proUser.id);

    await setPlan(freeUser.id, "free");
    await setPlan(standardUser.id, "standard");
    await setPlan(proUser.id, "pro");

    const freePlatformId = await seedPlatformActivity(freeUser.id, "telegram", `phase3-free-${seed}`);
    const standardPlatformId = await seedPlatformActivity(standardUser.id, "telegram", `phase3-standard-${seed}`);
    const proPlatformId = await seedPlatformActivity(proUser.id, "telegram", `phase3-pro-${seed}`);

    const freeAnalytics = await apiRequest(`/api/platforms/${freePlatformId}/analytics`, { cookie: freeUser.cookie });
    assert.equal(
      freeAnalytics.status,
      403,
      `Expected free analytics 403, got ${freeAnalytics.status} (${JSON.stringify(freeAnalytics.body)})`,
    );

    const standardAnalytics = await apiRequest(`/api/platforms/${standardPlatformId}/analytics`, {
      cookie: standardUser.cookie,
    });
    assert.equal(
      standardAnalytics.status,
      200,
      `Expected standard analytics 200, got ${standardAnalytics.status} (${JSON.stringify(standardAnalytics.body)})`,
    );
    const standardPayload = (standardAnalytics.body ?? {}) as Record<string, unknown>;
    assert.equal(
      typeof standardPayload.deepAnalytics,
      "undefined",
      `Expected no deepAnalytics for standard plan, got ${JSON.stringify(standardPayload)}`,
    );

    const proAnalytics = await apiRequest(`/api/platforms/${proPlatformId}/analytics`, { cookie: proUser.cookie });
    assert.equal(
      proAnalytics.status,
      200,
      `Expected pro analytics 200, got ${proAnalytics.status} (${JSON.stringify(proAnalytics.body)})`,
    );
    const proPayload = (proAnalytics.body ?? {}) as Record<string, unknown>;
    assert.ok(
      proPayload.deepAnalytics && typeof proPayload.deepAnalytics === "object",
      `Expected deepAnalytics object for pro plan, got ${JSON.stringify(proPayload)}`,
    );

    console.log("Test 2: advanced moderation automation policy helpers");
    assert.equal(canUseAdvancedModerationAutomation({ preset: "advanced" }), true);
    assert.equal(canUseAdvancedModerationAutomation({ preset: "custom" }), false);
    assert.equal(canUseAdvancedModerationAutomation({ preset: "basic" }), false);

    const customOnlySignal = getModerationSignal({
      blockedByCustomRules: true,
      blockedByAdvancedAutomation: false,
    });
    assert.equal(isMessageBlockedByModeration(customOnlySignal), true);

    const advancedOnlySignal = getModerationSignal({
      blockedByCustomRules: false,
      blockedByAdvancedAutomation: true,
    });
    assert.equal(isMessageBlockedByModeration(advancedOnlySignal), true);

    const cleanSignal = getModerationSignal({
      blockedByCustomRules: false,
      blockedByAdvancedAutomation: false,
    });
    assert.equal(isMessageBlockedByModeration(cleanSignal), false);

    console.log("Phase 3 regression checks passed.");
  } finally {
    if (createdUserIds.length > 0) {
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }
  }
}

main().catch((error) => {
  console.error("Phase 3 regression checks failed:", error);
  process.exitCode = 1;
});
