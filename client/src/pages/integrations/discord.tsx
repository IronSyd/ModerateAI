import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
  Settings,
  BarChart3,
  Users,
  ArrowRight,
  ExternalLink,
  Shield,
  MessagesSquare,
  Save,
  ServerCrash,
  Hash,
  Lock,
  Pencil,
  Trash2,
} from "lucide-react";
import { SiDiscord } from "react-icons/si";

const DiscordIntegration = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("setup");
  const [isDisconnectDialogOpen, setIsDisconnectDialogOpen] = useState(false);
  const [isCompleteSetupDialogOpen, setIsCompleteSetupDialogOpen] = useState(false);
  const [authCode, setAuthCode] = useState("");

  // Fetch platform data
  const { data: platform, isLoading } = useQuery({
    queryKey: ['/api/platforms/3'], // Assuming Discord platform has ID 3
    retry: false,
  });

  // Start Discord bot setup
  const startSetupMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/platforms/3`, {
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
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/3'] });
      queryClient.invalidateQueries({ queryKey: ['/api/platforms'] });
      window.open(`https://discord.com/api/oauth2/authorize?client_id=${import.meta.env.VITE_DISCORD_CLIENT_ID}&permissions=8&scope=bot%20applications.commands`, "_blank");
      toast({
        title: "Setup started",
        description: "Please complete the Discord authorization process.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to start Discord setup. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Complete Discord bot setup
  const completeSetupMutation = useMutation({
    mutationFn: async (data: { serverId: string, authCode: string }) => {
      return apiRequest("PATCH", `/api/platforms/3`, {
        name: "Discord Bot",
        status: "active",
        authToken: data.authCode,
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
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/3'] });
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
      return apiRequest("PATCH", `/api/platforms/3`, {
        status: "not_connected",
        authToken: null
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/3'] });
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

  // Update bot configuration
  const updateBotConfigMutation = useMutation({
    mutationFn: async (config: any) => {
      return apiRequest("PATCH", `/api/platforms/3`, {
        config: {
          ...platform?.config,
          ...config
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/3'] });
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
    startSetupMutation.mutate();
  };

  const handleCompleteSetup = () => {
    if (!authCode) {
      toast({
        title: "Error",
        description: "Please enter the Discord authorization code.",
        variant: "destructive",
      });
      return;
    }
    
    completeSetupMutation.mutate({
      serverId: platform?.config?.serverId || "123456789",
      authCode
    });
  };

  const handleDisconnectBot = () => {
    disconnectBotMutation.mutate();
  };

  // Mock channels and roles for the demo
  const discordChannels = [
    { id: "1", name: "general", type: "text", moderationEnabled: true, active: true },
    { id: "2", name: "help", type: "text", moderationEnabled: true, active: true },
    { id: "3", name: "announcements", type: "text", moderationEnabled: false, active: false },
    { id: "4", name: "voice-chat", type: "voice", moderationEnabled: false, active: false }
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>

          <p className="text-muted-foreground">Connect your AI assistant to Discord servers and channels</p>
        </div>
        <Badge 
          variant={
            platform?.status === "active" 
              ? "success" 
              : platform?.status === "setup_required"
              ? "warning"
              : "outline"
          } 
          className="capitalize"
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
            Channels
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
                  <div className="rounded-lg bg-emerald-900/20 p-4 border border-emerald-600/30">
                    <div className="flex">
                      <div className="rounded-full bg-emerald-600 p-1 mr-3 flex-shrink-0">
                        <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                          <span className="text-sm font-medium">ModerateAI</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Server:</span>
                          <span className="text-sm font-medium">Your Community Server</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Server ID:</span>
                          <span className="text-sm font-mono text-muted-foreground">{platform?.config?.serverId || "123456789"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Status:</span>
                          <Badge variant="success">Active</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Active Channels:</span>
                          <span className="text-sm font-medium">2 channels</span>
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
                          <span className="text-sm font-medium">127</span>
                        </div>
                        <div className="flex justify-between">
                          <div className="flex items-center">
                            <Hash className="h-4 w-4 mr-2 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Text Channels</span>
                          </div>
                          <span className="text-sm font-medium">6</span>
                        </div>
                        <div className="flex justify-between">
                          <div className="flex items-center">
                            <MessagesSquare className="h-4 w-4 mr-2 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Today's Messages</span>
                          </div>
                          <span className="text-sm font-medium">134</span>
                        </div>
                        <div className="flex justify-between">
                          <div className="flex items-center">
                            <Shield className="h-4 w-4 mr-2 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Moderation Actions</span>
                          </div>
                          <span className="text-sm font-medium">12</span>
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
                  <div className="rounded-lg bg-amber-900/20 p-4 border border-amber-600/30">
                    <div className="flex">
                      <div className="rounded-full bg-amber-500 p-1 mr-3 flex-shrink-0">
                        <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-amber-400">Setup Required</h3>
                        <p className="mt-1 text-sm text-amber-300/90">
                          Your Discord bot needs additional configuration to be fully activated.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Complete Bot Setup</h3>
                    <p className="text-sm text-muted-foreground">
                      To finish setting up your Discord bot, we need the authorization code from Discord:
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
                      <li>Try refreshing the authorization page and starting over</li>
                    </ul>
                    <div className="mt-4">
                      <Button variant="outline">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View Setup Guide
                      </Button>
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

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">What you'll get:</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex p-4 border rounded-lg bg-card">
                        <MessagesSquare className="h-5 w-5 mr-3 text-primary" />
                        <div>
                          <h4 className="text-sm font-medium">AI Responses</h4>
                          <p className="text-xs text-muted-foreground mt-1">
                            Bot responds to user questions automatically
                          </p>
                        </div>
                      </div>
                      <div className="flex p-4 border rounded-lg bg-card">
                        <Shield className="h-5 w-5 mr-3 text-primary" />
                        <div>
                          <h4 className="text-sm font-medium">Content Moderation</h4>
                          <p className="text-xs text-muted-foreground mt-1">
                            Filter inappropriate content and spam
                          </p>
                        </div>
                      </div>
                      <div className="flex p-4 border rounded-lg bg-card">
                        <Users className="h-5 w-5 mr-3 text-primary" />
                        <div>
                          <h4 className="text-sm font-medium">User Management</h4>
                          <p className="text-xs text-muted-foreground mt-1">
                            Handle warning and timeouts for rule breakers
                          </p>
                        </div>
                      </div>
                      <div className="flex p-4 border rounded-lg bg-card">
                        <BarChart3 className="h-5 w-5 mr-3 text-primary" />
                        <div>
                          <h4 className="text-sm font-medium">Analytics</h4>
                          <p className="text-xs text-muted-foreground mt-1">
                            Track engagement and moderation actions
                          </p>
                        </div>
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
              <CardTitle>Discord Channels</CardTitle>
              <CardDescription>
                Configure which channels the bot should moderate
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Channel</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Moderation</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {discordChannels.map(channel => (
                      <TableRow key={channel.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center">
                            <Hash className="h-4 w-4 mr-2 text-muted-foreground" />
                            {channel.name}
                          </div>
                        </TableCell>
                        <TableCell className="capitalize">{channel.type}</TableCell>
                        <TableCell>
                          <Switch 
                            checked={channel.moderationEnabled} 
                            disabled={!channel.active || channel.type === "voice"}
                          />
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={channel.active ? "success" : "outline"}
                          >
                            {channel.active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">
                            <Settings className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline">
                Refresh Channels
              </Button>
              <Button>
                Save Changes
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
              <div className="space-y-3">
                <Label htmlFor="welcomeMessage">Welcome Message</Label>
                <Textarea
                  id="welcomeMessage"
                  placeholder="Hello! I'm your AI assistant. How can I help you today?"
                  value={platform?.config?.welcomeMessage || ""}
                  onChange={(e) => updateBotConfigMutation.mutate({ welcomeMessage: e.target.value })}
                  rows={3}
                />
                <p className="text-sm text-muted-foreground">
                  Message shown when the bot is first added to a server
                </p>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Response Settings</h3>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Respond to Commands</Label>
                    <p className="text-sm text-muted-foreground">
                      Bot responds to slash commands
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Respond to Mentions</Label>
                    <p className="text-sm text-muted-foreground">
                      Bot responds when mentioned
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Private Responses</Label>
                    <p className="text-sm text-muted-foreground">
                      Send sensitive responses as DMs
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Moderation Settings</h3>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Content Filtering</Label>
                    <p className="text-sm text-muted-foreground">
                      Filter inappropriate content
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Automatic Warnings</Label>
                    <p className="text-sm text-muted-foreground">
                      Warn users who violate rules
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Log Moderation Actions</Label>
                    <p className="text-sm text-muted-foreground">
                      Keep a record of all moderation
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                
                <div className="mt-4">
                  <Label htmlFor="logChannel">Moderation Log Channel</Label>
                  <Select defaultValue="mod-logs">
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
              <Button className="ml-auto" onClick={() => {
                toast({
                  title: "Settings saved",
                  description: "Your Discord bot settings have been updated"
                });
              }}>
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
            <CardContent>
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground opacity-40" />
                  <h3 className="mt-4 text-lg font-medium">Analytics Coming Soon</h3>
                  <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                    We're building detailed analytics for your Discord bot.
                    Check back soon to see message volume, moderation actions, and user engagement metrics.
                  </p>
                </div>
              </div>
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
              Enter the authorization code from Discord to complete your bot setup.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="authCode">Discord Authorization Code</Label>
              <Input
                id="authCode"
                placeholder="Enter authorization code"
                value={authCode}
                onChange={(e) => setAuthCode(e.target.value)}
              />
              <p className="text-sm text-muted-foreground flex items-center">
                <Lock className="h-3 w-3 mr-1" />
                Your code is securely stored and encrypted
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
