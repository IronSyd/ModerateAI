import { useEffect } from "react";
import { Link, useParams } from "wouter";
import { ExternalLink, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDocsBaseUrl, getLegacyHelpArticleDocsUrl, resolveLegacyHelpPath } from "@/lib/docs";

type HelpArticleRouteParams = {
  articleId?: string;
};

export default function HelpArticlePage() {
  const params = useParams<HelpArticleRouteParams>();
  const articleId = params?.articleId ?? null;
  const docsBaseUrl = getDocsBaseUrl();
  const docsUrl = getLegacyHelpArticleDocsUrl(articleId);
  const docsPath = resolveLegacyHelpPath(articleId);
  const docsUnavailable = !docsBaseUrl || !docsUrl;

  useEffect(() => {
    if (!docsUnavailable && docsUrl) {
      window.location.replace(docsUrl);
    }
  }, [docsUnavailable, docsUrl]);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-10">
      <div className="glass-card rounded-2xl border border-primary/20 p-6 md:p-8">
        <h1 className="kinetic-headline text-2xl font-semibold text-foreground">Help Article Redirect</h1>

        {docsUnavailable ? (
          <>
            <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
              <div className="flex items-center gap-2 font-medium text-amber-300">
                <TriangleAlert className="h-4 w-4" />
                Docs unavailable
              </div>
              <p className="mt-2">
                This help article now lives in GitBook, but `VITE_DOCS_BASE_URL` is not configured in this environment.
              </p>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/help">
                <Button type="button" className="tactile-button">Back to Help Hub</Button>
              </Link>
              <Link href="/">
                <Button type="button" variant="outline" className="glass-chip">Go to Homepage</Button>
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="mt-4 text-muted-foreground">
              Redirecting to GitBook article: <span className="font-medium text-foreground">{docsPath}</span>
            </p>
            <a href={docsUrl} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center text-sm font-medium text-primary hover:underline">
              Open article now
              <ExternalLink className="ml-1 h-4 w-4" />
            </a>
            <div className="mt-5">
              <Link href="/help">
                <Button type="button" variant="outline" className="glass-chip">Back to Help Hub</Button>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
