import privacyPolicyMarkdown from "../../../docs/legal/privacy-policy.md?raw";
import termsOfServiceMarkdown from "../../../docs/legal/terms-of-service.md?raw";

export const privacyPolicyContent = {
  title: "Privacy Policy",
  description:
    "How ModerateAI collects, uses, stores, and shares data across the website, widget, dashboard, and connected Telegram/Discord integrations.",
  markdown: privacyPolicyMarkdown,
  contactEmail: "admin@moderateai.net",
} as const;

export const termsOfServiceContent = {
  title: "Terms of Service",
  description:
    "The terms that govern use of ModerateAI across the website, dashboard, widget, and connected Telegram/Discord integrations.",
  markdown: termsOfServiceMarkdown,
  contactEmail: "admin@moderateai.net",
} as const;
