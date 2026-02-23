import assert from "node:assert/strict";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "../server/db";
import { conversations, messages, users } from "../shared/schema";

type JsonRecord = Record<string, unknown>;

type ApiResult = {
  status: number;
  body: unknown;
  headers: Headers;
};

type PlanCase = {
  plan: "free" | "standard" | "pro";
  limits: {
    telegramGroupLimit: number;
    discordServerLimit: number;
    websiteDomainLimit: number;
    aiResponsesPerDay: number;
    knowledgeBaseMb: number;
  };
};

const BASE_URL = String(process.env.TEST_BASE_URL || process.env.FRONTEND_URL || "http://localhost:5000").replace(
  /\/+$/,
  "",
);

const PASSWORD = "TierMatrixPass123!";
const AUTH_RATE_LIMIT_TEST_BYPASS_TOKEN = String(process.env.AUTH_RATE_LIMIT_TEST_BYPASS_TOKEN ?? "").trim();
const AUTH_RATE_LIMIT_TEST_BYPASS_HEADER = "x-auth-rate-limit-test-bypass";
const MB = 1024 * 1024;

function parseBooleanEnv(value: string | undefined): boolean {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function parsePlanSet(value: string | undefined, fallback: PlanCase["plan"][]): Set<PlanCase["plan"]> {
  const raw = String(value ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  if (raw.length === 0) return new Set(fallback);
  const parsed = raw.filter((entry): entry is PlanCase["plan"] => entry === "free" || entry === "standard" || entry === "pro");
  return new Set(parsed.length > 0 ? parsed : fallback);
}

const STRESS_KB_OVERFLOW = parseBooleanEnv(process.env.TIER_MATRIX_STRESS_KB_OVERFLOW);
const STRESS_KB_PLANS = parsePlanSet(process.env.TIER_MATRIX_STRESS_KB_PLANS, ["standard", "pro"]);
const STRESS_KB_HEADROOM_BYTES = Math.max(
  256,
  Number.parseInt(process.env.TIER_MATRIX_STRESS_KB_HEADROOM_BYTES ?? "4096", 10) || 4096,
);
const STRESS_KB_OVERFLOW_DOC_BYTES = Math.max(
  STRESS_KB_HEADROOM_BYTES + 1,
  Number.parseInt(process.env.TIER_MATRIX_STRESS_KB_OVERFLOW_DOC_BYTES ?? "8192", 10) || 8192,
);

const PLAN_CASES: PlanCase[] = [
  {
    plan: "free",
    limits: {
      telegramGroupLimit: 1,
      discordServerLimit: 1,
      websiteDomainLimit: 1,
      aiResponsesPerDay: 20,
      knowledgeBaseMb: 10,
    },
  },
  {
    plan: "standard",
    limits: {
      telegramGroupLimit: 3,
      discordServerLimit: 3,
      websiteDomainLimit: 3,
      aiResponsesPerDay: 2500,
      knowledgeBaseMb: 250,
    },
  },
  {
    plan: "pro",
    limits: {
      telegramGroupLimit: 10,
      discordServerLimit: 10,
      websiteDomainLimit: 10,
      aiResponsesPerDay: 6000,
      knowledgeBaseMb: 1000,
    },
  },
];

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
  if (options.cookie) headers["Cookie"] = options.cookie;
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

async function seedAiMessagesToDailyLimit(params: {
  userId: number;
  platformId: number;
  plan: PlanCase["plan"];
  limit: number;
}): Promise<void> {
  const [conversation] = await db
    .insert(conversations)
    .values({
      platformId: params.platformId,
      externalUserId: `matrix-${params.plan}-visitor`,
      externalUsername: "Tier Matrix Visitor",
      externalId: `matrix-${params.plan}-visitor`,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  assert.ok(conversation?.id, `Expected conversation row for ${params.plan} plan`);

  const rows = Array.from({ length: params.limit }, (_, index) => ({
    conversationId: conversation.id,
    content: `tier-matrix-seed-${params.plan}-${index + 1}`,
    sender: "ai",
    createdAt: new Date(),
    metadata: {
      source: "tier_matrix_test",
      ownerUserId: params.userId,
      plan: params.plan,
    } as any,
  }));

  await db.insert(messages).values(rows as any);
}

async function createAndLoginTestUser(email: string, fullName: string): Promise<string> {
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
  assert.ok(cookie, "Expected session cookie after login");
  return cookie;
}

async function createKnowledgeBase(cookie: string, name: string): Promise<number> {
  const createKb = await apiRequest("/api/knowledge-bases", {
    method: "POST",
    cookie,
    body: {
      name,
      description: "Knowledge base limit check",
      isActive: true,
    },
  });

  assert.equal(
    createKb.status,
    201,
    `Expected knowledge base creation 201, got ${createKb.status} (${JSON.stringify(createKb.body)})`,
  );

  const kb = (createKb.body ?? {}) as JsonRecord;
  const knowledgeBaseId = Number(kb.id ?? 0);
  assert.ok(knowledgeBaseId > 0, "Expected knowledge base id");
  return knowledgeBaseId;
}

async function ensureWidgetDomainKbRouting(params: {
  cookie: string;
  platformId: number;
  plan: PlanCase["plan"];
  allowedDomain: string;
}): Promise<number> {
  const knowledgeBaseId = await createKnowledgeBase(params.cookie, `Tier Matrix Widget KB (${params.plan})`);

  const createDoc = await apiRequest(`/api/knowledge-bases/${knowledgeBaseId}/documents`, {
    method: "POST",
    cookie: params.cookie,
    body: {
      title: "Tier matrix widget route test",
      content: `Support and plan information for ${params.plan} plan widget quota regression checks.`,
      metadata: { source: "tier_matrix_widget_routing_setup" },
    },
  });
  assert.equal(
    createDoc.status,
    201,
    `Expected seed KB document create 201, got ${createDoc.status} (${JSON.stringify(createDoc.body)})`,
  );

  const widgetPatch = await apiRequest("/api/widget/config", {
    method: "PATCH",
    cookie: params.cookie,
    body: {
      domain: params.allowedDomain,
      config: {
        allowedDomains: [params.allowedDomain],
      },
    },
  });
  assert.equal(
    widgetPatch.status,
    200,
    `Expected widget config patch 200, got ${widgetPatch.status} (${JSON.stringify(widgetPatch.body)})`,
  );

  const chatConfigsResult = await apiRequest(`/api/platforms/${params.platformId}/chat-configurations`, {
    cookie: params.cookie,
  });
  assert.equal(
    chatConfigsResult.status,
    200,
    `Expected chat configurations 200, got ${chatConfigsResult.status} (${JSON.stringify(chatConfigsResult.body)})`,
  );

  const chatConfigs = Array.isArray(chatConfigsResult.body) ? (chatConfigsResult.body as JsonRecord[]) : [];
  const websiteDomainConfig = chatConfigs.find((item) => {
    const chatType = String(item.chatType ?? "");
    const externalId = String(item.externalId ?? "").toLowerCase();
    return chatType === "website_domain" && externalId === params.allowedDomain.toLowerCase();
  });
  assert.ok(websiteDomainConfig, `Expected website_domain chat configuration for ${params.allowedDomain}`);

  const domainConfigId = Number((websiteDomainConfig as JsonRecord).id ?? 0);
  assert.ok(Number.isFinite(domainConfigId) && domainConfigId > 0, "Expected website domain config id");

  const assignKnowledgeBase = await apiRequest(`/api/chat-configurations/${domainConfigId}`, {
    method: "PATCH",
    cookie: params.cookie,
    body: {
      knowledgeBaseId,
    },
  });
  assert.equal(
    assignKnowledgeBase.status,
    200,
    `Expected chat configuration patch 200, got ${assignKnowledgeBase.status} (${JSON.stringify(assignKnowledgeBase.body)})`,
  );

  return knowledgeBaseId;
}

async function assertFreeKnowledgeBaseLimitEnforced(cookie: string): Promise<void> {
  const knowledgeBaseId = await createKnowledgeBase(cookie, "Tier Matrix KB (Free)");

  const chunkSize = 5 * 1024 * 1024 + 512 * 1024; // 5.5MB
  const largeChunk = "k".repeat(chunkSize);

  const firstDoc = await apiRequest(`/api/knowledge-bases/${knowledgeBaseId}/documents`, {
    method: "POST",
    cookie,
    body: {
      title: "KB chunk A",
      content: largeChunk,
    },
  });
  assert.equal(
    firstDoc.status,
    201,
    `Expected first KB doc 201, got ${firstDoc.status} (${JSON.stringify(firstDoc.body)})`,
  );

  const secondDoc = await apiRequest(`/api/knowledge-bases/${knowledgeBaseId}/documents`, {
    method: "POST",
    cookie,
    body: {
      title: "KB chunk B",
      content: largeChunk,
    },
  });
  assert.equal(
    secondDoc.status,
    402,
    `Expected free KB overflow 402, got ${secondDoc.status} (${JSON.stringify(secondDoc.body)})`,
  );

  const secondDocPayload = (secondDoc.body ?? {}) as JsonRecord;
  assert.equal(
    String(secondDocPayload.code ?? ""),
    "KB_STORAGE_LIMIT_REACHED",
    `Expected KB_STORAGE_LIMIT_REACHED for free plan, got ${JSON.stringify(secondDocPayload)}`,
  );
}

async function runStressKnowledgeBaseOverflowForPlan(params: {
  cookie: string;
  plan: PlanCase["plan"];
  knowledgeBaseMb: number;
}): Promise<void> {
  const knowledgeBaseId = await createKnowledgeBase(params.cookie, `Tier Matrix KB (${params.plan} stress)`);
  const limitBytes = params.knowledgeBaseMb * MB;
  const prefillBytes = Math.max(limitBytes - STRESS_KB_HEADROOM_BYTES, 1);

  await db.execute(sql`
    insert into knowledge_documents (knowledge_base_id, title, content, metadata, created_at, updated_at)
    values (
      ${knowledgeBaseId},
      ${`Stress prefill ${params.plan}`},
      repeat('x', ${prefillBytes}),
      '{}'::jsonb,
      now(),
      now()
    )
  `);

  const overflowDoc = await apiRequest(`/api/knowledge-bases/${knowledgeBaseId}/documents`, {
    method: "POST",
    cookie: params.cookie,
    body: {
      title: `Overflow probe ${params.plan}`,
      content: "z".repeat(STRESS_KB_OVERFLOW_DOC_BYTES),
    },
  });

  assert.equal(
    overflowDoc.status,
    402,
    `Expected stress KB overflow 402 for ${params.plan}, got ${overflowDoc.status} (${JSON.stringify(overflowDoc.body)})`,
  );

  const overflowPayload = (overflowDoc.body ?? {}) as JsonRecord;
  assert.equal(
    String(overflowPayload.code ?? ""),
    "KB_STORAGE_LIMIT_REACHED",
    `Expected KB_STORAGE_LIMIT_REACHED in stress mode for ${params.plan}, got ${JSON.stringify(overflowPayload)}`,
  );
}

async function main() {
  const seed = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
  const createdUserIds: number[] = [];

  console.log(`Running tier matrix checks against ${BASE_URL}`);
  if (STRESS_KB_OVERFLOW) {
    console.log(
      `Stress KB overflow mode enabled for plans: ${Array.from(STRESS_KB_PLANS).join(", ")} ` +
        `(headroom=${STRESS_KB_HEADROOM_BYTES}B, probe=${STRESS_KB_OVERFLOW_DOC_BYTES}B)`,
    );
  }

  try {
    for (let index = 0; index < PLAN_CASES.length; index += 1) {
      const planCase = PLAN_CASES[index];
      const email = `tier-matrix-${seed}-${planCase.plan}@example.com`;
      const fullName = `Tier Matrix ${planCase.plan}`;
      console.log(`\n[${index + 1}/${PLAN_CASES.length}] Verifying ${planCase.plan.toUpperCase()} plan`);

      const cookie = await createAndLoginTestUser(email, fullName);
      const [userRow] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      assert.ok(userRow, `Expected user row for ${email}`);
      createdUserIds.push(userRow.id);

      const paidThroughAt = planCase.plan === "free" ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await db
        .update(users)
        .set({
          plan: planCase.plan,
          planStatus: "active",
          planSelectedAt: new Date(),
          planUpdatedAt: new Date(),
          paidThroughAt,
          trialEndsAt: null,
          billingSuspendedAt: null,
          billingSuspendedReason: null,
          billingSuspendedBy: null,
        } as any)
        .where(eq(users.id, userRow.id));

      const billingStatus = await apiRequest("/api/billing/status", { cookie });
      assert.equal(
        billingStatus.status,
        200,
        `Expected /api/billing/status 200, got ${billingStatus.status} (${JSON.stringify(billingStatus.body)})`,
      );
      const billingPayload = (billingStatus.body ?? {}) as JsonRecord;
      const entitlements = (billingPayload.entitlements ?? {}) as JsonRecord;
      assert.equal(
        Number(entitlements.knowledgeBaseMb ?? -1),
        planCase.limits.knowledgeBaseMb,
        `Unexpected knowledgeBaseMb entitlement for ${planCase.plan}`,
      );

      const widgetConfig = await apiRequest("/api/widget/config", { cookie });
      assert.equal(
        widgetConfig.status,
        200,
        `Expected /api/widget/config 200, got ${widgetConfig.status} (${JSON.stringify(widgetConfig.body)})`,
      );

      const configBody = widgetConfig.body as JsonRecord;
      const platformId = Number(configBody.platformId ?? 0);
      const token = String(configBody.token ?? "");
      assert.ok(platformId > 0, "Expected platformId in widget config response");
      assert.ok(token.length > 0, "Expected widget token in widget config response");

      const usageResult = await apiRequest("/api/widget/usage", { cookie });
      assert.equal(
        usageResult.status,
        200,
        `Expected /api/widget/usage 200, got ${usageResult.status} (${JSON.stringify(usageResult.body)})`,
      );

      const usage = ((usageResult.body as JsonRecord).usage ?? {}) as JsonRecord;
      assert.equal(
        Number(usage.telegramGroupLimit ?? -1),
        planCase.limits.telegramGroupLimit,
        `Unexpected telegramGroupLimit for ${planCase.plan}`,
      );
      assert.equal(
        Number(usage.discordServerLimit ?? -1),
        planCase.limits.discordServerLimit,
        `Unexpected discordServerLimit for ${planCase.plan}`,
      );
      assert.equal(
        Number(usage.websiteDomainLimit ?? -1),
        planCase.limits.websiteDomainLimit,
        `Unexpected websiteDomainLimit for ${planCase.plan}`,
      );
      assert.equal(
        Number(usage.aiResponsesPerDay ?? -1),
        planCase.limits.aiResponsesPerDay,
        `Unexpected aiResponsesPerDay for ${planCase.plan}`,
      );

      const allowedDomain = new URL(BASE_URL).hostname;
      await ensureWidgetDomainKbRouting({
        cookie,
        platformId,
        plan: planCase.plan,
        allowedDomain,
      });

      const overflowDomains = Array.from(
        { length: planCase.limits.websiteDomainLimit + 1 },
        (_, i) => `tier-${planCase.plan}-${i + 1}.example.com`,
      );
      const patchOverflow = await apiRequest("/api/widget/config", {
        method: "PATCH",
        cookie,
        body: {
          config: {
            allowedDomains: overflowDomains,
          },
        },
      });

      assert.equal(
        patchOverflow.status,
        402,
        `Expected domain overflow 402 for ${planCase.plan}, got ${patchOverflow.status} (${JSON.stringify(
          patchOverflow.body,
        )})`,
      );
      const patchOverflowPayload = patchOverflow.body as JsonRecord;
      assert.equal(
        String(patchOverflowPayload.code ?? ""),
        "WEBSITE_DOMAIN_LIMIT_REACHED",
        `Expected WEBSITE_DOMAIN_LIMIT_REACHED for ${planCase.plan}`,
      );

      await seedAiMessagesToDailyLimit({
        userId: userRow.id,
        platformId,
        plan: planCase.plan,
        limit: planCase.limits.aiResponsesPerDay,
      });

      const limitedChat = await apiRequest(`/api/widget/${encodeURIComponent(token)}/chat`, {
        method: "POST",
        body: {
          message: `tier-matrix-limit-check-${planCase.plan}`,
          sessionId: `matrix-session-${planCase.plan}`,
          origin: BASE_URL,
          pageUrl: `${BASE_URL}/tier-matrix`,
          pageTitle: "Tier Matrix",
        },
      });

      assert.equal(
        limitedChat.status,
        200,
        `Expected widget chat 200 for ${planCase.plan}, got ${limitedChat.status} (${JSON.stringify(limitedChat.body)})`,
      );

      const limitedPayload = (limitedChat.body ?? {}) as JsonRecord;
      assert.equal(
        Boolean(limitedPayload.limitReached),
        true,
        `Expected limitReached=true for ${planCase.plan}, got ${JSON.stringify(limitedPayload)}`,
      );

      const quota = (limitedPayload.quota ?? {}) as JsonRecord;
      assert.equal(
        Number(quota.limit ?? 0),
        planCase.limits.aiResponsesPerDay,
        `Unexpected quota.limit for ${planCase.plan} (${JSON.stringify(quota)})`,
      );

      if (planCase.plan === "free") {
        console.log("Checking free-plan knowledge base storage enforcement");
        await assertFreeKnowledgeBaseLimitEnforced(cookie);
      }
      if (STRESS_KB_OVERFLOW && STRESS_KB_PLANS.has(planCase.plan)) {
        console.log(`Running stress knowledge base overflow simulation for ${planCase.plan.toUpperCase()}`);
        await runStressKnowledgeBaseOverflowForPlan({
          cookie,
          plan: planCase.plan,
          knowledgeBaseMb: planCase.limits.knowledgeBaseMb,
        });
      }

      console.log(`Passed ${planCase.plan.toUpperCase()} checks`);
    }

    console.log("\nTier matrix checks passed.");
  } finally {
    if (createdUserIds.length > 0) {
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }
  }
}

main().catch((error) => {
  console.error("Tier matrix checks failed:", error);
  process.exitCode = 1;
});
