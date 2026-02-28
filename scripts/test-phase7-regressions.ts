import "dotenv/config";
import assert from "node:assert/strict";

type ApiResult = {
  status: number;
  body: unknown;
  headers: Headers;
};

const BASE_URL = String(process.env.TEST_BASE_URL || process.env.FRONTEND_URL || "http://127.0.0.1:5000").replace(
  /\/+$/,
  "",
);
const PASSWORD = String(process.env.E2E_SMOKE_PASSWORD || "SmokePass123!").trim();
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
  } = {},
): Promise<ApiResult> {
  const headers: Record<string, string> = { ...(options.headers ?? {}) };
  if (options.body !== undefined && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  if (options.cookie) headers.Cookie = options.cookie;
  if (AUTH_RATE_LIMIT_TEST_BYPASS_TOKEN) {
    headers[AUTH_RATE_LIMIT_TEST_BYPASS_HEADER] = AUTH_RATE_LIMIT_TEST_BYPASS_TOKEN;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  return {
    status: response.status,
    body,
    headers: response.headers,
  };
}

async function ensureOwnerSession(): Promise<{ email: string; cookie: string }> {
  const ownerEmail = String(process.env.E2E_SMOKE_OWNER_EMAIL || process.env.OWNER_EMAIL || "admin@moderateai.net")
    .trim()
    .toLowerCase();
  const ownerPassword = String(process.env.E2E_SMOKE_OWNER_PASSWORD || process.env.OWNER_PASSWORD || PASSWORD).trim();

  let login = await apiRequest("/api/login", {
    method: "POST",
    body: { email: ownerEmail, password: ownerPassword },
  });

  if (login.status === 401) {
    const signup = await apiRequest("/api/signup", {
      method: "POST",
      body: {
        email: ownerEmail,
        password: ownerPassword,
        fullName: "Phase7 Observability Owner",
      },
    });
    assert.ok(
      signup.status === 201 || signup.status === 409,
      `Expected owner signup 201/409, got ${signup.status} (${JSON.stringify(signup.body)})`,
    );

    login = await apiRequest("/api/login", {
      method: "POST",
      body: { email: ownerEmail, password: ownerPassword },
    });
  }

  assert.equal(login.status, 200, `Expected owner login 200, got ${login.status} (${JSON.stringify(login.body)})`);
  const cookie = extractCookie(login.headers);
  assert.ok(cookie, "Expected owner login session cookie");

  return { email: ownerEmail, cookie };
}

async function main() {
  console.log(`Running Phase 7 security/observability regressions against ${BASE_URL}`);

  const health = await apiRequest("/api/health");
  assert.equal(health.status, 200, `Expected /api/health 200, got ${health.status} (${JSON.stringify(health.body)})`);

  const requestId = String(health.headers.get("x-request-id") ?? "").trim();
  assert.ok(requestId.length >= 8, "Expected x-request-id response header");

  const xContentTypeOptions = String(health.headers.get("x-content-type-options") ?? "").toLowerCase();
  assert.equal(xContentTypeOptions, "nosniff", "Expected X-Content-Type-Options=nosniff");

  const xFrameOptions = String(health.headers.get("x-frame-options") ?? "").toUpperCase();
  assert.equal(xFrameOptions, "DENY", "Expected X-Frame-Options=DENY");

  const referrerPolicy = String(health.headers.get("referrer-policy") ?? "").toLowerCase();
  assert.equal(
    referrerPolicy,
    "strict-origin-when-cross-origin",
    "Expected Referrer-Policy=strict-origin-when-cross-origin",
  );

  const owner = await ensureOwnerSession();
  console.log(`Authenticated owner for observability checks: ${owner.email}`);

  const runtimeObs = await apiRequest("/api/admin/ops/runtime-observability", { cookie: owner.cookie });
  assert.equal(
    runtimeObs.status,
    200,
    `Expected runtime observability endpoint 200, got ${runtimeObs.status} (${JSON.stringify(runtimeObs.body)})`,
  );

  const payload = (runtimeObs.body ?? {}) as Record<string, any>;
  assert.equal(payload.requestTracing?.header, "X-Request-Id", "Expected requestTracing.header to be X-Request-Id");
  assert.ok(
    Number.isFinite(Number(payload.requestTracing?.slowRequestThresholdMs)),
    "Expected numeric requestTracing.slowRequestThresholdMs",
  );

  const eventCodes = Array.isArray(payload.events) ? payload.events.map((entry: any) => String(entry?.code ?? "")) : [];
  assert.ok(eventCodes.includes("API_SLOW_REQUEST"), "Expected API_SLOW_REQUEST in runtime observability events");
  assert.ok(eventCodes.includes("API_5XX_RESPONSE"), "Expected API_5XX_RESPONSE in runtime observability events");

  console.log("Phase 7 security/observability regressions passed.");
}

main().catch((error) => {
  console.error("Phase 7 security/observability regressions failed:", error);
  process.exit(1);
});
