import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Database, 
  FileText, 
  Plus, 
  Upload,
  Book,
  Search,
  MoreVertical,
  Trash2,
  Edit,
  Eye,
  X,
  RefreshCcw,
  Link2,
  Pause,
  Play,
  Clock,
  ExternalLink,
} from "lucide-react";
import { CreateKnowledgeBaseDialog } from "@/components/knowledge/create-knowledge-base-dialog";
import { DocumentUploadDialog } from "@/components/knowledge/document-upload-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface KnowledgeBase {
  id: number;
  name: string;
  description: string | null;
  documentCount: number;
  isActive: boolean;
  createdAt: string;
}

interface KnowledgeDocument {
  id: number;
  title: string;
  content: string;
  metadata?: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

interface KnowledgeUrlSyncRun {
  id: number;
  sourceId: number;
  status: string;
  triggerType: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  pagesDiscovered: number;
  pagesFetched: number;
  pagesCreated: number;
  pagesUpdated: number;
  pagesUnchanged: number;
  pagesMarkedStale: number;
  pagesSkipped: number;
  errorsCount: number;
  warningsCount: number;
  summary?: {
    pages?: Array<{ url: string; status: string; reason?: string }>;
    stoppedForQuota?: boolean;
    stoppedForQuotaMessage?: string | null;
    stoppedForTimeLimit?: boolean;
  } | null;
}

interface KnowledgeUrlSource {
  id: number;
  knowledgeBaseId: number;
  workspaceOwnerId: number;
  name: string | null;
  seedUrl: string;
  host: string;
  pathPrefix: string;
  status: "active" | "paused" | "error";
  syncMode: "manual" | "scheduled";
  scheduleRecurrence: "daily" | "weekly" | null;
  scheduleDaysOfWeek: number[] | null;
  scheduleTime: string | null;
  scheduleTimezone: string | null;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastRunStatus: "success" | "partial" | "failed" | null;
  lastError: string | null;
  latestRun?: KnowledgeUrlSyncRun | null;
}

export default function KnowledgeBasePage() {
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedKnowledgeBase, setSelectedKnowledgeBase] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewingDocument, setViewingDocument] = useState<KnowledgeDocument | null>(null);
  const [editingDocument, setEditingDocument] = useState<KnowledgeDocument | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [runsDialogSource, setRunsDialogSource] = useState<KnowledgeUrlSource | null>(null);

  // Fetch knowledge bases
  const { data: knowledgeBases = [], isLoading: isLoadingBases } = useQuery<KnowledgeBase[]>({
    queryKey: ["/api/knowledge-bases"],
  });

  // Fetch documents for selected knowledge base
  const { data: documents = [], isLoading: isLoadingDocs } = useQuery<KnowledgeDocument[]>({
    queryKey: [`/api/knowledge-bases/${selectedKnowledgeBase}/documents`],
    enabled: !!selectedKnowledgeBase,
  });

  const { data: urlSources = [], isLoading: isLoadingUrlSources } = useQuery<KnowledgeUrlSource[]>({
    queryKey: [`/api/knowledge-bases/${selectedKnowledgeBase}/url-sources`],
    enabled: !!selectedKnowledgeBase,
  });

  const { data: sourceRuns = [], isLoading: isLoadingSourceRuns } = useQuery<KnowledgeUrlSyncRun[]>({
    queryKey: runsDialogSource ? [`/api/knowledge-url-sources/${runsDialogSource.id}/runs`] : ["__no_url_source_runs__"],
    enabled: !!runsDialogSource,
  });

  // Update document mutation
  const updateDocumentMutation = useMutation({
    mutationFn: async (data: { id: number; title: string; content: string }) => {
      return apiRequest("PUT", `/api/knowledge-documents/${data.id}`, {
        title: data.title,
        content: data.content
      });
    },
    onSuccess: () => {
      setEditingDocument(null);
      setEditTitle("");
      setEditContent("");
      toast({
        title: "Document updated",
        description: "Your document has been updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/knowledge-bases/${selectedKnowledgeBase}/documents`] });
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update document. Please try again.",
        variant: "destructive",
      });
    },
  });

  const syncUrlSourceMutation = useMutation({
    mutationFn: async (sourceId: number) => {
      const res = await apiRequest("POST", `/api/knowledge-url-sources/${sourceId}/sync`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Sync started", description: "URL sync is running in the background." });
      if (selectedKnowledgeBase) {
        queryClient.invalidateQueries({ queryKey: [`/api/knowledge-bases/${selectedKnowledgeBase}/url-sources`] });
      }
      if (runsDialogSource) {
        queryClient.invalidateQueries({ queryKey: [`/api/knowledge-url-sources/${runsDialogSource.id}/runs`] });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Sync failed",
        description: error.message || "Failed to start URL sync.",
        variant: "destructive",
      });
    },
  });

  const patchUrlSourceMutation = useMutation({
    mutationFn: async ({ sourceId, patch }: { sourceId: number; patch: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `/api/knowledge-url-sources/${sourceId}`, patch);
      return res.json();
    },
    onSuccess: () => {
      if (selectedKnowledgeBase) {
        queryClient.invalidateQueries({ queryKey: [`/api/knowledge-bases/${selectedKnowledgeBase}/url-sources`] });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to update URL sync source.",
        variant: "destructive",
      });
    },
  });

  const deleteUrlSourceMutation = useMutation({
    mutationFn: async (sourceId: number) => {
      const res = await apiRequest("DELETE", `/api/knowledge-url-sources/${sourceId}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Source deleted", description: "URL sync source deleted. Existing documents were kept." });
      if (selectedKnowledgeBase) {
        queryClient.invalidateQueries({ queryKey: [`/api/knowledge-bases/${selectedKnowledgeBase}/url-sources`] });
      }
      if (runsDialogSource) setRunsDialogSource(null);
    },
    onError: (error: any) => {
      toast({
        title: "Delete failed",
        description: error.message || "Failed to delete URL sync source.",
        variant: "destructive",
      });
    },
  });

  const handleEditDocument = (doc: KnowledgeDocument) => {
    setEditingDocument(doc);
    setEditTitle(doc.title);
    setEditContent(doc.content);
    setViewingDocument(null);
  };

  const handleSaveDocument = () => {
    if (!editingDocument || !editTitle.trim() || !editContent.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide both a title and content",
        variant: "destructive",
      });
      return;
    }
    
    updateDocumentMutation.mutate({
      id: editingDocument.id,
      title: editTitle,
      content: editContent
    });
  };

  const filteredBases = knowledgeBases.filter(base =>
    base.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (base.description && base.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleUploadClick = (knowledgeBaseId: number) => {
    setSelectedKnowledgeBase(knowledgeBaseId);
    setUploadDialogOpen(true);
  };

  const getDocSourceMeta = (doc: KnowledgeDocument) => {
    const metadata = doc.metadata && typeof doc.metadata === "object" ? doc.metadata : null;
    return {
      sourceType: metadata?.sourceType as string | undefined,
      sourceUrl: metadata?.sourceUrl as string | undefined,
      syncStatus: metadata?.syncStatus as string | undefined,
    };
  };

  const sourceStatusBadgeVariant = (status: KnowledgeUrlSource["status"]) => {
    if (status === "active") return "default" as const;
    if (status === "paused") return "secondary" as const;
    return "destructive" as const;
  };

  const runStatusBadgeVariant = (status: string | null | undefined) => {
    if (status === "success") return "default" as const;
    if (status === "partial") return "secondary" as const;
    if (status === "failed" || status === "error") return "destructive" as const;
    return "outline" as const;
  };

  const formatSyncMode = (source: KnowledgeUrlSource) => {
    if (source.syncMode !== "scheduled") return "Manual";
    const recur = source.scheduleRecurrence === "weekly" ? "Weekly" : "Daily";
    return `${recur}${source.scheduleTime ? ` - ${source.scheduleTime}` : ""}`;
  };

  const handleToggleSourcePaused = (source: KnowledgeUrlSource) => {
    patchUrlSourceMutation.mutate({
      sourceId: source.id,
      patch: { status: source.status === "paused" ? "active" : "paused" },
    });
  };

  const handleDeleteSource = (source: KnowledgeUrlSource) => {
    if (!window.confirm(`Delete URL sync source "${source.name || `${source.host}${source.pathPrefix}`}"? Synced documents will be kept.`)) {
      return;
    }
    deleteUrlSourceMutation.mutate(source.id);
  };

  const selectedBase = selectedKnowledgeBase
    ? knowledgeBases.find((base) => base.id === selectedKnowledgeBase) ?? null
    : null;

  if (isLoadingBases) {
    return (
      <div className="space-y-6 wave-v2-page wave-v2-knowledge-base">
        <section className="wave-v2-hero rounded-2xl border p-5 md:p-6">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">Knowledge Base</h1>
            <p className="text-sm text-muted-foreground">Manage grounded content, URL sync sources, and document quality.</p>
          </div>
        </section>
        <div className="flex justify-between items-center">
          <div>
            <p className="text-muted-foreground">Manage your AI's knowledge and information</p>
          </div>
        </div>
        <div className="grid gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-3 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-3 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 wave-v2-page wave-v2-knowledge-base">
      <section className="wave-v2-hero rounded-2xl border p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">Knowledge Base</h1>
            <p className="text-sm text-muted-foreground">
              Manage source documents and URL sync crawlers used to ground assistant responses.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="glass-chip">
              Bases: {knowledgeBases.length}
            </Badge>
            <Badge variant="outline" className="glass-chip">
              Selected: {selectedBase ? selectedBase.name : "None"}
            </Badge>
          </div>
        </div>
      </section>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-muted-foreground">Manage your AI's knowledge and information</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Create Knowledge Base
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search knowledge bases..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Knowledge Bases Grid */}
      {filteredBases.length === 0 ? (
        <Card className="text-center py-12 glass-surface lift-card">
          <CardContent>
            <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Knowledge Bases Found</h3>
            <p className="text-muted-foreground mb-4">
              {knowledgeBases.length === 0 
                ? "Create your first knowledge base to start storing information for your AI"
                : "No knowledge bases match your search criteria"
              }
            </p>
            {knowledgeBases.length === 0 && (
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Knowledge Base
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredBases.map((base) => (
            <Card key={base.id} className="relative glass-surface lift-card">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Book className="h-5 w-5 text-primary" />
                      <span className="truncate">{base.name}</span>
                      {!base.isActive && (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </CardTitle>
                    {base.description && (
                      <CardDescription className="mt-1">
                        {base.description}
                      </CardDescription>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Documents</span>
                    <Badge variant="outline">
                      <FileText className="h-3 w-3 mr-1" />
                      {base.documentCount}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Created</span>
                    <span>{new Date(base.createdAt).toLocaleDateString()}</span>
                  </div>
                  
                  <div className="pt-2 space-y-2">
                    <Button 
                      className="w-full" 
                      onClick={() => handleUploadClick(base.id)}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Add Knowledge
                    </Button>
                    
                    {base.documentCount > 0 && (
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={() => setSelectedKnowledgeBase(base.id)}
                      >
                        <Search className="h-4 w-4 mr-2" />
                        View Documents ({base.documentCount})
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      className="w-full"
                      onClick={() => setSelectedKnowledgeBase(base.id)}
                    >
                      <Link2 className="h-4 w-4 mr-2" />
                      Manage URL Sync
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Documents Preview */}
      {selectedKnowledgeBase && (
        isLoadingDocs ? (
          <Card className="glass-surface lift-card">
            <CardHeader>
              <Skeleton className="h-6 w-72 max-w-full" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[1, 2, 3].map((row) => (
                  <div key={row} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-64 max-w-full" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <div className="flex gap-2">
                      <Skeleton className="h-8 w-8 rounded-md" />
                      <Skeleton className="h-8 w-8 rounded-md" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : documents.length > 0 ? (
          <Card className="glass-surface lift-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Documents in {selectedBase?.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {documents.slice(0, 5).map((doc) => (
                  <div key={doc.id} className="flex flex-col gap-3 p-3 border rounded-lg transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between">
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => setViewingDocument(doc)}
                    >
                      <div className="flex items-center flex-wrap gap-2">
                        <h4 className="font-medium hover:text-primary transition-colors">{doc.title}</h4>
                        {getDocSourceMeta(doc).sourceType === "url_crawl" && (
                          <>
                            <Badge variant="outline" className="text-xs">
                              <Link2 className="h-3 w-3 mr-1" />
                              URL Sync
                            </Badge>
                            {getDocSourceMeta(doc).syncStatus === "stale" && (
                              <Badge variant="secondary" className="text-xs">Stale</Badge>
                            )}
                          </>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Updated {new Date(doc.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewingDocument(doc)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setViewingDocument(doc)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEditDocument(doc)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
                {documents.length > 5 && (
                  <p className="text-sm text-muted-foreground text-center pt-2">
                    And {documents.length - 5} more documents...
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ) : null
      )}

      {/* URL Sync Sources */}
      {selectedKnowledgeBase && (
        <Card className="glass-surface lift-card">
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2">
                <RefreshCcw className="h-5 w-5" />
                URL Sync Sources{selectedBase ? ` for ${selectedBase.name}` : ""}
              </CardTitle>
              <CardDescription className="mt-1">
                Managed same-host path-prefix crawlers for static HTML pages. Best-effort sync continues on per-page failures and marks removed pages as stale.
              </CardDescription>
            </div>
            <Button variant="outline" onClick={() => setUploadDialogOpen(true)} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Add URL Sync Source
            </Button>
          </CardHeader>
          <CardContent>
            {isLoadingUrlSources ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="rounded-lg border p-4 space-y-2">
                    <Skeleton className="h-4 w-56 max-w-full" />
                    <Skeleton className="h-3 w-80 max-w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ))}
              </div>
            ) : urlSources.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center">
                <RefreshCcw className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <h3 className="font-medium mb-1">No URL sync sources yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Open Add Knowledge and use the URL Sync tab to create a managed crawler for this knowledge base.
                </p>
                <Button onClick={() => setUploadDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add URL Sync Source
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {urlSources.map((source) => (
                  <div key={source.id} className="rounded-lg border p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-medium truncate">
                            {source.name || `${source.host}${source.pathPrefix}`}
                          </h4>
                          <Badge variant={sourceStatusBadgeVariant(source.status)}>
                            {source.status === "paused" ? "Paused" : source.status === "error" ? "Error" : "Active"}
                          </Badge>
                          <Badge variant="outline">
                            <Clock className="h-3 w-3 mr-1" />
                            {formatSyncMode(source)}
                          </Badge>
                          {source.lastRunStatus && (
                            <Badge variant={runStatusBadgeVariant(source.lastRunStatus)}>
                              Last run: {source.lastRunStatus}
                            </Badge>
                          )}
                        </div>

                        <div className="text-sm text-muted-foreground break-all">
                          {source.seedUrl}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>Host: {source.host}</span>
                          <span>Path Prefix: {source.pathPrefix}</span>
                          {source.scheduleTimezone && source.syncMode === "scheduled" && (
                            <span>Timezone: {source.scheduleTimezone}</span>
                          )}
                          {source.lastRunAt && (
                            <span>Last Run: {new Date(source.lastRunAt).toLocaleString()}</span>
                          )}
                        </div>

                        {source.latestRun && (
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <Badge variant="outline">Discovered {source.latestRun.pagesDiscovered}</Badge>
                            <Badge variant="outline">Fetched {source.latestRun.pagesFetched}</Badge>
                            <Badge variant="outline">Created {source.latestRun.pagesCreated}</Badge>
                            <Badge variant="outline">Updated {source.latestRun.pagesUpdated}</Badge>
                            <Badge variant="outline">Unchanged {source.latestRun.pagesUnchanged}</Badge>
                            <Badge variant="outline">Stale {source.latestRun.pagesMarkedStale}</Badge>
                            <Badge variant="outline">Skipped {source.latestRun.pagesSkipped}</Badge>
                            {(source.latestRun.errorsCount > 0 || source.latestRun.warningsCount > 0) && (
                              <Badge variant={source.latestRun.errorsCount > 0 ? "destructive" : "secondary"}>
                                {source.latestRun.errorsCount} errors / {source.latestRun.warningsCount} warnings
                              </Badge>
                            )}
                          </div>
                        )}

                        {source.lastError && (
                          <p className="text-xs text-destructive">
                            {source.lastError}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full sm:w-auto"
                          onClick={() => syncUrlSourceMutation.mutate(source.id)}
                          disabled={syncUrlSourceMutation.isPending || patchUrlSourceMutation.isPending || deleteUrlSourceMutation.isPending}
                        >
                          {syncUrlSourceMutation.isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <RefreshCcw className="h-4 w-4 mr-2" />
                          )}
                          Sync Now
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full sm:w-auto"
                          onClick={() => handleToggleSourcePaused(source)}
                          disabled={patchUrlSourceMutation.isPending || syncUrlSourceMutation.isPending || deleteUrlSourceMutation.isPending}
                        >
                          {source.status === "paused" ? (
                            <Play className="h-4 w-4 mr-2" />
                          ) : (
                            <Pause className="h-4 w-4 mr-2" />
                          )}
                          {source.status === "paused" ? "Resume" : "Pause"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full sm:w-auto"
                          onClick={() => setRunsDialogSource(source)}
                          disabled={deleteUrlSourceMutation.isPending}
                        >
                          <Clock className="h-4 w-4 mr-2" />
                          View Runs
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-destructive hover:text-destructive sm:w-auto"
                          onClick={() => handleDeleteSource(source)}
                          disabled={deleteUrlSourceMutation.isPending || patchUrlSourceMutation.isPending || syncUrlSourceMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <CreateKnowledgeBaseDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
      
      {selectedKnowledgeBase && (
        <DocumentUploadDialog
          open={uploadDialogOpen}
          onOpenChange={setUploadDialogOpen}
          knowledgeBaseId={selectedKnowledgeBase}
        />
      )}
      
      {/* Document Viewer Dialog */}
      <Dialog open={!!viewingDocument} onOpenChange={() => setViewingDocument(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {viewingDocument?.title}
                </DialogTitle>
                <DialogDescription>
                  Updated {viewingDocument && new Date(viewingDocument.updatedAt).toLocaleDateString()}
                  {viewingDocument && viewingDocument.createdAt !== viewingDocument.updatedAt && (
                    <span> - Created {new Date(viewingDocument.createdAt).toLocaleDateString()}</span>
                  )}
                </DialogDescription>
                {viewingDocument && getDocSourceMeta(viewingDocument).sourceType === "url_crawl" && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      <Link2 className="h-3 w-3 mr-1" />
                      URL Sync
                    </Badge>
                    {getDocSourceMeta(viewingDocument).syncStatus === "stale" && (
                      <Badge variant="secondary" className="text-xs">Stale</Badge>
                    )}
                    {getDocSourceMeta(viewingDocument).sourceUrl && (
                      <a
                        href={getDocSourceMeta(viewingDocument).sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center text-xs text-primary hover:underline"
                      >
                        Source URL
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    )}
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewingDocument(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
          
          <ScrollArea className="flex-1 mt-4">
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground bg-background/50 rounded-md p-4 border">
                {viewingDocument?.content}
              </div>
            </div>
          </ScrollArea>
          
          <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
            <Button variant="outline" onClick={() => setViewingDocument(null)}>
              Close
            </Button>
            <Button onClick={() => handleEditDocument(viewingDocument!)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Document
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* URL Sync Runs Dialog */}
      <Dialog
        open={!!runsDialogSource}
        onOpenChange={(open) => {
          if (!open) setRunsDialogSource(null);
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCcw className="h-5 w-5" />
              URL Sync Runs
            </DialogTitle>
            <DialogDescription>
              {runsDialogSource ? (runsDialogSource.name || `${runsDialogSource.host}${runsDialogSource.pathPrefix}`) : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mt-2">
            <p className="text-sm text-muted-foreground break-all">
              {runsDialogSource?.seedUrl}
            </p>
            {runsDialogSource && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncUrlSourceMutation.mutate(runsDialogSource.id)}
                disabled={syncUrlSourceMutation.isPending}
              >
                {syncUrlSourceMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCcw className="h-4 w-4 mr-2" />
                )}
                Sync Now
              </Button>
            )}
          </div>

          <ScrollArea className="flex-1 mt-4">
            {isLoadingSourceRuns ? (
              <div className="space-y-3 pr-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="rounded-lg border p-4 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-56" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                ))}
              </div>
            ) : sourceRuns.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center">
                <Clock className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <h3 className="font-medium mb-1">No sync runs yet</h3>
                <p className="text-sm text-muted-foreground">
                  Start a manual sync to import pages from this source.
                </p>
              </div>
            ) : (
              <div className="space-y-3 pr-2">
                {sourceRuns.map((run) => (
                  <div key={run.id} className="rounded-lg border p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={runStatusBadgeVariant(run.status)}>{run.status}</Badge>
                        <Badge variant="outline">{run.triggerType}</Badge>
                        <span className="text-sm text-muted-foreground">Run #{run.id}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(run.createdAt).toLocaleString()}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 text-xs">
                      <Badge variant="outline">Discovered {run.pagesDiscovered}</Badge>
                      <Badge variant="outline">Fetched {run.pagesFetched}</Badge>
                      <Badge variant="outline">Created {run.pagesCreated}</Badge>
                      <Badge variant="outline">Updated {run.pagesUpdated}</Badge>
                      <Badge variant="outline">Unchanged {run.pagesUnchanged}</Badge>
                      <Badge variant="outline">Stale {run.pagesMarkedStale}</Badge>
                      <Badge variant="outline">Skipped {run.pagesSkipped}</Badge>
                      <Badge variant={run.errorsCount > 0 ? "destructive" : "secondary"}>
                        {run.errorsCount} errors / {run.warningsCount} warnings
                      </Badge>
                    </div>

                    {run.summary?.stoppedForQuota && (
                      <p className="text-xs text-amber-500">
                        Stopped early due to knowledge base storage quota.
                        {run.summary.stoppedForQuotaMessage ? ` ${run.summary.stoppedForQuotaMessage}` : ""}
                      </p>
                    )}
                    {run.summary?.stoppedForTimeLimit && (
                      <p className="text-xs text-amber-500">
                        Stopped early due to crawl time limit.
                      </p>
                    )}

                    {Array.isArray(run.summary?.pages) && run.summary.pages.length > 0 && (
                      <div className="rounded-md border p-3 bg-background/40">
                        <p className="text-xs font-medium mb-2">Recent page events</p>
                        <div className="space-y-1">
                          {run.summary.pages.slice(0, 10).map((page, idx) => (
                            <div key={`${run.id}-${idx}`} className="flex flex-wrap items-center gap-2 text-xs">
                              <Badge variant={runStatusBadgeVariant(page.status)}>{page.status}</Badge>
                              <span className="break-all text-muted-foreground">{page.url}</span>
                              {page.reason && <span className="text-muted-foreground">({page.reason})</span>}
                            </div>
                          ))}
                          {run.summary.pages.length > 10 && (
                            <p className="text-xs text-muted-foreground">
                              +{run.summary.pages.length - 10} more page events
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
      
      {/* Document Editor Dialog */}
      <Dialog open={!!editingDocument} onOpenChange={() => {
        if (!updateDocumentMutation.isPending) {
          setEditingDocument(null);
          setEditTitle("");
          setEditContent("");
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Edit Document
            </DialogTitle>
            <DialogDescription>
              Make changes to your document content
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 space-y-4 mt-4 overflow-hidden flex flex-col">
            <div>
              <Label htmlFor="editTitle">Title</Label>
              <Input
                id="editTitle"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Document title"
                disabled={updateDocumentMutation.isPending}
                className="mt-1"
              />
            </div>
            
            <div className="flex-1 flex flex-col">
              <Label htmlFor="editContent">Content</Label>
              <Textarea
                id="editContent"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="Document content"
                disabled={updateDocumentMutation.isPending}
                className="flex-1 mt-1 min-h-[300px] resize-none"
              />
            </div>
          </div>
          
          <div className="flex justify-between items-center mt-4 pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              {editContent.length.toLocaleString()} characters
            </p>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setEditingDocument(null);
                  setEditTitle("");
                  setEditContent("");
                }}
                disabled={updateDocumentMutation.isPending}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveDocument}
                disabled={updateDocumentMutation.isPending || !editTitle.trim() || !editContent.trim()}
              >
                {updateDocumentMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

