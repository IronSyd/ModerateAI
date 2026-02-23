export type Plan = "free" | "standard" | "pro";
export type PlanStatus = "active" | "trialing" | "past_due" | "canceled";

export type Entitlements = {
  // Seat limit includes the owner. `null` means unlimited.
  seatLimit: number | null;
  // Maximum number of platform integrations that can be active. `null` means unlimited.
  integrationLimit: number | null;
  // Maximum number of Telegram groups this workspace can actively run.
  telegramGroupLimit: number | null;
  // Maximum number of Discord servers this workspace can actively run.
  discordServerLimit: number | null;
  // Maximum number of website domains/widgets this workspace can actively run.
  websiteDomainLimit: number | null;
  // Daily AI response quota.
  aiResponsesPerDay: number;
  // Knowledge base storage allowance (MB). `null` means unlimited.
  knowledgeBaseMb: number | null;
};

export const ENTITLEMENTS: Record<Plan, Entitlements> = {
  free: {
    seatLimit: 1,
    integrationLimit: 3,
    telegramGroupLimit: 1,
    discordServerLimit: 1,
    websiteDomainLimit: 1,
    aiResponsesPerDay: 20,
    knowledgeBaseMb: 10,
  },
  standard: {
    seatLimit: 5,
    integrationLimit: 3,
    telegramGroupLimit: 3,
    discordServerLimit: 3,
    websiteDomainLimit: 3,
    aiResponsesPerDay: 2500,
    knowledgeBaseMb: 250,
  },
  pro: {
    seatLimit: 20,
    integrationLimit: 3,
    telegramGroupLimit: 10,
    discordServerLimit: 10,
    websiteDomainLimit: 10,
    aiResponsesPerDay: 6000,
    knowledgeBaseMb: 1000,
  },
};

export const INTERNAL_ENTITLEMENTS: Entitlements = {
  seatLimit: null,
  integrationLimit: null,
  telegramGroupLimit: null,
  discordServerLimit: null,
  websiteDomainLimit: null,
  // Large finite number so JSON serialization doesn't turn it into `null` (Infinity is not valid JSON).
  aiResponsesPerDay: 1_000_000_000,
  knowledgeBaseMb: null,
};

export function isInternalAccountRole(role: string | undefined): boolean {
  return role === "owner" || role === "admin";
}

export function normalizePlan(input: unknown): Plan {
  const value = String(input ?? "").toLowerCase().trim();
  if (value === "standard") return "standard";
  if (value === "pro") return "pro";
  return "free";
}

export function normalizePlanStatus(input: unknown): PlanStatus {
  const value = String(input ?? "").toLowerCase().trim();
  if (value === "trialing") return "trialing";
  if (value === "past_due") return "past_due";
  if (value === "canceled") return "canceled";
  return "active";
}

export function getEntitlementsForPlan(plan: Plan): Entitlements {
  return ENTITLEMENTS[plan];
}

export function getEntitlementsForUser(user: { role?: string | null; plan?: unknown } | null | undefined): Entitlements {
  const role = String(user?.role ?? "").toLowerCase().trim();
  if (isInternalAccountRole(role)) return INTERNAL_ENTITLEMENTS;
  return ENTITLEMENTS[normalizePlan(user?.plan)];
}
