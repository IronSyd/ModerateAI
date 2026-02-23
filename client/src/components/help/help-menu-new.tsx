import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { BookOpen, ExternalLink, LifeBuoy, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { docsSections, getDocsBaseUrl, getDocsUrl } from "@/lib/docs";
import { getSupportTelegramUrl } from "@/lib/support";

export function HelpMenu({ onClose }: { onClose: () => void }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [, navigate] = useLocation();
  const docsBaseUrl = getDocsBaseUrl();
  const supportUrl = getSupportTelegramUrl();

  const filteredSections = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return docsSections;
    return docsSections.filter((section) => {
      return (
        section.title.toLowerCase().includes(query) ||
        section.description.toLowerCase().includes(query)
      );
    });
  }, [searchQuery]);

  const openHelpHub = () => {
    navigate("/help");
    onClose();
  };

  const openDocsPage = (path: string) => {
    const url = getDocsUrl(path);
    if (!url) {
      openHelpHub();
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
    onClose();
  };

  return (
    <div className="relative z-50">
      <div className="fixed inset-0" onClick={onClose}></div>
      <div className="absolute right-0 mt-2 w-96 rounded-md border border-border bg-card shadow-lg">
        <div className="border-b p-3">
          <h3 className="text-lg font-semibold text-foreground">Documentation</h3>
          <p className="mt-1 text-sm text-muted-foreground">GitBook is the canonical ModerateAI docs source.</p>
          <div className="relative mt-3">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search docs sections..."
              className="bg-muted/40 pl-8"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-3">
          {!docsBaseUrl ? (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
              Docs unavailable in this environment. Configure `VITE_DOCS_BASE_URL` to enable GitBook links.
            </div>
          ) : (
            <div className="space-y-2">
              <button
                className="flex w-full items-center justify-between rounded-md border border-primary/20 px-3 py-2 text-left hover:bg-accent"
                onClick={() => openDocsPage("/")}
              >
                <span className="flex items-center gap-2 font-medium text-foreground">
                  <BookOpen className="h-4 w-4 text-primary" />
                  Open Full Documentation
                </span>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </button>

              {filteredSections.map((section) => (
                <button
                  key={section.id}
                  className="w-full rounded-md border border-border px-3 py-2 text-left hover:bg-accent"
                  onClick={() => openDocsPage(section.path)}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-foreground">{section.title}</p>
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="border-t bg-muted/30 p-3">
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="text-sm" onClick={openHelpHub}>
              Help Hub
            </Button>
            <a href={supportUrl} target="_blank" rel="noopener noreferrer" onClick={onClose}>
              <Button variant="outline" className="w-full text-sm">
                <LifeBuoy className="mr-2 h-4 w-4" />
                Contact Support
              </Button>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
