import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "wouter";
import WelcomeBanner from "@/components/dashboard/welcome-banner";
import StatsCard from "@/components/dashboard/stats-card";
import PlatformIntegrationCard from "@/components/dashboard/platform-integration-card";
import RecentActivityList from "@/components/dashboard/recent-activity-list";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { SiDiscord, SiTelegram } from "react-icons/si";

import { MessagesSquare, MonitorSmartphone, CheckCircle, Globe, Gauge } from "lucide-react";

type UsageStatusTone = "neutral" | "success" | "warning" | "danger";

type UsageStatus = {
  label: string;
  tone: UsageStatusTone;
};

const Dashboard = () => {
  const shouldReduceMotion = useReducedMotion();
  const { user } = useAuth();
  // Scroll handling now done at the App level

  // Consolidated dashboard payload: stats + platforms + recent activity + usage.
  const { data: overview, isLoading: isLoadingOverview } = useQuery({
    queryKey: ["/api/dashboard/overview"],
    retry: false,
    enabled: Boolean(user),
  });

  const stats = ((overview as any)?.stats ?? {}) as any;
  const platforms = (((overview as any)?.platforms ?? []) as any[]) ?? [];
  const recentActivity = (((overview as any)?.recentActivity ?? []) as any[]) ?? [];
  const widgetUsageData = ((overview as any)?.widgetUsage ?? null) as any;
  

  

  
  // Setup progress tracker
  const totalSetupSteps = 3; // Telegram, Discord, Website integrations
  const [completedSteps, setCompletedSteps] = useState(0);
  const [setupProgress, setSetupProgress] = useState({
    telegramIntegration: false,
    discordIntegration: false,
    websiteIntegration: false,
  });
  
  // Update completed steps based on data
  useEffect(() => {
    if (platforms) {
      let completed = 0;
      // Create initial progress object
      const progress = {
        telegramIntegration: false,
        discordIntegration: false,
        websiteIntegration: false,
      };
      

      
      // Check platform integrations
      if (platforms && Array.isArray(platforms)) {
        const telegramPlatform = platforms.find((p: any) => p.type === "telegram");
        if (telegramPlatform && telegramPlatform.status === "active") {
          completed += 1;
          progress.telegramIntegration = true;
        }
        
        const discordPlatform = platforms.find((p: any) => p.type === "discord");
        if (discordPlatform && discordPlatform.status === "active") {
          completed += 1;
          progress.discordIntegration = true;
        }

        const websitePlatform = platforms.find((p: any) => p.type === "website");
        if (websitePlatform && websitePlatform.status === "active") {
          completed += 1;
          progress.websiteIntegration = true;
        }
      }
      

      
      setCompletedSteps(completed);
      setSetupProgress(progress);
    }
  }, [platforms]);
  
  // Format stats for display
  const getStatsForDisplay = () => {
    if (isLoadingOverview || !stats) {
      return [
        {
          title: "Total Conversations",
          value: "-",
          icon: <MessagesSquare className="h-6 w-6" />,
          iconBgColor: "bg-primary/20",
          iconColor: "text-primary",
          changeValue: 0,
          changeText: "vs last week"
        },
        {
          title: "AI Responses",
          value: "-",
          icon: <MonitorSmartphone className="h-6 w-6" />,
          iconBgColor: "bg-secondary/20",
          iconColor: "text-secondary",
          changeValue: 0,
          changeText: "vs last week"
        },
        {
          title: "Response Rate",
          value: "-",
          icon: <CheckCircle className="h-6 w-6" />,
          iconBgColor: "bg-green-600/20",
          iconColor: "text-green-500",
          changeValue: 0,
          changeText: "vs last week"
        }
      ];
    }
    
    return [
      {
        title: "Total Conversations",
        value: (stats as any)?.totalConversations?.toLocaleString() || "0",
        icon: <MessagesSquare className="h-6 w-6" />,
        iconBgColor: "bg-primary/20",
        iconColor: "text-primary",
        changeValue: null,
        changeText: "vs last week"
      },
      {
        title: "AI Responses",
        value: (stats as any)?.aiResponses?.toLocaleString() || "0",
        icon: <MonitorSmartphone className="h-6 w-6" />,
        iconBgColor: "bg-secondary/20",
        iconColor: "text-secondary",
        changeValue: null,
        changeText: "vs last week"
      },
      {
        title: "Response Rate",
        value: (stats as any)?.responseRate > 0 ? `${(stats as any).responseRate.toFixed(1)}%` : "0%",
        icon: <CheckCircle className="h-6 w-6" />,
        iconBgColor: "bg-green-600/20",
        iconColor: "text-green-500",
        changeValue: null,
        changeText: "vs last week"
      }
    ];
  };

  const formatLimitValue = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "Unlimited";
    return value.toLocaleString();
  };

  const getUsageStatus = (usedRaw: unknown, limitRaw: unknown): UsageStatus => {
    const used = Number(usedRaw ?? 0);
    const limit = typeof limitRaw === "number" ? limitRaw : null;

    if (limit === null) {
      return { label: "No plan cap", tone: "success" };
    }

    if (limit <= 0) {
      return { label: "Unavailable on plan", tone: "danger" };
    }

    if (used >= limit) {
      return { label: "Limit reached", tone: "danger" };
    }

    const ratio = used / limit;
    if (ratio >= 0.9) {
      return { label: "Near limit", tone: "warning" };
    }
    if (ratio >= 0.75) {
      return { label: "High usage", tone: "warning" };
    }

    return { label: "Within plan", tone: "success" };
  };

  const getUsageStatsForDisplay = () => {
    const usage = (widgetUsageData as any)?.usage;
    if (isLoadingOverview || !usage) {
      return [
        {
          title: "Telegram Destinations",
          value: "-",
          icon: <SiTelegram className="h-6 w-6" />,
          iconBgColor: "bg-sky-500/15",
          iconColor: "text-sky-300",
          changeValue: null,
          changeText: "current usage",
          statusLabel: "Loading usage",
          statusTone: "neutral" as const,
        },
        {
          title: "Discord Destinations",
          value: "-",
          icon: <SiDiscord className="h-6 w-6" />,
          iconBgColor: "bg-indigo-500/15",
          iconColor: "text-indigo-300",
          changeValue: null,
          changeText: "current usage",
          statusLabel: "Loading usage",
          statusTone: "neutral" as const,
        },
        {
          title: "Website Destinations",
          value: "-",
          icon: <Globe className="h-6 w-6" />,
          iconBgColor: "bg-cyan-500/15",
          iconColor: "text-cyan-300",
          changeValue: null,
          changeText: "current usage",
          statusLabel: "Loading usage",
          statusTone: "neutral" as const,
        },
        {
          title: "AI Daily Quota",
          value: "-",
          icon: <Gauge className="h-6 w-6" />,
          iconBgColor: "bg-amber-500/15",
          iconColor: "text-amber-300",
          changeValue: null,
          changeText: "current usage",
          statusLabel: "Loading usage",
          statusTone: "neutral" as const,
        },
      ];
    }

    const telegramStatus = getUsageStatus(usage.telegramGroupsUsed, usage.telegramGroupLimit);
    const discordStatus = getUsageStatus(usage.discordServersUsed, usage.discordServerLimit);
    const websiteStatus = getUsageStatus(usage.websiteDomainsUsed, usage.websiteDomainLimit);
    const aiStatus = getUsageStatus(usage.aiResponsesUsedToday, usage.aiResponsesPerDay);

    return [
      {
        title: "Telegram Destinations",
        value: `${Number(usage.telegramGroupsUsed ?? 0).toLocaleString()} / ${formatLimitValue(usage.telegramGroupLimit)}`,
        icon: <SiTelegram className="h-6 w-6" />,
        iconBgColor: "bg-sky-500/15",
        iconColor: "text-sky-300",
        changeValue: null,
        changeText: "current usage",
        statusLabel: telegramStatus.label,
        statusTone: telegramStatus.tone,
      },
      {
        title: "Discord Destinations",
        value: `${Number(usage.discordServersUsed ?? 0).toLocaleString()} / ${formatLimitValue(usage.discordServerLimit)}`,
        icon: <SiDiscord className="h-6 w-6" />,
        iconBgColor: "bg-indigo-500/15",
        iconColor: "text-indigo-300",
        changeValue: null,
        changeText: "current usage",
        statusLabel: discordStatus.label,
        statusTone: discordStatus.tone,
      },
      {
        title: "Website Destinations",
        value: `${Number(usage.websiteDomainsUsed ?? 0).toLocaleString()} / ${formatLimitValue(usage.websiteDomainLimit)}`,
        icon: <Globe className="h-6 w-6" />,
        iconBgColor: "bg-cyan-500/15",
        iconColor: "text-cyan-300",
        changeValue: null,
        changeText: "current usage",
        statusLabel: websiteStatus.label,
        statusTone: websiteStatus.tone,
      },
      {
        title: "AI Daily Quota",
        value: `${Number(usage.aiResponsesUsedToday ?? 0).toLocaleString()} / ${formatLimitValue(usage.aiResponsesPerDay)}`,
        icon: <Gauge className="h-6 w-6" />,
        iconBgColor: "bg-amber-500/15",
        iconColor: "text-amber-300",
        changeValue: null,
        changeText: "current usage",
        statusLabel: aiStatus.label,
        statusTone: aiStatus.tone,
      },
    ];
  };
  
  // Format AI config for display

  

  
  // Process activity data
  const processActivityData = () => {
    if (isLoadingOverview || !recentActivity || !Array.isArray(recentActivity)) {
      return [];
    }
    
    return recentActivity.map((activity: any, index: number) => ({
      id: `activity-${index}`,
      user: {
        name: activity.user,
        avatar: ""
      },
      action: activity.action,
      platform: activity.platform as "discord" | "telegram",
      time: new Date(activity.time)
    }));
  };

  const statsForDisplay = getStatsForDisplay();
  const usageStatsForDisplay = getUsageStatsForDisplay();
  const connectedPlatforms = Array.isArray(platforms)
    ? platforms.filter(
        (platform: any) =>
          (platform.type === "telegram" || platform.type === "discord" || platform.type === "website") &&
          platform.status === "active",
      ).length
    : 0;
  const setupCompletionPercent = (completedSteps / totalSetupSteps) * 100;
  
  return (
    <div className="space-y-6 wave-v2-page wave-v2-dashboard">
      <section className="wave-v2-hero rounded-2xl border p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-foreground">Workspace Overview</h1>
            <p className="text-sm text-muted-foreground">
              Track support volume, AI coverage, destination usage, and setup health across channels.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border px-3 py-1 text-xs font-medium text-foreground/90 glass-chip">
              Connected: {connectedPlatforms}/3
            </span>
            <span className="rounded-full border px-3 py-1 text-xs font-medium text-foreground/90 glass-chip">
              Setup: {Math.round(setupCompletionPercent)}%
            </span>
          </div>
        </div>
      </section>

      {/* Welcome Banner with Setup Steps */}
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      >
        <WelcomeBanner
          completedSteps={completedSteps}
          totalSteps={totalSetupSteps}
          title="Welcome to ModerateAI"
          description="Set up your integrations to start moderating your communities."
          setupProgress={setupProgress}
        />
      </motion.div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5">
          <StatsCard
            title={statsForDisplay[0].title}
            value={statsForDisplay[0].value}
            icon={statsForDisplay[0].icon}
            iconBgColor={statsForDisplay[0].iconBgColor}
            iconColor={statsForDisplay[0].iconColor}
            changeValue={statsForDisplay[0].changeValue}
            changeText={statsForDisplay[0].changeText}
            delay={shouldReduceMotion ? 0 : 0}
          />
        </div>
        <div className="lg:col-span-3">
          <StatsCard
            title={statsForDisplay[1].title}
            value={statsForDisplay[1].value}
            icon={statsForDisplay[1].icon}
            iconBgColor={statsForDisplay[1].iconBgColor}
            iconColor={statsForDisplay[1].iconColor}
            changeValue={statsForDisplay[1].changeValue}
            changeText={statsForDisplay[1].changeText}
            delay={shouldReduceMotion ? 0 : 0.06}
          />
        </div>
        <div className="lg:col-span-4">
          <StatsCard
            title={statsForDisplay[2].title}
            value={statsForDisplay[2].value}
            icon={statsForDisplay[2].icon}
            iconBgColor={statsForDisplay[2].iconBgColor}
            iconColor={statsForDisplay[2].iconColor}
            changeValue={statsForDisplay[2].changeValue}
            changeText={statsForDisplay[2].changeText}
            delay={shouldReduceMotion ? 0 : 0.12}
          />
        </div>
        {usageStatsForDisplay.map((card, index) => (
          <div key={card.title} className="lg:col-span-3">
            <StatsCard
              title={card.title}
              value={card.value}
              icon={card.icon}
              iconBgColor={card.iconBgColor}
              iconColor={card.iconColor}
              changeValue={card.changeValue}
              changeText={card.changeText}
              statusLabel={card.statusLabel}
              statusTone={card.statusTone}
              delay={shouldReduceMotion ? 0 : 0.16 + index * 0.04}
            />
          </div>
        ))}

        <motion.div
          className="lg:col-span-8"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <h2 className="text-lg font-semibold text-foreground mb-4">Platform Integrations</h2>
          <div className="rounded-2xl shadow-sm surface-glow glass-surface overflow-hidden">
            {isLoadingOverview ? (
              <>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="border-b border-border p-6 last:border-b-0">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-center">
                        <Skeleton className="h-12 w-12 rounded-lg mr-4" />
                        <div>
                          <Skeleton className="h-4 w-24 mb-2" />
                          <Skeleton className="h-3 w-40" />
                        </div>
                      </div>
                      <div className="flex flex-col gap-3 sm:items-end">
                        <Skeleton className="h-6 w-24 rounded-full" />
                        <Skeleton className="h-10 w-36 rounded-xl" />
                      </div>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              Array.isArray(platforms) ? platforms
                .map((platform: any) => (
                  <PlatformIntegrationCard
                    key={platform.id}
                    type={platform.type as "telegram" | "discord" | "website"}
                    name={platform.name}
                    description={
                      platform.type === "telegram"
                        ? "Add AI responses to your Telegram groups"
                        : platform.type === "discord"
                          ? "Add AI moderation to your Discord server"
                          : "Add AI chat to your website and capture leads directly into your workspace."
                    }
                    status={platform.status as "active" | "not_connected" | "setup_required" | "inactive"}
                  />
                )) : null
            )}
          </div>
        </motion.div>

        <motion.div
          className="lg:col-span-4"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: shouldReduceMotion ? 0 : 0.06 }}
        >
          <h2 className="text-lg font-semibold text-foreground mb-4">Recent Activity</h2>
          <RecentActivityList
            activities={processActivityData()}
            isLoading={isLoadingOverview}
          />
        </motion.div>

        <motion.div
          className="lg:col-span-4 rounded-2xl p-6 surface-glow lift-card glass-surface"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: shouldReduceMotion ? 0 : 0.1 }}
        >
          <h3 className="text-base font-semibold text-foreground">Workspace Pulse</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Quick status across integrations and setup completion.
          </p>
          <div className="mt-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Connected platforms</span>
              <span className="text-sm font-semibold text-foreground">{connectedPlatforms}/3</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Setup completion</span>
              <span className="text-sm font-semibold text-foreground">{Math.round(setupCompletionPercent)}%</span>
            </div>
            <Progress value={setupCompletionPercent} className="h-2" />
            <div className="grid grid-cols-3 gap-2 pt-1">
              <Link href="/integrations/telegram">
                <Button size="sm" variant="outline" className="w-full glass-chip">Telegram</Button>
              </Link>
              <Link href="/integrations/discord">
                <Button size="sm" variant="outline" className="w-full glass-chip">Discord</Button>
              </Link>
              <Link href="/integrations/website">
                <Button size="sm" variant="outline" className="w-full glass-chip">Website</Button>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;

