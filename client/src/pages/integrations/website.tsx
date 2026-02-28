import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, ExternalLink, Search, RefreshCcw, AlertTriangle } from "lucide-react";

type WidgetConfig = {
  widgetTitle: string;
  welcomeMessage: string;
  primaryColor: string;
  position: "bottom-right" | "bottom-left";
  collectVisitorInfo: boolean;
  leadCaptureEnabled: boolean;
  leadPromptAfterMessages: number;
  leadPromptMessage: string;
  requireLeadEmail: boolean;
  leadIntentPreset: "conservative" | "balanced" | "aggressive";
  leadIntentScope: "commercial" | "commercial_and_escalation";
  allowedDomains: string[];
};

type WidgetConfigResponse = {
  platformId: number;
  status: string;
  token: string;
  config: WidgetConfig;
  domain: string | null;
  scriptUrl: string;
  frameUrl: string;
  embedSnippet: string;
  usage?: {
    websiteDomainsUsed: number;
    websiteDomainLimit: number | null;
    aiResponsesUsedToday: number;
    aiResponsesPerDay: number | null;
    aiResponsesResetAt: string;
  };
};

type KnowledgeBaseOption = {
  id: number;
  name: string;
  isActive: boolean;
};

type WebsiteDomainChatConfiguration = {
  id: number;
  platformId: number;
  externalId: string;
  chatType: string;
  chatName: string;
  knowledgeBaseId: number | null;
  isActive: boolean;
  knowledgeBase?: {
    name: string;
  };
};

type WebsiteLead = {
  id: number;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  notes: string | null;
  sourceUrl: string | null;
  status: "new" | "contacted" | "qualified" | "converted" | "disqualified" | "spam" | string;
  createdAt: string;
};

const LEAD_STATUS_OPTIONS: Array<WebsiteLead["status"]> = [
  "new",
  "contacted",
  "qualified",
  "converted",
  "disqualified",
  "spam",
];

