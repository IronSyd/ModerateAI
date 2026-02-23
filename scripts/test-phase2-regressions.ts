import "dotenv/config";
import assert from "node:assert/strict";
import { eq, inArray } from "drizzle-orm";
import { db } from "../server/db";
import { users } from "../shared/schema";

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
const PASSWORD = "Phase2RegressPass123!";
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

function getAuditItems(payload: unknown): Array<Record<string, unknown>> {
  if (!payload || typeof payload !== "object") return [];
  const raw = (payload as any).items;
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
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

async function setOwnerRole(userId: number): Promise<void> {
  await db
    .update(users)
    .set({
      role: "owner",
      workspaceOwnerId: null,
      workspaceRole: "admin",
      planSelectedAt: null,
      planUpdatedAt: new Date(),
    } as any)
    .where(eq(users.id, userId));
}

async function setProPlan(userId: number): Promise<void> {
  await db
    .update(users)
    .set({
      plan: "pro",
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

  console.log(`Running Phase 2 regressions against ${BASE_URL}`);

  try {
    const proUser = await createAndLoginUser(`phase2-pro-${seed}@example.com`, "Phase2 Pro");
    createdUserIds.push(proUser.id);

    await setProPlan(proUser.id);

    console.log("Test 1: workspace settings update is persisted to audit trail");
    const workspacePatch = await apiRequest("/api/workspace/settings", {
      method: "PATCH",
      cookie: proUser.cookie,
      body: {
        moderationPreset: "advanced",
        moderationRules: {
          blockedKeywords: ["spam phrase", "scam-url"],
          allowedKeywords: ["support ticket"],
          spamSensitivity: 68,
          strictness: 74,
        },
      },
    });
    assert.equal(
      workspacePatch.status,
      200,
      `Expected workspace settings patch 200, got ${workspacePatch.status} (${JSON.stringify(workspacePatch.body)})`,
    );

    const workspaceAudit = await apiRequest("/api/audit-log?action=workspace.settings_updated&limit=100", {
      cookie: proUser.cookie,
    });
    assert.equal(
      workspaceAudit.status,
      200,
      `Expected workspace audit endpoint 200, got ${workspaceAudit.status} (${JSON.stringify(workspaceAudit.body)})`,
    );
    const workspaceItems = getAuditItems(workspaceAudit.body);
    assert.ok(
      workspaceItems.length >= 1,
      `Expected at least one workspace.settings_updated audit event, got ${JSON.stringify(workspaceAudit.body)}`,
    );

    console.log("Test 2: message export is recorded to audit trail");
    const exportMessages = await apiRequest("/api/export/messages?format=json", {
      cookie: proUser.cookie,
    });
    assert.equal(
      exportMessages.status,
      200,
      `Expected export endpoint 200, got ${exportMessages.status} (${JSON.stringify(exportMessages.body)})`,
    );

    const exportAudit = await apiRequest("/api/audit-log?action=data_export.messages&limit=100", {
      cookie: proUser.cookie,
    });
    assert.equal(
      exportAudit.status,
      200,
      `Expected export audit endpoint 200, got ${exportAudit.status} (${JSON.stringify(exportAudit.body)})`,
    );
    const exportItems = getAuditItems(exportAudit.body);
    assert.ok(
      exportItems.length >= 1,
      `Expected at least one data_export.messages audit event, got ${JSON.stringify(exportAudit.body)}`,
    );

    console.log("Test 3: admin billing actions are persisted to audit trail");
    const customerUser = await createAndLoginUser(`phase2-customer-${seed}@example.com`, "Phase2 Customer");
    const ownerUser = await createAndLoginUser(`phase2-owner-${seed}@example.com`, "Phase2 Owner");
    createdUserIds.push(customerUser.id, ownerUser.id);

    await setOwnerRole(ownerUser.id);
    const ownerCookie = await login(ownerUser.email, PASSWORD);

    const activatePlan = await apiRequest(`/api/admin/users/${customerUser.id}/activate-plan`, {
      method: "POST",
      cookie: ownerCookie,
      body: {
        plan: "standard",
        durationDays: 30,
      },
    });
    assert.equal(
      activatePlan.status,
      200,
      `Expected activate-plan 200, got ${activatePlan.status} (${JSON.stringify(activatePlan.body)})`,
    );

    const allowBilling = await apiRequest(`/api/admin/users/${customerUser.id}/allow-billing`, {
      method: "POST",
      cookie: ownerCookie,
      body: {
        durationDays: 15,
      },
    });
    assert.equal(
      allowBilling.status,
      200,
      `Expected allow-billing 200, got ${allowBilling.status} (${JSON.stringify(allowBilling.body)})`,
    );

    const downgradeToFree = await apiRequest(`/api/admin/users/${customerUser.id}/downgrade-to-free`, {
      method: "POST",
      cookie: ownerCookie,
      body: {},
    });
    assert.equal(
      downgradeToFree.status,
      200,
      `Expected downgrade-to-free 200, got ${downgradeToFree.status} (${JSON.stringify(downgradeToFree.body)})`,
    );

    const activateAudit = await apiRequest("/api/audit-log?action=admin.billing_activate_plan&limit=200", {
      cookie: ownerCookie,
    });
    assert.equal(
      activateAudit.status,
      200,
      `Expected activate-plan audit 200, got ${activateAudit.status} (${JSON.stringify(activateAudit.body)})`,
    );
    const activateItems = getAuditItems(activateAudit.body);
    assert.ok(
      activateItems.some(
        (item) => Number(item.targetId ?? 0) === customerUser.id && Number(item.actorUserId ?? 0) === ownerUser.id,
      ),
      `Expected admin.billing_activate_plan event for target ${customerUser.id}`,
    );

    const allowAudit = await apiRequest("/api/audit-log?action=admin.billing_allow&limit=200", {
      cookie: ownerCookie,
    });
    assert.equal(
      allowAudit.status,
      200,
      `Expected allow-billing audit 200, got ${allowAudit.status} (${JSON.stringify(allowAudit.body)})`,
    );
    const allowItems = getAuditItems(allowAudit.body);
    assert.ok(
      allowItems.some(
        (item) => Number(item.targetId ?? 0) === customerUser.id && Number(item.actorUserId ?? 0) === ownerUser.id,
      ),
      `Expected admin.billing_allow event for target ${customerUser.id}`,
    );

    const downgradeAudit = await apiRequest("/api/audit-log?action=admin.billing_downgrade_free&limit=200", {
      cookie: ownerCookie,
    });
    assert.equal(
      downgradeAudit.status,
      200,
      `Expected downgrade audit 200, got ${downgradeAudit.status} (${JSON.stringify(downgradeAudit.body)})`,
    );
    const downgradeItems = getAuditItems(downgradeAudit.body);
    assert.ok(
      downgradeItems.some(
        (item) => Number(item.targetId ?? 0) === customerUser.id && Number(item.actorUserId ?? 0) === ownerUser.id,
      ),
      `Expected admin.billing_downgrade_free event for target ${customerUser.id}`,
    );

    console.log("Phase 2 regression checks passed.");
  } finally {
    if (createdUserIds.length > 0) {
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }
  }
}

main().catch((error) => {
  console.error("Phase 2 regression checks failed:", error);
  process.exitCode = 1;
});
