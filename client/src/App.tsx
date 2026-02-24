import { Switch, Route, useLocation } from "wouter";
import { useEffect, useLayoutEffect, useMemo, useState, lazy, Suspense, type ReactNode } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Skeleton } from "@/components/ui/skeleton";
import NotFound from "@/pages/not-found";
import { motion, useReducedMotion } from "framer-motion";

import LandingPage from "@/pages/landing";
import AuthPage from "@/pages/auth-page";
import AcceptInvitationPage from "@/pages/accept-invitation";

import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { AtmosphereOrbs } from "@/components/atmosphere-orbs";
import { AuthProvider } from "@/hooks/use-auth";
import { AdminUserProvider } from "@/hooks/use-admin-user";
import { NotificationsProvider } from "@/hooks/use-notifications";
import { ProtectedRoute } from "@/lib/protected-route";
import { MessagesSquare } from "lucide-react";

const DashboardPage = lazy(() => import("@/pages/dashboard"));
const ChoosePlanPage = lazy(() => import("@/pages/choose-plan"));
const ResetPasswordPage = lazy(() => import("@/pages/reset-password"));
const ConversationsPage = lazy(() => import("@/pages/conversations"));
const KnowledgeBasePage = lazy(() => import("@/pages/knowledge-base"));
const AdminUsersPage = lazy(() => import("@/pages/admin-users"));
const AdminHistoryLearningOpsPage = lazy(() => import("@/pages/admin-history-learning-ops"));
const TelegramIntegrationPage = lazy(() => import("@/pages/integrations/telegram"));
const DiscordIntegrationPage = lazy(() => import("@/pages/integrations/discord"));
const WebsiteIntegrationPage = lazy(() => import("@/pages/integrations/website"));
const DiscordFixPage = lazy(() => import("@/pages/discord-fix"));
const TeamPage = lazy(() => import("@/pages/team"));
const SettingsPage = lazy(() => import("@/pages/settings"));
const ActivityPage = lazy(() => import("@/pages/activity"));
const DeepAnalyticsPage = lazy(() => import("@/pages/deep-analytics"));
const ProfilePage = lazy(() => import("@/pages/profile"));
const PreferencesPage = lazy(() => import("@/pages/preferences"));
const BillingPage = lazy(() => import("@/pages/billing"));
const PrivacyPolicyPage = lazy(() => import("@/pages/privacy-policy"));
const TermsOfServicePage = lazy(() => import("@/pages/terms-of-service"));
const HelpCenterPage = lazy(() => import("@/pages/help"));
const HelpDocsReaderPage = lazy(() => import("@/pages/help/docs-reader"));
const HelpArticlePage = lazy(() => import("@/pages/help/article"));

type UiPerfProfile = "balanced" | "full_motion";

type RouteSeoConfig = {
  title: string;
  description: string;
  robots: string;
  canonicalPath?: string;
  ogType?: "website";
};

const SEO_SITE_NAME = "ModerateAI";
const SEO_DEFAULT_DESCRIPTION =
  "ModerateAI helps teams deliver AI support and capture qualified leads across Website, Telegram, and Discord in one workspace.";
const SEO_APP_DESCRIPTION =
  "ModerateAI workspace dashboard for AI support, lead capture, integrations, analytics, and operations.";

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

