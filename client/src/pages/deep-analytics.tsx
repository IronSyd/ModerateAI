import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, BarChart3, MessageSquare, ShieldAlert, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FilterBarShell, PageHeroShell, PageSectionCard } from "@/components/layout/page-shells";

type DeepAnalyticsResponse = {
  generatedAt: string;
  windowDays: number;
  totals: {
    conversationCount: number;
    totalMessages: number;
    aiResponses: number;
    responseRate: number;
    moderationEvents: number;
    contentFiltered: number;
    warningsIssued: number;
  };
  dailyTrend: Array<{
    date: string;
    messages: number;
    aiResponses: number;
    moderationEvents: number;
  }>;
  platformBreakdown: Array<{
    platformType: string;
    messages: number;
    aiResponses: number;
    moderationEvents: number;
    contentFiltered: number;
    warningsIssued: number;
  }>;
  actionBreakdown: Array<{
    action: string;
    count: number;
  }>;
  ruleSourceBreakdown: Array<{
    ruleSource: string;
    count: number;
  }>;
};

function extractApiMessage(error: unknown): string {
  if (!(error instanceof Error)) return "Failed to load deep analytics.";
  const raw = error.message || "";
  const colon = raw.indexOf(":");
  if (colon === -1) return raw || "Failed to load deep analytics.";
  const payload = raw.slice(colon + 1).trim();
  try {
    const parsed = JSON.parse(payload) as { message?: string };
    return parsed.message || payload || raw;
  } catch {
    return payload || raw;
  }
}

