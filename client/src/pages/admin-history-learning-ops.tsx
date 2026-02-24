import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw } from "lucide-react";

type AdminHistoryOpsEventSummary = {
  code: string;
  threshold: number;
  windowSeconds: number;
  windowCount: number;
  totalCount: number;
  windowStartedAt: string | null;
  lastSeenAt: string | null;
};

type BackfillDestinationSummary = {
  runId: number;
  recordedAt: string;
  platformType: "telegram" | "discord";
  platformId: number;
  chatConfigurationId: number;
  destinationExternalId: string;
  scanned: number;
  inserted: number;
  skippedAmbiguous: number;
  skippedDuplicates: number;
  errors: number;
  missingInventory: boolean;
};

type BackfillDebugState = {
  enabled: boolean;
  running: boolean;
  hasRun: boolean;
  runCount: number;
  currentRunId: number | null;
  lastStartedAt: string | null;
  lastCompletedAt: string | null;
  lastError: string | null;
  lastResult: {
    processedDestinations: number;
    inserted: number;
    skippedAmbiguous: number;
    skippedDuplicates: number;
    errors: number;
    skipped: boolean;
  } | null;
  currentProgress: {
    processedDestinations: number;
    inserted: number;
    skippedAmbiguous: number;
    skippedDuplicates: number;
    errors: number;
  } | null;
  config: {
    maxDays: number;
    maxMessagesPerDestination: number;
  };
  recentDestinations: BackfillDestinationSummary[];
};

type AutoAnalysisDestinationRun = {
  runId: number;
  recordedAt: string;
  platformType: "telegram" | "discord";
  platformId: number;
  chatConfigurationId: number;
  destinationExternalId: string;
  status: "analyzed" | "skipped_threshold" | "failed";
  pendingAdminMessages: number;
  threshold: number;
  insightsCreatedOrUpdated?: number;
  reason?: string;
  error?: string;
};

type AutoAnalysisDebugState = {
  enabled: boolean;
  running: boolean;
  runCount: number;
  currentRunId: number | null;
  lastStartedAt: string | null;
  lastCompletedAt: string | null;
  lastError: string | null;
  lastResult: {
    processed: number;
    analyzed: number;
    skippedThreshold: number;
    failed: number;
    skipped: boolean;
  } | null;
  currentProgress: {
    processed: number;
    analyzed: number;
    skippedThreshold: number;
    failed: number;
  } | null;
  config: {
    intervalMs: number;
    minNewAdminMessages: number;
  };
  inProgressChatConfigIds: number[];
  recentDestinations: AutoAnalysisDestinationRun[];
};

type AdminHistoryLearningOpsResponse = {
  generatedAt: string;
  config: {
    autoAnalysisEnabled: boolean;
    autoAnalysisIntervalMs: number;
    autoAnalysisMinNewAdminMessages: number;
    backfillOnStartupEnabled: boolean;
    backfillMaxDays: number;
    backfillMaxMessagesPerDestination: number;
  };
  backfill: BackfillDebugState;
  autoAnalysis: AutoAnalysisDebugState;
  events: AdminHistoryOpsEventSummary[];
};

type BackfillTriggerApiResponse =
  | { status: "started"; force: boolean; runId?: number | null; message: string }
  | { status: "already_running"; message: string; runId?: number | null }
  | { status: "already_completed"; message: string; canForce: true }
  | { status: "error"; message: string };

function formatDate(value: string | null | undefined) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function formatNumber(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "--";
  return value.toLocaleString();
}

