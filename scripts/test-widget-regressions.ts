import assert from "node:assert/strict";

type JsonRecord = Record<string, unknown>;

type ApiResult = {
  status: number;
  body: unknown;
  headers: Headers;
};

const BASE_URL = String(process.env.TEST_BASE_URL || process.env.FRONTEND_URL || "http://localhost:5000").replace(
  /\/+$/,
  "",
);
const AUTH_RATE_LIMIT_TEST_BYPASS_TOKEN = String(process.env.AUTH_RATE_LIMIT_TEST_BYPASS_TOKEN ?? "").trim();
const AUTH_RATE_LIMIT_TEST_BYPASS_HEADER = "x-auth-rate-limit-test-bypass";
const WIDGET_STRICT_SESSION_BINDING_ENABLED = ["1", "true", "yes", "on"].includes(
  String(process.env.WIDGET_STRICT_SESSION_BINDING_ENABLED ?? "")
    .trim()
    .toLowerCase(),
);

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

async function main() {
  const seed = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
  const email = `widget-regression-${seed}@example.com`;
  const password = "RegressionPass123!";
  const fullName = "Widget Regression";

  console.log(`Running widget API regressions against ${BASE_URL}`);
  console.log(`Using test account: ${email}`);

  const signup = await apiRequest("/api/signup", {
    method: "POST",
    body: { email, fullName, password },
  });
  assert.equal(signup.status, 201, `Expected signup 201, got ${signup.status} (${JSON.stringify(signup.body)})`);

  const login = await apiRequest("/api/login", {
    method: "POST",
    body: { email, password },
  });
  assert.equal(login.status, 200, `Expected login 200, got ${login.status} (${JSON.stringify(login.body)})`);
  const cookie = extractCookie(login.headers);
  assert.ok(cookie, "Expected session cookie after login");

  const widgetConfig = await apiRequest("/api/widget/config", { cookie });
  assert.equal(
    widgetConfig.status,
    200,
    `Expected /api/widget/config 200, got ${widgetConfig.status} (${JSON.stringify(widgetConfig.body)})`,
  );

  const configBody = widgetConfig.body as JsonRecord;
  const token = String(configBody.token ?? "");
  assert.ok(token.length > 0, "Expected widget token in /api/widget/config response");
  const platformId = Number(configBody.platformId ?? 0);
  assert.ok(Number.isFinite(platformId) && platformId > 0, "Expected widget platformId in /api/widget/config response");

  const allowedDomain = `widget-regression-${seed}.example.com`;
  const widgetOrigin = `https://${allowedDomain}`;
  const widgetPageUrl = `${widgetOrigin}/regression`;

  console.log("Test 1: domain limit enforcement");
  const domainLimit = await apiRequest("/api/widget/config", {
    method: "PATCH",
    cookie,
    body: {
      config: {
        allowedDomains: ["alpha.example.com", "beta.example.com"],
      },
    },
  });
  assert.equal(
    domainLimit.status,
    402,
    `Expected domain limit 402, got ${domainLimit.status} (${JSON.stringify(domainLimit.body)})`,
  );
  const domainPayload = domainLimit.body as JsonRecord;
  assert.equal(
    String(domainPayload.code ?? ""),
    "WEBSITE_DOMAIN_LIMIT_REACHED",
    `Expected WEBSITE_DOMAIN_LIMIT_REACHED code, got ${JSON.stringify(domainPayload)}`,
  );

  console.log("Setup: create KB, map domain, and assign KB routing");
  const createKnowledgeBase = await apiRequest("/api/knowledge-bases", {
    method: "POST",
    cookie,
    body: {
      name: `Widget Regression KB ${seed}`,
      description: "Regression knowledge base for widget route tests",
      isActive: true,
    },
  });
  assert.equal(
    createKnowledgeBase.status,
    201,
    `Expected knowledge base create 201, got ${createKnowledgeBase.status} (${JSON.stringify(createKnowledgeBase.body)})`,
  );
  const knowledgeBaseBody = createKnowledgeBase.body as JsonRecord;
  const knowledgeBaseId = Number(knowledgeBaseBody.id ?? 0);
  assert.ok(Number.isFinite(knowledgeBaseId) && knowledgeBaseId > 0, "Expected knowledge base id");

  const createKnowledgeDocument = await apiRequest(`/api/knowledge-bases/${knowledgeBaseId}/documents`, {
    method: "POST",
    cookie,
    body: {
      title: "Pricing and demo support",
      content:
        "ModerateAI offers Free, Standard, and Pro plans. Interested users can request an upgrade through support and schedule a demo.",
      metadata: { source: "widget-regression-script" },
    },
  });
  assert.equal(
    createKnowledgeDocument.status,
    201,
    `Expected knowledge document create 201, got ${createKnowledgeDocument.status} (${JSON.stringify(createKnowledgeDocument.body)})`,
  );

  const configureWidget = await apiRequest("/api/widget/config", {
    method: "PATCH",
    cookie,
    body: {
      domain: allowedDomain,
      config: {
        leadPromptAfterMessages: 1,
        leadCaptureEnabled: true,
        collectVisitorInfo: true,
        leadIntentPreset: "balanced",
        leadIntentScope: "commercial_and_escalation",
      },
    },
  });
  assert.equal(
    configureWidget.status,
    200,
    `Expected widget config patch 200, got ${configureWidget.status} (${JSON.stringify(configureWidget.body)})`,
  );

  const chatConfigsResult = await apiRequest(`/api/platforms/${platformId}/chat-configurations`, { cookie });
  assert.equal(
    chatConfigsResult.status,
    200,
    `Expected chat configurations 200, got ${chatConfigsResult.status} (${JSON.stringify(chatConfigsResult.body)})`,
  );

  const chatConfigs = Array.isArray(chatConfigsResult.body) ? (chatConfigsResult.body as JsonRecord[]) : [];
  const websiteDomainConfig = chatConfigs.find((item) => {
    const chatType = String(item.chatType ?? "");
    const externalId = String(item.externalId ?? "").toLowerCase();
    return chatType === "website_domain" && externalId === allowedDomain.toLowerCase();
  });
  assert.ok(websiteDomainConfig, "Expected website_domain chat configuration for allowed domain");

  const domainConfigId = Number(websiteDomainConfig?.id ?? 0);
  assert.ok(Number.isFinite(domainConfigId) && domainConfigId > 0, "Expected website domain config id");

  const assignKnowledgeBase = await apiRequest(`/api/chat-configurations/${domainConfigId}`, {
    method: "PATCH",
    cookie,
    body: {
      knowledgeBaseId,
    },
  });
  assert.equal(
    assignKnowledgeBase.status,
    200,
    `Expected chat configuration patch 200, got ${assignKnowledgeBase.status} (${JSON.stringify(assignKnowledgeBase.body)})`,
  );

  console.log("Setup: bootstrap widget session");
  const bootstrap = await apiRequest(
    `/api/widget/${encodeURIComponent(token)}/bootstrap?origin=${encodeURIComponent(widgetOrigin)}&pageUrl=${encodeURIComponent(widgetPageUrl)}`,
    { method: "GET" },
  );
  assert.equal(
    bootstrap.status,
    200,
    `Expected widget bootstrap 200, got ${bootstrap.status} (${JSON.stringify(bootstrap.body)})`,
  );
  const bootstrapPayload = (bootstrap.body ?? {}) as JsonRecord;
  const promptSessionId = String(bootstrapPayload.sessionId ?? "");
  let promptSessionToken = String(bootstrapPayload.sessionToken ?? "");
  assert.ok(promptSessionId.length > 0, "Expected bootstrap sessionId");
  assert.ok(promptSessionToken.length > 0, "Expected bootstrap sessionToken");

  console.log("Test 2: leadPrompt mode contract");
  const promptChat = await apiRequest(`/api/widget/${encodeURIComponent(token)}/chat`, {
    method: "POST",
    body: {
      message: "Can I get pricing details and a demo?",
      sessionId: promptSessionId,
      sessionToken: promptSessionToken,
      origin: widgetOrigin,
      pageUrl: widgetPageUrl,
      pageTitle: "Widget Regression",
    },
  });
  assert.equal(
    promptChat.status,
    200,
    `Expected prompt chat status 200, got ${promptChat.status} (${JSON.stringify(promptChat.body)})`,
  );
  const promptPayload = (promptChat.body ?? {}) as JsonRecord;
  const leadPrompt = (promptPayload.leadPrompt ?? {}) as JsonRecord;
  const leadPromptMode = String(leadPrompt.mode ?? "");
  assert.ok(
    leadPromptMode === "none" || leadPromptMode === "cta" || leadPromptMode === "form",
    `Expected leadPrompt.mode to be none|cta|form, got ${JSON.stringify(leadPrompt)}`,
  );
  assert.equal(
    Boolean(leadPrompt.show),
    leadPromptMode !== "none",
    `Expected leadPrompt.show to match mode visibility, got ${JSON.stringify(leadPrompt)}`,
  );
  assert.equal(
    typeof leadPrompt.reason,
    "string",
    `Expected leadPrompt.reason string, got ${JSON.stringify(leadPrompt)}`,
  );
  const refreshedPromptSessionToken = String(promptPayload.sessionToken ?? "");
  if (refreshedPromptSessionToken) {
    promptSessionToken = refreshedPromptSessionToken;
  }

  console.log("Test 3: session token validation behavior");
  const invalidSessionTokenChat = await apiRequest(`/api/widget/${encodeURIComponent(token)}/chat`, {
    method: "POST",
    body: {
      message: "Checking invalid session token handling",
      sessionId: promptSessionId,
      sessionToken: `${promptSessionToken}x`,
      origin: widgetOrigin,
      pageUrl: widgetPageUrl,
      pageTitle: "Widget Regression",
    },
  });
  if (WIDGET_STRICT_SESSION_BINDING_ENABLED) {
    assert.equal(
      invalidSessionTokenChat.status,
      403,
      `Expected strict mode to reject invalid session token, got ${invalidSessionTokenChat.status} (${JSON.stringify(
        invalidSessionTokenChat.body,
      )})`,
    );
  } else {
    assert.equal(
      invalidSessionTokenChat.status,
      200,
      `Expected compatibility mode fallback on invalid session token, got ${invalidSessionTokenChat.status} (${JSON.stringify(
        invalidSessionTokenChat.body,
      )})`,
    );
  }

  console.log("Test 4: lead dedup behavior");
  const leadFirst = await apiRequest(`/api/widget/${encodeURIComponent(token)}/lead`, {
    method: "POST",
    body: {
      sessionId: promptSessionId,
      sessionToken: promptSessionToken,
      name: "Widget Lead",
      email,
      company: "Regression Co",
      origin: widgetOrigin,
      pageUrl: widgetPageUrl,
      pageTitle: "Widget Regression",
    },
  });
  assert.equal(
    leadFirst.status,
    201,
    `Expected first lead create 201, got ${leadFirst.status} (${JSON.stringify(leadFirst.body)})`,
  );
  const firstLeadPayload = (leadFirst.body ?? {}) as JsonRecord;
  assert.equal(
    Boolean(firstLeadPayload.deduplicated),
    false,
    `Expected first lead deduplicated=false, got ${JSON.stringify(firstLeadPayload)}`,
  );

  const leadSecond = await apiRequest(`/api/widget/${encodeURIComponent(token)}/lead`, {
    method: "POST",
    body: {
      sessionId: promptSessionId,
      sessionToken: promptSessionToken,
      name: "Widget Lead",
      email,
      company: "Regression Co",
      origin: widgetOrigin,
      pageUrl: widgetPageUrl,
      pageTitle: "Widget Regression",
    },
  });
  assert.equal(
    leadSecond.status,
    200,
    `Expected duplicate lead return 200, got ${leadSecond.status} (${JSON.stringify(leadSecond.body)})`,
  );
  const secondLeadPayload = (leadSecond.body ?? {}) as JsonRecord;
  assert.equal(
    Boolean(secondLeadPayload.deduplicated),
    true,
    `Expected duplicate lead deduplicated=true, got ${JSON.stringify(secondLeadPayload)}`,
  );

  console.log("Test 5: lead capture disabled blocks submissions");
  const disableLeadCapture = await apiRequest("/api/widget/config", {
    method: "PATCH",
    cookie,
    body: {
      config: {
        leadCaptureEnabled: false,
      },
    },
  });
  assert.equal(
    disableLeadCapture.status,
    200,
    `Expected lead capture disable patch 200, got ${disableLeadCapture.status} (${JSON.stringify(disableLeadCapture.body)})`,
  );
  const blockedLead = await apiRequest(`/api/widget/${encodeURIComponent(token)}/lead`, {
    method: "POST",
    body: {
      sessionId: promptSessionId,
      sessionToken: promptSessionToken,
      name: "Should Block",
      email,
      origin: widgetOrigin,
      pageUrl: widgetPageUrl,
      pageTitle: "Widget Regression",
    },
  });
  assert.equal(
    blockedLead.status,
    403,
    `Expected lead capture disabled 403, got ${blockedLead.status} (${JSON.stringify(blockedLead.body)})`,
  );
  const enableLeadCapture = await apiRequest("/api/widget/config", {
    method: "PATCH",
    cookie,
    body: {
      config: {
        leadCaptureEnabled: true,
      },
    },
  });
  assert.equal(
    enableLeadCapture.status,
    200,
    `Expected lead capture enable patch 200, got ${enableLeadCapture.status} (${JSON.stringify(enableLeadCapture.body)})`,
  );

  console.log("Test 6: daily AI quota enforcement");
  const sessionId = promptSessionId;
  let quotaSessionToken = promptSessionToken;
  let finalChatPayload: JsonRecord | null = null;
  for (let i = 1; i <= 30; i += 1) {
    const chat = await apiRequest(`/api/widget/${encodeURIComponent(token)}/chat`, {
      method: "POST",
      body: {
        message: `quota test message ${i}`,
        sessionId,
        sessionToken: quotaSessionToken,
        origin: widgetOrigin,
        pageUrl: widgetPageUrl,
        pageTitle: "Widget Regression",
      },
    });
    assert.equal(chat.status, 200, `Expected chat status 200, got ${chat.status} on message ${i}`);
    finalChatPayload = (chat.body ?? {}) as JsonRecord;
    const refreshedQuotaToken = String(finalChatPayload.sessionToken ?? "");
    if (refreshedQuotaToken) {
      quotaSessionToken = refreshedQuotaToken;
    }
    if (Boolean(finalChatPayload.limitReached)) break;
  }

  assert.ok(finalChatPayload, "Expected final chat payload");
  assert.equal(
    Boolean(finalChatPayload?.limitReached),
    true,
    `Expected final chat to hit limit, got ${JSON.stringify(finalChatPayload)}`,
  );
  const quota = (finalChatPayload?.quota ?? {}) as JsonRecord;
  assert.equal(Number(quota.limit ?? 0), 20, `Expected free daily quota limit 20, got ${JSON.stringify(quota)}`);
  const quotaLeadPrompt = (finalChatPayload?.leadPrompt ?? {}) as JsonRecord;
  assert.equal(
    String(quotaLeadPrompt.mode ?? ""),
    "none",
    `Expected leadPrompt.mode=none on quota path, got ${JSON.stringify(quotaLeadPrompt)}`,
  );

  console.log("Test 7: rate-limit 429 behavior");
  let hit429 = false;
  for (let i = 1; i <= 30; i += 1) {
    const lead = await apiRequest(`/api/widget/${encodeURIComponent(token)}/lead`, {
      method: "POST",
      body: {},
    });
    if (lead.status === 429) {
      hit429 = true;
      break;
    }
  }
  assert.ok(hit429, "Expected at least one 429 response from widget lead rate limiting");

  console.log("All widget API regression checks passed.");
}

main().catch((error) => {
  console.error("Widget regression tests failed:", error);
  process.exitCode = 1;
});
