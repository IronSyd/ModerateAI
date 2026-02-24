import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronRight,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { getDocsAppUrl, getDocsPageByAppPath, getDocsPageByDocsPath, getDocsPages, type DocsPageMeta } from "@/lib/docs";

type DocsNavGroup = {
  key: string;
  title: string;
  pages: DocsPageMeta[];
};

function buildNavGroups(pages: DocsPageMeta[]): DocsNavGroup[] {
  const groups = new Map<string, DocsNavGroup>();

  for (const page of pages) {
    const existing = groups.get(page.section);
    if (existing) {
      existing.pages.push(page);
      continue;
    }

    groups.set(page.section, {
      key: page.section,
      title: page.sectionTitle,
      pages: [page],
    });
  }

  return Array.from(groups.values());
}

function normalizeRelativeDocsLink(currentDocsPath: string, href: string): string | null {
  const raw = href.trim();
  if (!raw || raw.startsWith("#")) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return null;
  if (raw.startsWith("//")) return null;

  const [pathOnly] = raw.split("#");
  let candidate = pathOnly;

  if (candidate.endsWith(".md")) {
    candidate = candidate.replace(/\/README\.md$/i, "").replace(/\.md$/i, "");
  }

  if (!candidate.startsWith("/")) {
    const baseSegments = currentDocsPath.split("/").filter(Boolean);
    if (baseSegments.length > 0) {
      baseSegments.pop();
    }

    for (const segment of candidate.split("/")) {
      if (!segment || segment === ".") continue;
      if (segment === "..") {
        baseSegments.pop();
        continue;
      }
      baseSegments.push(segment);
    }

    candidate = `/${baseSegments.join("/")}`;
  }

  if (!candidate) candidate = "/";
  if (!candidate.startsWith("/")) candidate = `/${candidate}`;
  candidate = candidate.replace(/\/+$/, "") || "/";

  return getDocsPageByDocsPath(candidate)?.appPath ?? null;
}

