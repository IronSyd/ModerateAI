import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Search, Filter, MessageSquare, Pencil, Save, Sparkles, ChevronDown, ChevronUp, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

// Type definitions
type Conversation = {
  id: number;
  platformId: number;
  externalUserId: string;
  externalUsername?: string;
  externalId?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type Platform = {
  id: number;
  type: string;
  name: string;
  status: string;
};

type MessageCorrection = {
  id: number;
  correctedContent: string;
  annotation?: string | null;
  status: "draft" | "approved";
  approvedForLearningAt?: string | null;
  approvedByUserId?: number | null;
  createdByUserId: number;
  updatedByUserId: number;
  createdAt: string;
  updatedAt: string;
};

type ConversationMessage = {
  id: number;
  conversationId: number;
  content: string;
  sender: "user" | "ai" | "system";
  createdAt: string;
  metadata?: unknown;
  correction?: MessageCorrection;
};

const ROLE_ORDER = {
  viewer: 0,
  moderator: 1,
  admin: 2,
} as const;

function getEffectiveWorkspaceRole(user: any): keyof typeof ROLE_ORDER {
  if (!user) return "viewer";
  if (user.role === "owner" || user.role === "admin") return "admin";
  const ownerId = Number(user.workspaceOwnerId ?? 0);
  if (!Number.isFinite(ownerId) || ownerId <= 0) return "admin";
  const role = String(user.workspaceRole ?? "viewer").toLowerCase();
  if (role === "admin") return "admin";
  if (role === "moderator") return "moderator";
  return "viewer";
}

function hasRoleAtLeast(user: any, required: keyof typeof ROLE_ORDER): boolean {
  return ROLE_ORDER[getEffectiveWorkspaceRole(user)] >= ROLE_ORDER[required];
}

const Conversations = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [threadDialogOpen, setThreadDialogOpen] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [draftCorrectedContent, setDraftCorrectedContent] = useState("");
  const [draftAnnotation, setDraftAnnotation] = useState("");
  const [expandedOriginals, setExpandedOriginals] = useState<Set<number>>(new Set());

  // Fetch conversations
  const { data: conversations, isLoading, refetch: refetchConversations } = useQuery({
    queryKey: ['/api/conversations', platformFilter !== "all" ? platformFilter : null],
    retry: false,
  });

  // Fetch platforms for platform labels
  const { data: platforms } = useQuery({
    queryKey: ['/api/platforms'],
    retry: false,
  });

  const selectedConversationMessagesKey = selectedConversationId
    ? `/api/conversations/${selectedConversationId}/messages`
    : null;
  const {
    data: threadMessages,
    isLoading: isThreadLoading,
    refetch: refetchThreadMessages,
  } = useQuery({
    queryKey: [selectedConversationMessagesKey ?? "__disabled_conversation_messages__"],
    enabled: Boolean(selectedConversationMessagesKey),
    retry: false,
  });
  
  const saveCorrectionMutation = useMutation({
    mutationFn: async (input: { messageId: number; correctedContent: string; annotation?: string | null }) => {
      const res = await apiRequest("PUT", `/api/messages/${input.messageId}/correction`, {
        correctedContent: input.correctedContent,
        annotation: input.annotation ?? null,
      });
      return res.json();
    },
    onSuccess: async () => {
      if (selectedConversationMessagesKey) {
        await queryClient.invalidateQueries({ queryKey: [selectedConversationMessagesKey] });
      }
      await queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      refetchThreadMessages();
      toast({
        title: "Correction saved",
        description: "Saved as draft. Approve it explicitly to feed learning.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Save failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const approveCorrectionMutation = useMutation({
    mutationFn: async (input: { messageId: number }) => {
      const res = await apiRequest("POST", `/api/messages/${input.messageId}/correction/approve-learning`, {});
      return res.json();
    },
    onSuccess: async () => {
      if (selectedConversationMessagesKey) {
        await queryClient.invalidateQueries({ queryKey: [selectedConversationMessagesKey] });
      }
      await queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      refetchThreadMessages();
      toast({
        title: "Approved for learning",
        description: "This correction can now influence future responses.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Approval failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Platform type to display label
  const platformLabel = {
    website: "Website",
    telegram: "Telegram",
    discord: "Discord"
  };
  
  // Status badge variant
  const statusBadgeVariant = {
    active: "success",
    closed: "secondary",
    archived: "outline"
  };

  const canManageCorrections = hasRoleAtLeast(user, "moderator");

  const resolvePlatformType = (conversation: Conversation): string => {
    const platform = ((platforms as Platform[] | undefined) ?? []).find(
      (candidate) => candidate.id === conversation.platformId,
    );
    return String(platform?.type ?? "").toLowerCase();
  };

  const resolvePlatformName = (conversation: Conversation): string => {
    const platform = ((platforms as Platform[] | undefined) ?? []).find(
      (candidate) => candidate.id === conversation.platformId,
    );
    return platform?.name ?? "Unknown Platform";
  };

  const selectedConversation = useMemo(
    () => ((conversations as Conversation[] | undefined) ?? []).find((row) => row.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId],
  );

  const threadMessagesList = (threadMessages as ConversationMessage[] | undefined) ?? [];

  const openThread = (conversationId: number) => {
    setSelectedConversationId(conversationId);
    setThreadDialogOpen(true);
    setEditingMessageId(null);
    setDraftCorrectedContent("");
    setDraftAnnotation("");
  };

  const beginCorrectionEdit = (message: ConversationMessage) => {
    setEditingMessageId(message.id);
    setDraftCorrectedContent(message.correction?.correctedContent ?? message.content);
    setDraftAnnotation(message.correction?.annotation ?? "");
  };

  const cancelCorrectionEdit = () => {
    setEditingMessageId(null);
    setDraftCorrectedContent("");
    setDraftAnnotation("");
  };

  const toggleOriginal = (messageId: number) => {
    setExpandedOriginals((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  };

  const hasUnsavedChanges = (message: ConversationMessage): boolean => {
    if (editingMessageId !== message.id) return false;
    const baselineContent = (message.correction?.correctedContent ?? message.content).trim();
    const baselineAnnotation = (message.correction?.annotation ?? "").trim();
    return (
      draftCorrectedContent.trim() !== baselineContent ||
      draftAnnotation.trim() !== baselineAnnotation
    );
  };

  const saveCorrectionDraft = async (message: ConversationMessage) => {
    const correctedContent = draftCorrectedContent.trim();
    if (!correctedContent) {
      toast({
        title: "Correction required",
        description: "Corrected content cannot be empty.",
        variant: "destructive",
      });
      return;
    }
    await saveCorrectionMutation.mutateAsync({
      messageId: message.id,
      correctedContent,
      annotation: draftAnnotation.trim() || null,
    });
  };

  const approveCorrectionForLearning = async (message: ConversationMessage) => {
    if (editingMessageId === message.id && hasUnsavedChanges(message)) {
      await saveCorrectionDraft(message);
    } else if (!message.correction && editingMessageId !== message.id) {
      beginCorrectionEdit(message);
      toast({
        title: "Save correction first",
        description: "Create and save a correction draft before approving it for learning.",
      });
      return;
    }
    await approveCorrectionMutation.mutateAsync({ messageId: message.id });
  };
  
  // Filter conversations based on search and filters
  const filteredConversations = (conversations as Conversation[] || []).filter((conversation: Conversation) => {
    if (platformFilter !== "all" && resolvePlatformType(conversation) !== platformFilter) {
      return false;
    }

    // Filter by status
    if (statusFilter !== "all" && conversation.status !== statusFilter) {
      return false;
    }
    
    // Filter by search query (username / IDs)
    if (searchQuery) {
      const haystack = [
        conversation.externalUsername ?? "",
        conversation.externalUserId ?? "",
        conversation.externalId ?? "",
      ].join(" ").toLowerCase();
      if (!haystack.includes(searchQuery.toLowerCase())) {
        return false;
      }
    }
    return true;
  });
  
  return (
    <div className="space-y-6 wave-v2-page wave-v2-conversations">
      <section className="wave-v2-hero rounded-2xl border p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">Conversations</h1>
            <p className="text-sm text-muted-foreground">
              Review recent customer threads, inspect AI replies, and approve corrections for learning.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="glass-chip">
              Total: {filteredConversations.length}
            </Badge>
            <Badge variant="outline" className="glass-chip capitalize">
              Platform: {platformFilter === "all" ? "All" : platformFilter}
            </Badge>
          </div>
        </div>
      </section>

      <Card className="glass-surface lift-card">
        <CardHeader>
          <CardTitle>Manage Conversations</CardTitle>
          <CardDescription>
            View and manage all customer conversations across your connected platforms.
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <Tabs defaultValue="all" className="w-full" onValueChange={setPlatformFilter}>
            <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="overflow-x-auto pb-1">
                <TabsList className="glass-chip w-max min-w-full sm:min-w-0">
                  <TabsTrigger value="all" className="whitespace-nowrap">All Platforms</TabsTrigger>
                  <TabsTrigger value="website" className="whitespace-nowrap">Website</TabsTrigger>
                  <TabsTrigger value="telegram" className="whitespace-nowrap">Telegram</TabsTrigger>
                  <TabsTrigger value="discord" className="whitespace-nowrap">Discord</TabsTrigger>
                </TabsList>
              </div>
              
              <div className="mt-1 flex w-full flex-col gap-2 md:mt-0 md:w-auto md:flex-row">
                <div className="relative w-full md:w-auto">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search by name..."
                    className="w-full pl-8 md:max-w-xs"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
                
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full glass-chip md:w-[180px]">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <TabsContent value="all" className="m-0">
              {renderConversationsTable(filteredConversations, isLoading)}
            </TabsContent>
            
            <TabsContent value="website" className="m-0">
              {renderConversationsTable(filteredConversations, isLoading)}
            </TabsContent>
            
            <TabsContent value="telegram" className="m-0">
              {renderConversationsTable(filteredConversations, isLoading)}
            </TabsContent>
            
            <TabsContent value="discord" className="m-0">
              {renderConversationsTable(filteredConversations, isLoading)}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog
        open={threadDialogOpen && Boolean(selectedConversationId)}
        onOpenChange={(open) => {
          setThreadDialogOpen(open);
          if (!open) {
            setEditingMessageId(null);
            setDraftCorrectedContent("");
            setDraftAnnotation("");
          }
        }}
      >
        <DialogContent className="max-h-[90vh] w-[95vw] max-w-5xl overflow-hidden p-0 glass-surface">
          {renderThreadDialog()}
        </DialogContent>
      </Dialog>
    </div>
  );
  
  function renderThreadDialog() {
    if (!selectedConversation) {
      return (
        <>
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle>Conversation Thread</DialogTitle>
            <DialogDescription>Select a conversation to review messages.</DialogDescription>
          </DialogHeader>
          <div className="p-6 text-sm text-muted-foreground">No conversation selected.</div>
        </>
      );
    }

    return (
      <>
        <DialogHeader className="border-b px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="truncate">Conversation Thread</DialogTitle>
              <DialogDescription className="mt-2">
                {selectedConversation.externalUsername || "Anonymous User"} | {resolvePlatformName(selectedConversation)} |{" "}
                {selectedConversation.externalId || selectedConversation.externalUserId}
              </DialogDescription>
            </div>
            <Badge variant="secondary">
              {platformLabel[resolvePlatformType(selectedConversation) as keyof typeof platformLabel] || "Unknown"}
            </Badge>
          </div>
        </DialogHeader>

        <div className="grid max-h-[calc(90vh-78px)] grid-cols-1 gap-0 overflow-hidden md:grid-cols-[minmax(0,1fr)_360px]">
          <div className="overflow-y-auto p-4 md:p-6">
            {isThreadLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 animate-pulse rounded-xl bg-accent" />
                ))}
              </div>
            ) : threadMessagesList.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                No messages found for this conversation.
              </div>
            ) : (
              <div className="space-y-3">
                {threadMessagesList.map((message) => renderThreadMessage(message))}
              </div>
            )}
          </div>

          <div className="border-t p-4 md:border-l md:border-t-0 md:p-5">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Correction Workflow</h3>
              <p className="text-xs text-muted-foreground">
                Create internal corrections for AI replies and explicitly approve them to feed learning.
              </p>
              <div className="rounded-lg border p-3 text-xs text-muted-foreground">
                <p>Permissions</p>
                <p className="mt-1">
                  Viewers can inspect threads. Moderators/Admins can create/edit corrections and approve for learning.
                </p>
              </div>
              {!canManageCorrections && (
                <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-200">
                  Your workspace role is read-only for corrections.
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => refetchThreadMessages()} disabled={isThreadLoading}>
                  Refresh Thread
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setThreadDialogOpen(false)}>
                  <X className="mr-2 h-4 w-4" />
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  function renderThreadMessage(message: ConversationMessage) {
    const isAi = message.sender === "ai";
    const isUser = message.sender === "user";
    const correction = message.correction;
    const isEditing = editingMessageId === message.id;
    const showOriginal = expandedOriginals.has(message.id);
    const canEditMessage = canManageCorrections && isAi;

    return (
      <div
        key={message.id}
        className={
          "rounded-xl border p-4 " +
          (isAi ? "border-blue-500/30 bg-blue-500/5" : isUser ? "border-border bg-card/20" : "border-amber-500/30 bg-amber-500/5")
        }
      >
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline">{isAi ? "AI" : isUser ? "User" : "System"}</Badge>
          <span className="text-muted-foreground">
            {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
          </span>
          {correction && (
            <Badge
              variant="outline"
              className={correction.status === "approved" ? "border-emerald-500/40 text-emerald-300" : "border-yellow-500/40 text-yellow-300"}
            >
              {correction.status === "approved" ? "Learning Approved" : "Correction Draft"}
            </Badge>
          )}
        </div>

        {correction ? (
          <div className="space-y-2">
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-emerald-300">Corrected (Internal)</p>
              <p className="whitespace-pre-wrap text-sm leading-6">{correction.correctedContent}</p>
              {correction.annotation && <p className="mt-2 text-xs text-muted-foreground">Note: {correction.annotation}</p>}
            </div>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => toggleOriginal(message.id)}>
              {showOriginal ? <ChevronUp className="mr-1 h-3 w-3" /> : <ChevronDown className="mr-1 h-3 w-3" />}
              {showOriginal ? "Hide Original AI Response" : "Show Original AI Response"}
            </Button>
            {showOriginal && (
              <div className="rounded-lg border p-3 text-sm text-muted-foreground">
                <p className="mb-1 text-xs uppercase tracking-wide">Original AI Response</p>
                <p className="whitespace-pre-wrap leading-6">{message.content}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
        )}

        {canEditMessage && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => (isEditing ? cancelCorrectionEdit() : beginCorrectionEdit(message))}>
                <Pencil className="mr-2 h-4 w-4" />
                {isEditing ? "Cancel Edit" : correction ? "Edit Correction" : "Add Correction"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => approveCorrectionForLearning(message)}
                disabled={approveCorrectionMutation.isPending || saveCorrectionMutation.isPending}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Approve for Learning
              </Button>
            </div>

            {isEditing && (
              <div className="space-y-3 rounded-lg border bg-card/30 p-3">
                <div className="space-y-2">
                  <Label htmlFor={`corrected-content-${message.id}`}>Corrected response</Label>
                  <Textarea
                    id={`corrected-content-${message.id}`}
                    value={draftCorrectedContent}
                    onChange={(e) => setDraftCorrectedContent(e.target.value)}
                    rows={5}
                    placeholder="Write the corrected AI response..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`correction-annotation-${message.id}`}>Annotation (optional)</Label>
                  <Textarea
                    id={`correction-annotation-${message.id}`}
                    value={draftAnnotation}
                    onChange={(e) => setDraftAnnotation(e.target.value)}
                    rows={3}
                    placeholder="Why this correction is better..."
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => saveCorrectionDraft(message)} disabled={saveCorrectionMutation.isPending}>
                    <Save className="mr-2 h-4 w-4" />
                    {saveCorrectionMutation.isPending ? "Saving..." : "Save Correction"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => cancelCorrectionEdit()}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  function renderConversationsTable(conversations: Conversation[], isLoading: boolean) {
    if (isLoading) {
      return (
        <div className="animate-pulse">
          <div className="h-8 bg-accent rounded w-full mb-4"></div>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-12 bg-accent rounded w-full mb-2"></div>
          ))}
        </div>
      );
    }
    
    if (!conversations || conversations.length === 0) {
      return (
        <div className="py-12 text-center">
          <p className="text-muted-foreground mb-4">No conversations found</p>
          <p className="text-sm text-muted-foreground">
            Conversations will appear here after users interact with your website widget, Telegram bot, or Discord bot.
          </p>
        </div>
      );
    }
    
    return (
      <div className="ui-v2-table-shell rounded-xl border glass-divider bg-background/55">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Platform</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Update</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {conversations.map((conversation: Conversation) => {
              const platformType = resolvePlatformType(conversation);
              
              return (
                <TableRow key={conversation.id}>
                  <TableCell className="font-medium">
                    {conversation.externalUsername || "Anonymous User"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {platformLabel[platformType as keyof typeof platformLabel] || "Unknown"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant[conversation.status as keyof typeof statusBadgeVariant] as any}>
                      {conversation.status.charAt(0).toUpperCase() + conversation.status.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {formatDistanceToNow(new Date(conversation.updatedAt), { addSuffix: true })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => openThread(conversation.id)}>
                      <MessageSquare className="mr-2 h-4 w-4" />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  }
};

export default Conversations;
