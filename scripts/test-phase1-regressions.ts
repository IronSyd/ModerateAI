import "dotenv/config";
import assert from "node:assert/strict";
import { eq, inArray } from "drizzle-orm";
import { db } from "../server/db";
import { conversations, messages, platforms, users } from "../shared/schema";

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
const PASSWORD = "Phase1RegressPass123!";
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

async function setPlan(userId: number, plan: "free" | "standard" | "pro") {
  const paidThroughAt = plan === "free" ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db
    .update(users)
    .set({
      plan,
      planStatus: "active",
      planSelectedAt: new Date(),
      planUpdatedAt: new Date(),
      paidThroughAt,
      trialEndsAt: null,
      billingSuspendedAt: null,
      billingSuspendedReason: null,
      billingSuspendedBy: null,
    } as any)
    .where(eq(users.id, userId));
}

async function seedConversationWithMessages(params: {
  userId: number;
  tag: string;
  droppedAgeDays: number;
  keptAgeDays: number;
}) {
  const [platformRow] = await db
    .insert(platforms)
    .values({
      type: "telegram",
      name: `Phase1 ${params.tag}`,
      status: "active",
      userId: params.userId,
      config: {},
      authToken: null,
      createdAt: new Date(),
    })
    .returning({ id: platforms.id });
  assert.ok(platformRow?.id, "Expected seeded platform");

  const [conversationRow] = await db
    .insert(conversations)
    .values({
      platformId: platformRow.id,
      externalUserId: `phase1-${params.tag}-user`,
      externalUsername: `phase1-${params.tag}`,
      externalId: `phase1-${params.tag}-external`,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning({ id: conversations.id });
  assert.ok(conversationRow?.id, "Expected seeded conversation");

  const now = Date.now();
  const droppedAt = new Date(now - params.droppedAgeDays * 24 * 60 * 60 * 1000);
  const keptAt = new Date(now - params.keptAgeDays * 24 * 60 * 60 * 1000);
  const recentAt = new Date(now - 1 * 60 * 60 * 1000);

  await db.insert(messages).values([
    {
      conversationId: conversationRow.id,
      content: `drop-${params.tag}`,
      sender: "user",
      createdAt: droppedAt,
      metadata: null,
    },
    {
      conversationId: conversationRow.id,
      content: `keep-${params.tag}`,
      sender: "user",
      createdAt: keptAt,
      metadata: null,
    },
    {
      conversationId: conversationRow.id,
      content: `recent-${params.tag}`,
      sender: "ai",
      createdAt: recentAt,
      metadata: null,
    },
  ]);

  return conversationRow.id;
}

async function assertHistoryWindow(params: {
  cookie: string;
  conversationId: number;
  mustContain: string[];
  mustNotContain: string[];
}) {
  const response = await apiRequest(`/api/conversations/${params.conversationId}/messages`, {
    cookie: params.cookie,
  });
  assert.equal(
    response.status,
    200,
    `Expected messages endpoint 200, got ${response.status} (${JSON.stringify(response.body)})`,
  );

  const payload = Array.isArray(response.body) ? response.body : [];
  const contents = payload.map((row: any) => String(row.content ?? ""));

  for (const expected of params.mustContain) {
    assert.ok(contents.includes(expected), `Expected messages to include "${expected}", got ${JSON.stringify(contents)}`);
  }
  for (const excluded of params.mustNotContain) {
    assert.ok(!contents.includes(excluded), `Expected messages to exclude "${excluded}", got ${JSON.stringify(contents)}`);
  }
}

async function main() {
  const seed = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
  const createdUserIds: number[] = [];

  console.log(`Running Phase 1 regressions against ${BASE_URL}`);

  try {
    const freeUser = await createAndLoginUser(`phase1-free-${seed}@example.com`, "Phase1 Free");
    const standardUser = await createAndLoginUser(`phase1-standard-${seed}@example.com`, "Phase1 Standard");
    const proUser = await createAndLoginUser(`phase1-pro-${seed}@example.com`, "Phase1 Pro");
    createdUserIds.push(freeUser.id, standardUser.id, proUser.id);

    await setPlan(freeUser.id, "free");
    await setPlan(standardUser.id, "standard");
    await setPlan(proUser.id, "pro");

    console.log("Test 1: history-window enforcement by tier");
    const freeConversationId = await seedConversationWithMessages({
      userId: freeUser.id,
      tag: "free",
      droppedAgeDays: 8,
      keptAgeDays: 2,
    });
    const standardConversationId = await seedConversationWithMessages({
      userId: standardUser.id,
      tag: "standard",
      droppedAgeDays: 100,
      keptAgeDays: 45,
    });
    const proConversationId = await seedConversationWithMessages({
      userId: proUser.id,
      tag: "pro",
      droppedAgeDays: 400,
      keptAgeDays: 300,
    });

    await assertHistoryWindow({
      cookie: freeUser.cookie,
      conversationId: freeConversationId,
      mustContain: ["keep-free", "recent-free"],
      mustNotContain: ["drop-free"],
    });
    await assertHistoryWindow({
      cookie: standardUser.cookie,
      conversationId: standardConversationId,
      mustContain: ["keep-standard", "recent-standard"],
      mustNotContain: ["drop-standard"],
    });
    await assertHistoryWindow({
      cookie: proUser.cookie,
      conversationId: proConversationId,
      mustContain: ["keep-pro", "recent-pro"],
      mustNotContain: ["drop-pro"],
    });

    console.log("Test 2: moderation preset enforcement");
    const freePresetPatch = await apiRequest("/api/workspace/settings", {
      method: "PATCH",
      cookie: freeUser.cookie,
      body: { moderationPreset: "advanced" },
    });
    assert.equal(
      freePresetPatch.status,
      403,
      `Expected free preset block 403, got ${freePresetPatch.status} (${JSON.stringify(freePresetPatch.body)})`,
    );

    const standardPresetPatch = await apiRequest("/api/workspace/settings", {
      method: "PATCH",
      cookie: standardUser.cookie,
      body: {
        moderationPreset: "custom",
        moderationRules: {
          blockedKeywords: ["spam-link", "toxic phrase"],
          allowedKeywords: ["support ticket"],
          spamSensitivity: 60,
          strictness: 62,
        },
      },
    });
    assert.equal(
      standardPresetPatch.status,
      200,
      `Expected standard custom preset update 200, got ${standardPresetPatch.status} (${JSON.stringify(
        standardPresetPatch.body,
      )})`,
    );

    console.log("Test 3: Pro-only endpoint access");
    const freeAudit = await apiRequest("/api/audit-log", { cookie: freeUser.cookie });
    assert.equal(
      freeAudit.status,
      403,
      `Expected free audit access 403, got ${freeAudit.status} (${JSON.stringify(freeAudit.body)})`,
    );

    const freeExport = await apiRequest("/api/export/messages?format=json", { cookie: freeUser.cookie });
    assert.equal(
      freeExport.status,
      403,
      `Expected free export access 403, got ${freeExport.status} (${JSON.stringify(freeExport.body)})`,
    );

    const proAudit = await apiRequest("/api/audit-log", { cookie: proUser.cookie });
    assert.equal(
      proAudit.status,
      200,
      `Expected pro audit access 200, got ${proAudit.status} (${JSON.stringify(proAudit.body)})`,
    );

    const proExport = await apiRequest("/api/export/messages?format=json", { cookie: proUser.cookie });
    assert.equal(
      proExport.status,
      200,
      `Expected pro export access 200, got ${proExport.status} (${JSON.stringify(proExport.body)})`,
    );

    console.log("Phase 1 regression checks passed.");
  } finally {
    if (createdUserIds.length > 0) {
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }
  }
}

main().catch((error) => {
  console.error("Phase 1 regression checks failed:", error);
  process.exitCode = 1;
});
