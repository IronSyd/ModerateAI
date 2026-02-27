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
const REQUIRE_ADMIN_ROUTE_CHECKS = String(process.env.PLAYWRIGHT_REQUIRE_ADMIN_ROUTES ?? "0")
  .trim()
  .toLowerCase();

type RouteCheck = {
  path: string;
  markers: RegExp[];
  requiresAdmin?: boolean;
};

const PUBLIC_ROUTE_CHECKS: RouteCheck[] = [
  { path: "/", markers: [/Powerful Features/i, /Seamless Integrations/i, /Simple, Transparent Pricing/i] },
  { path: "/auth", markers: [/Sign In/i, /Create account/i, /Password/i] },
  { path: "/privacy-policy", markers: [/Privacy Policy/i] },
  { path: "/terms-of-service", markers: [/Terms of Service/i] },
];

const APP_ROUTE_CHECKS: RouteCheck[] = [
  { path: "/dashboard", markers: [/Workspace Overview/i] },
  { path: "/conversations", markers: [/Manage Conversations/i, /Conversations/i] },
  { path: "/knowledge-base", markers: [/Knowledge Base/i] },
  { path: "/integrations/telegram", markers: [/Telegram Integration/i] },
  { path: "/integrations/discord", markers: [/Discord Integration/i] },
  { path: "/integrations/website", markers: [/Website Integration/i] },
  { path: "/settings", markers: [/Notification Settings/i, /Moderation Controls/i, /Account Actions/i] },
  { path: "/help", markers: [/ModerateAI Docs Hub/i] },
  { path: "/admin/users", markers: [/All Users/i, /Workspace Integrations/i], requiresAdmin: true },
  {
    path: "/admin/ops/admin-history-learning",
    markers: [/Backfill/i, /Auto-Analysis/i, /Run Backfill Now/i],
    requiresAdmin: true,
  },
];

function isTruthyFlag(value: string): boolean {
  return ["1", "true", "yes", "on"].includes(value);
}

function normalizePathname(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

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
  return { storageState, user };
}

async function assertRouteLoads(route: RouteCheck, contextName: "public" | "app", storageState?: any) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext(storageState ? { storageState } : undefined);
  const page = await context.newPage();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  try {
    const response = await page.goto(`${BASE_URL}${route.path}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    assert.ok(response, `No response returned for ${route.path}`);
    assert.ok(
      response.ok(),
      `Document request failed for ${route.path}: ${response.status()} ${response.statusText()}`,
    );

    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
    await page.waitForTimeout(150);

    const resolvedPath = normalizePathname(new URL(page.url()).pathname);
    const expectedPath = normalizePathname(route.path);
    assert.equal(
      resolvedPath,
      expectedPath,
      `Unexpected route resolution for ${route.path}: landed on ${resolvedPath}`,
    );

    const bodyText = (await page.locator("body").innerText()).trim();
    assert.ok(bodyText.length > 0, `Expected rendered text content for ${contextName} route ${route.path}`);

    const matchedMarker = route.markers.some((marker) => marker.test(bodyText));
    assert.ok(
      matchedMarker,
      `Route marker not found for ${route.path}. Checked markers: ${route.markers
        .map((marker) => marker.toString())
        .join(", ")}`,
    );

    assert.equal(pageErrors.length, 0, `Unhandled browser error(s) on ${route.path}: ${pageErrors.join(" | ")}`);
  } finally {
    await context.close();
    await browser.close();
  }
}

async function main() {
  console.log(`Running Playwright smoke checks against ${BASE_URL}`);

  for (const route of PUBLIC_ROUTE_CHECKS) {
    console.log(`Smoke check (public): ${route.path}`);
    await assertRouteLoads(route, "public");
  }

  const { storageState, user } = await ensureAuthenticatedStorageState();
  const isAdminUser = user.role === "admin" || user.role === "owner";
  const requireAdminRouteChecks = isTruthyFlag(REQUIRE_ADMIN_ROUTE_CHECKS);

  if (!isAdminUser && requireAdminRouteChecks) {
    assert.fail(
      "PLAYWRIGHT_REQUIRE_ADMIN_ROUTES is enabled but authenticated user is not admin/owner. " +
        "Provide E2E_SMOKE_OWNER_EMAIL and E2E_SMOKE_OWNER_PASSWORD.",
    );
  }

  const selectedAppRoutes = APP_ROUTE_CHECKS.filter((route) => {
    if (!route.requiresAdmin) return true;
    return isAdminUser;
  });
  const skippedAdminRoutes = APP_ROUTE_CHECKS.filter((route) => route.requiresAdmin && !isAdminUser).map(
    (route) => route.path,
  );

  if (skippedAdminRoutes.length > 0) {
    console.log(
      `Skipping admin-only routes for non-admin user (${user.role}): ${skippedAdminRoutes.join(", ")}. ` +
        "Set E2E_SMOKE_OWNER_EMAIL/E2E_SMOKE_OWNER_PASSWORD to enforce admin smoke coverage.",
    );
  }

  for (const route of selectedAppRoutes) {
    console.log(`Smoke check (app): ${route.path}`);
    await assertRouteLoads(route, "app", storageState);
  }

  console.log("Playwright smoke checks passed.");
}

main().catch((error) => {
  console.error("Playwright smoke checks failed:", error);
  process.exitCode = 1;
});
