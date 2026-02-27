import assert from "node:assert/strict";
import { chromium, request } from "playwright";

type SafeUser = {
  role: string;
  workspaceOwnerId?: number | null;
  planSelectedAt?: string | null;
};

const BASE_URL = String(
  process.env.TEST_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || process.env.FRONTEND_URL || "http://127.0.0.1:5000",
).replace(/\/+$/, "");
const PASSWORD = String(process.env.E2E_SMOKE_PASSWORD || "SmokePass123!");
const AUTH_RATE_LIMIT_TEST_BYPASS_TOKEN = String(process.env.AUTH_RATE_LIMIT_TEST_BYPASS_TOKEN ?? "").trim();
const AUTH_RATE_LIMIT_TEST_BYPASS_HEADER = "x-auth-rate-limit-test-bypass";

const PUBLIC_ROUTES = ["/", "/auth", "/privacy-policy", "/terms-of-service"];
const APP_ROUTES = [
  "/dashboard",
  "/conversations",
  "/knowledge-base",
  "/integrations/telegram",
  "/integrations/discord",
  "/integrations/website",
  "/admin/users",
  "/admin/ops/admin-history-learning",
  "/settings",
  "/help",
];

function needsPlanSelection(user: SafeUser): boolean {
  const isAdmin = user.role === "admin" || user.role === "owner";
  const isWorkspaceMember = Boolean(user.workspaceOwnerId);
  return !isAdmin && !isWorkspaceMember && !user.planSelectedAt;
}

async function ensureAuthenticatedStorageState() {
  const extraHeaders: Record<string, string> = {};
  if (AUTH_RATE_LIMIT_TEST_BYPASS_TOKEN) {
    extraHeaders[AUTH_RATE_LIMIT_TEST_BYPASS_HEADER] = AUTH_RATE_LIMIT_TEST_BYPASS_TOKEN;
  }

  const api = await request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: extraHeaders,
  });

  const explicitOwnerEmail = String(process.env.E2E_SMOKE_OWNER_EMAIL || process.env.OWNER_EMAIL || "").trim();
  const explicitOwnerPassword = String(process.env.E2E_SMOKE_OWNER_PASSWORD || process.env.OWNER_PASSWORD || "").trim();

  let email = explicitOwnerEmail;
  let password = explicitOwnerPassword;
  let fullName = "ModerateAI Smoke User";

  if (!email || !password) {
    const seed = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
    email = `playwright-smoke-${seed}@example.com`;
    password = PASSWORD;
    fullName = "Playwright Smoke User";

    const signup = await api.post("/api/signup", {
      data: { email, password, fullName },
    });
    assert.ok(
      signup.status() === 201 || signup.status() === 409,
      `Expected signup 201/409, got ${signup.status()} (${await signup.text()})`,
    );
  }

  const login = await api.post("/api/login", {
    data: { email, password },
  });
  assert.equal(login.status(), 200, `Expected login 200, got ${login.status()} (${await login.text()})`);

  const meResponse = await api.get("/api/user");
  assert.equal(
    meResponse.status(),
    200,
    `Expected /api/user 200, got ${meResponse.status()} (${await meResponse.text()})`,
  );
  const user = (await meResponse.json()) as SafeUser;

  if (needsPlanSelection(user)) {
    const selectPlan = await api.post("/api/billing/select-plan", {
      data: { plan: "free" },
    });
    assert.equal(
      selectPlan.status(),
      200,
      `Expected free plan selection 200, got ${selectPlan.status()} (${await selectPlan.text()})`,
    );
  }

  const storageState = await api.storageState();
  await api.dispose();
  return storageState;
}

async function assertRouteLoads(route: string, contextName: "public" | "app", storageState?: any) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext(storageState ? { storageState } : undefined);
  const page = await context.newPage();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  try {
    const response = await page.goto(`${BASE_URL}${route}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    assert.ok(response, `No response returned for ${route}`);
    assert.ok(response.ok(), `Document request failed for ${route}: ${response.status()} ${response.statusText()}`);

    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
    await page.waitForTimeout(150);

    const bodyText = (await page.locator("body").innerText()).trim();
    assert.ok(bodyText.length > 0, `Expected rendered text content for ${contextName} route ${route}`);
    assert.equal(pageErrors.length, 0, `Unhandled browser error(s) on ${route}: ${pageErrors.join(" | ")}`);
  } finally {
    await context.close();
    await browser.close();
  }
}

async function main() {
  console.log(`Running Playwright smoke checks against ${BASE_URL}`);

  for (const route of PUBLIC_ROUTES) {
    console.log(`Smoke check (public): ${route}`);
    await assertRouteLoads(route, "public");
  }

  const storageState = await ensureAuthenticatedStorageState();
  for (const route of APP_ROUTES) {
    console.log(`Smoke check (app): ${route}`);
    await assertRouteLoads(route, "app", storageState);
  }

  console.log("Playwright smoke checks passed.");
}

main().catch((error) => {
  console.error("Playwright smoke checks failed:", error);
  process.exitCode = 1;
});

