import { Link } from "wouter";
import { ArrowRight, ExternalLink, LifeBuoy, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { getSupportTelegramUrl } from "@/lib/support";

const CONTACT_EMAIL = "admin@moderateai.net";

export default function ContactPage() {
  const supportUrl = getSupportTelegramUrl();

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
        <article className="mx-auto max-w-5xl space-y-10">
          <section>
            <p className="mb-3 inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
              Contact ModerateAI
            </p>
            <h1 className="kinetic-headline text-4xl font-bold leading-tight md:text-5xl">
              Reach ModerateAI for support, onboarding, and product questions.
            </h1>
            <p className="mt-5 max-w-3xl text-lg text-muted-foreground">
              Fastest contact path: email <strong className="text-foreground">{CONTACT_EMAIL}</strong>. Include your
              workspace email, plan, and issue summary so we can route your request quickly.
            </p>
          </section>

          <section className="grid gap-6 md:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="kinetic-headline flex items-center text-lg font-semibold">
                <Mail className="mr-2 h-4 w-4 text-primary" />
                Email
              </h2>
              <p className="mt-3 text-sm text-muted-foreground">
                For onboarding, billing, and support requests.
              </p>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="mt-4 inline-block text-sm text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
              >
                {CONTACT_EMAIL}
              </a>
            </div>

            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="kinetic-headline flex items-center text-lg font-semibold">
                <LifeBuoy className="mr-2 h-4 w-4 text-primary" />
                Live Support Channel
              </h2>
              <p className="mt-3 text-sm text-muted-foreground">
                Chat with support through the official Telegram support channel.
              </p>
              <a
                href={supportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center text-sm text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
              >
                Open support channel
                <ExternalLink className="ml-1 h-3.5 w-3.5" />
              </a>
            </div>

            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="kinetic-headline flex items-center text-lg font-semibold">
                <ShieldCheck className="mr-2 h-4 w-4 text-primary" />
                Security Reports
              </h2>
              <p className="mt-3 text-sm text-muted-foreground">
                For security concerns, include reproduction steps and severity context.
              </p>
              <Link href="/security">
                <Button variant="outline" className="mt-4 tactile-button">
                  Security Page
                </Button>
              </Link>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="kinetic-headline text-2xl font-semibold">Frequently asked contact questions</h2>
            <div className="mt-5 space-y-5">
              <div>
                <h3 className="font-medium text-foreground">How do I get plan activation for Standard or Pro?</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Contact support with your expected usage and billing preference. The team activates paid plans after
                  payment verification.
                </p>
              </div>
              <div>
                <h3 className="font-medium text-foreground">What should I include in support requests?</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Include workspace email, platform affected, issue summary, and timestamps. This reduces back-and-forth
                  and speeds triage.
                </p>
              </div>
              <div>
                <h3 className="font-medium text-foreground">Where can I read setup and product docs?</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Visit{" "}
                  <a
                    href="https://docs.moderateai.net/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
                  >
                    docs.moderateai.net
                  </a>{" "}
                  for setup and operational guidance.
                </p>
              </div>
            </div>
          </section>

          <section className="flex flex-wrap gap-3">
            <Link href="/about">
              <Button variant="outline" className="tactile-button">
                About ModerateAI
              </Button>
            </Link>
            <Link href="/ai-customer-support-software">
              <Button variant="outline" className="tactile-button">
                Product Use Cases
              </Button>
            </Link>
            <Link href="/auth?mode=signup">
              <Button className="tactile-button">
                Create Free Account
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </section>
        </article>
      </main>
    </div>
  );
}