function formatDate(value: string | null | undefined) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function parseApiErrorPayload(error: Error): Record<string, unknown> | null {
  const message = String(error?.message ?? "");
  const jsonStart = message.indexOf("{");
  if (jsonStart < 0) return null;
  const jsonText = message.slice(jsonStart);
  try {
    const parsed = JSON.parse(jsonText);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function formatQuota(value: number | null | undefined): string {
  if (value === null || value === undefined) return "Unlimited";
  return value.toLocaleString();
}

function parseKnowledgeBaseDraftValue(value: string | undefined): number | null {
  if (!value || value === "none") return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

export default function WebsiteIntegrationPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [domain, setDomain] = useState("");
  const [draft, setDraft] = useState<WidgetConfig | null>(null);
  const [domainKnowledgeBaseDraft, setDomainKnowledgeBaseDraft] = useState<Record<number, string>>({});

  const isWorkspaceAdmin =
    user?.role === "owner" ||
    user?.role === "admin" ||
    String((user as any)?.workspaceRole ?? "").toLowerCase() === "admin";

  const {
    data: widget,
    isLoading: widgetLoading,
    isFetching: widgetFetching,
    refetch: refetchWidget,
    error: widgetError,
  } = useQuery<WidgetConfigResponse, Error>({
    queryKey: ["/api/widget/config"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const {
    data: leads = [],
    isLoading: leadsLoading,
    isFetching: leadsFetching,
    refetch: refetchLeads,
    error: leadsError,
  } = useQuery<WebsiteLead[], Error>({
    queryKey: ["/api/widget/leads"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: Boolean(user),
  });

  const {
    data: knowledgeBases = [],
    isLoading: knowledgeBasesLoading,
  } = useQuery<KnowledgeBaseOption[], Error>({
    queryKey: ["/api/knowledge-bases"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: Boolean(user),
  });

  const {
    data: websiteChatConfigurations = [],
    isLoading: websiteChatConfigurationsLoading,
    isFetching: websiteChatConfigurationsFetching,
    refetch: refetchWebsiteChatConfigurations,
  } = useQuery<WebsiteDomainChatConfiguration[], Error>({
    queryKey: [`/api/platforms/${widget?.platformId ?? 0}/chat-configurations`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: Boolean(widget?.platformId) && Boolean(user),
  });

  const websiteDomainConfigs = useMemo(
    () =>
      websiteChatConfigurations
        .filter((config) => config.chatType === "website_domain")
        .sort((a, b) => String(a.externalId ?? "").localeCompare(String(b.externalId ?? ""))),
    [websiteChatConfigurations],
  );

  const activeWebsiteDomainConfigs = useMemo(
    () => websiteDomainConfigs.filter((config) => Boolean(config.isActive)),
    [websiteDomainConfigs],
  );

  const unassignedDomainCount = useMemo(
    () => activeWebsiteDomainConfigs.filter((config) => !config.knowledgeBaseId).length,
    [activeWebsiteDomainConfigs],
  );

  useEffect(() => {
    if (!widget) return;
    setDraft(widget.config);
    setDomain(widget.domain ?? "");
  }, [widget]);

  useEffect(() => {
    setDomainKnowledgeBaseDraft((current) => {
      const next: Record<number, string> = {};
      for (const config of websiteDomainConfigs) {
        next[config.id] = current[config.id] ?? (config.knowledgeBaseId ? String(config.knowledgeBaseId) : "none");
      }
      return next;
    });
  }, [websiteDomainConfigs]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!draft) throw new Error("Widget config not loaded");
      const res = await apiRequest("PATCH", "/api/widget/config", {
        domain: domain.trim() || null,
        config: draft,
      });
      return (await res.json()) as WidgetConfigResponse;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["/api/widget/config"], updated);
      queryClient.invalidateQueries({ queryKey: [`/api/platforms/${updated.platformId}/chat-configurations`] });
      toast({ title: "Saved", description: "Widget settings updated." });
    },
    onError: (error: Error) => {
      const payload = parseApiErrorPayload(error);
      const code = String(payload?.code ?? "");
      if (code === "WEBSITE_DOMAIN_LIMIT_REACHED") {
        toast({
          title: "Domain limit reached",
          description:
            String(payload?.message ?? "") || "Your plan has reached the website domain limit. Upgrade to add more.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Save failed",
        description: String(payload?.message ?? "") || error.message,
        variant: "destructive",
      });
    },
  });

  const updateLeadStatusMutation = useMutation({
    mutationFn: async (input: { id: number; status: WebsiteLead["status"] }) => {
      const res = await apiRequest("PATCH", `/api/widget/leads/${input.id}/status`, {
        status: input.status,
      });
      return (await res.json()) as WebsiteLead;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/widget/leads"] });
      toast({ title: "Lead updated", description: "Lead status was updated." });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateDomainKnowledgeBaseMutation = useMutation({
    mutationFn: async (input: { configId: number; knowledgeBaseId: number | null }) => {
      const res = await apiRequest("PATCH", `/api/chat-configurations/${input.configId}`, {
        knowledgeBaseId: input.knowledgeBaseId,
      });
      return await res.json();
    },
    onSuccess: async (_updated, variables) => {
      if (widget?.platformId) {
        await queryClient.invalidateQueries({ queryKey: [`/api/platforms/${widget.platformId}/chat-configurations`] });
      }
      toast({
        title: "Knowledge base updated",
        description: `Domain mapping saved for configuration #${variables.configId}.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((lead) => {
      return (
        String(lead.id).includes(q) ||
        String(lead.fullName ?? "").toLowerCase().includes(q) ||
        String(lead.email ?? "").toLowerCase().includes(q) ||
        String(lead.company ?? "").toLowerCase().includes(q)
      );
    });
  }, [leads, search]);

  const isBusy = widgetFetching || saveMutation.isPending;

  return (
    <div className="space-y-6 wave-v2-page wave-v2-integrations">
      <section className="wave-v2-hero rounded-2xl border p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">Website Integration</h1>
            <p className="text-sm text-muted-foreground">
              Configure the widget, route domains to knowledge bases, and manage captured leads.
            </p>
          </div>
          <Badge variant="outline" className="glass-chip">
            Leads: {filteredLeads.length}
          </Badge>
        </div>
      </section>

      <Card className="glass-surface">
        <CardContent className="space-y-6 pt-6">
          {widgetLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-10 w-48" />
            </div>
          ) : widgetError ? (
            <p className="text-sm text-destructive">{widgetError.message}</p>
          ) : !widget || !draft ? (
            <p className="text-sm text-muted-foreground">Widget configuration not available.</p>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="widget-domain">Allowed domain (optional)</Label>
                  <Input
                    id="widget-domain"
                    value={domain}
                    onChange={(event) => setDomain(event.target.value)}
                    placeholder="example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="widget-color">Primary color</Label>
                  <Input
                    id="widget-color"
                    value={draft.primaryColor}
                    onChange={(event) =>
                      setDraft((current) => (current ? { ...current, primaryColor: event.target.value } : current))
                    }
                    placeholder="#3B82F6"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="widget-title">Widget title</Label>
                  <Input
                    id="widget-title"
                    value={draft.widgetTitle}
                    onChange={(event) =>
                      setDraft((current) => (current ? { ...current, widgetTitle: event.target.value } : current))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="widget-after-messages">Minimum user messages before lead prompt eligibility</Label>
                  <Input
                    id="widget-after-messages"
                    type="number"
                    min={1}
                    max={12}
                    value={draft.leadPromptAfterMessages}
                    onChange={(event) =>
                      setDraft((current) =>
                        current
                          ? {
                              ...current,
                              leadPromptAfterMessages: Math.max(
                                1,
                                Math.min(12, Number.parseInt(event.target.value || "1", 10) || 1),
                              ),
                            }
                          : current,
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lead-intent-preset">Lead intent preset</Label>
                  <Select
                    value={draft.leadIntentPreset}
                    onValueChange={(value: WidgetConfig["leadIntentPreset"]) =>
                      setDraft((current) => (current ? { ...current, leadIntentPreset: value } : current))
                    }
                  >
                    <SelectTrigger id="lead-intent-preset">
                      <SelectValue placeholder="Select preset" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="conservative">Conservative</SelectItem>
                      <SelectItem value="balanced">Balanced</SelectItem>
                      <SelectItem value="aggressive">Aggressive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lead-intent-scope">Lead intent scope</Label>
                  <Select
                    value={draft.leadIntentScope}
                    onValueChange={(value: WidgetConfig["leadIntentScope"]) =>
                      setDraft((current) => (current ? { ...current, leadIntentScope: value } : current))
                    }
                  >
                    <SelectTrigger id="lead-intent-scope">
                      <SelectValue placeholder="Select scope" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="commercial">Commercial only</SelectItem>
                      <SelectItem value="commercial_and_escalation">Commercial + escalation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="widget-welcome">Welcome message</Label>
                <Textarea
                  id="widget-welcome"
                  value={draft.welcomeMessage}
                  onChange={(event) =>
                    setDraft((current) => (current ? { ...current, welcomeMessage: event.target.value } : current))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lead-prompt">Lead prompt message</Label>
                <Textarea
                  id="lead-prompt"
                  value={draft.leadPromptMessage}
                  onChange={(event) =>
                    setDraft((current) => (current ? { ...current, leadPromptMessage: event.target.value } : current))
                  }
                />
              </div>

              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={draft.collectVisitorInfo}
                    onCheckedChange={(checked) =>
                      setDraft((current) => (current ? { ...current, collectVisitorInfo: checked } : current))
                    }
                  />
                  Collect visitor info
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={draft.leadCaptureEnabled}
                    onCheckedChange={(checked) =>
                      setDraft((current) => (current ? { ...current, leadCaptureEnabled: checked } : current))
                    }
                  />
                  Enable lead prompt
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={draft.requireLeadEmail}
                    onCheckedChange={(checked) =>
                      setDraft((current) => (current ? { ...current, requireLeadEmail: checked } : current))
                    }
                  />
                  Require email for lead
                </label>
              </div>

              <div className="rounded-lg border border-border bg-background/40 p-4 space-y-3">
                <p className="text-sm font-medium">Embed snippet</p>
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-words">{widget.embedSnippet}</pre>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="glass-chip"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(widget.embedSnippet);
                        toast({ title: "Copied", description: "Snippet copied to clipboard." });
                      } catch {
                        toast({
                          title: "Copy failed",
                          description: "Could not copy snippet.",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy snippet
                  </Button>
                  <Button type="button" variant="outline" className="glass-chip" asChild>
                    <a href={widget.frameUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open widget test
                    </a>
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="outline" className="glass-chip">
                  Website domains: {widget.usage?.websiteDomainsUsed ?? 0}/
                  {formatQuota(widget.usage?.websiteDomainLimit)}
                </Badge>
                <Badge variant="outline" className="glass-chip">
                  AI today: {widget.usage?.aiResponsesUsedToday?.toLocaleString() ?? 0}/
                  {formatQuota(widget.usage?.aiResponsesPerDay)}
                </Badge>
                <Badge variant="outline" className="glass-chip">
                  Quota resets: {formatDate(widget.usage?.aiResponsesResetAt)}
                </Badge>
                <Badge variant="outline" className="glass-chip">
                  Status: {widget.status}
                </Badge>
                <Badge variant="outline" className="glass-chip">
                  Token: {widget.token.slice(0, 10)}...
                </Badge>
                <Button
                  type="button"
                  variant="outline"
                  className="glass-chip"
                  onClick={() => refetchWidget()}
                  disabled={widgetFetching}
                >
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
                <Button
                  type="button"
                  className="glass-chip"
                  disabled={!isWorkspaceAdmin || isBusy}
                  onClick={() => saveMutation.mutate()}
                >
                  {saveMutation.isPending ? "Saving..." : "Save settings"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="glass-surface">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Domain Knowledge Base Routing</CardTitle>
              <CardDescription className="mt-1.5">
                Assign a knowledge base per website domain. Widget chat is blocked on domains without a valid
                assignment.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              className="glass-chip"
              onClick={() => refetchWebsiteChatConfigurations()}
              disabled={websiteChatConfigurationsFetching || !widget?.platformId}
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              {websiteChatConfigurationsFetching ? "Refreshing..." : "Refresh domains"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {unassignedDomainCount > 0 && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  {unassignedDomainCount} active domain{unassignedDomainCount === 1 ? "" : "s"} missing a knowledge
                  base assignment. Widget chat is blocked for those domains until mapped.
                </p>
              </div>
            </div>
          )}

          {!widget?.platformId ? (
            <p className="text-sm text-muted-foreground">
              Widget platform not available yet. Save website settings first to load domain mappings.
            </p>
          ) : websiteChatConfigurationsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : websiteDomainConfigs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No website destination domains yet. Add an allowed domain above and save settings to create a routing
              row.
            </p>
          ) : (
            <div className="rounded-lg border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domain</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Knowledge Base</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {websiteDomainConfigs.map((config) => {
                    const selectedValue =
                      domainKnowledgeBaseDraft[config.id] ?? (config.knowledgeBaseId ? String(config.knowledgeBaseId) : "none");
                    const isSavingRow =
                      updateDomainKnowledgeBaseMutation.isPending &&
                      updateDomainKnowledgeBaseMutation.variables?.configId === config.id;

                    return (
                      <TableRow key={config.id}>
                        <TableCell className="font-medium">{config.externalId}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={config.isActive ? "glass-chip border-emerald-500/40 text-emerald-300" : "glass-chip"}
                          >
                            {config.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="min-w-[240px]">
                          <Select
                            value={selectedValue}
                            onValueChange={(value) =>
                              setDomainKnowledgeBaseDraft((current) => ({ ...current, [config.id]: value }))
                            }
                            disabled={knowledgeBasesLoading || !isWorkspaceAdmin}
                          >
                            <SelectTrigger className="h-9 bg-background/60">
                              <SelectValue placeholder="Select knowledge base" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No knowledge base (block chat)</SelectItem>
                              {knowledgeBases.map((kb) => (
                                <SelectItem key={kb.id} value={String(kb.id)}>
                                  {kb.name}
                                  {kb.isActive ? "" : " (inactive)"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {!config.knowledgeBaseId && (
                            <p className="mt-2 text-xs text-amber-300">No knowledge base assigned. Chat will be blocked.</p>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="outline"
                            className="glass-chip"
                            disabled={!isWorkspaceAdmin || isSavingRow}
                            onClick={() =>
                              updateDomainKnowledgeBaseMutation.mutate({
                                configId: config.id,
                                knowledgeBaseId: parseKnowledgeBaseDraftValue(
                                  domainKnowledgeBaseDraft[config.id] ??
                                    (config.knowledgeBaseId ? String(config.knowledgeBaseId) : "none"),
                                ),
                              })
                            }
                          >
                            {isSavingRow ? "Saving..." : "Save"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass-surface">
        <CardHeader>
          <CardTitle>Website Leads</CardTitle>
          <CardDescription>Captured leads from the website widget.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, email, company, ID..."
                className="pl-8"
              />
            </div>
            <Badge variant="outline" className="glass-chip">
              {filteredLeads.length} leads
            </Badge>
            <Button
              type="button"
              variant="outline"
              className="glass-chip"
              onClick={() => refetchLeads()}
              disabled={leadsFetching}
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              {leadsFetching ? "Refreshing..." : "Refresh"}
            </Button>
          </div>

          {leadsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : leadsError ? (
            <p className="text-sm text-destructive">{leadsError.message}</p>
          ) : (
            <div className="rounded-lg border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Captured</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        No leads yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLeads.map((lead) => (
                      <TableRow key={lead.id}>
                        <TableCell>{lead.id}</TableCell>
                        <TableCell>{lead.fullName || "--"}</TableCell>
                        <TableCell>{lead.email || "--"}</TableCell>
                        <TableCell>{lead.company || "--"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="glass-chip">
                            {lead.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[220px] truncate">{lead.sourceUrl || "--"}</TableCell>
                        <TableCell>{formatDate(lead.createdAt)}</TableCell>
                        <TableCell className="text-right">
                          <select
                            value={lead.status}
                            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                            onChange={(event) =>
                              updateLeadStatusMutation.mutate({
                                id: lead.id,
                                status: event.target.value as WebsiteLead["status"],
                              })
                            }
                            disabled={
                              updateLeadStatusMutation.isPending || !isWorkspaceAdmin || !LEAD_STATUS_OPTIONS.includes(lead.status)
                            }
                          >
                            {LEAD_STATUS_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