function formatDurationMs(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "--";
  if (value < 1000) return `${value} ms`;
  const totalSeconds = Math.round(value / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function BoolBadge({ value, trueLabel = "Enabled", falseLabel = "Disabled" }: { value: boolean; trueLabel?: string; falseLabel?: string }) {
  return (
    <Badge
      className={
        value
          ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
          : "border-muted/30 bg-muted/20 text-muted-foreground"
      }
      variant="outline"
    >
      {value ? trueLabel : falseLabel}
    </Badge>
  );
}

function PlatformBadge({ platformType }: { platformType: "telegram" | "discord" }) {
  const isTelegram = platformType === "telegram";
  return (
    <Badge
      variant="outline"
      className={
        isTelegram
          ? "border-sky-500/30 bg-sky-500/15 text-sky-300"
          : "border-indigo-500/30 bg-indigo-500/15 text-indigo-300"
      }
    >
      {isTelegram ? "Telegram" : "Discord"}
    </Badge>
  );
}

function AutoAnalysisStatusBadge({ status }: { status: AutoAnalysisDestinationRun["status"] }) {
  if (status === "analyzed") {
    return (
      <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/15 text-emerald-300">
        Analyzed
      </Badge>
    );
  }
  if (status === "failed") {
    return (
      <Badge variant="outline" className="border-red-500/30 bg-red-500/15 text-red-300">
        Failed
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-amber-500/30 bg-amber-500/15 text-amber-300">
      Skipped (Threshold)
    </Badge>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-80" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

export default function AdminHistoryLearningOpsPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "admin" || user?.role === "owner";
  const [platformFilter, setPlatformFilter] = useState<"all" | "telegram" | "discord">("all");
  const [autoStatusFilter, setAutoStatusFilter] = useState<"all" | AutoAnalysisDestinationRun["status"]>("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [forceRerunConfirmOpen, setForceRerunConfirmOpen] = useState(false);

  const { data, isLoading, isFetching, error, refetch } = useQuery<AdminHistoryLearningOpsResponse, Error>({
    queryKey: ["/api/admin/ops/admin-history-learning"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: Boolean(isAdmin),
    refetchInterval: autoRefreshEnabled ? 15000 : false,
  });

  const backfillTriggerMutation = useMutation({
    mutationFn: async ({ force }: { force: boolean }) => {
      const response = await fetch("/api/admin/ops/admin-history-learning/backfill", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });

      let payload: BackfillTriggerApiResponse | null = null;
      try {
        payload = (await response.json()) as BackfillTriggerApiResponse;
      } catch {
        payload = null;
      }

      if (![202, 409].includes(response.status)) {
        const message =
          payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
            ? payload.message
            : `${response.status}: Failed to trigger backfill`;
        throw new Error(message);
      }

      return {
        httpStatus: response.status,
        payload: payload ?? { status: "error", message: "Unexpected empty response" as const },
      };
    },
    onSuccess: ({ payload }) => {
      if (payload.status === "started") {
        toast({
          title: payload.force ? "Backfill re-run started" : "Backfill started",
          description: payload.message,
        });
      } else if (payload.status === "already_running") {
        toast({
          title: "Backfill already running",
          description: payload.message,
        });
      } else if (payload.status === "already_completed") {
        toast({
          title: "Backfill already completed",
          description: payload.message,
        });
      } else {
        toast({
          title: "Backfill trigger error",
          description: payload.message,
          variant: "destructive",
        });
      }
      void refetch();
    },
    onError: (mutationError: Error) => {
      toast({
        title: "Failed to trigger backfill",
        description: mutationError.message,
        variant: "destructive",
      });
    },
  });

  const normalizedSearchFilter = searchFilter.trim().toLowerCase();
  const backfillRecentDestinations = data?.backfill.recentDestinations ?? [];
  const autoAnalysisRecentDestinations = data?.autoAnalysis.recentDestinations ?? [];

  const filteredBackfillDestinations = useMemo(() => {
    return backfillRecentDestinations.filter((row) => {
      if (platformFilter !== "all" && row.platformType !== platformFilter) return false;
      if (normalizedSearchFilter) {
        const haystack = [
          row.destinationExternalId,
          String(row.chatConfigurationId),
          String(row.platformId),
          String(row.runId),
          row.platformType,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(normalizedSearchFilter)) return false;
      }
      return true;
    });
  }, [backfillRecentDestinations, normalizedSearchFilter, platformFilter]);

  const filteredAutoAnalysisDestinations = useMemo(() => {
    return autoAnalysisRecentDestinations.filter((row) => {
      if (platformFilter !== "all" && row.platformType !== platformFilter) return false;
      if (autoStatusFilter !== "all" && row.status !== autoStatusFilter) return false;
      if (normalizedSearchFilter) {
        const haystack = [
          row.destinationExternalId,
          String(row.chatConfigurationId),
          String(row.platformId),
          String(row.runId),
          row.platformType,
          row.status,
          row.reason ?? "",
          row.error ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(normalizedSearchFilter)) return false;
      }
      return true;
    });
  }, [autoAnalysisRecentDestinations, normalizedSearchFilter, platformFilter, autoStatusFilter]);

  const handleManualRefresh = async () => {
    const result = await refetch();

    if (result.error) {
      toast({
        title: "Refresh failed",
        description: result.error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Refreshed",
      description: "Learning Ops data updated.",
    });
  };

  if (isAuthLoading) {
    return <LoadingState />;
  }

  if (!isAdmin) {
    return (
      <Card className="glass-surface border-border/70">
        <CardHeader>
          <CardTitle>Admin Access Required</CardTitle>
          <CardDescription>This page is available to owner/admin accounts only.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isLoading) {
    return <LoadingState />;
  }

  if (error || !data) {
    return (
      <Card className="glass-surface border-red-500/30">
        <CardHeader>
          <CardTitle>Failed to load admin-history learning ops</CardTitle>
          <CardDescription>{error?.message ?? "Unknown error"}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => refetch()} variant="outline">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isBackfillActionDisabled = data.backfill.running || backfillTriggerMutation.isPending;

  return (
    <div className="space-y-6">
      <AlertDialog open={forceRerunConfirmOpen} onOpenChange={setForceRerunConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Force Re-run Historical Backfill?</AlertDialogTitle>
            <AlertDialogDescription>
              This starts a new best-effort backfill run for Telegram/Discord admin-history learning. Already
              backfilled messages are safely skipped as duplicates via idempotency (`sourceMessageId`).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={backfillTriggerMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={backfillTriggerMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                backfillTriggerMutation.mutate(
                  { force: true },
                  {
                    onSettled: () => setForceRerunConfirmOpen(false),
                  },
                );
              }}
            >
              {backfillTriggerMutation.isPending ? "Starting..." : "Force Re-run"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-end">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-border/60 bg-background/40">
            Auto-refresh {autoRefreshEnabled ? "On (15s)" : "Off"}
          </Badge>
          <Badge variant="outline" className="border-border/60 bg-background/40">
            Generated {formatDate(data.generatedAt)}
          </Badge>
          <Button
            variant="outline"
            onClick={() => setAutoRefreshEnabled((prev) => !prev)}
          >
            {autoRefreshEnabled ? "Pause Auto-Refresh" : "Resume Auto-Refresh"}
          </Button>
          <Button
            variant="outline"
            onClick={() => void handleManualRefresh()}
            disabled={isFetching}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Card className="glass-surface border-border/70">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Client-side filters for recent destination rows.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <div className="text-sm text-muted-foreground">Search destinations / IDs</div>
            <Input
              value={searchFilter}
              onChange={(event) => setSearchFilter(event.target.value)}
              placeholder="Search by destination ID, chat config ID, platform ID, status..."
              className="max-w-2xl"
            />
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <div className="text-sm text-muted-foreground">Platform</div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={platformFilter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPlatformFilter("all")}
                >
                  All
                </Button>
                <Button
                  type="button"
                  variant={platformFilter === "telegram" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPlatformFilter("telegram")}
                >
                  Telegram
                </Button>
                <Button
                  type="button"
                  variant={platformFilter === "discord" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPlatformFilter("discord")}
                >
                  Discord
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <div className="text-sm text-muted-foreground">Auto-analysis status</div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={autoStatusFilter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAutoStatusFilter("all")}
                >
                  All
                </Button>
                <Button
                  type="button"
                  variant={autoStatusFilter === "analyzed" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAutoStatusFilter("analyzed")}
                >
                  Analyzed
                </Button>
                <Button
                  type="button"
                  variant={autoStatusFilter === "skipped_threshold" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAutoStatusFilter("skipped_threshold")}
                >
                  Skipped
                </Button>
                <Button
                  type="button"
                  variant={autoStatusFilter === "failed" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAutoStatusFilter("failed")}
                >
                  Failed
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="glass-surface border-border/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Backfill
              <BoolBadge value={data.backfill.enabled} />
              <BoolBadge value={data.backfill.running} trueLabel="Running" falseLabel="Idle" />
            </CardTitle>
            <CardDescription>
              Startup backfill status for Telegram/Discord admin-history ingestion. Best-effort backfill continues on
              per-row/per-destination errors. Review Ambiguous/Duplicates/Errors in the table below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                onClick={() => backfillTriggerMutation.mutate({ force: false })}
                disabled={isBackfillActionDisabled}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${backfillTriggerMutation.isPending ? "animate-spin" : ""}`} />
                Run Backfill Now
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setForceRerunConfirmOpen(true)}
                disabled={isBackfillActionDisabled}
              >
                Force Re-run
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border/60 bg-background/20 p-3">
                <div className="text-xs text-muted-foreground">Runs</div>
                <div className="text-lg font-semibold">{formatNumber(data.backfill.runCount)}</div>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/20 p-3">
                <div className="text-xs text-muted-foreground">Has Run</div>
                <div className="pt-1">
                  <BoolBadge value={data.backfill.hasRun} trueLabel="Yes" falseLabel="No" />
                </div>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/20 p-3">
                <div className="text-xs text-muted-foreground">Max Days</div>
                <div className="text-lg font-semibold">{formatNumber(data.backfill.config.maxDays)}</div>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/20 p-3">
                <div className="text-xs text-muted-foreground">Max Msgs / Destination</div>
                <div className="text-lg font-semibold">
                  {formatNumber(data.backfill.config.maxMessagesPerDestination)}
                </div>
              </div>
            </div>

            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <span className="text-muted-foreground">Last started:</span> {formatDate(data.backfill.lastStartedAt)}
              </div>
              <div>
                <span className="text-muted-foreground">Last completed:</span> {formatDate(data.backfill.lastCompletedAt)}
              </div>
              <div>
                <span className="text-muted-foreground">Current run:</span> {data.backfill.currentRunId ?? "--"}
              </div>
              <div>
                <span className="text-muted-foreground">Last error:</span>{" "}
                <span className={data.backfill.lastError ? "text-red-300" : ""}>
                  {data.backfill.lastError ?? "--"}
                </span>
              </div>
            </div>

            {data.backfill.currentProgress ? (
              <div className="rounded-lg border border-border/60 bg-background/20 p-3 text-sm">
                <div className="mb-2 font-medium">Current Progress</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>Processed: {formatNumber(data.backfill.currentProgress.processedDestinations)}</div>
                  <div>Inserted: {formatNumber(data.backfill.currentProgress.inserted)}</div>
                  <div>Ambiguous: {formatNumber(data.backfill.currentProgress.skippedAmbiguous)}</div>
                  <div>Duplicates: {formatNumber(data.backfill.currentProgress.skippedDuplicates)}</div>
                  <div>Errors: {formatNumber(data.backfill.currentProgress.errors)}</div>
                </div>
              </div>
            ) : null}

            {data.backfill.lastResult ? (
              <div className="rounded-lg border border-border/60 bg-background/20 p-3 text-sm">
                <div className="mb-2 font-medium">Last Result</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>Processed: {formatNumber(data.backfill.lastResult.processedDestinations)}</div>
                  <div>Inserted: {formatNumber(data.backfill.lastResult.inserted)}</div>
                  <div>Ambiguous: {formatNumber(data.backfill.lastResult.skippedAmbiguous)}</div>
                  <div>Duplicates: {formatNumber(data.backfill.lastResult.skippedDuplicates)}</div>
                  <div>Errors: {formatNumber(data.backfill.lastResult.errors)}</div>
                  <div>
                    Skipped run:{" "}
                    <BoolBadge value={data.backfill.lastResult.skipped} trueLabel="Yes" falseLabel="No" />
                  </div>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="glass-surface border-border/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Auto-Analysis
              <BoolBadge value={data.autoAnalysis.enabled} />
              <BoolBadge value={data.autoAnalysis.running} trueLabel="Running" falseLabel="Idle" />
            </CardTitle>
            <CardDescription>
              Scheduled admin-history analysis and insight refresh activity.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border/60 bg-background/20 p-3">
                <div className="text-xs text-muted-foreground">Runs</div>
                <div className="text-lg font-semibold">{formatNumber(data.autoAnalysis.runCount)}</div>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/20 p-3">
                <div className="text-xs text-muted-foreground">Threshold</div>
                <div className="text-lg font-semibold">
                  {formatNumber(data.autoAnalysis.config.minNewAdminMessages)} new admin msgs
                </div>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/20 p-3">
                <div className="text-xs text-muted-foreground">Interval</div>
                <div className="text-lg font-semibold">{formatDurationMs(data.autoAnalysis.config.intervalMs)}</div>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/20 p-3">
                <div className="text-xs text-muted-foreground">In Progress Chats</div>
                <div className="text-lg font-semibold">
                  {formatNumber(data.autoAnalysis.inProgressChatConfigIds.length)}
                </div>
              </div>
            </div>

            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <span className="text-muted-foreground">Last started:</span> {formatDate(data.autoAnalysis.lastStartedAt)}
              </div>
              <div>
                <span className="text-muted-foreground">Last completed:</span> {formatDate(data.autoAnalysis.lastCompletedAt)}
              </div>
              <div>
                <span className="text-muted-foreground">Current run:</span> {data.autoAnalysis.currentRunId ?? "--"}
              </div>
              <div>
                <span className="text-muted-foreground">Last error:</span>{" "}
                <span className={data.autoAnalysis.lastError ? "text-red-300" : ""}>
                  {data.autoAnalysis.lastError ?? "--"}
                </span>
              </div>
            </div>

            {data.autoAnalysis.currentProgress ? (
              <div className="rounded-lg border border-border/60 bg-background/20 p-3 text-sm">
                <div className="mb-2 font-medium">Current Progress</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>Processed: {formatNumber(data.autoAnalysis.currentProgress.processed)}</div>
                  <div>Analyzed: {formatNumber(data.autoAnalysis.currentProgress.analyzed)}</div>
                  <div>Skipped threshold: {formatNumber(data.autoAnalysis.currentProgress.skippedThreshold)}</div>
                  <div>Failed: {formatNumber(data.autoAnalysis.currentProgress.failed)}</div>
                </div>
              </div>
            ) : null}

            {data.autoAnalysis.lastResult ? (
              <div className="rounded-lg border border-border/60 bg-background/20 p-3 text-sm">
                <div className="mb-2 font-medium">Last Result</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>Processed: {formatNumber(data.autoAnalysis.lastResult.processed)}</div>
                  <div>Analyzed: {formatNumber(data.autoAnalysis.lastResult.analyzed)}</div>
                  <div>Skipped threshold: {formatNumber(data.autoAnalysis.lastResult.skippedThreshold)}</div>
                  <div>Failed: {formatNumber(data.autoAnalysis.lastResult.failed)}</div>
                  <div>
                    Skipped run:{" "}
                    <BoolBadge value={data.autoAnalysis.lastResult.skipped} trueLabel="Yes" falseLabel="No" />
                  </div>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card className="glass-surface border-border/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Backfill Destinations
            <Badge variant="outline" className="border-border/60 bg-background/30">
              {formatNumber(filteredBackfillDestinations.length)} shown
            </Badge>
          </CardTitle>
          <CardDescription>
            Recent backfill summaries by destination (Telegram/Discord).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Chat Config</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead className="text-right">Scanned</TableHead>
                  <TableHead className="text-right">Inserted</TableHead>
                  <TableHead className="text-right">Duplicates</TableHead>
                  <TableHead className="text-right">Ambiguous</TableHead>
                  <TableHead className="text-right">Errors</TableHead>
                  <TableHead>Inventory</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBackfillDestinations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground">
                      No backfill destination summaries match the current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBackfillDestinations.map((row, index) => (
                    <TableRow key={`${row.runId}-${row.chatConfigurationId}-${row.destinationExternalId}-${index}`}>
                      <TableCell className="whitespace-nowrap">{formatDate(row.recordedAt)}</TableCell>
                      <TableCell><PlatformBadge platformType={row.platformType} /></TableCell>
                      <TableCell>{row.chatConfigurationId}</TableCell>
                      <TableCell className="max-w-[220px] truncate" title={row.destinationExternalId}>
                        {row.destinationExternalId}
                      </TableCell>
                      <TableCell className="text-right">{formatNumber(row.scanned)}</TableCell>
                      <TableCell className="text-right">{formatNumber(row.inserted)}</TableCell>
                      <TableCell className="text-right">{formatNumber(row.skippedDuplicates)}</TableCell>
                      <TableCell className="text-right">{formatNumber(row.skippedAmbiguous)}</TableCell>
                      <TableCell className="text-right">{formatNumber(row.errors)}</TableCell>
                      <TableCell>
                        <BoolBadge value={!row.missingInventory} trueLabel="OK" falseLabel="Missing" />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-surface border-border/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Auto-Analysis Destinations
            <Badge variant="outline" className="border-border/60 bg-background/30">
              {formatNumber(filteredAutoAnalysisDestinations.length)} shown
            </Badge>
          </CardTitle>
          <CardDescription>
            Recent scheduled analysis decisions and outcomes by destination.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Chat Config</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Pending Admin Msgs</TableHead>
                  <TableHead className="text-right">Threshold</TableHead>
                  <TableHead className="text-right">Insights +/-</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAutoAnalysisDestinations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      No auto-analysis destination runs match the current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAutoAnalysisDestinations.map((row, index) => (
                    <TableRow key={`${row.runId}-${row.chatConfigurationId}-${row.destinationExternalId}-${index}`}>
                      <TableCell className="whitespace-nowrap">{formatDate(row.recordedAt)}</TableCell>
                      <TableCell><PlatformBadge platformType={row.platformType} /></TableCell>
                      <TableCell>{row.chatConfigurationId}</TableCell>
                      <TableCell className="max-w-[220px] truncate" title={row.destinationExternalId}>
                        {row.destinationExternalId}
                      </TableCell>
                      <TableCell><AutoAnalysisStatusBadge status={row.status} /></TableCell>
                      <TableCell className="text-right">{formatNumber(row.pendingAdminMessages)}</TableCell>
                      <TableCell className="text-right">{formatNumber(row.threshold)}</TableCell>
                      <TableCell className="text-right">{formatNumber(row.insightsCreatedOrUpdated ?? 0)}</TableCell>
                      <TableCell className="max-w-[280px] truncate" title={row.error ?? row.reason ?? ""}>
                        {row.error ?? row.reason ?? "--"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-surface border-border/70">
        <CardHeader>
          <CardTitle>Ops Event Summary</CardTitle>
          <CardDescription>Recent counters for backfill/auto-analysis ops events.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead className="text-right">Window Count</TableHead>
                  <TableHead className="text-right">Total Count</TableHead>
                  <TableHead className="text-right">Window</TableHead>
                  <TableHead className="text-right">Threshold</TableHead>
                  <TableHead>Last Seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.events.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No related ops events recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.events.map((event) => (
                    <TableRow key={event.code}>
                      <TableCell className="font-mono text-xs md:text-sm">{event.code}</TableCell>
                      <TableCell className="text-right">{formatNumber(event.windowCount)}</TableCell>
                      <TableCell className="text-right">{formatNumber(event.totalCount)}</TableCell>
                      <TableCell className="text-right">{event.windowSeconds}s</TableCell>
                      <TableCell className="text-right">{formatNumber(event.threshold)}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(event.lastSeenAt)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
