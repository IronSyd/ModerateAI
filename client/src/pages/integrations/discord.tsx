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
  serverName?: string;
  memberCount?: number;
  channels?: DiscordChannel[];
  dailyMessages?: number;
  moderationCount?: number;
  permissions?: string;
  setupCompleted?: boolean;
  
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
  config: DiscordConfig;
  authToken?: string | null;
  createdAt: Date;
  userId: number;
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
import {
  Loader2,
  MessageSquareMore,
  BarChart3,
  Users,
  ArrowRight,
  ExternalLink,
  Shield,
  MessagesSquare,
  Save,
  ServerCrash,
  Lock,
  Pencil,
  Trash2,
  Hash,
  Settings,
  RefreshCw,
  Bot,
  MessageSquare,
  TrendingUp,
  Users2,
} from "lucide-react";
import { SiDiscord } from "react-icons/si";

// Analytics component for Discord platform
const DiscordAnalytics = ({ platformId }: { platformId: number }) => {
  const { data: analytics, isLoading } = useQuery({
    queryKey: [`/api/platforms/${platformId}/analytics`],
    enabled: !!platformId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <BarChart3 className="mx-auto h-8 w-8 text-muted-foreground animate-spin" />
          <p className="mt-2 text-sm text-muted-foreground">Loading analytics...</p>
        </div>
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Moderation Activity</CardTitle>
            <CardDescription>Content filtering and moderation stats</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Shield className="h-4 w-4 text-red-500 mr-2" />
                  <span className="text-sm">Content Filtered</span>
                </div>
                <span className="font-semibold">{analytics.moderationActions?.contentFiltered || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Shield className="h-4 w-4 text-orange-500 mr-2" />
                  <span className="text-sm">Warnings Issued</span>
                </div>
                <span className="font-semibold">{analytics.moderationActions?.warningsIssued || 0}</span>
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
  // Add state for settings
  const [automaticWarnings, setAutomaticWarnings] = useState(true);
  const [logModerationActions, setLogModerationActions] = useState(true);
  const [moderationLogChannel, setModerationLogChannel] = useState("mod-logs");
  
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

  // Fetch platform data
  const { data: platform, isLoading } = useQuery<DiscordPlatform>({
    queryKey: ['/api/platforms/10'], // Discord platform has ID 10
    retry: false,
  });

  const discordPlatformId = 10; // Discord platform ID

  // Get chat configurations for this platform
  const { data: chatConfigurations = [] } = useQuery({
    queryKey: [`/api/platforms/${discordPlatformId}/chat-configurations`],
    enabled: !!platform && platform.status === "active",
  });



  // Get knowledge bases
  const { data: knowledgeBases = [] } = useQuery({
    queryKey: ["/api/knowledge-bases"],
    enabled: !!user,
  });

  // Start Discord bot setup
  const startSetupMutation = useMutation({
    mutationFn: async () => {
      // Add console logs to debug the Discord client ID
      console.log("Discord Client ID:", import.meta.env.VITE_DISCORD_CLIENT_ID);
      
      return apiRequest("PATCH", `/api/platforms/10`, {
        name: "Discord Bot",
        status: "setup_required",
        config: {
          setupStarted: true,
          serverId: "",
          permissions: "8"
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/10'] });
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
      return apiRequest("PATCH", `/api/platforms/10`, {
        name: "Discord Bot",
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
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/10'] });
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
      return apiRequest("PATCH", `/api/platforms/10`, {
        status: "not_connected",
        authToken: null
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/10'] });
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
      return apiRequest("PATCH", `/api/platforms/10`, {
        config: {
          ...platform?.config,
          lastRefreshed: new Date().toISOString()
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/10'] });
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
      return apiRequest("PATCH", `/api/platforms/10`, {
        config: {
          ...platform?.config,
          channels: updatedChannels
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/10'] });
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

  // Update bot configuration
  const updateBotConfigMutation = useMutation({
    mutationFn: async (config: any) => {
      return apiRequest("PATCH", `/api/platforms/10`, {
        config: {
          ...platform?.config,
          ...config
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/10'] });
      toast({
        title: "Success",
        description: "Bot settings updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update bot settings. Please try again.",
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
    
    // Initialize settings from platform config when it loads
    if (platform?.config) {
      // Moderation settings
      setAutomaticWarnings(platform.config.automaticWarnings ?? true);
      setLogModerationActions(platform.config.logModerationActions ?? true);
      setModerationLogChannel(platform.config.moderationLogChannel ?? "mod-logs");
    }
  }, [platform]);

  // Use channels from the updatedChannels state or fallback to demo channels
  const discordChannels = updatedChannels.length > 0 ? updatedChannels : platform?.config?.channels || [
    { id: "1", name: "general", type: "text", moderationEnabled: true, active: true },
    { id: "2", name: "help", type: "text", moderationEnabled: true, active: true }
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>

          <p className="text-muted-foreground">Connect your AI assistant to Discord servers and channels</p>
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
        <TabsList className="mb-6">
          <TabsTrigger value="setup">
            <MessageSquareMore className="h-4 w-4 mr-2" />
            Setup
          </TabsTrigger>
          <TabsTrigger value="channels" disabled={platform?.status !== "active"}>
            <Hash className="h-4 w-4 mr-2" />
            Servers
          </TabsTrigger>
          <TabsTrigger value="settings" disabled={platform?.status !== "active"}>
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="analytics" disabled={platform?.status !== "active"}>
            <BarChart3 className="h-4 w-4 mr-2" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="setup" className="m-0">
          <Card>
            <CardHeader>
              <CardTitle>Discord Bot Setup</CardTitle>
              <CardDescription>
                Connect your AI assistant to Discord servers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
                Manage individual settings for each Discord server and channel where your bot is active
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DiscordServerList
                chatConfigurations={chatConfigurations as any[]}
                knowledgeBases={knowledgeBases as any[]}
                platformId={discordPlatformId}
                channels={platform?.config?.channels || []}
              />
            </CardContent>
            <CardFooter className="flex justify-end">
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
                        description: `${result.message || 'Generated chat configurations successfully'}`
                      });
                      queryClient.invalidateQueries({ queryKey: [`/api/platforms/${discordPlatformId}/chat-configurations`] });
                    } else {
                      throw new Error('Failed to generate configurations');
                    }
                  } catch (error) {
                    toast({
                      title: "Error",
                      description: "Failed to generate server configurations. Please try again.",
                      variant: "destructive"
                    });
                  }
                }}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Servers
              </Button>
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
              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Moderation Settings</h3>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Automatic Warnings</Label>
                    <p className="text-sm text-muted-foreground">
                      Warn users who violate rules
                    </p>
                  </div>
                  <Switch 
                    checked={automaticWarnings} 
                    onCheckedChange={setAutomaticWarnings}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Log Moderation Actions</Label>
                    <p className="text-sm text-muted-foreground">
                      Keep a record of all moderation
                    </p>
                  </div>
                  <Switch 
                    checked={logModerationActions} 
                    onCheckedChange={setLogModerationActions}
                  />
                </div>
                
                <div className="mt-4">
                  <Label htmlFor="logChannel">Moderation Log Channel</Label>
                  <Select 
                    value={moderationLogChannel}
                    onValueChange={setModerationLogChannel}
                  >
                    <SelectTrigger className="w-full mt-1">
                      <SelectValue placeholder="Select channel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mod-logs">mod-logs</SelectItem>
                      <SelectItem value="bot-commands">bot-commands</SelectItem>
                      <SelectItem value="admin">admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground mt-1">
                    Channel where moderation actions are logged
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                className="ml-auto" 
                onClick={() => {
                  // Save all settings to the database
                  updateBotConfigMutation.mutate({
                    // Moderation settings
                    automaticWarnings,
                    logModerationActions,
                    moderationLogChannel
                  });
                }}
              >
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </Button>
            </CardFooter>
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
