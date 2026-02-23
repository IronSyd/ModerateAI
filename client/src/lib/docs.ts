export type DocsSection = {
  id: string;
  title: string;
  description: string;
  path: string;
};

function normalizeBaseUrl(value: unknown): string | null {
  const base = String(value ?? "").trim().replace(/\/+$/, "");
  return base.length > 0 ? base : null;
}

export function getDocsBaseUrl(): string | null {
  return normalizeBaseUrl(import.meta.env.VITE_DOCS_BASE_URL);
}

export function getDocsUrl(path: string = "/"): string | null {
  const base = getDocsBaseUrl();
  if (!base) return null;
  if (!path || path === "/") return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function hasDocsBaseUrl(): boolean {
  return Boolean(getDocsBaseUrl());
}

export const docsSections: DocsSection[] = [
  {
    id: "introduction",
    title: "Introduction",
    description: "What ModerateAI does: support and Leads in one workspace.",
    path: "/introduction",
  },
  {
    id: "quickstart",
    title: "Quickstart",
    description: "Create an account, sign in, and launch your first workspace.",
    path: "/quickstart",
  },
  {
    id: "plans-access",
    title: "Plans and Access",
    description: "Understand Free access and Standard/Pro admin-activation flow.",
    path: "/plans-and-access",
  },
  {
    id: "integrations",
    title: "Integrations",
    description: "Connect Website Widget + Lead Capture, Telegram, and Discord.",
    path: "/integrations",
  },
  {
    id: "team-permissions",
    title: "Team and Permissions",
    description: "Roles, inherited workspace access, and seat behavior.",
    path: "/team-and-permissions",
  },
  {
    id: "admin-operations",
    title: "Admin Operations",
    description: "User controls, upgrades, downgrades, and password recovery.",
    path: "/admin-operations",
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    description: "Fix login, activation, integration setup, and quota issues.",
    path: "/troubleshooting",
  },
];

const legacyArticlePathMap: Record<string, string> = {
  onboarding: "/quickstart",
  "ai-config": "/quickstart",
  "website-integration": "/integrations/website-widget-lead-capture",
  "telegram-bot": "/integrations/telegram",
  "discord-setup": "/integrations/discord",
  "ai-training": "/team-and-permissions",
  "analytics-dashboard": "/plans-and-access",
  "response-templates": "/team-and-permissions",
  "content-rules": "/team-and-permissions",
  "custom-responses": "/team-and-permissions",
  "banned-words": "/team-and-permissions",
  "moderation-levels": "/team-and-permissions",
  "intro-video": "/introduction",
  "telegram-video": "/integrations/telegram",
  "contact-support": "/plans-and-access",
  "billing-support": "/plans-and-access",
  "team-roles": "/team-and-permissions",
  "telegram-integration": "/integrations/telegram",
  "discord-integration": "/integrations/discord",
};

export function resolveLegacyHelpPath(articleId: string | null | undefined): string {
  const key = String(articleId ?? "").trim();
  if (!key) return "/troubleshooting";
  return legacyArticlePathMap[key] ?? "/troubleshooting";
}

export function getLegacyHelpArticleDocsUrl(articleId: string | null | undefined): string | null {
  return getDocsUrl(resolveLegacyHelpPath(articleId));
}
