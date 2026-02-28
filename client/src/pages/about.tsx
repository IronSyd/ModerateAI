import { Link } from "wouter";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";

const PLATFORM_FACTS = [
  "ModerateAI runs AI support workflows across website chat, Discord, and Telegram.",
  "Teams use ModerateAI to answer repetitive questions, capture qualified leads, and reduce manual triage.",
  "A shared knowledge base powers consistent responses across channels.",
  "Workspace analytics and moderation operations are managed in one dashboard.",
];

export default function AboutPage() {
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
              <Button className="tactile-button">Contact</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="px-6 py-12 md:px-8 md:py-16">
        <article className="mx-auto max-w-5xl space-y-10">
          <section>
            <p className="mb-3 inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
              About ModerateAI
            </p>
            <h1 className="kinetic-headline text-4xl font-bold leading-tight md:text-5xl">
              ModerateAI helps teams run AI support and moderation in one place.
            </h1>
            <p className="mt-5 max-w-3xl text-lg text-muted-foreground">
              ModerateAI is built for teams that need fast, consistent support replies across website chat, Telegram,
              and Discord while maintaining operational control over moderation and lead workflows.
            </p>
          </section>

          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="kinetic-headline text-2xl font-semibold">What ModerateAI does</h2>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              {PLATFORM_FACTS.map((fact) => (
                <li key={fact} className="flex items-start">
                  <CheckCircle2 className="mr-2 mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{fact}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="kinetic-headline text-2xl font-semibold">Who it is for</h2>
            <p className="mt-4 text-sm text-muted-foreground">
              ModerateAI is commonly used by SaaS teams, support operations leads, community managers, and growing
              businesses that need a practical AI workflow without managing separate systems for every channel.
            </p>
          </section>

          <section className="flex flex-wrap gap-3">
            <Link href="/security">
              <Button variant="outline" className="tactile-button">
                Review Security
              </Button>
            </Link>
            <Link href="/ai-customer-support-software">
              <Button variant="outline" className="tactile-button">
                Explore Use Cases
              </Button>
            </Link>
            <Link href="/contact">
              <Button className="tactile-button">
                Contact ModerateAI
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </section>
        </article>
      </main>
    </div>
  );
}