function resolveSeoConfig(rawLocation: string): RouteSeoConfig {
  const [pathname] = String(rawLocation || "/").split("?");

  if (pathname === "/") {
    return {
      title: "ModerateAI | AI Support, Lead Capture, and Community Moderation",
      description:
        "Deliver instant support and capture qualified leads from your website, Telegram, and Discord in one workspace.",
      robots: "index,follow",
      canonicalPath: "/",
      ogType: "website",
    };
  }

  if (pathname.startsWith("/auth")) {
    return {
      title: "Sign In | ModerateAI",
      description: "Sign in or create a ModerateAI account to access your workspace.",
      robots: "noindex,nofollow",
      canonicalPath: "/auth",
      ogType: "website",
    };
  }

  if (pathname.startsWith("/accept-invitation")) {
    return {
      title: "Accept Invitation | ModerateAI",
      description: "Accept a workspace invitation to join ModerateAI.",
      robots: "noindex,nofollow",
      canonicalPath: "/accept-invitation",
      ogType: "website",
    };
  }

  if (pathname === "/privacy-policy") {
    return {
      title: "Privacy Policy | ModerateAI",
      description:
        "Learn how ModerateAI collects, uses, stores, and shares data across the website, widget, dashboard, and Telegram/Discord integrations.",
      robots: "index,follow",
      canonicalPath: "/privacy-policy",
      ogType: "website",
    };
  }

  if (pathname === "/terms-of-service") {
    return {
      title: "Terms of Service | ModerateAI",
      description:
        "Read the Terms of Service for ModerateAI, including use of the website, dashboard, widget, AI features, and Telegram/Discord integrations.",
      robots: "index,follow",
      canonicalPath: "/terms-of-service",
      ogType: "website",
    };
  }

  return {
    title: "ModerateAI App",
    description: SEO_APP_DESCRIPTION,
    robots: "noindex,nofollow",
    canonicalPath: pathname || "/",
    ogType: "website",
  };
}

function upsertMetaTag(
  selector: string,
  createTag: () => HTMLMetaElement,
  content: string,
) {
  let node = document.head.querySelector<HTMLMetaElement>(selector);
  if (!node) {
    node = createTag();
    document.head.appendChild(node);
  }
  node.setAttribute("content", content);
}

function upsertLinkTag(
  selector: string,
  createTag: () => HTMLLinkElement,
  href: string,
) {
  let node = document.head.querySelector<HTMLLinkElement>(selector);
  if (!node) {
    node = createTag();
    document.head.appendChild(node);
  }
  node.setAttribute("href", href);
}

function RouteSeoManager({ location }: { location: string }) {
  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") return;

    const seo = resolveSeoConfig(location);
    const siteBase =
      normalizeBaseUrl(import.meta.env.VITE_SITE_URL) ??
      normalizeBaseUrl(window.location.origin) ??
      "https://moderateai.net";
    const canonicalUrl = new URL(seo.canonicalPath ?? "/", siteBase).toString();

    document.title = seo.title;

    upsertMetaTag(
      "meta[name='description']",
      () => {
        const tag = document.createElement("meta");
        tag.setAttribute("name", "description");
        return tag;
      },
      seo.description,
    );

    upsertMetaTag(
      "meta[name='robots']",
      () => {
        const tag = document.createElement("meta");
        tag.setAttribute("name", "robots");
        return tag;
      },
      seo.robots,
    );

    upsertMetaTag(
      "meta[property='og:title']",
      () => {
        const tag = document.createElement("meta");
        tag.setAttribute("property", "og:title");
        return tag;
      },
      seo.title,
    );

    upsertMetaTag(
      "meta[property='og:description']",
      () => {
        const tag = document.createElement("meta");
        tag.setAttribute("property", "og:description");
        return tag;
      },
      seo.description,
    );

    upsertMetaTag(
      "meta[property='og:type']",
      () => {
        const tag = document.createElement("meta");
        tag.setAttribute("property", "og:type");
        return tag;
      },
      seo.ogType ?? "website",
    );

    upsertMetaTag(
      "meta[property='og:url']",
      () => {
        const tag = document.createElement("meta");
        tag.setAttribute("property", "og:url");
        return tag;
      },
      canonicalUrl,
    );

    upsertMetaTag(
      "meta[property='og:site_name']",
      () => {
        const tag = document.createElement("meta");
        tag.setAttribute("property", "og:site_name");
        return tag;
      },
      SEO_SITE_NAME,
    );

    upsertMetaTag(
      "meta[name='twitter:title']",
      () => {
        const tag = document.createElement("meta");
        tag.setAttribute("name", "twitter:title");
        return tag;
      },
      seo.title,
    );

    upsertMetaTag(
      "meta[name='twitter:description']",
      () => {
        const tag = document.createElement("meta");
        tag.setAttribute("name", "twitter:description");
        return tag;
      },
      seo.description,
    );

    upsertLinkTag(
      "link[rel='canonical']",
      () => {
        const tag = document.createElement("link");
        tag.setAttribute("rel", "canonical");
        return tag;
      },
      canonicalUrl,
    );
  }, [location]);

  return null;
}

