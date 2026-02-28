import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, Link } from "wouter";

// Type definitions for Discord platform
interface DiscordChannel {
  id: string;
  name: string;
  type: string;
  moderationEnabled: boolean;
  active: boolean;
}

interface DiscordConfig {
  botName?: string;
  botUsername?: string;
  serverName?: string;
  serverId?: string;
  memberCount?: number;
  channels?: DiscordChannel[];
  dailyMessages?: number;
  moderationCount?: number;
  permissions?: string;
  setupCompleted?: boolean;
  directMessagesEnabled?: boolean;
  
  // Moderation settings
  automaticWarnings?: boolean;
  logModerationActions?: boolean;
  moderationLogChannel?: string;
}

interface DiscordPlatform {
  id: number;
  type: string;
  name: string;
  status: string;
  botOwnershipMode?: "app_owned" | "byob";
  appOwnedAvailable?: boolean;
  activeClaimCode?: {
    id: number;
    code: string;
    expiresAt: string;
    createdAt: string;
  } | null;
  appOwnedBot?: {
    available: boolean;
    clientId?: string;
    inviteUrl?: string;
    invitePermissions?: string;
  };
  config: DiscordConfig;
  authToken?: string | null;
  createdAt: Date;
  userId: number;
}

interface PlatformSummary {
  id: number;
  type: string;
  name: string;
  status: string;
  botOwnershipMode?: "app_owned" | "byob";
  appOwnedAvailable?: boolean;
  appOwnedBot?: {
    available: boolean;
    clientId?: string;
    inviteUrl?: string;
    invitePermissions?: string;
  };
}

interface PlatformClaimCodeResponse {
  platformId: number;
  platformType: string;
  activeClaimCode: {
    id: number;
    code: string;
    expiresAt: string;
    createdAt?: string;
  } | null;
}

interface DiscordAnalyticsData {
  totalMessages: number;
  aiResponses: number;
  activeServers: number;
  totalChannels: number;
  responseRate: number;
  messagesByDay: { date: string; messages: number }[];
  deepAnalytics?: {
    recentActivityCount: number;
    activityByPlatform: Record<string, number>;
  };
}

interface DiscordChatConfiguration {
  id: number;
  platformId: number;
  externalId: string;
  chatName?: string;
  chatType: string;
  isActive: boolean;
  settings?: {
    enabledChannels?: Record<string, boolean>;
    totalChannels?: number;
  };
}

interface DiscordDiscoveredServer {
  guildId: string;
  guildName: string;
  memberCount?: number;
  textChannelCount: number;
  isConfigured: boolean;
  isActive: boolean;
  channelsUnavailable: boolean;
}

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { ChatConfigurationList } from "@/components/discord/ChatConfigurationList";
import { DiscordServerList } from "@/components/discord/DiscordServerList";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Loader2,
  MessageSquareMore,
  BarChart3,
  Users,
  ArrowRight,
  ExternalLink,
  Shield,
  MessagesSquare,
  ServerCrash,
  Lock,
  Unlock,
  Pencil,
  Trash2,
  Hash,
  Settings,
  RefreshCw,
  Bot,
  MessageSquare,
  TrendingUp,
  Users2,
  Copy,
  AlertTriangle,
} from "lucide-react";
import { SiDiscord } from "react-icons/si";

