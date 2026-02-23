import assert from "node:assert/strict";
import { eq, inArray } from "drizzle-orm";
import { db } from "../server/db";
import { users } from "../shared/schema";

type JsonRecord = Record<string, unknown>;

type ApiResult = {
  status: number;
  body: unknown;
  headers: Headers;
};

type SafeUser = {
  id: number;
  email: string;
  role: string;
  workspaceOwnerId?: number | null;
  planSelectedAt?: string | null;
};

const BASE_URL = String(process.env.TEST_BASE_URL || process.env.FRONTEND_URL || "http://localhost:5000").replace(
  /\/+$/,
  "",
);

const PASSWORD = "JourneyPass123!";
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

function needsPlanSelection(user: SafeUser): boolean {
  const planSelectedAt = user.planSelectedAt ?? null;
  const isAdmin = user.role === "admin" || user.role === "owner";
  const isWorkspaceMember = Boolean(user.workspaceOwnerId);
  return !isAdmin && !isWorkspaceMember && !planSelectedAt;
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

async function login(email: string, password: string): Promise<string> {
  const loginResult = await apiRequest("/api/login", {
    method: "POST",
    body: { email, password },
  });
  assert.equal(
    loginResult.status,
    200,
    `Expected login 200 for ${email}, got ${loginResult.status} (${JSON.stringify(loginResult.body)})`,
  );
  const cookie = extractCookie(loginResult.headers);
  assert.ok(cookie, `Expected session cookie for ${email}`);
  return cookie;
}

async function createAccount(email: string, fullName: string, password: string): Promise<void> {
  const signup = await apiRequest("/api/signup", {
    method: "POST",
    body: { email, fullName, password },
  });
  assert.equal(signup.status, 201, `Expected signup 201, got ${signup.status} (${JSON.stringify(signup.body)})`);
}

async function fetchSafeUser(cookie: string): Promise<SafeUser> {
  const me = await apiRequest("/api/user", { cookie });
  assert.equal(me.status, 200, `Expected /api/user 200, got ${me.status} (${JSON.stringify(me.body)})`);
  return me.body as SafeUser;
}

async function verifyDashboardApis(cookie: string): Promise<void> {
  const dashboardStats = await apiRequest("/api/dashboard/stats", { cookie });
  assert.equal(
    dashboardStats.status,
    200,
    `Expected /api/dashboard/stats 200, got ${dashboardStats.status} (${JSON.stringify(dashboardStats.body)})`,
  );

  const platforms = await apiRequest("/api/platforms", { cookie });
  assert.equal(
    platforms.status,
    200,
    `Expected /api/platforms 200, got ${platforms.status} (${JSON.stringify(platforms.body)})`,
  );

  const recentActivity = await apiRequest("/api/dashboard/recent-activity", { cookie });
  assert.equal(
    recentActivity.status,
    200,
    `Expected /api/dashboard/recent-activity 200, got ${recentActivity.status} (${JSON.stringify(recentActivity.body)})`,
  );

  const widgetUsage = await apiRequest("/api/widget/usage", { cookie });
  assert.equal(
    widgetUsage.status,
    200,
    `Expected /api/widget/usage 200, got ${widgetUsage.status} (${JSON.stringify(widgetUsage.body)})`,
  );
}

async function testRegularUserJourney(seed: string): Promise<void> {
  const email = `journey-${seed}@example.com`;
  const fullName = "Journey Test User";

  await createAccount(email, fullName, PASSWORD);

  const cookie = await login(email, PASSWORD);

  const beforePlan = await fetchSafeUser(cookie);
  assert.equal(beforePlan.role, "user", "Expected regular user role for journey account");
  assert.equal(
    needsPlanSelection(beforePlan),
    true,
    `Expected regular user to require plan selection before choose-plan (${JSON.stringify(beforePlan)})`,
  );

  const selectFree = await apiRequest("/api/billing/select-plan", {
    method: "POST",
    cookie,
    body: { plan: "free" },
  });
  assert.equal(
    selectFree.status,
    200,
    `Expected free plan selection 200, got ${selectFree.status} (${JSON.stringify(selectFree.body)})`,
  );

  const afterPlan = await fetchSafeUser(cookie);
  assert.equal(
    needsPlanSelection(afterPlan),
    false,
    `Expected plan-selection requirement to clear after choosing free (${JSON.stringify(afterPlan)})`,
  );
  assert.ok(afterPlan.planSelectedAt, "Expected planSelectedAt to be set after selecting free plan");

  await verifyDashboardApis(cookie);
}

async function testSyntheticOwnerBypass(seed: string): Promise<string> {
  const syntheticOwnerEmail = `journey-owner-${seed}@example.com`;
  const fullName = "Journey Owner Test";
  await createAccount(syntheticOwnerEmail, fullName, PASSWORD);

  const [created] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, syntheticOwnerEmail))
    .limit(1);
  assert.ok(created?.id, "Expected synthetic owner user row");

  await db
    .update(users)
    .set({
      role: "owner",
      workspaceOwnerId: null,
      workspaceRole: "admin",
      planSelectedAt: null,
      planUpdatedAt: new Date(),
    } as any)
    .where(eq(users.id, created.id));

  const cookie = await login(syntheticOwnerEmail, PASSWORD);
  const owner = await fetchSafeUser(cookie);
  assert.equal(owner.role, "owner", `Expected synthetic owner role, got ${owner.role}`);
  assert.equal(
    needsPlanSelection(owner),
    false,
    `Expected owner/admin to bypass plan selection (${JSON.stringify(owner)})`,
  );

  await verifyDashboardApis(cookie);
  return syntheticOwnerEmail;
}

async function maybeTestOwnerBypass(seed: string): Promise<string | null> {
  const ownerEmail = String(process.env.E2E_OWNER_EMAIL || process.env.OWNER_EMAIL || "").trim().toLowerCase();
  const ownerPassword = String(process.env.E2E_OWNER_PASSWORD || process.env.OWNER_PASSWORD || "").trim();

  if (!ownerEmail || !ownerPassword) {
    console.log("Owner credentials not provided; running synthetic owner bypass scenario.");
    return testSyntheticOwnerBypass(seed);
  }

  const cookie = await login(ownerEmail, ownerPassword);
  const owner = await fetchSafeUser(cookie);

  assert.ok(
    owner.role === "owner" || owner.role === "admin",
    `Expected owner/admin role for bypass scenario, got ${owner.role}`,
  );
  assert.equal(
    needsPlanSelection(owner),
    false,
    `Expected owner/admin to bypass plan selection (${JSON.stringify(owner)})`,
  );

  await verifyDashboardApis(cookie);
  return null;
}

async function main() {
  const seed = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
  const createdEmails = [`journey-${seed}@example.com`];

  console.log(`Running auth+onboarding journey checks against ${BASE_URL}`);

  try {
    await testRegularUserJourney(seed);
    const syntheticOwnerEmail = await maybeTestOwnerBypass(seed);
    if (syntheticOwnerEmail) createdEmails.push(syntheticOwnerEmail);
    console.log("Journey checks passed.");
  } finally {
    const rows = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(inArray(users.email, createdEmails));
    const ids = rows.map((row) => row.id);
    if (ids.length > 0) {
      await db.delete(users).where(inArray(users.id, ids));
    }
  }
}

main().catch((error) => {
  console.error("Journey checks failed:", error);
  process.exitCode = 1;
});
