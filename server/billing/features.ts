import type { User } from "@shared/schema";
import { isInternalAccountRole, normalizePlan, type Plan } from "./entitlements";

export type ModerationPreset = "basic" | "custom" | "advanced";
export type AnalyticsTier = "none" | "standard" | "deep";

function isInternal(user: Pick<User, "role"> | null | undefined): boolean {
  return isInternalAccountRole(String(user?.role ?? "").toLowerCase());
}

export function getPlanForUser(user: Pick<User, "plan" | "role"> | null | undefined): Plan {
  if (isInternal(user)) return "pro";
  return normalizePlan((user as any)?.plan);
}

export function getConversationHistoryWindowDaysForUser(
  user: Pick<User, "plan" | "role"> | null | undefined,
): number | null {
  if (isInternal(user)) return null;
  const plan = getPlanForUser(user);
  if (plan === "pro") return 365;
  if (plan === "standard") return 90;
  return 7;
}

export function getAnalyticsTierForUser(
  user: Pick<User, "plan" | "role"> | null | undefined,
): AnalyticsTier {
  if (isInternal(user)) return "deep";
  const plan = getPlanForUser(user);
  if (plan === "pro") return "deep";
  if (plan === "standard") return "standard";
  return "none";
}

export function isSentimentAnalysisAvailableForUser(
  user: Pick<User, "plan" | "role"> | null | undefined,
): boolean {
  if (isInternal(user)) return true;
  return getPlanForUser(user) !== "free";
}

export function getDefaultModerationPresetForUser(
  user: Pick<User, "plan" | "role"> | null | undefined,
): ModerationPreset {
  if (isInternal(user)) return "advanced";
  const plan = getPlanForUser(user);
  if (plan === "pro") return "advanced";
  if (plan === "standard") return "custom";
  return "basic";
}

export function getAllowedModerationPresetsForUser(
  user: Pick<User, "plan" | "role"> | null | undefined,
): ModerationPreset[] {
  if (isInternal(user)) return ["basic", "custom", "advanced"];
  const plan = getPlanForUser(user);
  if (plan === "pro") return ["basic", "custom", "advanced"];
  if (plan === "standard") return ["basic", "custom"];
  return ["basic"];
}

export function getModerationStrictnessForPreset(preset: ModerationPreset): number {
  if (preset === "advanced") return 80;
  if (preset === "custom") return 65;
  return 45;
}

export function canExportData(user: Pick<User, "plan" | "role"> | null | undefined): boolean {
  return getAnalyticsTierForUser(user) === "deep";
}

export function canAccessAuditLog(user: Pick<User, "plan" | "role"> | null | undefined): boolean {
  return getAnalyticsTierForUser(user) === "deep";
}