// Analytics component for Discord platform
const DiscordAnalytics = ({ platformId }: { platformId: number }) => {
  const { data: analytics, isLoading, error } = useQuery<DiscordAnalyticsData>({
    queryKey: [`/api/platforms/${platformId}/analytics`],
    enabled: !!platformId,
  });

  if (isLoading) {
    return (
      <div className="space-y-6 py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((card) => (
            <div key={card} className="rounded-lg border p-4 space-y-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-72 w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    const rawMessage = error instanceof Error ? error.message : "Failed to load analytics";
    const isTierGate = rawMessage.includes("403") && rawMessage.includes("Analytics are available on Standard and Pro plans");
    return (
      <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4 text-sm">
        <p className="font-medium text-blue-100">
          {isTierGate ? "Analytics unavailable on Free plan" : "Could not load analytics"}
        </p>
        <p className="mt-1 text-blue-200/90">
          {isTierGate
            ? "Upgrade to Standard or Pro to unlock analytics for Discord."
            : rawMessage}
        </p>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <BarChart3 className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-lg font-medium">No Data Available</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Start conversations to see analytics data.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-blue-200">
        {analytics.deepAnalytics
          ? "Pro deep analytics active: includes expanded activity context."
          : "Standard analytics dashboard active."}
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border">
          <div className="flex items-center">
            <MessageSquare className="h-5 w-5 text-blue-600" />
            <span className="ml-2 text-sm font-medium text-blue-800">Total Messages</span>
          </div>
          <p className="text-2xl font-bold text-blue-900 mt-2">{analytics.totalMessages || 0}</p>
        </div>
        
        <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border">
          <div className="flex items-center">
            <Bot className="h-5 w-5 text-green-600" />
            <span className="ml-2 text-sm font-medium text-green-800">AI Responses</span>
          </div>
          <p className="text-2xl font-bold text-green-900 mt-2">{analytics.aiResponses || 0}</p>
        </div>
        
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border">
          <div className="flex items-center">
            <Users2 className="h-5 w-5 text-purple-600" />
            <span className="ml-2 text-sm font-medium text-purple-800">Active Servers</span>
          </div>
          <p className="text-2xl font-bold text-purple-900 mt-2">{analytics.activeServers || 0}</p>
        </div>
        
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-lg border">
          <div className="flex items-center">
            <TrendingUp className="h-5 w-5 text-orange-600" />
            <span className="ml-2 text-sm font-medium text-orange-800">Response Rate</span>
          </div>
          <p className="text-2xl font-bold text-orange-900 mt-2">{analytics.responseRate || 0}%</p>
        </div>
      </div>

      {/* Server Activity */}
      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Server Activity</CardTitle>
            <CardDescription>Distribution across Discord servers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                  <span className="text-sm">Active Servers</span>
                </div>
                <span className="font-semibold">{analytics.activeServers || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                  <span className="text-sm">Total Channels</span>
                </div>
                <span className="font-semibold">{analytics.totalChannels || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Message Activity (Last 7 Days)</CardTitle>
          <CardDescription>Daily message volume across all servers</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-end justify-between space-x-2">
            {(analytics.messagesByDay || []).map((day: any, index: number) => {
              const maxMessages = Math.max(...(analytics.messagesByDay || []).map((d: any) => d.messages));
              const height = maxMessages > 0 ? (day.messages / maxMessages) * 100 : 0;
              const date = new Date(day.date);
              const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
              
              return (
                <div key={index} className="flex-1 flex flex-col items-center">
                  <div className="w-full flex flex-col items-center mb-2">
                    <div 
                      className="w-full bg-indigo-500 rounded-t-sm transition-all duration-300 hover:bg-indigo-600" 
                      style={{ height: `${Math.max(height, 4)}px` }}
                      title={`${day.messages} messages on ${dayName}`}
                    ></div>
                  </div>
                  <span className="text-xs text-muted-foreground">{dayName}</span>
                  <span className="text-xs font-medium">{day.messages}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const DiscordIntegration = () => {
  const { toast } = useToast();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("setup");
  const [isDisconnectDialogOpen, setIsDisconnectDialogOpen] = useState(false);
  const [isCompleteSetupDialogOpen, setIsCompleteSetupDialogOpen] = useState(false);
  const [authCode, setAuthCode] = useState("");
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [updatedChannels, setUpdatedChannels] = useState<DiscordChannel[]>([]);
  
  // Check if user is authenticated
  useEffect(() => {
    if (!isAuthLoading && !user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to access Discord integration features.",
        variant: "destructive",
      });
      setLocation("/auth");
    }
  }, [user, isAuthLoading, toast, setLocation]);

  // Fetch all platforms to resolve the Discord platform ID dynamically.
  const { data: platforms = [] } = useQuery<PlatformSummary[]>({
    queryKey: ["/api/platforms"],
    retry: false,
    enabled: !!user,
  });

  const discordPlatform = platforms.find((entry) => entry.type === "discord") ?? null;
  const discordPlatformId = discordPlatform?.id ?? 0;

  // Fetch platform data
  const { data: platform, isLoading } = useQuery<DiscordPlatform>({
    queryKey: [`/api/platforms/${discordPlatformId}`],
    retry: false,
    enabled: !!discordPlatformId,
  });

  const platformMode = (platform?.botOwnershipMode ?? discordPlatform?.botOwnershipMode ?? "app_owned") as
    | "app_owned"
    | "byob";
  const appOwnedAvailable = Boolean(
    platform?.appOwnedAvailable ?? discordPlatform?.appOwnedAvailable ?? false,
  );
  const canManageIntegration =
    (user as any)?.role === "owner" ||
    (user as any)?.role === "admin" ||
    (user as any)?.workspaceRole === "admin";
  const canManageDestinationLocks =
    (user as any)?.role === "owner" ||
    (user as any)?.role === "admin" ||
    (user as any)?.workspaceRole === "admin" ||
    (user as any)?.workspaceRole === "moderator";
  const canUseByob =
    (user as any)?.role === "owner" ||
    (user as any)?.role === "admin" ||
    (user as any)?.plan === "pro";

  const { data: claimCodeState } = useQuery<PlatformClaimCodeResponse>({
    queryKey: [`/api/platforms/${discordPlatformId}/claim-code`],
    retry: false,
    enabled: !!discordPlatformId && platformMode === "app_owned" && !!user && canManageIntegration,
  });

  const activeClaimCode = claimCodeState?.activeClaimCode ?? platform?.activeClaimCode ?? null;
  const appOwnedBot = platform?.appOwnedBot ?? discordPlatform?.appOwnedBot ?? null;
  const appOwnedDiscordInviteUrl = appOwnedBot?.inviteUrl;

  // Get chat configurations for this platform
  const { data: chatConfigurations = [] } = useQuery<DiscordChatConfiguration[]>({
    queryKey: [`/api/platforms/${discordPlatformId}/chat-configurations`],
    enabled: !!discordPlatformId,
  });
  const hasClaimedDiscordServer = chatConfigurations.some(
    (config) => config.isActive && config.chatType === "server",
  );

  const { data: discoveredServers = [], isLoading: isLoadingDiscoveredServers } = useQuery<DiscordDiscoveredServer[]>({
    queryKey: [`/api/platforms/${discordPlatformId}/discord/discovered-servers`],
    retry: false,
    enabled: !!discordPlatformId && !!user && canManageIntegration && platformMode === "byob",
  });

  const enableServerMutation = useMutation({
    mutationFn: async (guildId: string) => {
      const res = await apiRequest(
        "POST",
        `/api/platforms/${discordPlatformId}/discord/servers/${guildId}/enable`,
      );
      return await res.json();
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/platforms/${discordPlatformId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/platforms/${discordPlatformId}/chat-configurations`] });
      queryClient.invalidateQueries({ queryKey: [`/api/platforms/${discordPlatformId}/discord/discovered-servers`] });
      toast({
        title: "Server enabled",
        description: `${result.guildName || "Discord server"} is ready. Enable channels in the server card to start responses.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Enable failed",
        description: error?.message || "Could not enable this Discord server.",
        variant: "destructive",
      });
    },
  });



  // Get knowledge bases
  const { data: knowledgeBases = [] } = useQuery({
    queryKey: ["/api/knowledge-bases"],
    enabled: !!user,
  });

  const switchModeMutation = useMutation({
    mutationFn: async (mode: "app_owned" | "byob") => {
      const payload: Record<string, unknown> = {
        botOwnershipMode: mode,
      };
      if (mode === "app_owned") {
        payload.status = "active";
      } else {
        payload.status = "setup_required";
      }
      const res = await apiRequest("PATCH", `/api/platforms/${discordPlatformId}`, payload);
      return (await res.json()) as DiscordPlatform;
    },
    onSuccess: (_updated, mode) => {
      queryClient.invalidateQueries({ queryKey: [`/api/platforms/${discordPlatformId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/platforms"] });
      queryClient.invalidateQueries({ queryKey: [`/api/platforms/${discordPlatformId}/claim-code`] });
      queryClient.invalidateQueries({ queryKey: [`/api/platforms/${discordPlatformId}/discord/discovered-servers`] });
      toast({
        title: "Mode updated",
        description:
          mode === "app_owned"
            ? "Discord is now using app-owned mode."
            : "Discord is now using BYOB mode.",
      });
    },
    onError: (error) => {
      toast({
        title: "Mode switch failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const issueClaimCodeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/platforms/${discordPlatformId}/claim-code`);
      return await res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/platforms/${discordPlatformId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/platforms/${discordPlatformId}/claim-code`] });
      toast({
        title: "Claim code issued",
        description: `Code ${data.code} expires at ${new Date(data.expiresAt).toLocaleString()}.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to issue claim code",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const revokeClaimCodeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/platforms/${discordPlatformId}/claim-code/revoke`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/platforms/${discordPlatformId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/platforms/${discordPlatformId}/claim-code`] });
      toast({
        title: "Claim code revoked",
        description: "The active claim code is no longer valid.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to revoke claim code",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const unlockAllMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/platforms/${discordPlatformId}/unlock-all`, {
        reason: "Unlocked all Discord destinations from integration page.",
      });
      return await res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/platforms/${discordPlatformId}/chat-configurations`] });
      queryClient.invalidateQueries({ queryKey: ['/api/platforms'] });
      toast({
        title: "Unlock-all completed",
        description:
          typeof data?.total === "number"
            ? `Processed ${data.total} locks (${data.unlocked ?? 0} unlocked, ${data.failed ?? 0} failed).`
            : data?.message || "All active Discord locks were cleared.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Unlock-all failed",
        description: error?.message || "Could not unlock all destinations.",
        variant: "destructive",
      });
    },
  });

  const checkClaimStatus = async () => {
    if (!discordPlatformId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [`/api/platforms/${discordPlatformId}`] }),
      queryClient.invalidateQueries({ queryKey: [`/api/platforms/${discordPlatformId}/chat-configurations`] }),
      queryClient.invalidateQueries({ queryKey: [`/api/platforms/${discordPlatformId}/claim-code`] }),
    ]);

    const latestConfigs =
      (queryClient.getQueryData<DiscordChatConfiguration[]>([
        `/api/platforms/${discordPlatformId}/chat-configurations`,
      ]) ?? []);
    const claimDetected = latestConfigs.some((config) => config.isActive && config.chatType === "server");

    if (claimDetected) {
      toast({
        title: "Claim detected",
        description: "Server linked successfully. You can configure it in the Servers tab.",
      });
      setActiveTab("channels");
      return;
    }

    toast({
      title: "Not linked yet",
      description: "No claimed server found yet. Run /claim CODE or !claim CODE in your Discord server.",
    });
  };

  // Start Discord bot setup
  const startSetupMutation = useMutation({
    mutationFn: async () => {
      // Add console logs to debug the Discord client ID
      console.log("Discord Client ID:", import.meta.env.VITE_DISCORD_CLIENT_ID);
      
      return apiRequest("PATCH", `/api/platforms/${discordPlatformId}`, {
        name: "Discord Bot",
        botOwnershipMode: "byob",
        status: "setup_required",
        config: {
          setupStarted: true,
          serverId: "",
          permissions: "8"
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/platforms/${discordPlatformId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/platforms'] });
      
      // Check if Discord client ID is available
      const discordClientId = import.meta.env.VITE_DISCORD_CLIENT_ID;
      if (!discordClientId) {
        toast({
          title: "Configuration Error",
          description: "Discord Client ID is missing. Please check your environment settings.",
          variant: "destructive",
        });
        return;
      }
      
      // Open Discord authorization window
      window.open(`https://discord.com/api/oauth2/authorize?client_id=${discordClientId}&permissions=8&scope=bot%20applications.commands`, "_blank");
      
      toast({
        title: "Setup started",
        description: "Please complete the Discord authorization process.",
      });
    },
    onError: (error) => {
      console.error("Discord setup error:", error);
      toast({
        title: "Error",
        description: "Failed to start Discord setup. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Complete Discord bot setup
  const completeSetupMutation = useMutation({
    mutationFn: async (data: { serverId: string, authCode?: string }) => {
      return apiRequest("PATCH", `/api/platforms/${discordPlatformId}`, {
        name: "Discord Bot",
        botOwnershipMode: "byob",
        status: "active",
        // Only include authToken if authCode is provided
        ...(data.authCode ? { authToken: data.authCode } : {}),
        config: {
          setupCompleted: true,
          serverId: data.serverId,
          welcomeMessage: "Hello! I'm your AI assistant. How can I help you today?",
          permissions: "8",
          channels: []
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/platforms/${discordPlatformId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/platforms'] });
      setIsCompleteSetupDialogOpen(false);
      toast({
        title: "Success",
        description: "Discord bot setup completed successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to complete Discord setup. Please check your server ID and try again.",
        variant: "destructive",
      });
    },
  });

  // Disconnect Discord bot
  const disconnectBotMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/platforms/${discordPlatformId}`, {
        botOwnershipMode: "byob",
        status: "not_connected",
        authToken: null
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/platforms/${discordPlatformId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/platforms'] });
      setIsDisconnectDialogOpen(false);
      toast({
        title: "Success",
        description: "Discord bot disconnected successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to disconnect Discord bot. Please try again.",
        variant: "destructive",
      });
    },
  });
  
  // Refresh Discord channels
  const refreshChannelsMutation = useMutation({
    mutationFn: async () => {
      // In a real app, this would connect to Discord API to fetch the latest channels
      // For now, simulate refreshing by adding a new timestamp
      return apiRequest("PATCH", `/api/platforms/${discordPlatformId}`, {
        config: {
          ...platform?.config,
          lastRefreshed: new Date().toISOString()
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/platforms/${discordPlatformId}`] });
      toast({
        title: "Success",
        description: "Discord channels refreshed successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to refresh Discord channels. Please try again.",
        variant: "destructive",
      });
    },
  });
  
  // Save channel changes
  const saveChannelChangesMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/platforms/${discordPlatformId}`, {
        config: {
          ...platform?.config,
          channels: updatedChannels
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/platforms/${discordPlatformId}`] });
      toast({
        title: "Success",
        description: "Channel settings updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update channel settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleStartSetup = () => {
    // Check if user is authenticated
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to add Discord integration.",
        variant: "destructive",
      });
      setLocation("/auth");
      return;
    }

    if (!discordPlatformId) {
      toast({
        title: "Platform unavailable",
        description: "Discord integration platform is still loading. Please refresh and try again.",
        variant: "destructive",
      });
      return;
    }
    
    // Start the setup process
    startSetupMutation.mutate();
  };

  const handleCompleteSetup = () => {
    // We no longer require the authCode, but we'll pass it if it's provided
    completeSetupMutation.mutate({
      serverId: platform?.config?.serverId || "",
      ...(authCode ? { authCode } : {})
    });
  };

  const handleDisconnectBot = () => {
    disconnectBotMutation.mutate();
  };
  
  const handleRefreshChannels = () => {
    refreshChannelsMutation.mutate();
  };
  
  const handleSaveChannels = () => {
    saveChannelChangesMutation.mutate();
  };
  
  const handleToggleModeration = (channelId: string, enabled: boolean) => {
    // Find the channel and update its moderation setting
    const updatedChannelsList = updatedChannels.map(channel => 
      channel.id === channelId 
        ? { ...channel, moderationEnabled: enabled }
        : channel
    );
    
    setUpdatedChannels(updatedChannelsList);
  };

  // Initialize updatedChannels when platform data changes
  useEffect(() => {
    if (platform?.config?.channels) {
      setUpdatedChannels([...platform.config.channels]);
    }
  }, [platform]);

  useEffect(() => {
    if (
      !discordPlatformId ||
      platformMode !== "app_owned" ||
      !activeClaimCode ||
      hasClaimedDiscordServer
    ) {
      return;
    }

    const intervalId = window.setInterval(() => {
      queryClient.invalidateQueries({ queryKey: [`/api/platforms/${discordPlatformId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/platforms/${discordPlatformId}/chat-configurations`] });
      queryClient.invalidateQueries({ queryKey: [`/api/platforms/${discordPlatformId}/claim-code`] });
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [
    discordPlatformId,
    platformMode,
    activeClaimCode,
    hasClaimedDiscordServer,
  ]);

  // Use channels from the updatedChannels state or fallback to demo channels
  const discordChannels = updatedChannels.length > 0 ? updatedChannels : platform?.config?.channels || [
    { id: "1", name: "general", type: "text", moderationEnabled: true, active: true },
    { id: "2", name: "help", type: "text", moderationEnabled: true, active: true }
  ];

  return (
    <div className="space-y-6 wave-v2-page wave-v2-integrations">
      <div className="wave-v2-hero rounded-2xl border p-5 md:p-6 flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">Discord Integration</h1>
          <p className="text-sm text-muted-foreground">Connect your AI assistant to Discord servers and channels.</p>
        </div>
        <Badge 
          variant="outline" 
          className={`capitalize ${
            platform?.status === "active" 
              ? "bg-green-600/20 text-green-500" 
              : platform?.status === "setup_required"
              ? "bg-yellow-600/20 text-yellow-500"
              : ""
          }`}
        >
          {platform?.status === "active" 
            ? "Active" 
            : platform?.status?.replace("_", " ")}
        </Badge>
      </div>

      <Tabs defaultValue="setup" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 glass-chip">
          <TabsTrigger value="setup">
            <MessageSquareMore className="h-4 w-4 mr-2" />
            Setup
          </TabsTrigger>
          <TabsTrigger value="channels" disabled={!platform}>
            <Hash className="h-4 w-4 mr-2" />
            Servers
          </TabsTrigger>
          <TabsTrigger value="settings" disabled={!hasClaimedDiscordServer}>
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="analytics" disabled={!hasClaimedDiscordServer}>
            <BarChart3 className="h-4 w-4 mr-2" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="setup" className="m-0">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Bot Ownership Mode</CardTitle>
              <CardDescription>
                App-owned mode is default. BYOB is available for Pro workspaces.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Button
                  variant={platformMode === "app_owned" ? "default" : "outline"}
                  onClick={() => switchModeMutation.mutate("app_owned")}
                  disabled={!canManageIntegration || switchModeMutation.isPending}
                >
                  App-owned
                </Button>
                <Button
                  variant={platformMode === "byob" ? "default" : "outline"}
                  onClick={() => switchModeMutation.mutate("byob")}
                  disabled={!canManageIntegration || !canUseByob || switchModeMutation.isPending}
                >
                  BYOB (Pro)
                </Button>
              </div>
              {!canUseByob && (
                <p className="text-sm text-muted-foreground">
                  Upgrade to Pro to connect your own Discord bot token.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{platformMode === "app_owned" ? "App-Owned Discord Setup" : "Discord Bot Setup"}</CardTitle>
              <CardDescription>
                {platformMode === "app_owned"
                  ? "Generate a one-time claim code, invite the shared bot, then run /claim CODE in your server."
                  : "Connect your AI assistant, then enable servers from the Servers tab. Channels start disabled until you turn them on."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoading ? (
                <div className="space-y-6 py-2">
                  <Skeleton className="h-20 w-full rounded-xl" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Skeleton className="h-44 w-full rounded-xl" />
                    <Skeleton className="h-44 w-full rounded-xl" />
                  </div>
                  <Skeleton className="h-60 w-full rounded-xl" />
                </div>
              ) : platformMode === "app_owned" ? (
                <div className="space-y-6">
                  {!appOwnedAvailable && (
                    <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 p-4">
                      <div className="flex gap-3">
                        <AlertTriangle className="h-5 w-5 text-amber-300" />
                        <div>
                          <h3 className="text-sm font-medium text-amber-200">App-owned Discord bot unavailable</h3>
                          <p className="mt-1 text-sm text-amber-200/90">
                            Ask support to configure <code>DISCORD_APP_BOT_TOKEN</code> on this environment.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="rounded-lg border p-4">
                    <h3 className="text-lg font-medium mb-2">Claim Code</h3>
                    <p className="text-sm text-muted-foreground">
                      Generate a one-time code, invite the shared ModerateAI bot, then run
                      <code className="ml-1">/claim CODE</code> in your server.
                    </p>

                    <div className="mt-4 rounded-md border border-blue-500/30 bg-blue-500/10 p-3">
                      <p className="text-sm text-blue-100">
                        Invite the shared Discord bot first, then claim from any server channel.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => {
                            if (!appOwnedDiscordInviteUrl) return;
                            window.open(appOwnedDiscordInviteUrl, "_blank", "noopener,noreferrer");
                          }}
                          disabled={!appOwnedDiscordInviteUrl}
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Add Shared Discord Bot
                        </Button>
                        {appOwnedDiscordInviteUrl ? (
                          <Button
                            variant="outline"
                            onClick={() => {
                              navigator.clipboard.writeText(appOwnedDiscordInviteUrl);
                              toast({ title: "Copied", description: "Discord invite link copied." });
                            }}
                          >
                            <Copy className="mr-2 h-4 w-4" />
                            Copy Invite Link
                          </Button>
                        ) : null}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {appOwnedBot?.clientId
                          ? `Shared bot client ID: ${appOwnedBot.clientId}`
                          : "Shared bot invite metadata will appear once app-owned metadata is available."}
                      </p>
                    </div>

                    {activeClaimCode ? (
                      <div className="mt-4 space-y-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <Badge variant="secondary">Active Code</Badge>
                          <code className="rounded bg-muted px-2 py-1 text-sm tracking-wider">{activeClaimCode.code}</code>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(activeClaimCode.code);
                              toast({ title: "Copied", description: "Claim code copied to clipboard." });
                            }}
                          >
                            <Copy className="mr-2 h-4 w-4" />
                            Copy
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Expires: {new Date(activeClaimCode.expiresAt).toLocaleString()}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-muted-foreground">No active claim code.</p>
                    )}

                    <div className="mt-4 flex flex-wrap gap-3">
                      <Button
                        onClick={() => issueClaimCodeMutation.mutate()}
                        disabled={!canManageIntegration || !appOwnedAvailable || issueClaimCodeMutation.isPending}
                      >
                        {issueClaimCodeMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Generate Claim Code
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => revokeClaimCodeMutation.mutate()}
                        disabled={!canManageIntegration || !activeClaimCode || revokeClaimCodeMutation.isPending}
                      >
                        {revokeClaimCodeMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Revoke Code
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => checkClaimStatus()}
                        disabled={!activeClaimCode}
                      >
                        Check Claim Status
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-lg border p-4">
                    <h3 className="text-lg font-medium mb-3">Setup Steps</h3>
                    <ol className="space-y-2 text-sm text-muted-foreground">
                      <li>1. Generate a claim code.</li>
                      <li>2. Click <span className="font-medium">Add Shared Discord Bot</span> and invite it to your server.</li>
                      <li>3. In any channel, run: <code>/claim YOUR_CODE</code> or <code>!claim YOUR_CODE</code></li>
                      <li>4. Click <span className="font-medium">Check Claim Status</span>, then configure server settings in the Servers tab.</li>
                    </ol>
                  </div>
                </div>
              ) : platform?.status === "active" ? (
                <div className="space-y-6">
                  <div className="p-4">
                    <div className="flex">
                      <div className="mr-3 flex-shrink-0">
                        <svg className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-emerald-400">Connected Successfully</h3>
                        <p className="mt-1 text-sm text-emerald-300/90">
                          Your Discord bot is active and moderating your server.
                        </p>
                        <div className="mt-3">
                          <Button 
                            variant="outline" 
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setIsDisconnectDialogOpen(true)}
                          >
                            <ServerCrash className="h-4 w-4 mr-2" />
                            Disconnect Bot
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-lg font-medium mb-3">Bot Information</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Bot Name:</span>
                          <span className="text-sm font-medium">{platform?.config?.botName || 'Loading...'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Server:</span>
                          <span className="text-sm font-medium">{platform?.config?.serverName || 'Loading...'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Status:</span>
                          <Badge variant="outline" className="bg-green-600/20 text-green-500">
                            {platform?.status === "active" ? "Active" : platform?.status}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Active Channels:</span>
                          <span className="text-sm font-medium">
                            {platform?.config?.channels?.filter((c: DiscordChannel) => c.active).length || 0} channels
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-medium mb-3">Server Overview</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <div className="flex items-center">
                            <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Members</span>
                          </div>
                          <span className="text-sm font-medium">{platform?.config?.memberCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <div className="flex items-center">
                            <Hash className="h-4 w-4 mr-2 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Text Channels</span>
                          </div>
                          <span className="text-sm font-medium">
                            {platform?.config?.channels?.filter((c: DiscordChannel) => c.type === "text").length}
                          </span>
                        </div>

                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border p-4">
                    <h3 className="text-lg font-medium mb-3">Next Steps</h3>
                    <div className="space-y-4">
                      <div className="flex">
                        <div className="h-6 w-6 rounded-full bg-blue-900/30 text-blue-400 flex items-center justify-center mr-3 flex-shrink-0">
                          1
                        </div>
                        <div>
                          <p className="text-sm text-foreground/80">
                            <span className="font-medium">Configure channels</span> - Choose which channels the bot should moderate
                          </p>
                        </div>
                      </div>
                      <div className="flex">
                        <div className="h-6 w-6 rounded-full bg-blue-900/30 text-blue-400 flex items-center justify-center mr-3 flex-shrink-0">
                          2
                        </div>
                        <div>
                          <p className="text-sm text-foreground/80">
                            <span className="font-medium">Customize moderation rules</span> - Set up your moderation preferences
                          </p>
                        </div>
                      </div>
                      <div className="flex">
                        <div className="h-6 w-6 rounded-full bg-blue-900/30 text-blue-400 flex items-center justify-center mr-3 flex-shrink-0">
                          3
                        </div>
                        <div>
                          <p className="text-sm text-foreground/80">
                            <span className="font-medium">Invite your team</span> - Add team members to help with moderation
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : platform?.status === "setup_required" ? (
                <div className="space-y-6">
                  <div className="rounded-lg p-4 border">
                    <div className="flex">
                      <div className="rounded-full p-1 mr-3 flex-shrink-0">
                        <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium">Setup Required</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Your Discord bot needs additional configuration to be fully activated.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Complete Bot Setup</h3>
                    <p className="text-sm text-muted-foreground">
                      Your Discord bot has been added to your server. Click the button below to complete the setup process.
                      An authorization code is no longer required.
                    </p>
                    <Button onClick={() => setIsCompleteSetupDialogOpen(true)}>
                      Complete Setup
                    </Button>
                  </div>

                  <div className="rounded-lg border p-4 mt-6">
                    <h3 className="text-lg font-medium mb-3">Having Trouble?</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      If you're experiencing issues with the Discord bot setup:
                    </p>
                    <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2">
                      <li>Make sure you have admin permissions on your Discord server</li>
                      <li>Check that you've authorized the bot with the correct permissions</li>
                      <li>You can complete the setup without an authorization code</li>
                      <li>Try refreshing the authorization page and starting over if needed</li>
                    </ul>
                    <div className="mt-4">
                      <Link href="/help/article/discord-integration">
                        <Button variant="outline">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View Setup Guide
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="rounded-lg bg-blue-900/20 p-4 border border-blue-600/30">
                    <div className="flex">
                      <div className="h-8 w-8 rounded-full text-white bg-primary mr-3 flex items-center justify-center flex-shrink-0">
                        <SiDiscord className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-base font-medium text-blue-400">Connect to Discord</h3>
                        <p className="mt-1 text-sm text-blue-300/90">
                          Add our AI-powered bot to your Discord server for automated moderation and support.
                        </p>
                      </div>
                    </div>
                  </div>



                  <div className="rounded-lg border p-4 bg-card">
                    <h3 className="text-lg font-medium mb-4">Get Started</h3>
                    <p className="text-sm text-muted-foreground mb-6">
                      Click the button below to add ModerateAI to your Discord server. You'll need to be a server admin to complete this process.
                    </p>
                    <Button onClick={handleStartSetup}>
                      <SiDiscord className="mr-2 h-4 w-4" />
                      Add to Discord
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="channels" className="m-0">
          <Card>
            <CardHeader>
              <CardTitle>Server Configurations</CardTitle>
              <CardDescription>
                Manage individual settings for each Discord server and channel where your bot can respond
              </CardDescription>
            </CardHeader>
            <CardContent>
              {platformMode === "app_owned" && !hasClaimedDiscordServer ? (
                <div className="rounded-lg border p-6 text-sm">
                  <p className="text-base font-semibold">No claimed destination yet</p>
                  <p className="mt-2 text-muted-foreground">
                    Complete setup in the Setup tab: invite the shared bot and run
                    <code className="ml-1">/claim CODE</code> or <code className="ml-1">!claim CODE</code>.
                  </p>
                  <Button className="mt-4" variant="outline" onClick={() => setActiveTab("setup")}>
                    Go to Setup
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {platformMode === "byob" ? (
                    <div className="rounded-lg border p-4 bg-card/40">
                      <h3 className="text-base font-semibold">Servers Catalog</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Servers must be enabled from this list. Channels start disabled until you enable them in each server card.
                      </p>
                      {isLoadingDiscoveredServers ? (
                        <p className="mt-3 text-sm text-muted-foreground">Loading discovered servers...</p>
                      ) : discoveredServers.length === 0 ? (
                        <p className="mt-3 text-sm text-muted-foreground">
                          No discovered servers yet. Add the bot to a server, then click Refresh Servers.
                        </p>
                      ) : (
                        <div className="mt-4 space-y-2">
                          {discoveredServers.map((server) => (
                            <div
                              key={server.guildId}
                              className="rounded-lg border border-border/70 p-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
                            >
                              <div>
                                <p className="text-sm font-medium">{server.guildName}</p>
                                <p className="text-xs text-muted-foreground">
                                  {server.textChannelCount} text channels
                                  {server.memberCount ? ` • ${server.memberCount} members` : ""}
                                </p>
                                {server.channelsUnavailable ? (
                                  <p className="mt-1 text-xs text-amber-400">
                                    Channels unavailable. Check bot permissions and refresh.
                                  </p>
                                ) : null}
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={server.isConfigured ? "default" : "secondary"}>
                                  {server.isConfigured ? "Enabled" : "Not enabled"}
                                </Badge>
                                {!server.isConfigured ? (
                                  <Button
                                    size="sm"
                                    onClick={() => enableServerMutation.mutate(server.guildId)}
                                    disabled={enableServerMutation.isPending}
                                  >
                                    {enableServerMutation.isPending ? (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : null}
                                    Enable
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}

                  <DiscordServerList
                    chatConfigurations={chatConfigurations as any[]}
                    knowledgeBases={knowledgeBases as any[]}
                    platformId={discordPlatformId}
                    channels={platform?.config?.channels || []}
                  />
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-end">
              <div className="flex flex-wrap justify-end gap-2">
                {canManageDestinationLocks ? (
                  <Button
                    variant="outline"
                    onClick={() => unlockAllMutation.mutate()}
                    disabled={unlockAllMutation.isPending}
                  >
                    {unlockAllMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Unlock className="mr-2 h-4 w-4" />
                    )}
                    Unlock All
                  </Button>
                ) : null}
                <Button 
                  variant="outline" 
                  onClick={async () => {
                    try {
                      const response = await fetch(`/api/platforms/${discordPlatformId}/generate-chat-configurations`, {
                        method: 'POST',
                        credentials: 'include'
                      });
                      
                      if (response.ok) {
                        const result = await response.json();
                        toast({
                          title: "Success",
                          description: `${result.message || 'Refreshed server configurations successfully'}`
                        });
                        queryClient.invalidateQueries({ queryKey: [`/api/platforms/${discordPlatformId}`] });
                        queryClient.invalidateQueries({ queryKey: [`/api/platforms/${discordPlatformId}/chat-configurations`] });
                        queryClient.invalidateQueries({ queryKey: [`/api/platforms/${discordPlatformId}/discord/discovered-servers`] });
                      } else {
                        let serverMessage = "Failed to refresh server configurations.";
                        try {
                          const body = await response.json();
                          if (body?.message) {
                            serverMessage = body.message;
                          }
                        } catch {
                          // ignore JSON parsing errors and use fallback message
                        }
                        throw new Error(serverMessage);
                      }
                    } catch (error) {
                      toast({
                        title: "Error",
                        description: error instanceof Error ? error.message : "Failed to refresh server configurations. Please try again.",
                        variant: "destructive"
                      });
                    }
                  }}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh Servers
                </Button>
              </div>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="m-0">
          <Card>
            <CardHeader>
              <CardTitle>Bot Settings</CardTitle>
              <CardDescription>
                Configure how your Discord bot behaves
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2.5">
                <h3 className="text-lg font-medium leading-none">Response Settings</h3>
                <p className="text-sm text-muted-foreground">
                  Server responses are controlled per server in the Servers tab.
                </p>
                <div className="flex items-center justify-between opacity-80">
                  <div className="space-y-1">
                    <Label className="text-lg font-medium leading-none text-foreground">Private Chat Mode</Label>
                    <p className="text-sm text-muted-foreground">
                      Direct messages are disabled for Discord bots.
                    </p>
                  </div>
                  <Switch checked={false} disabled />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="m-0">
          <Card>
            <CardHeader>
              <CardTitle>Analytics & Insights</CardTitle>
              <CardDescription>
                View performance metrics for your Discord bot
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <DiscordAnalytics platformId={discordPlatformId} />
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      {/* Complete Setup Dialog */}
      <Dialog open={isCompleteSetupDialogOpen} onOpenChange={setIsCompleteSetupDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Complete Discord Setup</DialogTitle>
            <DialogDescription>
              To complete setup, provide your Discord bot token from the Discord Developer Portal.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="authCode">Discord Bot Token</Label>
              <Input
                id="authCode"
                placeholder="Enter your Discord bot token (starts with 'MTC4...' or similar)"
                value={authCode}
                onChange={(e) => setAuthCode(e.target.value)}
                type="password"
              />
              <p className="text-sm text-muted-foreground flex items-center">
                <Lock className="h-3 w-3 mr-1" />
                Find this in your Discord Developer Portal under Bot settings
              </p>
              <p className="text-xs text-muted-foreground">
                Your bot token is securely stored and encrypted. This is different from the authorization code.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCompleteSetupDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCompleteSetup} disabled={completeSetupMutation.isPending}>
              {completeSetupMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="mr-2 h-4 w-4" />
              )}
              Complete Setup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disconnect Bot Dialog */}
      <AlertDialog open={isDisconnectDialogOpen} onOpenChange={setIsDisconnectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Discord Bot</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to disconnect your Discord bot? The bot will be removed from your server and all settings will be reset.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnectBot}
              className="bg-red-500 hover:bg-red-600"
            >
              {disconnectBotMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Disconnect Bot
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


    </div>
  );
};

export default DiscordIntegration;

