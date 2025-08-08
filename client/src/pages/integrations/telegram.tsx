import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { AuthDialog } from "@/components/auth-dialog";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Loader2,
  Send,
  Bot,
  Settings,
  PieChart,
  Plus,
  RefreshCw,
  Lock,
  Check,
  XCircle,
  Clock,
  Users,
  MessageSquare,
  Info,
  Save,
  Trash2,
  BarChart3,
  TrendingUp,
  Users2,
  Shield,
} from "lucide-react";
import { ChatConfigurationList } from "@/components/telegram/ChatConfigurationList";

// Analytics component for Telegram platform
const TelegramAnalytics = ({ platformId }: { platformId: number }) => {
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
          <p className="text-2xl font-bold text-blue-900 mt-2">{analytics.totalMessages}</p>
        </div>
        
        <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border">
          <div className="flex items-center">
            <Bot className="h-5 w-5 text-green-600" />
            <span className="ml-2 text-sm font-medium text-green-800">AI Responses</span>
          </div>
          <p className="text-2xl font-bold text-green-900 mt-2">{analytics.aiResponses}</p>
        </div>
        
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border">
          <div className="flex items-center">
            <Users2 className="h-5 w-5 text-purple-600" />
            <span className="ml-2 text-sm font-medium text-purple-800">Conversations</span>
          </div>
          <p className="text-2xl font-bold text-purple-900 mt-2">{analytics.conversations}</p>
        </div>
        
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-lg border">
          <div className="flex items-center">
            <TrendingUp className="h-5 w-5 text-orange-600" />
            <span className="ml-2 text-sm font-medium text-orange-800">Response Rate</span>
          </div>
          <p className="text-2xl font-bold text-orange-900 mt-2">{analytics.responseRate}%</p>
        </div>
      </div>

      {/* Chat Types */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Chat Types</CardTitle>
            <CardDescription>Distribution of private vs group conversations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                  <span className="text-sm">Private Chats</span>
                </div>
                <span className="font-semibold">{analytics.chatTypes.private}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                  <span className="text-sm">Group Chats</span>
                </div>
                <span className="font-semibold">{analytics.chatTypes.group}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Moderation Activity</CardTitle>
            <CardDescription>Content filtering and spam protection stats</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Shield className="h-4 w-4 text-red-500 mr-2" />
                  <span className="text-sm">Content Filtered</span>
                </div>
                <span className="font-semibold">{analytics.moderationActions.contentFiltered}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Shield className="h-4 w-4 text-orange-500 mr-2" />
                  <span className="text-sm">Spam Blocked</span>
                </div>
                <span className="font-semibold">{analytics.moderationActions.spamBlocked}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Message Activity (Last 7 Days)</CardTitle>
          <CardDescription>Daily message volume</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-end justify-between space-x-2">
            {analytics.messagesByDay.map((day: any, index: number) => {
              const maxMessages = Math.max(...analytics.messagesByDay.map((d: any) => d.messages));
              const height = maxMessages > 0 ? (day.messages / maxMessages) * 100 : 0;
              const date = new Date(day.date);
              const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
              
              return (
                <div key={index} className="flex-1 flex flex-col items-center">
                  <div className="w-full flex flex-col items-center mb-2">
                    <div 
                      className="w-full bg-blue-500 rounded-t-sm transition-all duration-300 hover:bg-blue-600" 
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

const TelegramIntegration = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("setup");
  const [isConnectingBot, setIsConnectingBot] = useState(false);
  const [token, setToken] = useState("");
  const [isTokenDialogOpen, setIsTokenDialogOpen] = useState(false);
  const [isDisconnectDialogOpen, setIsDisconnectDialogOpen] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  
  // Bot settings state
  const [groupMode, setGroupMode] = useState(false);
  const [privateChatMode, setPrivateChatMode] = useState(true);
  const [mentionOnly, setMentionOnly] = useState(true);
  const [contentFilteringEnabled, setContentFilteringEnabled] = useState(true);
  const [spamProtectionEnabled, setSpamProtectionEnabled] = useState(true);

  // Fetch all platforms first to find the Telegram platform
  const { data: platforms, isLoading: platformsLoading } = useQuery({
    queryKey: ['/api/platforms'],
    retry: false,
    enabled: !!user, // Only fetch if user is logged in
  });

  // Find the Telegram platform from the list
  const telegramPlatform = Array.isArray(platforms) 
    ? platforms.find(p => p.type === 'telegram') 
    : null;
  
  const telegramPlatformId = telegramPlatform?.id || 0;
  
  // Fetch specific platform data
  const { data: platform, isLoading } = useQuery({
    queryKey: [`/api/platforms/${telegramPlatformId}`],
    retry: false,
    enabled: !!user && !!telegramPlatformId, // Only fetch if user is logged in and we have the ID
  });

  // Get chat configurations for this platform
  const { data: chatConfigurations = [] } = useQuery({
    queryKey: [`/api/platforms/${telegramPlatformId}/chat-configurations`],
    enabled: !!telegramPlatformId && platform?.status === "active",
  });



  // Get knowledge bases
  const { data: knowledgeBases = [] } = useQuery({
    queryKey: ["/api/knowledge-bases"],
    enabled: !!user,
  });

  // Sync local state with platform data when it loads
  useEffect(() => {
    console.log('=== PLATFORM DEBUG ===');
    console.log('Platform object:', platform);
    console.log('Platform config:', platform?.config);
    console.log('Bot name from config:', platform?.config?.botName);
    console.log('Bot username from config:', platform?.config?.botUsername);
    console.log('=== END DEBUG ===');
    
    if (platform && platform.config) {
      const config = platform.config as any;
      setGroupMode(config.groupMode || false);
      setPrivateChatMode(config.privateChatMode !== false); // Default to true
      setMentionOnly(config.mentionOnly !== false); // Default to true
      setContentFilteringEnabled(config.contentFilteringEnabled !== false); // Default to true
      setSpamProtectionEnabled(config.spamProtectionEnabled !== false); // Default to true
    }
  }, [platform]);

  // Connect Telegram bot
  const connectBotMutation = useMutation({
    mutationFn: async (token: string) => {
      return apiRequest("PATCH", `/api/platforms/${telegramPlatformId}`, {
        name: "Telegram Bot",
        authToken: token,
        status: "active",
        config: {
          welcomeMessage: "Hello! I'm your AI assistant. How can I help you today?",
          groupMode: true,
          privateChatMode: true,
          mentionOnly: true,
          contentFilteringEnabled: true,
          spamProtectionEnabled: true,
          botCommands: [
            { command: "help", description: "Show help information" },
            { command: "about", description: "About this bot" }
          ]
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/platforms/${telegramPlatformId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/platforms'] });
      setIsTokenDialogOpen(false);
      toast({
        title: "Success",
        description: "Telegram bot connected successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to connect Telegram bot. Please check your token and try again.",
        variant: "destructive",
      });
    },
  });

  // Disconnect Telegram bot
  const disconnectBotMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/platforms/${telegramPlatformId}`, {
        status: "not_connected",
        authToken: null
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/platforms/${telegramPlatformId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/platforms'] });
      setIsDisconnectDialogOpen(false);
      toast({
        title: "Success",
        description: "Telegram bot disconnected successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to disconnect Telegram bot. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update bot configuration
  const updateBotConfigMutation = useMutation({
    mutationFn: async (config: any) => {
      return apiRequest("PATCH", `/api/platforms/${telegramPlatformId}`, {
        config
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/platforms/${telegramPlatformId}`] });
      toast({
        title: "Success",
        description: "Bot configuration updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update bot configuration. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleConnectBot = async () => {
    if (!token.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid bot token",
        variant: "destructive",
      });
      return;
    }
    
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in before connecting your Telegram bot",
        variant: "destructive",
      });
      setIsTokenDialogOpen(false);
      setShowAuthDialog(true);
      return;
    }
    
    // If the Telegram platform wasn't found, refresh the platforms list
    if (!telegramPlatformId) {
      try {
        console.log("Telegram platform not found, refreshing platforms list");
        const response = await fetch('/api/platforms', {
          credentials: 'include'
        });
        
        if (response.ok) {
          const platforms = await response.json();
          console.log("Fetched platforms:", platforms);
          
          const telegramPlatform = platforms.find((p: any) => p.type === 'telegram');
          
          if (telegramPlatform) {
            // We found the platform after refresh
            toast({
              title: "Platform found",
              description: "Telegram platform has been initialized",
            });
            // Update local state and continue
            queryClient.invalidateQueries({ queryKey: ['/api/platforms'] });
            setTimeout(() => {
              // Give a moment for the query to refresh, then try again
              toast({
                title: "Please try again",
                description: "Please try connecting the bot again",
              });
            }, 1000);
            return;
          } else {
            // Still no platform after refresh
            toast({
              title: "Error",
              description: "Telegram platform not found. Please refresh the page or contact support.",
              variant: "destructive",
            });
            return;
          }
        }
      } catch (error) {
        console.error("Error refreshing platforms:", error);
      }
      
      toast({
        title: "Error",
        description: "Telegram platform not initialized. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }
    
    // Use direct fetch API to ensure credentials are included
    try {
      setIsConnectingBot(true);
      
      const response = await fetch(`/api/platforms/${telegramPlatformId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // This is crucial for sending cookies with the request
        body: JSON.stringify({
          name: "Telegram Bot",
          authToken: token,
          status: "active",
          config: {
            groupMode: true
          }
        })
      });
      
      // Log response details for debugging
      console.log('Connect bot response status:', response.status);
      
      if (response.ok) {
        // Success
        setIsTokenDialogOpen(false);
        queryClient.invalidateQueries({ queryKey: [`/api/platforms/${telegramPlatformId}`] });
        queryClient.invalidateQueries({ queryKey: ['/api/platforms'] });
        
        toast({
          title: "Success",
          description: "Telegram bot connected successfully!",
        });
      } else {
        // Failed, try to get error message
        let errorMessage = "Failed to connect Telegram bot. Please check your token and try again.";
        try {
          const errorData = await response.json();
          if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch (e) {
          // Use default error message if response parsing fails
        }
        
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error connecting Telegram bot:", error);
      toast({
        title: "Error",
        description: "An error occurred while connecting your Telegram bot.",
        variant: "destructive",
      });
    } finally {
      setIsConnectingBot(false);
    }
  };

  const handleDisconnectBot = async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "You need to log in to disconnect your Telegram bot",
        variant: "destructive",
      });
      setIsDisconnectDialogOpen(false);
      setShowAuthDialog(true);
      return;
    }
    
    if (!telegramPlatformId) {
      toast({
        title: "Error",
        description: "Telegram platform not initialized. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      // Use direct fetch API with credentials to ensure authentication
      const response = await fetch(`/api/platforms/${telegramPlatformId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          status: "not_connected",
          authToken: null
        })
      });
      
      console.log('Disconnect bot response status:', response.status);
      
      if (response.ok) {
        setIsDisconnectDialogOpen(false);
        queryClient.invalidateQueries({ queryKey: [`/api/platforms/${telegramPlatformId}`] });
        queryClient.invalidateQueries({ queryKey: ['/api/platforms'] });
        
        toast({
          title: "Success",
          description: "Telegram bot disconnected successfully.",
        });
      } else {
        let errorMessage = "Failed to disconnect Telegram bot.";
        try {
          const errorData = await response.json();
          if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch (e) {
          // Use default error message
        }
        
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error disconnecting Telegram bot:", error);
      toast({
        title: "Error",
        description: "An error occurred while disconnecting your Telegram bot.",
        variant: "destructive",
      });
    }
  };

  const updateBotConfig = async (configUpdate: any) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "You need to log in to update bot settings",
        variant: "destructive",
      });
      setShowAuthDialog(true);
      return;
    }
    
    if (!telegramPlatformId) {
      toast({
        title: "Error",
        description: "Telegram platform not initialized. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      console.log('Updating bot config with:', configUpdate);
      
      // Create a clean config object to avoid issues with undefined/null values
      const currentConfig = (platform as any)?.config || {};
      const newConfig = {
        ...currentConfig,
        ...configUpdate
      };
      
      console.log('Final config being sent:', newConfig);
      
      // Use direct fetch API with credentials to ensure authentication
      const response = await fetch(`/api/platforms/${telegramPlatformId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          config: newConfig
        })
      });
      
      console.log('Update bot config response status:', response.status);
      
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: [`/api/platforms/${telegramPlatformId}`] });
        
        toast({
          title: "Success",
          description: "Bot settings updated successfully.",
        });
      } else {
        let errorMessage = "Failed to update bot settings.";
        try {
          const errorData = await response.json();
          console.error('Error response:', errorData);
          if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch (e) {
          console.error('Error parsing error response:', e);
          // Use default error message
        }
        
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error updating bot settings:", error);
      toast({
        title: "Error",
        description: "An error occurred while updating bot settings.",
        variant: "destructive",
      });
    }
  };

  // Empty groups list since the bot isn't in any groups yet
  const telegramGroups: { id: number; name: string; members: number; status: string; lastActive: string }[] = [];

  // Show auth dialog if not logged in
  useEffect(() => {
    if (!user) {
      setShowAuthDialog(true);
    }
  }, [user]);
  
  // Initialize moderation settings from platform config
  useEffect(() => {
    if ((platform as any)?.config) {
      // Set content filtering
      setContentFilteringEnabled(
        (platform as any).config.contentFilteringEnabled !== undefined 
          ? (platform as any).config.contentFilteringEnabled 
          : true
      );
      
      // Set spam protection
      setSpamProtectionEnabled(
        (platform as any).config.spamProtectionEnabled !== undefined 
          ? (platform as any).config.spamProtectionEnabled 
          : true
      );
    }
  }, [platform]);
  
  // Manual login function
  const loginManually = async () => {
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: 'demo', password: 'demo123' })
      });
      
      if (response.ok) {
        const user = await response.json();
        queryClient.setQueryData(['/api/user'], user);
        
        // Invalidate all platform queries to refresh data
        queryClient.invalidateQueries({ queryKey: ['/api/platforms'] });
        
        toast({
          title: "Login successful",
          description: "You're now logged in with the demo account.",
        });
        
        // Check login status
        const checkResponse = await fetch('/api/user', {
          credentials: 'include'
        });
        console.log('Login status check:', checkResponse.status, checkResponse.ok);
        
        if (checkResponse.ok) {
          toast({
            title: "Session verified",
            description: "Your session is active and working.",
          });
        }
      } else {
        toast({
          title: "Login failed",
          description: "Unable to log in with demo account. Check server logs.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Login error:", error);
      toast({
        title: "Login error",
        description: "An error occurred during login.",
        variant: "destructive"
      });
    }
  };

  return (
    <div>
      {/* Authentication dialog */}
      <AuthDialog 
        open={showAuthDialog} 
        onOpenChange={setShowAuthDialog}
        onLoginSuccess={() => {
          // After login, query will automatically re-fetch
          toast({
            title: "Login successful",
            description: "You're now logged in and can connect your Telegram bot.",
          });
        }}
      />
      
      {/* Debug login card - this will help with session issues */}
      {!user && (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex flex-col space-y-4">
              <div className="flex items-center">
                <Info className="h-5 w-5 mr-2 text-amber-600" />
                <div>
                  <h3 className="font-medium text-amber-800">Authentication Required</h3>
                  <p className="text-sm text-amber-700">
                    You need to log in to connect your Telegram bot. Click the button below to login with the demo account.
                  </p>
                </div>
              </div>
              <Button 
                onClick={loginManually}
                className="w-full md:w-auto"
              >
                Login with Demo Account
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-muted-foreground">Connect your AI assistant to Telegram groups and chats</p>
        </div>
        <Badge 
          variant={
            (platform as any)?.status === "active" 
              ? "secondary" 
              : (platform as any)?.status === "not_connected" 
                ? "outline" 
                : "secondary"
          } 
          className="capitalize"
        >
          {(platform as any)?.status === "active" 
            ? "Active" 
            : (platform as any)?.status?.replace("_", " ")}
        </Badge>
      </div>

      <Tabs defaultValue="setup" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="setup">
            <Bot className="h-4 w-4 mr-2" />
            Setup
          </TabsTrigger>
          <TabsTrigger value="groups" disabled={!(platform as any) || (platform as any)?.status === "setup_required"}>
            <Users className="h-4 w-4 mr-2" />
            Groups
          </TabsTrigger>
          <TabsTrigger value="settings" disabled={!(platform as any) || (platform as any)?.status === "setup_required"}>
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="analytics" disabled={!(platform as any) || (platform as any)?.status === "setup_required"}>
            <PieChart className="h-4 w-4 mr-2" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="setup" className="m-0">
          <Card>
            <CardHeader>
              <CardTitle>Connect Telegram Bot</CardTitle>
              <CardDescription>
                Follow these steps to connect your AI assistant to Telegram
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (platform as any)?.status === "active" ? (
                <div className="space-y-6">
                  <div className="rounded-lg bg-accent p-4 border">
                    <div className="flex">
                      <Check className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
                      <div>
                        <h3 className="text-sm font-medium text-primary">Connected Successfully</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Your Telegram bot is active and ready to respond to messages.
                        </p>
                        <div className="mt-3">
                          <Button 
                            variant="outline" 
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setIsDisconnectDialogOpen(true)}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
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
                          <span className="text-sm text-muted-foreground">Username:</span>
                          <span className="text-sm font-medium">@{platform?.config?.botUsername || 'Loading...'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Status:</span>
                          <Badge variant="secondary">Active</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Groups:</span>
                          <span className="text-sm font-medium">{telegramGroups.length}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-medium mb-3">Use Your Bot</h3>
                      <p className="text-sm text-foreground mb-4">
                        To use your bot, share the following link with users or add your bot to groups:
                      </p>
                      <div className="flex space-x-2">
                        <Input 
                          value={platform?.config?.botUsername ? `https://t.me/${platform.config.botUsername}` : 'Loading...'} 
                          readOnly 
                          className="bg-card"
                        />
                        <Button variant="outline" onClick={() => {
                          const botLink = platform?.config?.botUsername ? `https://t.me/${platform.config.botUsername}` : '';
                          if (botLink) {
                            navigator.clipboard.writeText(botLink);
                            toast({
                              title: "Link copied",
                              description: "Bot link copied to clipboard",
                            });
                          }
                        }}>
                          Copy
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border p-4">
                    <h3 className="text-lg font-medium mb-3">Next Steps</h3>
                    <div className="space-y-4">
                      <div className="flex">
                        <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mr-3 flex-shrink-0">
                          1
                        </div>
                        <div>
                          <p className="text-sm text-foreground">
                            <span className="font-medium">Add your bot to groups</span> - Invite @{platform?.config?.botUsername || 'your_bot'} to your Telegram groups
                          </p>
                        </div>
                      </div>
                      <div className="flex">
                        <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mr-3 flex-shrink-0">
                          2
                        </div>
                        <div>
                          <p className="text-sm text-foreground">
                            <span className="font-medium">Make the bot an admin</span> - Grant admin privileges for full functionality
                          </p>
                        </div>
                      </div>
                      <div className="flex">
                        <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mr-3 flex-shrink-0">
                          3
                        </div>
                        <div>
                          <p className="text-sm text-foreground">
                            <span className="font-medium">Configure responses</span> - Customize how your bot responds in the Settings tab
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="rounded-lg bg-card p-4 border">
                    <h3 className="text-lg font-medium mb-3">Create a Telegram Bot</h3>
                    <div className="space-y-4">
                      <div className="flex">
                        <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mr-3 flex-shrink-0">
                          1
                        </div>
                        <div>
                          <p className="text-sm text-foreground">
                            <span className="font-medium">Open Telegram</span> and search for the "BotFather" (@BotFather)
                          </p>
                        </div>
                      </div>
                      <div className="flex">
                        <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mr-3 flex-shrink-0">
                          2
                        </div>
                        <div>
                          <p className="text-sm text-foreground">
                            <span className="font-medium">Start a chat with BotFather</span> and send the command <code>/newbot</code>
                          </p>
                        </div>
                      </div>
                      <div className="flex">
                        <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mr-3 flex-shrink-0">
                          3
                        </div>
                        <div>
                          <p className="text-sm text-foreground">
                            <span className="font-medium">Follow the instructions</span> to create your bot (name and username)
                          </p>
                        </div>
                      </div>
                      <div className="flex">
                        <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mr-3 flex-shrink-0">
                          4
                        </div>
                        <div>
                          <p className="text-sm text-foreground">
                            <span className="font-medium">Copy the API token</span> that BotFather provides
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg bg-card p-4 border">
                    <h3 className="text-lg font-medium mb-3">Connect Your Bot</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Paste the API token from BotFather to connect your Telegram bot to ModerateAI:
                    </p>
                    <Button 
                      onClick={() => {
                        if (!user) {
                          toast({
                            title: "Login Required",
                            description: "You need to log in before connecting a Telegram bot",
                            variant: "destructive"
                          });
                          setShowAuthDialog(true);
                        } else {
                          setIsTokenDialogOpen(true);
                        }
                      }}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Connect Telegram Bot
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="groups" className="m-0">
          <Card>
            <CardHeader>
              <CardTitle>Chat Configurations</CardTitle>
              <CardDescription>
                Manage individual settings for each Telegram group and chat where your bot is active
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChatConfigurationList
                chatConfigurations={chatConfigurations}
                knowledgeBases={knowledgeBases}
                platformId={telegramPlatformId}
              />
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  toast({
                    title: "Refreshing configurations",
                    description: "Checking for new Telegram chats and groups."
                  });
                  queryClient.invalidateQueries({ queryKey: [`/api/platforms/${telegramPlatformId}/chat-configurations`] });
                }}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Chats
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="m-0">
          <Card>
            <CardHeader>
              <CardTitle>Bot Settings</CardTitle>
              <CardDescription>
                Configure how your Telegram bot behaves
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Response Settings</h3>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Group Mode</Label>
                    <p className="text-sm text-muted-foreground">
                      Respond to messages in group chats
                    </p>
                  </div>
                  <Switch 
                    checked={groupMode}
                    onCheckedChange={setGroupMode}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Private Chat Mode</Label>
                    <p className="text-sm text-muted-foreground">
                      Respond to direct messages
                    </p>
                  </div>
                  <Switch 
                    checked={privateChatMode}
                    onCheckedChange={setPrivateChatMode}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Mention Only</Label>
                    <p className="text-sm text-muted-foreground">
                      Only respond when mentioned in groups
                    </p>
                  </div>
                  <Switch 
                    checked={mentionOnly}
                    onCheckedChange={setMentionOnly}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Moderation</h3>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="content-filtering">Content Filtering</Label>
                    <p className="text-sm text-muted-foreground">
                      Moderate inappropriate content
                    </p>
                  </div>
                  <Switch 
                    id="content-filtering"
                    checked={contentFilteringEnabled} 
                    onCheckedChange={setContentFilteringEnabled}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="spam-protection">Spam Protection</Label>
                    <p className="text-sm text-muted-foreground">
                      Detect and filter spam messages
                    </p>
                  </div>
                  <Switch 
                    id="spam-protection"
                    checked={spamProtectionEnabled} 
                    onCheckedChange={setSpamProtectionEnabled}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                className="ml-auto" 
                onClick={() => {
                  // Save all bot settings
                  updateBotConfig({
                    groupMode: groupMode,
                    privateChatMode: privateChatMode,
                    mentionOnly: mentionOnly,
                    contentFilteringEnabled: contentFilteringEnabled,
                    spamProtectionEnabled: spamProtectionEnabled
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
                View performance metrics for your Telegram bot
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <TelegramAnalytics platformId={telegramPlatformId} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Connect Bot Dialog */}
      <Dialog open={isTokenDialogOpen} onOpenChange={setIsTokenDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Connect Telegram Bot</DialogTitle>
            <DialogDescription>
              Enter the API token from BotFather to connect your Telegram bot.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="token">Bot API Token</Label>
              <Input
                id="token"
                placeholder="123456789:ABCdefGhIJKlmnOPQRstUVwxYZ"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
              <p className="text-sm text-muted-foreground flex items-center">
                <Lock className="h-3 w-3 mr-1" />
                Your token is securely stored and encrypted
              </p>
              
              {!user && (
                <div className="mt-3 rounded-md bg-amber-50 p-3 border border-amber-200">
                  <div className="flex">
                    <Info className="h-5 w-5 text-amber-600 mr-2 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-medium text-amber-800">Login Required</h4>
                      <p className="text-xs text-amber-700 mt-1">
                        You need to log in before connecting your Telegram bot.
                      </p>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="mt-2"
                        onClick={() => {
                          setIsTokenDialogOpen(false);
                          setShowAuthDialog(true);
                        }}
                      >
                        Log in now
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTokenDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleConnectBot} 
              disabled={isConnectingBot || !user}
            >
              {isConnectingBot ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Connect Bot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disconnect Bot Dialog */}
      <AlertDialog open={isDisconnectDialogOpen} onOpenChange={setIsDisconnectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Telegram Bot</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to disconnect your Telegram bot? Your bot will stop responding to messages and you'll need to reconnect it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnectBot}
              className="bg-red-500 hover:bg-red-600"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Disconnect Bot
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TelegramIntegration;
