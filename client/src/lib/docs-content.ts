import adminOperationsMd from "../../../docs/gitbook/admin-operations.md?raw";
import introductionMd from "../../../docs/gitbook/introduction.md?raw";
import plansAndAccessMd from "../../../docs/gitbook/plans-and-access.md?raw";
import quickstartMd from "../../../docs/gitbook/quickstart.md?raw";
import teamAndPermissionsMd from "../../../docs/gitbook/team-and-permissions.md?raw";
import troubleshootingMd from "../../../docs/gitbook/troubleshooting.md?raw";
import integrationsOverviewMd from "../../../docs/gitbook/integrations/README.md?raw";
import discordIntegrationMd from "../../../docs/gitbook/integrations/discord.md?raw";
import telegramIntegrationMd from "../../../docs/gitbook/integrations/telegram.md?raw";
import websiteWidgetLeadCaptureMd from "../../../docs/gitbook/integrations/website-widget-lead-capture.md?raw";

export type DocsPageMeta = {
  id: string;
  title: string;
  description: string;
  docsPath: string;
  appPath: string;
  section: string;
  sectionTitle: string;
  markdown: string;
};

type DocsPageSeed = Omit<DocsPageMeta, "appPath">;

function docsPathToAppPath(docsPath: string): string {
  const normalized = docsPath.trim().replace(/\/+$/, "");
  if (!normalized || normalized === "/") return "/help/docs";
  return `/help/docs${normalized.startsWith("/") ? normalized : `/${normalized}`}`;
}

function createPage(seed: DocsPageSeed): DocsPageMeta {
  return {
    ...seed,
    appPath: docsPathToAppPath(seed.docsPath),
  };
}

export const docsPages: DocsPageMeta[] = [
  createPage({
    id: "introduction",
    title: "Introduction",
    description: "What ModerateAI does across Website, Telegram, and Discord.",
    docsPath: "/introduction",
    section: "getting-started",
    sectionTitle: "Getting Started",
    markdown: introductionMd,
  }),
  createPage({
    id: "quickstart",
    title: "Quickstart",
    description: "Create an account, set up your workspace, and connect your first integration.",
    docsPath: "/quickstart",
    section: "getting-started",
    sectionTitle: "Getting Started",
    markdown: quickstartMd,
  }),
  createPage({
    id: "plans-and-access",
    title: "Plans and Access",
    description: "Understand plan activation, access controls, and availability by tier.",
    docsPath: "/plans-and-access",
    section: "getting-started",
    sectionTitle: "Getting Started",
    markdown: plansAndAccessMd,
  }),
  createPage({
    id: "integrations",
    title: "Integrations Overview",
    description: "Overview of Website Widget, Telegram, and Discord integrations.",
    docsPath: "/integrations",
    section: "integrations",
    sectionTitle: "Integrations",
    markdown: integrationsOverviewMd,
  }),
  createPage({
    id: "website-widget-lead-capture",
    title: "Website Widget + Lead Capture",
    description: "Configure the website widget, domain routing, and lead capture workflows.",
    docsPath: "/integrations/website-widget-lead-capture",
    section: "integrations",
    sectionTitle: "Integrations",
    markdown: websiteWidgetLeadCaptureMd,
  }),
  createPage({
    id: "telegram",
    title: "Telegram",
    description: "Set up the Telegram bot, claim groups, and configure responses.",
    docsPath: "/integrations/telegram",
    section: "integrations",
    sectionTitle: "Integrations",
    markdown: telegramIntegrationMd,
  }),
  createPage({
    id: "discord",
    title: "Discord",
    description: "Set up the Discord bot, server/channel enablement, and response controls.",
    docsPath: "/integrations/discord",
    section: "integrations",
    sectionTitle: "Integrations",
    markdown: discordIntegrationMd,
  }),
  createPage({
    id: "team-and-permissions",
    title: "Team and Permissions",
    description: "Roles, workspace access inheritance, and permission behavior.",
    docsPath: "/team-and-permissions",
    section: "operations",
    sectionTitle: "Operations",
    markdown: teamAndPermissionsMd,
  }),
  createPage({
    id: "admin-operations",
    title: "Admin Operations",
    description: "Admin workflows for users, recovery, plans, and operational tasks.",
    docsPath: "/admin-operations",
    section: "operations",
    sectionTitle: "Operations",
    markdown: adminOperationsMd,
  }),
  createPage({
    id: "troubleshooting",
    title: "Troubleshooting",
    description: "Resolve setup, integration, docs, and runtime issues quickly.",
    docsPath: "/troubleshooting",
    section: "operations",
    sectionTitle: "Operations",
    markdown: troubleshootingMd,
  }),
];

