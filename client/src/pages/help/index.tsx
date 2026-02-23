import { Link } from "wouter";
import { ArrowUpRight, BookOpen, ExternalLink, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { docsSections, getDocsBaseUrl, getDocsUrl } from "@/lib/docs";
import { getSupportTelegramUrl } from "@/lib/support";

export default function HelpCenterPage() {
  const docsBaseUrl = getDocsBaseUrl();
  const supportUrl = getSupportTelegramUrl();
  const docsUnavailable = !docsBaseUrl;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-8">
      <div className="glass-card rounded-2xl border border-primary/20 p-6 md:p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-primary/80">Documentation</p>
        <h1 className="kinetic-headline mt-2 text-3xl font-semibold text-foreground">ModerateAI Docs Hub</h1>
        <p className="mt-3 max-w-3xl text-muted-foreground">
          GitBook is the canonical source for product docs, onboarding, integrations, admin operations, and troubleshooting.
        </p>

        {docsUnavailable ? (
          <div className="mt-6 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
            <p className="text-sm font-medium text-amber-300">Docs unavailable</p>
            <p className="mt-1 text-sm text-amber-200/90">
              `VITE_DOCS_BASE_URL` is not configured in this environment. Set it to your GitBook URL to enable docs links.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/">
                <Button type="button" className="tactile-button">Go to Homepage</Button>
              </Link>
              <a href={supportUrl} target="_blank" rel="noopener noreferrer">
                <Button type="button" variant="outline" className="glass-chip">
                  <LifeBuoy className="mr-2 h-4 w-4" />
                  Contact Support
                </Button>
              </a>
            </div>
          </div>
        ) : (
          <div className="mt-5 flex flex-wrap gap-3">
            <a href={docsBaseUrl} target="_blank" rel="noopener noreferrer">
              <Button type="button" className="tactile-button">
                Open Full Documentation
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </a>
            <a href={supportUrl} target="_blank" rel="noopener noreferrer">
              <Button type="button" variant="outline" className="glass-chip">
                <LifeBuoy className="mr-2 h-4 w-4" />
                Contact Support
              </Button>
            </a>
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {docsSections.map((section) => {
          const href = getDocsUrl(section.path);

          return (
            <Card key={section.id} className="glass-card border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BookOpen className="h-4 w-4 text-primary" />
                  {section.title}
                </CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-sm font-medium text-primary hover:underline">
                    Open in GitBook
                    <ArrowUpRight className="ml-1 h-4 w-4" />
                  </a>
                ) : (
                  <span className="text-sm text-muted-foreground">Docs URL not configured</span>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
