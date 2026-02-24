import { Link } from "wouter";
import { ArrowRight, BookOpen, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { docsSections } from "@/lib/docs";
import { getSupportTelegramUrl } from "@/lib/support";

export default function HelpCenterPage() {
  const supportUrl = getSupportTelegramUrl();

  return (
    <div className="mx-auto max-w-6xl px-4 pb-8">
      <div className="glass-card rounded-2xl border border-primary/20 p-6 md:p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-primary/80">Documentation</p>
        <h1 className="kinetic-headline mt-2 text-3xl font-semibold text-foreground">ModerateAI Docs Hub</h1>
        <p className="mt-3 max-w-3xl text-muted-foreground">
          Browse ModerateAI documentation in-app for onboarding, integrations, admin operations, and troubleshooting.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <Button asChild className="tactile-button">
            <Link href="/help/docs">
              Open Full Documentation
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <a href={supportUrl} target="_blank" rel="noopener noreferrer">
            <Button type="button" variant="outline" className="glass-chip">
              <LifeBuoy className="mr-2 h-4 w-4" />
              Contact Support
            </Button>
          </a>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {docsSections.map((section) => (
          <Card key={section.id} className="glass-card border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <BookOpen className="h-4 w-4 text-primary" />
                {section.title}
              </CardTitle>
              <CardDescription>{section.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                href={section.appPath}
                className="inline-flex items-center text-sm font-medium text-primary hover:underline"
              >
                Open in Documentation
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

