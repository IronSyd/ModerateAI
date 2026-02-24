import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link } from "wouter";
import { ArrowLeft, LifeBuoy, Scale } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { termsOfServiceContent } from "@/lib/legal-content";
import { getSupportTelegramUrl } from "@/lib/support";

export default function TermsOfServicePage() {
  const supportUrl = getSupportTelegramUrl();
  const { title, description, markdown, contactEmail } = termsOfServiceContent;
  const { toast } = useToast();

  const copyText = async (value: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch {
      // Fall through to legacy copy.
    }

    try {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.top = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(textarea);
      return copied;
    } catch {
      return false;
    }
  };

  const showCopyResultToast = (copied: boolean, value: string) => {
    if (copied) {
      toast({
        title: "Copied",
        description: "Email address copied to clipboard.",
      });
      return;
    }

    toast({
      title: "Copy failed",
      description: `Copy manually: ${value}`,
      variant: "destructive",
    });
  };

  const handleCopyEmail = async (value: string) => {
    const copied = await copyText(value);
    showCopyResultToast(copied, value);
  };

  const extractMailtoAddress = (href: string) => {
    const mailtoValue = href.slice("mailto:".length);
    return decodeURIComponent(mailtoValue.split("?")[0] || "").trim();
  };

  if (!markdown || !markdown.trim()) {
    return (
      <div className="min-h-screen bg-background px-4 py-10 md:py-14">
        <div className="mx-auto max-w-4xl">
          <Card className="glass-card border-red-500/30">
            <CardHeader>
              <CardTitle>Terms of Service Unavailable</CardTitle>
              <CardDescription>
                The terms of service content could not be loaded in this build.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button asChild className="tactile-button">
                <Link href="/">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Home
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10 md:py-14">
      <div className="mx-auto max-w-5xl space-y-6">
        <Card className="glass-card border-primary/20">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                Legal
              </Badge>
              <Badge variant="outline" className="border-border/60 bg-background/40 text-muted-foreground">
                Public Page
              </Badge>
            </div>
            <CardTitle className="kinetic-headline mt-2 flex items-center gap-2 text-3xl">
              <Scale className="h-6 w-6 text-primary" />
              {title}
            </CardTitle>
            <CardDescription className="max-w-3xl text-base">{description}</CardDescription>
            <div className="pt-2 text-sm text-muted-foreground">
              <div>
                Terms contact:{" "}
                <button
                  type="button"
                  aria-label="Copy terms contact email"
                  className="text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
                  onClick={() => void handleCopyEmail(contactEmail)}
                >
                  {contactEmail}
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild className="tactile-button">
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
              </Link>
            </Button>
            <a href={supportUrl} target="_blank" rel="noopener noreferrer">
              <Button type="button" variant="outline" className="glass-chip">
                <LifeBuoy className="mr-2 h-4 w-4" />
                Contact Support
              </Button>
            </a>
          </CardContent>
        </Card>

        <Card className="glass-card border-primary/20">
          <CardContent className="pt-6">
            <div className="prose prose-neutral max-w-none prose-headings:text-foreground prose-p:text-muted-foreground prose-li:text-muted-foreground prose-strong:text-foreground prose-code:text-foreground prose-pre:border prose-pre:border-primary/20 prose-pre:bg-background/70 dark:prose-invert dark:prose-p:text-muted-foreground dark:prose-li:text-muted-foreground dark:prose-headings:text-foreground dark:prose-strong:text-foreground">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ href = "", children, title: anchorTitle, className: anchorClassName, ...props }) => {
                    if (href.startsWith("mailto:")) {
                      const emailToCopy = extractMailtoAddress(href);
                      return (
                        <button
                          type="button"
                          className={
                            anchorClassName ??
                            "bg-transparent p-0 text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
                          }
                          onClick={() => void handleCopyEmail(emailToCopy || contactEmail)}
                          aria-label={`Copy email address ${emailToCopy || contactEmail}`}
                          title={anchorTitle}
                        >
                          {children}
                        </button>
                      );
                    }

                    const isExternal = /^(https?:)?\/\//i.test(href);
                    if (isExternal) {
                      return (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={
                            anchorClassName ??
                            "text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
                          }
                          {...props}
                        >
                          {children}
                        </a>
                      );
                    }

                    return (
                      <a
                        href={href}
                        className={
                          anchorClassName ??
                          "text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
                        }
                        {...props}
                      >
                        {children}
                      </a>
                    );
                  },
                }}
              >
                {markdown}
              </ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