export default function DocsReaderPage() {
  const [location, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const allPages = getDocsPages();
  const currentPage = getDocsPageByAppPath(location);

  const filteredPages = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return allPages;

    return allPages.filter((page) => {
      return (
        page.title.toLowerCase().includes(query) ||
        page.description.toLowerCase().includes(query) ||
        page.docsPath.toLowerCase().includes(query)
      );
    });
  }, [allPages, searchQuery]);

  const navGroups = useMemo(() => buildNavGroups(filteredPages), [filteredPages]);
  const activeIndex = currentPage ? allPages.findIndex((page) => page.id === currentPage.id) : -1;
  const previousPage = activeIndex > 0 ? allPages[activeIndex - 1] : null;
  const nextPage = activeIndex >= 0 && activeIndex < allPages.length - 1 ? allPages[activeIndex + 1] : null;

  if (!currentPage) {
    return (
      <div className="mx-auto max-w-4xl px-4 pb-8">
        <Card className="glass-card border-primary/20">
          <CardHeader>
            <CardTitle className="kinetic-headline text-2xl">Documentation Page Not Found</CardTitle>
            <CardDescription>
              The requested documentation page could not be resolved from the local docs bundle.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild className="tactile-button">
              <Link href="/help">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Docs Hub
              </Link>
            </Button>
            <Button asChild variant="outline" className="glass-chip">
              <Link href={getDocsAppUrl("/introduction")}>Open Introduction</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-8">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button asChild variant="outline" className="glass-chip">
          <Link href="/help">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Docs Hub
          </Link>
        </Button>
        <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
          In-App Docs
        </Badge>
        <span className="text-xs text-muted-foreground">{allPages.length} pages bundled locally</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="glass-card border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <BookOpen className="h-4 w-4 text-primary" />
                Documentation
              </CardTitle>
              <CardDescription>
                Search local docs pages and navigate by section.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search docs..."
                  className="bg-muted/40 pl-8"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  aria-label="Search documentation pages"
                />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{filteredPages.length} matches</span>
                {searchQuery ? (
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => setSearchQuery("")}
                  >
                    Clear
                  </button>
                ) : null}
              </div>
              <Separator />
              <ScrollArea className="h-[320px] pr-2 lg:h-[calc(100vh-22rem)]">
                <div className="space-y-4">
                  {navGroups.length === 0 ? (
                    <div className="rounded-xl border border-border/60 bg-background/40 p-3 text-sm text-muted-foreground">
                      No matching docs pages. Clear search to browse all pages.
                    </div>
                  ) : (
                    navGroups.map((group) => (
                      <div key={group.key} className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/70">
                          {group.title}
                        </p>
                        <div className="space-y-1">
                          {group.pages.map((page) => {
                            const isActive = page.id === currentPage.id;
                            return (
                              <button
                                key={page.id}
                                type="button"
                                onClick={() => navigate(page.appPath)}
                                className={cn(
                                  "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors",
                                  isActive
                                    ? "border-primary/40 bg-primary/10 text-foreground"
                                    : "border-border/60 bg-background/40 text-foreground hover:bg-accent",
                                )}
                              >
                                <span className="pr-2 text-sm font-medium">{page.title}</span>
                                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </aside>

        <div className="space-y-4">
          <Card className="glass-card border-primary/20">
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-border/60 text-muted-foreground">
                  {currentPage.sectionTitle}
                </Badge>
                <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                  {currentPage.docsPath}
                </Badge>
              </div>
              <CardTitle className="kinetic-headline text-2xl">{currentPage.title}</CardTitle>
              <CardDescription>{currentPage.description}</CardDescription>
            </CardHeader>
          </Card>

          <Card className="glass-card border-primary/20">
            <CardContent className="pt-6">
              <div className="prose prose-neutral max-w-none prose-headings:text-foreground prose-p:text-muted-foreground prose-li:text-muted-foreground prose-strong:text-foreground prose-code:text-foreground prose-pre:border prose-pre:border-primary/20 prose-pre:bg-background/70 dark:prose-invert dark:prose-p:text-muted-foreground dark:prose-li:text-muted-foreground dark:prose-headings:text-foreground dark:prose-strong:text-foreground">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    a: ({ href = "", children, ...props }) => {
                      const internalRoute = normalizeRelativeDocsLink(currentPage.docsPath, href);
                      const isExternal = /^(https?:)?\/\//i.test(href);

                      if (internalRoute) {
                        return (
                          <a
                            href={internalRoute}
                            onClick={(event) => {
                              event.preventDefault();
                              navigate(internalRoute);
                            }}
                            className="text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
                            {...props}
                          >
                            {children}
                          </a>
                        );
                      }

                      if (isExternal) {
                        return (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
                            {...props}
                          >
                            {children}
                          </a>
                        );
                      }

                      return (
                        <a
                          href={href}
                          className="text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
                          {...props}
                        >
                          {children}
                        </a>
                      );
                    },
                  }}
                >
                  {currentPage.markdown}
                </ReactMarkdown>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="glass-card border-primary/20">
              <CardContent className="pt-5">
                {previousPage ? (
                  <Link href={previousPage.appPath} className="group block">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Previous</p>
                    <p className="mt-1 flex items-center gap-2 text-sm font-medium text-foreground group-hover:text-primary">
                      <ArrowLeft className="h-4 w-4" />
                      {previousPage.title}
                    </p>
                  </Link>
                ) : (
                  <div className="text-sm text-muted-foreground">Start of documentation</div>
                )}
              </CardContent>
            </Card>
            <Card className="glass-card border-primary/20">
              <CardContent className="pt-5">
                {nextPage ? (
                  <Link href={nextPage.appPath} className="group block text-right sm:text-left">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Next</p>
                    <p className="mt-1 flex items-center justify-end gap-2 text-sm font-medium text-foreground group-hover:text-primary sm:justify-start">
                      {nextPage.title}
                      <ArrowRight className="h-4 w-4" />
                    </p>
                  </Link>
                ) : (
                  <div className="text-sm text-muted-foreground">End of documentation</div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