function resolveUiPerfProfile(value: unknown): UiPerfProfile {
  return String(value ?? "") === "full_motion" ? "full_motion" : "balanced";
}

function pageFallback() {
  return (
    <div className="space-y-4 py-2">
      <Skeleton className="h-7 w-64" />
      <Skeleton className="h-5 w-96 max-w-full" />
      <div className="grid gap-3">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    </div>
  );
}

function GlobalBackgroundBubbles() {
  const bubbleClasses = [
    "app-bubble--1",
    "app-bubble--2",
    "app-bubble--3",
    "app-bubble--4",
    "app-bubble--5",
    "app-bubble--6",
  ];

  return (
    <div className="app-bubble-field" aria-hidden>
      {bubbleClasses.map((bubbleClass) => (
        <div key={bubbleClass} className={`app-bubble ${bubbleClass}`}>
          <div className="app-bubble-content">
            <div className="app-bubble-logo">
              <MessagesSquare className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="app-bubble-lines">
              <span className="app-bubble-line app-bubble-line--a" />
              <span className="app-bubble-line app-bubble-line--b" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function GlobalMicroInteractions() {
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      try {
        const source = event.target;
        if (!(source instanceof Element)) return;

        const target = source.closest<HTMLElement>(
          "[data-micro-ripple='true'], button, [role='button'], [role='switch']",
        );
        if (!target) return;
        if (target.getAttribute("data-micro") === "false") return;
        if (target.getAttribute("data-micro-ripple") === "false") return;
        if (target.hasAttribute("disabled")) return;
        if (target.getAttribute("aria-disabled") === "true") return;

        target.classList.add("micro-ripple-host", "micro-press");

        const rect = target.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;

        const ripple = document.createElement("span");
        const size = Math.max(rect.width, rect.height) * 1.35;

        ripple.className = "micro-ripple-node";
        ripple.style.width = `${size}px`;
        ripple.style.height = `${size}px`;
        ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
        ripple.style.top = `${event.clientY - rect.top - size / 2}px`;

        target.appendChild(ripple);
        ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
      } catch (error) {
        console.error("Micro interaction error:", error);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  return null;
}

function GlobalKineticTypography({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;

    const mediaQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (mediaQuery?.matches) return;

    let activeElement: HTMLElement | null = null;

    const reset = (el: HTMLElement) => {
      el.style.setProperty("--kx", "0");
      el.style.setProperty("--ky", "0");
    };

    const onPointerMove = (event: PointerEvent) => {
      try {
        if (event.pointerType && event.pointerType !== "mouse") return;

        const source = event.target;
        if (!(source instanceof Element)) return;

        const target = source.closest<HTMLElement>(
          ".kinetic-headline, .kinetic-auto h1, .kinetic-auto h2, .kinetic-auto h3",
        );
        if (!target) {
          if (activeElement && document.contains(activeElement)) reset(activeElement);
          activeElement = null;
          return;
        }

        if (activeElement && activeElement !== target && document.contains(activeElement)) {
          reset(activeElement);
        }
        activeElement = target;

        const rect = target.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;

        const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
        const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;

        target.style.setProperty("--kx", x.toFixed(3));
        target.style.setProperty("--ky", y.toFixed(3));
      } catch (error) {
        console.error("Kinetic typography error:", error);
      }
    };

    const clearActive = () => {
      if (activeElement && document.contains(activeElement)) reset(activeElement);
      activeElement = null;
    };

    const onMouseOut = (event: MouseEvent) => {
      if (event.relatedTarget) return;
      clearActive();
    };

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("mouseout", onMouseOut);
    document.addEventListener("visibilitychange", clearActive);

    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("mouseout", onMouseOut);
      document.removeEventListener("visibilitychange", clearActive);
      clearActive();
    };
  }, [enabled]);

  return null;
}

function DashboardLayout({ children, showAtmosphere }: { children: ReactNode; showAtmosphere: boolean }) {
  const shouldReduceMotion = useReducedMotion();
  const [location] = useLocation();

  useLayoutEffect(() => {
    window.scrollTo(0, 0);

    const preventScroll = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };

    document.addEventListener("scroll", preventScroll, { passive: false });

    const timer = setTimeout(() => {
      document.removeEventListener("scroll", preventScroll);
    }, 500);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("scroll", preventScroll);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background font-sans relative overflow-x-clip">
      {showAtmosphere ? <AtmosphereOrbs className="z-0" /> : null}

      <div className="relative z-10 min-h-screen flex">
        <Sidebar />

        <div className="flex-1 min-w-0 md:ml-64">
          <Header />

          <div className="px-4 pb-4 pt-20 md:px-6 md:pb-6 md:pt-24">
            <motion.div
              key={location}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              {children}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Router({ uiPerfProfile }: { uiPerfProfile: UiPerfProfile }) {
  const [location] = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);

  const isPublicPage =
    location === "/" ||
    location === "/privacy-policy" ||
    location === "/terms-of-service" ||
    location.startsWith("/auth") ||
    location.startsWith("/accept-invitation");
  const fallback = pageFallback();

  if (isPublicPage) {
    return (
      <Suspense fallback={fallback}>
        <Switch>
          <Route path="/" component={LandingPage} />
          <Route path="/privacy-policy" component={PrivacyPolicyPage} />
          <Route path="/terms-of-service" component={TermsOfServicePage} />
          <Route path="/auth" component={AuthPage} />
          <Route path="/accept-invitation" component={AcceptInvitationPage} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    );
  }

  return (
    <DashboardLayout showAtmosphere={uiPerfProfile === "full_motion"}>
      <Switch>
        <ProtectedRoute path="/dashboard">
          <Suspense fallback={fallback}>
            <DashboardPage />
          </Suspense>
        </ProtectedRoute>

        <ProtectedRoute path="/choose-plan">
          <Suspense fallback={fallback}>
            <ChoosePlanPage />
          </Suspense>
        </ProtectedRoute>

        <ProtectedRoute path="/reset-password">
          <Suspense fallback={fallback}>
            <ResetPasswordPage />
          </Suspense>
        </ProtectedRoute>

        <ProtectedRoute path="/conversations">
          <Suspense fallback={fallback}>
            <ConversationsPage />
          </Suspense>
        </ProtectedRoute>

        <ProtectedRoute path="/knowledge-base">
          <Suspense fallback={fallback}>
            <KnowledgeBasePage />
          </Suspense>
        </ProtectedRoute>

        <ProtectedRoute path="/admin/users">
          <Suspense fallback={fallback}>
            <AdminUsersPage />
          </Suspense>
        </ProtectedRoute>

        <ProtectedRoute path="/admin/ops/admin-history-learning">
          <Suspense fallback={fallback}>
            <AdminHistoryLearningOpsPage />
          </Suspense>
        </ProtectedRoute>

        <ProtectedRoute path="/integrations/telegram">
          <Suspense fallback={fallback}>
            <TelegramIntegrationPage />
          </Suspense>
        </ProtectedRoute>

        <ProtectedRoute path="/integrations/discord">
          <Suspense fallback={fallback}>
            <DiscordIntegrationPage />
          </Suspense>
        </ProtectedRoute>

        <ProtectedRoute path="/integrations/website">
          <Suspense fallback={fallback}>
            <WebsiteIntegrationPage />
          </Suspense>
        </ProtectedRoute>

        <ProtectedRoute path="/integrations/discord-fix">
          <Suspense fallback={fallback}>
            <DiscordFixPage />
          </Suspense>
        </ProtectedRoute>

        <ProtectedRoute path="/team">
          <Suspense fallback={fallback}>
            <TeamPage />
          </Suspense>
        </ProtectedRoute>

        <ProtectedRoute path="/settings">
          <Suspense fallback={fallback}>
            <SettingsPage />
          </Suspense>
        </ProtectedRoute>

        <ProtectedRoute path="/activity">
          <Suspense fallback={fallback}>
            <ActivityPage />
          </Suspense>
        </ProtectedRoute>

        <ProtectedRoute path="/analytics/deep">
          <Suspense fallback={fallback}>
            <DeepAnalyticsPage />
          </Suspense>
        </ProtectedRoute>

        <ProtectedRoute path="/profile">
          <Suspense fallback={fallback}>
            <ProfilePage />
          </Suspense>
        </ProtectedRoute>

        <ProtectedRoute path="/preferences">
          <Suspense fallback={fallback}>
            <PreferencesPage />
          </Suspense>
        </ProtectedRoute>

        <ProtectedRoute path="/billing">
          <Suspense fallback={fallback}>
            <BillingPage />
          </Suspense>
        </ProtectedRoute>

        <ProtectedRoute path="/help/article/:articleId">
          <Suspense fallback={fallback}>
            <HelpArticlePage />
          </Suspense>
        </ProtectedRoute>

        <ProtectedRoute path="/help/docs">
          <Suspense fallback={fallback}>
            <HelpDocsReaderPage />
          </Suspense>
        </ProtectedRoute>

        <ProtectedRoute path="/help/docs/:slug">
          <Suspense fallback={fallback}>
            <HelpDocsReaderPage />
          </Suspense>
        </ProtectedRoute>

        <ProtectedRoute path="/help/docs/:section/:slug">
          <Suspense fallback={fallback}>
            <HelpDocsReaderPage />
          </Suspense>
        </ProtectedRoute>

        <ProtectedRoute path="/help">
          <Suspense fallback={fallback}>
            <HelpCenterPage />
          </Suspense>
        </ProtectedRoute>

        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function AppShell() {
  const [location] = useLocation();
  const [uiPerfProfile, setUiPerfProfile] = useState<UiPerfProfile>("balanced");

  useEffect(() => {
    let isCancelled = false;

    const loadRuntimeConfig = async () => {
      try {
        const response = await fetch("/api/runtime-config", { credentials: "include" });
        if (!response.ok) return;
        const payload = await response.json();
        if (!isCancelled) {
          setUiPerfProfile(resolveUiPerfProfile(payload?.uiPerfProfile));
        }
      } catch {
        if (!isCancelled) {
          setUiPerfProfile("balanced");
        }
      }
    };

    loadRuntimeConfig();
    return () => {
      isCancelled = true;
    };
  }, []);

  const isLanding = location === "/";
  const kineticEnabled = uiPerfProfile === "full_motion" || isLanding;
  const showBackgroundBubbles = kineticEnabled;

  const shellClassName = useMemo(() => {
    const classes = ["relative", "isolate", "min-h-screen", "tactile-auto"];
    classes.push(uiPerfProfile === "full_motion" ? "kinetic-auto ui-perf-full" : "ui-perf-balanced");
    return classes.join(" ");
  }, [uiPerfProfile]);

  return (
    <div className={shellClassName}>
      {showBackgroundBubbles ? <GlobalBackgroundBubbles /> : null}
      <div className="relative z-10">
        <RouteSeoManager location={location} />
        <GlobalMicroInteractions />
        <GlobalKineticTypography enabled={kineticEnabled} />
        <Router uiPerfProfile={uiPerfProfile} />
        <Toaster />
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AdminUserProvider>
          <NotificationsProvider>
            <AppShell />
          </NotificationsProvider>
        </AdminUserProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
