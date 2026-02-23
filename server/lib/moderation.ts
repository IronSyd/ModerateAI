import { storage } from "../storage";
import {
  getAllowedModerationPresetsForUser,
  getDefaultModerationPresetForUser,
  getModerationStrictnessForPreset,
  type ModerationPreset,
} from "../billing/features";

export type WorkspaceModerationRules = {
  blockedKeywords: string[];
  allowedKeywords: string[];
  spamSensitivity: number;
  strictness: number;
};

export type WorkspaceModerationPolicy = {
  preset: ModerationPreset;
  strictness: number;
  rules: WorkspaceModerationRules;
  ownerUserId: number | null;
};

export type ModerationSignal = {
  blockedByCustomRules: boolean;
  blockedByAdvancedAutomation: boolean;
};

const DEFAULT_RULES: WorkspaceModerationRules = {
  blockedKeywords: [],
  allowedKeywords: [],
  spamSensitivity: 50,
  strictness: 50,
};

function clampPercent(value: unknown, fallback: number): number {
  const numeric = Number(value);
  if (Number.isNaN(numeric) || !Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function normalizeKeywords(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? "").trim().toLowerCase())
    .filter((item) => item.length > 0)
    .slice(0, 250);
}

function normalizeRules(input: unknown): WorkspaceModerationRules {
  const raw = (input ?? {}) as any;
  return {
    blockedKeywords: normalizeKeywords(raw.blockedKeywords),
    allowedKeywords: normalizeKeywords(raw.allowedKeywords),
    spamSensitivity: clampPercent(raw.spamSensitivity, DEFAULT_RULES.spamSensitivity),
    strictness: clampPercent(raw.strictness, DEFAULT_RULES.strictness),
  };
}

export function containsBlockedKeyword(text: string, rules: WorkspaceModerationRules): boolean {
  const normalized = String(text ?? "").toLowerCase();
  if (!normalized) return false;
  if (rules.allowedKeywords.some((keyword) => normalized.includes(keyword))) {
    return false;
  }
  return rules.blockedKeywords.some((keyword) => normalized.includes(keyword));
}

// Advanced automation (LLM moderation checks + automated enforcement actions)
// is intentionally reserved for the `advanced` preset.
export function canUseAdvancedModerationAutomation(
  policy: Pick<WorkspaceModerationPolicy, "preset"> | null | undefined,
): boolean {
  return policy?.preset === "advanced";
}

export function getModerationSignal(params: {
  blockedByCustomRules: boolean;
  blockedByAdvancedAutomation: boolean;
}): ModerationSignal {
  return {
    blockedByCustomRules: Boolean(params.blockedByCustomRules),
    blockedByAdvancedAutomation: Boolean(params.blockedByAdvancedAutomation),
  };
}

export function isMessageBlockedByModeration(signal: ModerationSignal): boolean {
  return signal.blockedByCustomRules || signal.blockedByAdvancedAutomation;
}

export async function getWorkspaceModerationPolicyForPlatform(
  platformId: number,
): Promise<WorkspaceModerationPolicy> {
  const platform = await storage.getPlatform(platformId);
  if (!platform) {
    return {
      preset: "basic",
      strictness: getModerationStrictnessForPreset("basic"),
      rules: DEFAULT_RULES,
      ownerUserId: null,
    };
  }

  const ownerUser = await storage.getUser(platform.userId);
  const defaultPreset = getDefaultModerationPresetForUser(ownerUser as any);
  const allowedPresets = getAllowedModerationPresetsForUser(ownerUser as any);
  const workspaceSettings = await storage.getWorkspaceSettings(platform.userId);

  const requestedPreset = (workspaceSettings?.moderationPreset ?? defaultPreset) as ModerationPreset;
  const preset = allowedPresets.includes(requestedPreset) ? requestedPreset : defaultPreset;
  const rules = normalizeRules(workspaceSettings?.moderationRules);
  const strictnessFromPreset = getModerationStrictnessForPreset(preset);

  const strictness =
    preset === "custom"
      ? clampPercent(rules.strictness, strictnessFromPreset)
      : strictnessFromPreset;

  return {
    preset,
    strictness,
    rules: {
      ...rules,
      strictness,
    },
    ownerUserId: platform.userId,
  };
}