function humanizeKey(value: string): string {
  return String(value || "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const DeepAnalyticsPage = () => {
  const [windowDays, setWindowDays] = useState("30");

  const { data, isLoading, error } = useQuery<DeepAnalyticsResponse>({
    queryKey: ["/api/analytics/deep", windowDays],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/deep?days=${windowDays}`, { credentials: "include" });
      if (!response.ok) {
        const bodyText = await response.text();
        throw new Error(`${response.status}: ${bodyText}`);
      }
      return response.json();
    },
    retry: false,
  });

  const maxDailyMessages = useMemo(() => {
    if (!data?.dailyTrend?.length) return 1;
    return Math.max(1, ...data.dailyTrend.map((day) => day.messages));
  }, [data?.dailyTrend]);

  const maxDailyModeration = useMemo(() => {
    if (!data?.dailyTrend?.length) return 1;
    return Math.max(1, ...data.dailyTrend.map((day) => day.moderationEvents));
  }, [data?.dailyTrend]);

  const visibleActionBreakdown = useMemo(
    () => (data?.actionBreakdown ?? []).filter((item) => item.action !== "spam_blocked"),
    [data?.actionBreakdown],
  );

  const visibleRuleSourceBreakdown = useMemo(
    () => (data?.ruleSourceBreakdown ?? []).filter((item) => item.ruleSource !== "spam_heuristic"),
    [data?.ruleSourceBreakdown],
  );

  const isTierGate = error instanceof Error && error.message.startsWith("403");

  if (isLoading) {
    return (
      <div className="space-y-6 wave-v2-page wave-v2-analytics">
        <PageHeroShell>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-foreground">Deep Analytics</h1>
            <p className="text-sm text-muted-foreground">
              Analyze response quality, moderation activity, and channel performance.
            </p>
          </div>
        </PageHeroShell>
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Skeleton key={idx} className="h-36 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6 wave-v2-page wave-v2-analytics">
        <PageHeroShell>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-foreground">Deep Analytics</h1>
            <p className="text-sm text-muted-foreground">
              Analyze response quality, moderation activity, and channel performance.
            </p>
          </div>
        </PageHeroShell>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{isTierGate ? "Deep analytics unavailable" : "Analytics unavailable"}</AlertTitle>
          <AlertDescription>
            {isTierGate
              ? "Upgrade to Pro to access deep analytics."
              : extractApiMessage(error)}
          </AlertDescription>
        </Alert>
        <div className="flex items-center gap-3">
          {isTierGate ? (
            <Link href="/choose-plan">
              <Button>View Plans</Button>
            </Link>
          ) : null}
          <Link href="/dashboard">
            <Button variant="outline">Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 wave-v2-page wave-v2-analytics">
      <PageHeroShell>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">Deep Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Pro-level message intelligence and moderation telemetry across your workspace.
          </p>
        </div>
      </PageHeroShell>

      <FilterBarShell>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-muted-foreground">Window</div>
          <div className="w-full md:w-48">
            <Select value={windowDays} onValueChange={setWindowDays}>
              <SelectTrigger>
                <SelectValue placeholder="Window" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </FilterBarShell>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <PageSectionCard>
          <CardHeader className="pb-2">
            <CardDescription>Total Messages</CardDescription>
            <CardTitle className="text-3xl">{data.totals.totalMessages.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            {data.totals.aiResponses.toLocaleString()} AI responses
          </CardContent>
        </PageSectionCard>
        <PageSectionCard>
          <CardHeader className="pb-2">
            <CardDescription>Response Rate</CardDescription>
            <CardTitle className="text-3xl">{data.totals.responseRate}%</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            {data.totals.conversationCount.toLocaleString()} conversations
          </CardContent>
        </PageSectionCard>
        <PageSectionCard>
          <CardHeader className="pb-2">
            <CardDescription>Moderation Events</CardDescription>
            <CardTitle className="text-3xl">{data.totals.moderationEvents.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            {data.totals.contentFiltered.toLocaleString()} content filtered
          </CardContent>
        </PageSectionCard>
        <PageSectionCard>
          <CardHeader className="pb-2">
            <CardDescription>Window</CardDescription>
            <CardTitle className="text-3xl">{data.windowDays}d</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Generated {new Date(data.generatedAt).toLocaleString()}
          </CardContent>
        </PageSectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <PageSectionCard>
          <CardHeader>
            <CardTitle>Daily Message Trend</CardTitle>
            <CardDescription>Message and moderation volume over the selected window.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.dailyTrend.map((day) => {
              const messageWidth = Math.max(4, (day.messages / maxDailyMessages) * 100);
              const moderationWidth = Math.max(4, (day.moderationEvents / maxDailyModeration) * 100);
              return (
                <div key={day.date} className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{day.date}</span>
                    <span>{day.messages} msgs | {day.moderationEvents} moderation</span>
                  </div>
                  <div className="space-y-1">
                    <div className="h-2 rounded bg-muted/40 overflow-hidden">
                      <div className="h-full bg-primary transition-all duration-300" style={{ width: `${messageWidth}%` }} />
                    </div>
                    <div className="h-2 rounded bg-muted/40 overflow-hidden">
                      <div className="h-full bg-amber-400/90 transition-all duration-300" style={{ width: `${moderationWidth}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </PageSectionCard>

        <PageSectionCard>
          <CardHeader>
            <CardTitle>Platform Breakdown</CardTitle>
            <CardDescription>Performance and moderation by platform type.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.platformBreakdown.map((platform) => (
              <div key={platform.platformType} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{humanizeKey(platform.platformType)}</p>
                  <Badge variant="secondary">{platform.messages.toLocaleString()} messages</Badge>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <span>AI responses: {platform.aiResponses.toLocaleString()}</span>
                  <span>Moderation: {platform.moderationEvents.toLocaleString()}</span>
                  <span>Filtered: {platform.contentFiltered.toLocaleString()}</span>
                  <span>Warnings: {platform.warningsIssued.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </PageSectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <PageSectionCard>
          <CardHeader>
            <CardTitle>Action Breakdown</CardTitle>
            <CardDescription>How moderation actions were distributed.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {visibleActionBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">No moderation actions recorded in this window.</p>
            ) : (
              visibleActionBreakdown.map((item) => (
                <Badge key={item.action} variant="outline">
                  {humanizeKey(item.action)}: {item.count}
                </Badge>
              ))
            )}
          </CardContent>
        </PageSectionCard>
        <PageSectionCard>
          <CardHeader>
            <CardTitle>Rule Source Breakdown</CardTitle>
            <CardDescription>Which moderation source triggered actions.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {visibleRuleSourceBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">No rule-source data recorded in this window.</p>
            ) : (
              visibleRuleSourceBreakdown.map((item) => (
                <Badge key={item.ruleSource} variant="outline">
                  {humanizeKey(item.ruleSource)}: {item.count}
                </Badge>
              ))
            )}
          </CardContent>
        </PageSectionCard>
      </div>
    </div>
  );
};

export default DeepAnalyticsPage;
