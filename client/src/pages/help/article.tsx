import { useEffect } from "react";
import { Link, useLocation, useParams } from "wouter";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getLegacyHelpArticleAppUrl, resolveLegacyHelpPath } from "@/lib/docs";

type HelpArticleRouteParams = {
  articleId?: string;
};

export default function HelpArticlePage() {
  const params = useParams<HelpArticleRouteParams>();
  const articleId = params?.articleId ?? null;
  const [, navigate] = useLocation();
  const docsPath = resolveLegacyHelpPath(articleId);
  const appDocsUrl = getLegacyHelpArticleAppUrl(articleId);

  useEffect(() => {
    navigate(appDocsUrl, { replace: true });
  }, [appDocsUrl, navigate]);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-10">
      <Card className="glass-card rounded-2xl border border-primary/20">
        <CardHeader>
          <CardTitle className="kinetic-headline text-2xl font-semibold text-foreground">
            Opening Documentation
          </CardTitle>
          <CardDescription>
            Redirecting this legacy help link to the in-app documentation reader.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Target page: <span className="font-medium text-foreground">{docsPath}</span>
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild className="tactile-button">
              <Link href={appDocsUrl}>
                Open Documentation Now
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="glass-chip">
              <Link href="/help">Back to Docs Hub</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

