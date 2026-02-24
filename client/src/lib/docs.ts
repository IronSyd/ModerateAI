import { docsPages, type DocsPageMeta } from "@/lib/docs-content";

export type { DocsPageMeta };

export type DocsSection = {
  id: string;
  title: string;
  description: string;
  path: string;
  appPath: string;
};

const docsPageById = new Map(docsPages.map((page) => [page.id, page] as const));
const docsPageByDocsPath = new Map(docsPages.map((page) => [page.docsPath, page] as const));
const docsPageByAppPath = new Map(docsPages.map((page) => [page.appPath, page] as const));

export const docsSections: DocsSection[] = [
  {
    id: "introduction",
    title: "Introduction",
    description: "What ModerateAI does: support and leads in one workspace.",
    path: "/introduction",
    appPath: "/help/docs/introduction",
  },
  {
    id: "quickstart",
    title: "Quickstart",
    description: "Create an account, sign in, and launch your first workspace.",
    path: "/quickstart",
    appPath: "/help/docs/quickstart",
  },
  {
    id: "plans-access",
    title: "Plans and Access",
    description: "Understand Free access and Standard/Pro admin-activation flow.",
    path: "/plans-and-access",
    appPath: "/help/docs/plans-and-access",
  },
  {
    id: "integrations",
    title: "Integrations",
    description: "Connect Website Widget + Lead Capture, Telegram, and Discord.",
    path: "/integrations",
    appPath: "/help/docs/integrations",
  },
  {
    id: "team-permissions",
    title: "Team and Permissions",
    description: "Roles, inherited workspace access, and seat behavior.",
    path: "/team-and-permissions",
    appPath: "/help/docs/team-and-permissions",
  },
  {
    id: "admin-operations",
    title: "Admin Operations",
    description: "User controls, upgrades, downgrades, and password recovery.",
    path: "/admin-operations",
    appPath: "/help/docs/admin-operations",
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    description: "Fix login, activation, integration setup, and quota issues.",
    path: "/troubleshooting",
    appPath: "/help/docs/troubleshooting",
  },
];

function normalizePath(value: string): string {
  const [pathOnly] = String(value || "").split(/[?#]/);
  if (!pathOnly) return "/";
  const trimmed = pathOnly.trim();
  if (!trimmed) return "/";
  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (withLeadingSlash.length > 1) {
    return withLeadingSlash.replace(/\/+$/, "");
  }
  return withLeadingSlash;
}

function normalizeDocsPath(value: string | null | undefined): string {
  const normalized = normalizePath(String(value ?? ""));
  if (normalized === "/help/docs") return "/introduction";
  if (normalized.startsWith("/help/docs/")) {
    const stripped = normalized.slice("/help/docs".length);
    return stripped || "/introduction";
  }
  return normalized === "/" ? "/introduction" : normalized;
}

function normalizeAppDocsPath(value: string | null | undefined): string {
  const normalized = normalizePath(String(value ?? ""));
  if (normalized === "/help/docs/") return "/help/docs";
  return normalized;
}

export function getDocsPages(): DocsPageMeta[] {
  return docsPages;
}

export function getDocsPageByDocsPath(path: string | null | undefined): DocsPageMeta | null {
  const normalized = normalizeDocsPath(path);
  return docsPageByDocsPath.get(normalized) ?? null;
}

export function getDocsPageByAppPath(pathname: string | null | undefined): DocsPageMeta | null {
  const normalized = normalizeAppDocsPath(pathname);
  if (normalized === "/help/docs") {
    return docsPageById.get("introduction") ?? null;
  }
  return docsPageByAppPath.get(normalized) ?? null;
}

export function getDocsAppUrl(docsPathOrId?: string | null): string {
  const raw = String(docsPathOrId ?? "").trim();
  if (!raw || raw === "/") return "/help/docs";

  const pageById = docsPageById.get(raw);
  if (pageById) return pageById.appPath;

  const pageByDocsPath = getDocsPageByDocsPath(raw);
  if (pageByDocsPath) return pageByDocsPath.appPath;

  const normalized = normalizeAppDocsPath(raw);
  if (normalized.startsWith("/help/docs")) return normalized;

  const docsPath = normalizeDocsPath(raw);
  return `/help/docs${docsPath}`;
}

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

export function getLegacyHelpArticleAppUrl(articleId: string | null | undefined): string {
  return getDocsAppUrl(resolveLegacyHelpPath(articleId));
}

