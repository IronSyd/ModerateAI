export type RouteSeoConfig = {
  title: string;
  description: string;
  robots: string;
  canonicalPath: string;
  ogType: "website";
  faqEntries?: Array<{ question: string; answer: string }>;
};

export const SEO_SITE_NAME = "ModerateAI";
export const SEO_SITE_BASE_FALLBACK = "https://www.moderateai.net";

const SEO_DEFAULT_DESCRIPTION =
  "ModerateAI helps teams deliver AI support and capture qualified leads across Website, Telegram, and Discord in one workspace.";
const SEO_APP_DESCRIPTION =
  "ModerateAI workspace dashboard for AI support, lead capture, integrations, analytics, and operations.";

type UseCaseSeo = {
  title: string;
  description: string;
  faqEntries: Array<{ question: string; answer: string }>;
};

export const SEO_PUBLIC_USE_CASE_MAP: Record<string, UseCaseSeo> = {
  "/ai-customer-support-software": {
    title: "AI Customer Support Software | Website, Discord, Telegram | ModerateAI",
    description:
      "Scale customer support with AI across website chat, Discord, and Telegram. ModerateAI combines support, lead capture, and moderation in one workspace.",
    faqEntries: [
      {
        question: "What channels does ModerateAI support?",
        answer: "ModerateAI supports website chat, Discord servers, and Telegram groups in one workspace.",
      },
      {
        question: "Can I configure AI tone and response style?",
        answer: "Yes. Teams can configure response style, response length, moderation behavior, and knowledge context.",
      },
    ],
  },
  "/discord-moderation-bot": {
    title: "Discord Moderation Bot with AI Support Workflows | ModerateAI",
    description:
      "Automate Discord moderation and support with ModerateAI. Improve community quality, reduce manual triage, and keep responses consistent.",
    faqEntries: [
      {
        question: "Is ModerateAI only for moderation?",
        answer: "No. ModerateAI combines moderation operations with AI support workflows.",
      },
      {
        question: "Can teams iterate moderation behavior safely?",
        answer: "Yes. Admin learning and operational analytics are available for iterative refinement.",
      },
    ],
  },
  "/telegram-customer-support-bot": {
    title: "Telegram Customer Support Bot for Faster Team Response | ModerateAI",
    description:
      "Deploy a Telegram AI support bot with moderation and analytics. ModerateAI helps teams respond faster and handle volume with better consistency.",
    faqEntries: [
      {
        question: "Can ModerateAI run support workflows in Telegram?",
        answer: "Yes. ModerateAI supports Telegram AI customer support and moderation workflows.",
      },
      {
        question: "Does this connect to a shared knowledge base?",
        answer: "Yes. Knowledge can be shared across Telegram, website chat, and Discord workflows.",
      },
    ],
  },
  "/website-ai-lead-capture": {
    title: "Website AI Lead Capture Software | ModerateAI",
    description:
      "Capture qualified leads from website AI chat while answering support questions in real time. ModerateAI connects lead capture with operations and analytics.",
    faqEntries: [
      {
        question: "Can website chat capture qualified leads?",
        answer: "Yes. ModerateAI supports lead capture flows alongside support automation on website chat.",
      },
      {
        question: "Can we connect website operations with other channels?",
        answer: "Yes. Website workflows can be managed together with Telegram and Discord in one workspace.",
      },
    ],
  },
  "/ai-knowledge-base-software": {
    title: "AI Knowledge Base Software for Support and Moderation | ModerateAI",
    description:
      "Keep AI responses accurate with a shared knowledge base for website, Discord, and Telegram support workflows in ModerateAI.",
    faqEntries: [
      {
        question: "What content can teams add to the knowledge base?",
        answer: "Teams can add documents and managed URL sources to keep responses grounded in current information.",
      },
      {
        question: "Can one knowledge base power multiple channels?",
        answer: "Yes. The same knowledge base can power website, Telegram, and Discord support workflows.",
      },
    ],
  },
};

export const SEO_PUBLIC_USE_CASE_PATHS = Object.freeze(Object.keys(SEO_PUBLIC_USE_CASE_MAP));

function normalizePathname(rawPath: string): string {
  const [pathname] = String(rawPath || "/").split("?");
  if (!pathname || pathname === "/") return "/";
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

function normalizeBaseUrl(value: string | null | undefined): string | null {
  const raw = String(value ?? "").trim().replace(/\/+$/, "");
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    return parsed.origin;
  } catch {
    return null;
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function replaceTag(html: string, pattern: RegExp, replacement: string): string {
  if (pattern.test(html)) {
    return html.replace(pattern, replacement);
  }
  return html.replace("</head>", `${replacement}\n  </head>`);
}

function buildStructuredData(canonicalUrl: string, seo: RouteSeoConfig): Record<string, unknown> {
  const graph: Record<string, unknown>[] = [
    {
      "@type": "Organization",
      name: SEO_SITE_NAME,
      url: SEO_SITE_BASE_FALLBACK,
    },
    {
      "@type": "WebSite",
      name: SEO_SITE_NAME,
      url: SEO_SITE_BASE_FALLBACK,
      potentialAction: {
        "@type": "SearchAction",
        target: "https://docs.moderateai.net/?q={search_term_string}",
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "SoftwareApplication",
      name: SEO_SITE_NAME,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description: SEO_DEFAULT_DESCRIPTION,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
    {
      "@type": "WebPage",
      name: seo.title,
      description: seo.description,
      url: canonicalUrl,
    },
  ];

  if (seo.faqEntries && seo.faqEntries.length > 0) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: seo.faqEntries.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.answer,
        },
      })),
    });
  }

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}

