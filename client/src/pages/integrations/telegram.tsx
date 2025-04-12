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
} from "lucide-react";

const TelegramIntegration = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("setup");
  const [isConnectingBot, setIsConnectingBot] = useState(false);
  const [token, setToken] = useState("");
  const [isTokenDialogOpen, setIsTokenDialogOpen] = useState(false);
  const [isDisconnectDialogOpen, setIsDisconnectDialogOpen] = useState(false);

  // Fetch platform data
  const { data: platform, isLoading } = useQuery({
    queryKey: ['/api/platforms/2'], // Assuming Telegram platform has ID 2
    retry: false,
  });

  // Connect Telegram bot
  const connectBotMutation = useMutation({
    mutationFn: async (token: string) => {
      return apiRequest("PATCH", `/api/platforms/2`, {
        name: "Telegram Bot",
        authToken: token,
        status: "active",
        config: {
          welcomeMessage: "Hello! I'm your AI assistant. How can I help you today?",
          groupMode: true,
          botCommands: [
            { command: "help", description: "Show help information" },
            { command: "about", description: "About this bot" }
          ]
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/2'] });
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
      return apiRequest("PATCH", `/api/platforms/2`, {
        status: "not_connected",
        authToken: null
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/2'] });
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
      return apiRequest("PATCH", `/api/platforms/2`, {
        config
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/2'] });
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

  const handleConnectBot = () => {
    if (!token.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid bot token",
        variant: "destructive",
      });
      return;
    }
    
    connectBotMutation.mutate(token);
  };

  const handleDisconnectBot = () => {
    disconnectBotMutation.mutate();
  };

  const updateBotConfig = (config: any) => {
    updateBotConfigMutation.mutate({
      ...platform?.config,
      ...config
    });
  };

  // Mock groups and channels for the demo
  const telegramGroups = [
    { id: 1, name: "Product Support", members: 245, status: "active", lastActive: "2 hours ago" },
    { id: 2, name: "Community Chat", members: 1203, status: "active", lastActive: "5 minutes ago" },
    { id: 3, name: "Announcement Channel", members: 587, status: "pending", lastActive: "1 day ago" }
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Telegram Integration</h1>
          <p className="text-muted-foreground">Connect your AI assistant to Telegram groups and chats</p>
        </div>
        <Badge 
          variant={
            platform?.status === "active" 
              ? "success" 
              : platform?.status === "not_connected" 
                ? "outline" 
                : "secondary"
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
            <Bot className="h-4 w-4 mr-2" />
            Setup
          </TabsTrigger>
          <TabsTrigger value="groups" disabled={platform?.status !== "active"}>
            <Users className="h-4 w-4 mr-2" />
            Groups
          </TabsTrigger>
          <TabsTrigger value="settings" disabled={platform?.status !== "active"}>
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="analytics" disabled={platform?.status !== "active"}>
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
              ) : platform?.status === "active" ? (
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
                          <span className="text-sm font-medium">ModerateAI Assistant</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Username:</span>
                          <span className="text-sm font-medium">@ModerateAI_Bot</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Status:</span>
                          <Badge variant="success">Active</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Groups:</span>
                          <span className="text-sm font-medium">{telegramGroups.length}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-medium mb-3">Use Your Bot</h3>
                      <p className="text-sm text-gray-600 mb-4">
                        To use your bot, share the following link with users or add your bot to groups:
                      </p>
                      <div className="flex space-x-2">
                        <Input 
                          value="https://t.me/ModerateAI_Bot" 
                          readOnly 
                          className="bg-gray-50"
                        />
                        <Button variant="outline" onClick={() => {
                          navigator.clipboard.writeText("https://t.me/ModerateAI_Bot");
                          toast({
                            title: "Link copied",
                            description: "Bot link copied to clipboard",
                          });
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
                          <p className="text-sm text-gray-700">
                            <span className="font-medium">Add your bot to groups</span> - Invite @ModerateAI_Bot to your Telegram groups
                          </p>
                        </div>
                      </div>
                      <div className="flex">
                        <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mr-3 flex-shrink-0">
                          2
                        </div>
                        <div>
                          <p className="text-sm text-gray-700">
                            <span className="font-medium">Make the bot an admin</span> - Grant admin privileges for full functionality
                          </p>
                        </div>
                      </div>
                      <div className="flex">
                        <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mr-3 flex-shrink-0">
                          3
                        </div>
                        <div>
                          <p className="text-sm text-gray-700">
                            <span className="font-medium">Configure responses</span> - Customize how your bot responds in the Settings tab
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="rounded-lg bg-gray-50 p-4 border">
                    <h3 className="text-lg font-medium mb-3">Create a Telegram Bot</h3>
                    <div className="space-y-4">
                      <div className="flex">
                        <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mr-3 flex-shrink-0">
                          1
                        </div>
                        <div>
                          <p className="text-sm text-gray-700">
                            <span className="font-medium">Open Telegram</span> and search for the "BotFather" (@BotFather)
                          </p>
                        </div>
                      </div>
                      <div className="flex">
                        <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mr-3 flex-shrink-0">
                          2
                        </div>
                        <div>
                          <p className="text-sm text-gray-700">
                            <span className="font-medium">Start a chat with BotFather</span> and send the command <code>/newbot</code>
                          </p>
                        </div>
                      </div>
                      <div className="flex">
                        <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mr-3 flex-shrink-0">
                          3
                        </div>
                        <div>
                          <p className="text-sm text-gray-700">
                            <span className="font-medium">Follow the instructions</span> to create your bot (name and username)
                          </p>
                        </div>
                      </div>
                      <div className="flex">
                        <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mr-3 flex-shrink-0">
                          4
                        </div>
                        <div>
                          <p className="text-sm text-gray-700">
                            <span className="font-medium">Copy the API token</span> that BotFather provides
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg bg-gray-50 p-4 border">
                    <h3 className="text-lg font-medium mb-3">Connect Your Bot</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Paste the API token from BotFather to connect your Telegram bot to ModerateAI:
                    </p>
                    <Button onClick={() => setIsTokenDialogOpen(true)}>
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
              <CardTitle>Telegram Groups</CardTitle>
              <CardDescription>
                Manage groups where your bot is active
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Group Name</TableHead>
                      <TableHead>Members</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Active</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {telegramGroups.map(group => (
                      <TableRow key={group.id}>
                        <TableCell className="font-medium">{group.name}</TableCell>
                        <TableCell>{group.members}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={group.status === "active" ? "success" : "outline"}
                            className="capitalize"
                          >
                            {group.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-gray-500">{group.lastActive}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">
                            Settings
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-500">
                            Leave
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
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Groups
              </Button>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add New Group
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
              <div className="space-y-3">
                <Label htmlFor="welcomeMessage">Welcome Message</Label>
                <Textarea
                  id="welcomeMessage"
                  placeholder="Hello! I'm your AI assistant. How can I help you today?"
                  value={platform?.config?.welcomeMessage || ""}
                  onChange={(e) => updateBotConfig({ welcomeMessage: e.target.value })}
                  rows={3}
                />
                <p className="text-sm text-gray-500">
                  This message is sent when someone starts a conversation with your bot
                </p>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Response Settings</h3>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Group Mode</Label>
                    <p className="text-sm text-gray-500">
                      Respond to messages in group chats
                    </p>
                  </div>
                  <Switch 
                    checked={platform?.config?.groupMode || false}
                    onCheckedChange={(checked) => updateBotConfig({ groupMode: checked })}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Private Chat Mode</Label>
                    <p className="text-sm text-gray-500">
                      Respond to direct messages
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Mention Only</Label>
                    <p className="text-sm text-gray-500">
                      Only respond when mentioned in groups
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Commands</h3>
                <p className="text-sm text-gray-500">
                  Configure the commands your bot responds to in Telegram
                </p>
                
                <div className="space-y-2">
                  {(platform?.config?.botCommands || [
                    { command: "help", description: "Show help information" },
                    { command: "about", description: "About this bot" }
                  ]).map((cmd, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <code className="bg-gray-100 px-2 py-1 rounded text-sm">/
                        {cmd.command}
                      </code>
                      <span className="text-sm text-gray-500">-</span>
                      <span className="text-sm">{cmd.description}</span>
                    </div>
                  ))}
                </div>
                
                <Button variant="outline" size="sm">
                  <Plus className="mr-2 h-3 w-3" />
                  Add Command
                </Button>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Moderation</h3>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Content Filtering</Label>
                    <p className="text-sm text-gray-500">
                      Moderate inappropriate content
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Spam Protection</Label>
                    <p className="text-sm text-gray-500">
                      Detect and filter spam messages
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button className="ml-auto" onClick={() => {
                toast({
                  title: "Settings saved",
                  description: "Your bot settings have been updated"
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
                View performance metrics for your Telegram bot
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <PieChart className="mx-auto h-12 w-12 text-gray-300" />
                  <h3 className="mt-4 text-lg font-medium">Analytics Coming Soon</h3>
                  <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">
                    We're building detailed analytics for your Telegram bot.
                    Check back soon to see conversation metrics, response times, and usage statistics.
                  </p>
                </div>
              </div>
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
              <p className="text-sm text-gray-500 flex items-center">
                <Lock className="h-3 w-3 mr-1" />
                Your token is securely stored and encrypted
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTokenDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConnectBot} disabled={connectBotMutation.isPending}>
              {connectBotMutation.isPending ? (
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

export default TelegramIntegration;
