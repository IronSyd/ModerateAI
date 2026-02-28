import { Link, useLocation } from "wouter";
import { ArrowRight, CheckCircle2, MessagesSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";

type UseCaseContent = {
  title: string;
  subtitle: string;
  painPoints: string[];
  outcomes: string[];
  faqs: Array<{ q: string; a: string }>;
  related: Array<{ href: string; label: string }>;
};

const USE_CASE_CONTENT: Record<string, UseCaseContent> = {
  "/ai-customer-support-software": {
    title: "AI Customer Support Software for Website, Discord, and Telegram",
    subtitle:
      "ModerateAI helps teams automate repetitive support questions, qualify leads, and keep response quality consistent across channels.",
    painPoints: [
      "Slow first-response times during off-hours.",
      "Support quality drops when volume spikes.",
      "Context gets lost between website chats and community channels.",
      "Manual triage drains small teams.",
    ],
    outcomes: [
      "Faster first response and resolution with AI-assisted workflows.",
      "Shared knowledge base answers that stay consistent across channels.",
      "Lead capture from high-intent support conversations.",
      "One workspace for operations, moderation, and analytics.",
    ],
    faqs: [
      {
        q: "What channels does ModerateAI support?",
        a: "ModerateAI supports website chat, Discord servers, and Telegram groups in one workspace.",
      },
      {
        q: "Can I control the AI tone and response style?",
        a: "Yes. You can configure style, response length, moderation behavior, and knowledge base context.",
      },
      {
        q: "Does it include analytics?",
        a: "Yes. You get conversation, moderation, and operational views to track performance over time.",
      },
    ],
    related: [
      { href: "/website-ai-lead-capture", label: "Website AI Lead Capture" },
      { href: "/discord-moderation-bot", label: "Discord Moderation Bot" },
      { href: "/telegram-customer-support-bot", label: "Telegram Support Bot" },
    ],
  },
  "/discord-moderation-bot": {
    title: "Discord Moderation Bot with AI Support Workflows",
    subtitle:
      "Run AI-powered moderation and community support in Discord while keeping policy control, visibility, and consistency.",
    painPoints: [
      "Manual moderation cannot keep up with active servers.",
      "Toxic or spam content harms community quality.",
      "Support questions repeat across multiple channels.",
      "Ops teams need clear auditability for moderation actions.",
    ],
    outcomes: [
      "AI moderation support for faster handling of policy violations.",
      "Configurable behavior by server/channel context.",
      "Shared support responses backed by your knowledge base.",
      "Operational visibility for moderation and support trends.",
    ],
    faqs: [
      {
        q: "Is ModerateAI only for moderation?",
        a: "No. It combines moderation and customer/community support in the same workflow.",
      },
      {
        q: "Can I use app-owned or BYOB setups?",
        a: "Yes. ModerateAI supports hybrid integration workflows designed for practical rollout.",
      },
      {
        q: "Can I review and refine behavior over time?",
        a: "Yes. Admin learning and analytics tooling help teams iterate safely.",
      },
    ],
    related: [
      { href: "/ai-customer-support-software", label: "AI Customer Support Software" },
      { href: "/ai-knowledge-base-software", label: "AI Knowledge Base Software" },
      { href: "/telegram-customer-support-bot", label: "Telegram Support Bot" },
    ],
  },
  "/telegram-customer-support-bot": {
    title: "Telegram Customer Support Bot for Fast Team Response",
    subtitle:
      "Deploy AI-assisted Telegram support to answer common questions, reduce queue load, and escalate edge cases faster.",
    painPoints: [
      "Support requests arrive around the clock.",
      "Human responders repeat the same answers daily.",
      "Consistency is difficult across multiple operators.",
      "No unified view of support quality and moderation activity.",
    ],
    outcomes: [
      "Immediate AI-assisted first responses in Telegram chats.",
      "Knowledge-backed answers for product and policy questions.",
      "Operational controls for moderation and fallback handling.",
      "A single workspace shared with website and Discord operations.",
    ],
    faqs: [
      {
        q: "Can ModerateAI handle both group and support use cases?",
        a: "Yes. It is designed for community channels and support-driven flows.",
      },
      {
        q: "Does it work with a central knowledge base?",
        a: "Yes. You can upload and sync knowledge so responses stay relevant.",
      },
      {
        q: "Can we start free and upgrade later?",
        a: "Yes. You can start on a free tier and scale up as support volume grows.",
      },
    ],
    related: [
      { href: "/ai-customer-support-software", label: "AI Customer Support Software" },
      { href: "/website-ai-lead-capture", label: "Website AI Lead Capture" },
      { href: "/discord-moderation-bot", label: "Discord Moderation Bot" },
    ],
  },
  "/website-ai-lead-capture": {
    title: "Website AI Lead Capture with Real-Time Support",
    subtitle:
      "Convert support conversations into qualified leads using ModerateAI website widget workflows and CRM-ready operations.",
    painPoints: [
      "Website visitors leave before sales or support responds.",
      "Lead quality is inconsistent without structured intake.",
      "Support chat and sales handoff are disconnected.",
      "Teams need one system for capture, response, and follow-up.",
    ],
    outcomes: [
      "Website chat that answers questions and captures lead context.",
      "Faster qualification of high-intent visitor conversations.",
      "Shared analytics across support, moderation, and lead activity.",
      "Integrated workflows across website, Discord, and Telegram.",
    ],
    faqs: [
      {
        q: "Can ModerateAI capture leads from website chat?",
        a: "Yes. The website integration supports AI chat plus lead capture workflows.",
      },
      {
        q: "Can we route by domain or knowledge context?",
        a: "Yes. Domain-aware knowledge routing is supported for website workflows.",
      },
      {
        q: "Is this useful for small teams?",
        a: "Yes. It is designed to reduce manual load while keeping response quality high.",
      },
    ],
    related: [
      { href: "/ai-customer-support-software", label: "AI Customer Support Software" },
      { href: "/ai-knowledge-base-software", label: "AI Knowledge Base Software" },
      { href: "/telegram-customer-support-bot", label: "Telegram Support Bot" },
    ],
  },
  "/ai-knowledge-base-software": {
    title: "AI Knowledge Base Software for Support and Moderation",
    subtitle:
      "Keep AI responses accurate with a centralized knowledge base connected to website, Telegram, and Discord workflows.",
    painPoints: [
      "Answers drift when teams rely on tribal knowledge.",
      "Support quality varies by operator and channel.",
      "Updating policies across platforms is slow.",
      "Teams need fewer hallucinations and more grounded responses.",
    ],
    outcomes: [
      "Centralized knowledge base content for consistent AI responses.",
      "Faster onboarding for support and moderation operations.",
      "Improved answer reliability with source-backed context.",
      "Operational visibility into coverage and learning workflows.",
    ],
    faqs: [
      {
        q: "What content can I add to the knowledge base?",
        a: "You can add documents and managed URL sources to keep AI responses grounded in your latest information.",
      },
      {
        q: "Can this be used across channels?",
        a: "Yes. Knowledge is shared across website chat, Telegram, and Discord workflows.",
      },
      {
        q: "Does ModerateAI support continual improvement?",
        a: "Yes. Training and admin learning workflows are built in for iterative quality gains.",
      },
    ],
    related: [
      { href: "/ai-customer-support-software", label: "AI Customer Support Software" },
      { href: "/discord-moderation-bot", label: "Discord Moderation Bot" },
      { href: "/website-ai-lead-capture", label: "Website AI Lead Capture" },
    ],
  },
};

function normalizePath(path: string): string {
  const [pathname] = String(path || "/").split("?");
  if (!pathname || pathname === "/") return "/";
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

export default function SeoUseCasePage() {
  const [location] = useLocation();
  const path = normalizePath(String(location ?? "/"));
  const content = USE_CASE_CONTENT[path] ?? USE_CASE_CONTENT["/ai-customer-support-software"];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/80 bg-background/90 backdrop-blur px-6 py-4 md:px-8">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
          <Logo />
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" className="tactile-button">
                Home
              </Button>
            </Link>
            <Link href="/auth?mode=signup">
              <Button className="tactile-button">Start Free</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="px-6 py-12 md:px-8 md:py-16">
        <article className="mx-auto max-w-5xl">
          <p className="mb-3 inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <MessagesSquare className="mr-2 h-3.5 w-3.5" />
            ModerateAI Use Case
          </p>

          <h1 className="kinetic-headline text-4xl font-bold leading-tight md:text-5xl">{content.title}</h1>
          <p className="mt-5 max-w-3xl text-lg text-muted-foreground">{content.subtitle}</p>

          <section className="mt-10 grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="kinetic-headline text-xl font-semibold">Common Challenges</h2>
              <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                {content.painPoints.map((item) => (
                  <li key={item} className="flex items-start">
                    <span className="mr-2 mt-[2px] text-primary">-</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="kinetic-headline text-xl font-semibold">What ModerateAI Improves</h2>
              <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                {content.outcomes.map((item) => (
                  <li key={item} className="flex items-start">
                    <CheckCircle2 className="mr-2 mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="mt-10 rounded-xl border border-border bg-card p-6">
            <h2 className="kinetic-headline text-2xl font-semibold">Frequently Asked Questions</h2>
            <div className="mt-5 space-y-5">
              {content.faqs.map((faq) => (
                <div key={faq.q}>
                  <h3 className="font-medium text-foreground">{faq.q}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{faq.a}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-10 rounded-xl border border-border bg-card p-6">
            <h2 className="kinetic-headline text-xl font-semibold">Related Use Cases</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              {content.related.map((item) => (
                <Link key={item.href} href={item.href}>
                  <Button variant="outline" className="tactile-button">
                    {item.label}
                  </Button>
                </Link>
              ))}
            </div>
          </section>

          <section className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link href="/auth?mode=signup">
              <Button className="tactile-button">
                Create Free Account
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/">
              <Button variant="outline" className="tactile-button">
                Back to Product Overview
              </Button>
            </Link>
          </section>
        </article>
      </main>
    </div>
  );
}
