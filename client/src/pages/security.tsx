import { Link } from "wouter";
import { AlertTriangle, ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";

const SECURITY_CONTROLS = [
  "Session-based authentication with secure cookie defaults and server-side session storage.",
  "Rate limiting on API and authentication paths to reduce abuse risk.",
  "Operational observability hooks for slow requests, 5xx responses, and runtime events.",
  "Role-based workspace access controls for admin, moderator, and viewer permissions.",
];

export default function SecurityPage() {
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
            <Link href="/contact">
              <Button className="tactile-button">Report Issue</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="px-6 py-12 md:px-8 md:py-16">
        <article className="mx-auto max-w-5xl space-y-10">
          <section>
            <p className="mb-3 inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
              Security Overview
            </p>
            <h1 className="kinetic-headline text-4xl font-bold leading-tight md:text-5xl">
              ModerateAI applies layered safeguards for support and moderation workflows.
            </h1>
            <p className="mt-5 max-w-3xl text-lg text-muted-foreground">
              This page summarizes practical controls in the current application architecture. It is a product security
              overview, not a legal guarantee or certification statement.
            </p>
          </section>

          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="kinetic-headline text-2xl font-semibold">Current control categories</h2>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              {SECURITY_CONTROLS.map((item) => (
                <li key={item} className="flex items-start">
                  <ShieldCheck className="mr-2 mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="kinetic-headline text-2xl font-semibold">Incident reporting</h2>
            <p className="mt-4 text-sm text-muted-foreground">
              If you believe you found a security issue, email{" "}
              <a
                href="mailto:admin@moderateai.net"
                className="text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
              >
                admin@moderateai.net
              </a>{" "}
              with reproduction steps and impact details. Include relevant timestamps and request IDs when possible.
            </p>
          </section>

          <section className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-6">
            <h2 className="kinetic-headline flex items-center text-xl font-semibold">
              <AlertTriangle className="mr-2 h-4 w-4 text-amber-500" />
              Scope note
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Security posture evolves over time. For the latest implementation-level controls, rely on deployed
              runtime behavior, release-gate evidence, and current internal runbooks.
            </p>
          </section>

          <section className="flex flex-wrap gap-3">
            <Link href="/about">
              <Button variant="outline" className="tactile-button">
                About ModerateAI
              </Button>
            </Link>
            <Link href="/contact">
              <Button className="tactile-button">
                Contact Security
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/privacy-policy">
              <Button variant="outline" className="tactile-button">
                Privacy Policy
              </Button>
            </Link>
          </section>
        </article>
      </main>
    </div>
  );
}