export function resolveSeoRouteConfig(rawPath: string): RouteSeoConfig {
  const normalizedPath = normalizePathname(rawPath);

  if (normalizedPath === "/") {
    return {
      title: "ModerateAI | AI Support, Lead Capture, and Community Moderation",
      description:
        "Deliver instant support and capture qualified leads from your website, Telegram, and Discord in one workspace.",
      robots: "index,follow",
      canonicalPath: "/",
      ogType: "website",
    };
  }

  if (normalizedPath.startsWith("/auth")) {
    return {
      title: "Sign In | ModerateAI",
      description: "Sign in or create a ModerateAI account to access your workspace.",
      robots: "noindex,nofollow",
      canonicalPath: "/auth",
      ogType: "website",
    };
  }

  if (normalizedPath.startsWith("/accept-invitation")) {
    return {
      title: "Accept Invitation | ModerateAI",
      description: "Accept a workspace invitation to join ModerateAI.",
      robots: "noindex,nofollow",
      canonicalPath: "/accept-invitation",
      ogType: "website",
    };
  }

  if (normalizedPath === "/privacy-policy") {
    return {
      title: "Privacy Policy | ModerateAI",
      description:
        "Learn how ModerateAI collects, uses, stores, and shares data across the website, widget, dashboard, and Telegram/Discord integrations.",
      robots: "index,follow",
      canonicalPath: "/privacy-policy",
      ogType: "website",
    };
  }

  if (normalizedPath === "/terms-of-service") {
    return {
      title: "Terms of Service | ModerateAI",
      description:
        "Read the Terms of Service for ModerateAI, including use of the website, dashboard, widget, AI features, and Telegram/Discord integrations.",
      robots: "index,follow",
      canonicalPath: "/terms-of-service",
      ogType: "website",
    };
  }

  const useCase = SEO_PUBLIC_USE_CASE_MAP[normalizedPath];
  if (useCase) {
    return {
      title: useCase.title,
      description: useCase.description,
      robots: "index,follow",
      canonicalPath: normalizedPath,
      ogType: "website",
      faqEntries: useCase.faqEntries,
    };
  }

  return {
    title: "ModerateAI App",
    description: SEO_APP_DESCRIPTION,
    robots: "noindex,nofollow",
    canonicalPath: normalizedPath || "/",
    ogType: "website",
  };
}

export function renderSeoDocument(
  template: string,
  rawPath: string,
  options?: {
    siteBaseUrl?: string | null | undefined;
  },
): string {
  const seo = resolveSeoRouteConfig(rawPath);
  const siteBaseUrl = normalizeBaseUrl(options?.siteBaseUrl) ?? SEO_SITE_BASE_FALLBACK;
  const canonicalUrl = new URL(seo.canonicalPath, siteBaseUrl).toString();
  const jsonLdPayload = JSON.stringify(buildStructuredData(canonicalUrl, seo), null, 2).replaceAll("<", "\\u003c");

  let html = template;
  html = replaceTag(html, /<title>[\s\S]*?<\/title>/i, `    <title>${escapeHtml(seo.title)}</title>`);
  html = replaceTag(
    html,
    /<meta\s+name=["']description["'][^>]*>/i,
    `    <meta name="description" content="${escapeHtml(seo.description)}" />`,
  );
  html = replaceTag(
    html,
    /<meta\s+name=["']robots["'][^>]*>/i,
    `    <meta name="robots" content="${escapeHtml(seo.robots)}" />`,
  );
  html = replaceTag(
    html,
    /<meta\s+property=["']og:title["'][^>]*>/i,
    `    <meta property="og:title" content="${escapeHtml(seo.title)}" />`,
  );
  html = replaceTag(
    html,
    /<meta\s+property=["']og:description["'][^>]*>/i,
    `    <meta property="og:description" content="${escapeHtml(seo.description)}" />`,
  );
  html = replaceTag(
    html,
    /<meta\s+property=["']og:type["'][^>]*>/i,
    `    <meta property="og:type" content="${escapeHtml(seo.ogType)}" />`,
  );
  html = replaceTag(
    html,
    /<meta\s+property=["']og:url["'][^>]*>/i,
    `    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`,
  );
  html = replaceTag(
    html,
    /<meta\s+property=["']og:site_name["'][^>]*>/i,
    `    <meta property="og:site_name" content="${escapeHtml(SEO_SITE_NAME)}" />`,
  );
  html = replaceTag(
    html,
    /<meta\s+name=["']twitter:title["'][^>]*>/i,
    `    <meta name="twitter:title" content="${escapeHtml(seo.title)}" />`,
  );
  html = replaceTag(
    html,
    /<meta\s+name=["']twitter:description["'][^>]*>/i,
    `    <meta name="twitter:description" content="${escapeHtml(seo.description)}" />`,
  );
  html = replaceTag(
    html,
    /<link\s+rel=["']canonical["'][^>]*>/i,
    `    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`,
  );

  if (/<script[^>]*id=["']seo-structured-data["'][^>]*>[\s\S]*?<\/script>/i.test(html)) {
    html = html.replace(
      /<script[^>]*id=["']seo-structured-data["'][^>]*>[\s\S]*?<\/script>/i,
      `    <script id="seo-structured-data" type="application/ld+json">\n${jsonLdPayload}\n    </script>`,
    );
  } else if (/<script\s+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/i.test(html)) {
    html = html.replace(
      /<script\s+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/i,
      `    <script id="seo-structured-data" type="application/ld+json">\n${jsonLdPayload}\n    </script>`,
    );
  } else {
    html = html.replace(
      "</head>",
      `    <script id="seo-structured-data" type="application/ld+json">\n${jsonLdPayload}\n    </script>\n  </head>`,
    );
  }

  return html;
}
