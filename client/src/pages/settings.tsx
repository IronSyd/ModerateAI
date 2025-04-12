import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
  Save,
  User,
  Bell,
  Globe,
  Lock,
  CreditCard,
  Download,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Trash2,
  FileJson,
  Languages,
  MoonStar,
  Sun,
  Plus,
} from "lucide-react";

const Settings = () => {
  const { toast } = useToast();
  const [isDeleteAccountDialogOpen, setIsDeleteAccountDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // General settings state
  const [generalSettings, setGeneralSettings] = useState({
    firstName: "Demo",
    lastName: "User",
    email: "demo@example.com",
    language: "en",
    timezone: "UTC",
    theme: "light",
  });

  // Notification settings state
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    inAppNotifications: true,
    marketingEmails: false,
    weeklyDigest: true,
    alertNotifications: true,
  });

  // API settings state
  const [apiSettings, setApiSettings] = useState({
    apiKey: "sk_demo_••••••••••••••••••••••",
    webhookUrl: "",
    enableWebhooks: false,
    enableLogging: true,
    rateLimit: "100",
  });

  // Save profile settings
  const saveProfileMutation = useMutation({
    mutationFn: async (data: typeof generalSettings) => {
      // Simulate API call
      return new Promise<void>((resolve) => setTimeout(resolve, 1000));
    },
    onSuccess: () => {
      toast({
        title: "Profile updated",
        description: "Your profile settings have been saved",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update profile settings",
        variant: "destructive",
      });
    },
  });

  // Save notification settings
  const saveNotificationsMutation = useMutation({
    mutationFn: async (data: typeof notificationSettings) => {
      // Simulate API call
      return new Promise<void>((resolve) => setTimeout(resolve, 1000));
    },
    onSuccess: () => {
      toast({
        title: "Notifications updated",
        description: "Your notification preferences have been saved",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update notification settings",
        variant: "destructive",
      });
    },
  });

  // Save API settings
  const saveApiSettingsMutation = useMutation({
    mutationFn: async (data: typeof apiSettings) => {
      // Simulate API call
      return new Promise<void>((resolve) => setTimeout(resolve, 1000));
    },
    onSuccess: () => {
      toast({
        title: "API settings updated",
        description: "Your API settings have been saved",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update API settings",
        variant: "destructive",
      });
    },
  });

  // Generate new API key
  const generateApiKeyMutation = useMutation({
    mutationFn: async () => {
      // Simulate API call
      return new Promise<{ apiKey: string }>((resolve) => 
        setTimeout(() => resolve({ apiKey: "sk_demo_" + Math.random().toString(36).substring(2, 15) }), 1000)
      );
    },
    onSuccess: (data) => {
      setApiSettings(prev => ({
        ...prev,
        apiKey: data.apiKey
      }));
      toast({
        title: "New API key generated",
        description: "Make sure to copy your new API key",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate new API key",
        variant: "destructive",
      });
    },
  });

  // Delete account
  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      // Simulate API call
      return new Promise<void>((resolve) => setTimeout(resolve, 1500));
    },
    onSuccess: () => {
      setIsDeleteAccountDialogOpen(false);
      toast({
        title: "Account deleted",
        description: "Your account has been successfully deleted",
      });
      // In a real app, we would redirect to a logout page or home page
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete account",
        variant: "destructive",
      });
    },
  });

  // Handle form submissions
  const handleSaveProfile = () => {
    saveProfileMutation.mutate(generalSettings);
  };

  const handleSaveNotifications = () => {
    saveNotificationsMutation.mutate(notificationSettings);
  };

  const handleSaveApiSettings = () => {
    saveApiSettingsMutation.mutate(apiSettings);
  };

  const handleGenerateApiKey = () => {
    generateApiKeyMutation.mutate();
  };

  const handleDeleteAccount = () => {
    deleteAccountMutation.mutate();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      </div>

      <Tabs defaultValue="account" className="space-y-6">
        <TabsList>
          <TabsTrigger value="account">
            <User className="h-4 w-4 mr-2" />
            Account
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="h-4 w-4 mr-2" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="api">
            <FileJson className="h-4 w-4 mr-2" />
            API
          </TabsTrigger>
          <TabsTrigger value="billing">
            <CreditCard className="h-4 w-4 mr-2" />
            Billing
          </TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Account Settings</CardTitle>
              <CardDescription>
                Manage your account information and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Personal Information</h3>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input 
                      id="firstName" 
                      value={generalSettings.firstName}
                      onChange={(e) => setGeneralSettings(prev => ({ ...prev, firstName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input 
                      id="lastName" 
                      value={generalSettings.lastName}
                      onChange={(e) => setGeneralSettings(prev => ({ ...prev, lastName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input 
                      id="email" 
                      type="email" 
                      value={generalSettings.email}
                      onChange={(e) => setGeneralSettings(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="flex space-x-2">
                      <Input id="password" type="password" value="••••••••" disabled />
                      <Button variant="outline">Change</Button>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Preferences</h3>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="language">Language</Label>
                    <Select 
                      value={generalSettings.language}
                      onValueChange={(value) => setGeneralSettings(prev => ({ ...prev, language: value }))}
                    >
                      <SelectTrigger id="language">
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                        <SelectItem value="fr">French</SelectItem>
                        <SelectItem value="de">German</SelectItem>
                        <SelectItem value="ja">Japanese</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Select 
                      value={generalSettings.timezone}
                      onValueChange={(value) => setGeneralSettings(prev => ({ ...prev, timezone: value }))}
                    >
                      <SelectTrigger id="timezone">
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UTC">UTC (Coordinated Universal Time)</SelectItem>
                        <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                        <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                        <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                        <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Theme</Label>
                  <div className="flex space-x-4">
                    <div 
                      className={`border rounded-md p-3 flex flex-col items-center cursor-pointer ${
                        generalSettings.theme === 'light' ? 'border-primary-500 bg-primary-50' : 'border-gray-200'
                      }`}
                      onClick={() => setGeneralSettings(prev => ({ ...prev, theme: 'light' }))}
                    >
                      <Sun className="h-6 w-6 mb-2 text-primary-500" />
                      <span className="text-sm font-medium">Light</span>
                    </div>
                    <div 
                      className={`border rounded-md p-3 flex flex-col items-center cursor-pointer ${
                        generalSettings.theme === 'dark' ? 'border-primary-500 bg-primary-50' : 'border-gray-200'
                      }`}
                      onClick={() => setGeneralSettings(prev => ({ ...prev, theme: 'dark' }))}
                    >
                      <MoonStar className="h-6 w-6 mb-2 text-primary-500" />
                      <span className="text-sm font-medium">Dark</span>
                    </div>
                    <div 
                      className={`border rounded-md p-3 flex flex-col items-center cursor-pointer ${
                        generalSettings.theme === 'system' ? 'border-primary-500 bg-primary-50' : 'border-gray-200'
                      }`}
                      onClick={() => setGeneralSettings(prev => ({ ...prev, theme: 'system' }))}
                    >
                      <Languages className="h-6 w-6 mb-2 text-primary-500" />
                      <span className="text-sm font-medium">System</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between items-center border-t px-6 py-4">
              <Button variant="outline">Cancel</Button>
              <Button onClick={handleSaveProfile} disabled={saveProfileMutation.isPending}>
                {saveProfileMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Changes
              </Button>
            </CardFooter>
          </Card>

          <Card className="border-red-900/20">
            <CardHeader>
              <CardTitle className="text-red-500">Danger Zone</CardTitle>
              <CardDescription>
                Irreversible actions that affect your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-red-900/30 bg-red-900/10 p-4">
                <div className="flex">
                  <AlertTriangle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0" />
                  <div>
                    <h3 className="text-sm font-medium text-red-400">Delete Account</h3>
                    <div className="mt-2 text-sm text-red-400/90">
                      <p>
                        Permanently delete your account and all associated data. This action cannot be undone.
                      </p>
                    </div>
                    <div className="mt-4">
                      <Button 
                        variant="outline" 
                        className="text-red-500 hover:text-red-400 hover:bg-red-950/30 border-red-900/20"
                        onClick={() => setIsDeleteAccountDialogOpen(true)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Account
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>
                Manage how and when you receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Email Notifications</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="emailNotifications">Email Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive notifications via email
                      </p>
                    </div>
                    <Switch 
                      id="emailNotifications" 
                      checked={notificationSettings.emailNotifications}
                      onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, emailNotifications: checked }))}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="marketingEmails">Marketing Emails</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive product updates and announcements
                      </p>
                    </div>
                    <Switch 
                      id="marketingEmails" 
                      checked={notificationSettings.marketingEmails}
                      onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, marketingEmails: checked }))}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="weeklyDigest">Weekly Digest</Label>
                      <p className="text-sm text-muted-foreground">
                        Weekly summary of activity and stats
                      </p>
                    </div>
                    <Switch 
                      id="weeklyDigest" 
                      checked={notificationSettings.weeklyDigest}
                      onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, weeklyDigest: checked }))}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Platform Notifications</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="inAppNotifications">In-App Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Show notifications within the app
                      </p>
                    </div>
                    <Switch 
                      id="inAppNotifications" 
                      checked={notificationSettings.inAppNotifications}
                      onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, inAppNotifications: checked }))}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="alertNotifications">Critical Alerts</Label>
                      <p className="text-sm text-muted-foreground">
                        Notifications for important moderation events
                      </p>
                    </div>
                    <Switch 
                      id="alertNotifications" 
                      checked={notificationSettings.alertNotifications}
                      onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, alertNotifications: checked }))}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between items-center border-t px-6 py-4">
              <Button variant="outline">Reset Defaults</Button>
              <Button 
                onClick={handleSaveNotifications} 
                disabled={saveNotificationsMutation.isPending}
              >
                {saveNotificationsMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Preferences
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>API Settings</CardTitle>
              <CardDescription>
                Manage your API keys and webhook configurations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">API Keys</h3>
                <div className="space-y-2">
                  <Label htmlFor="apiKey">API Key</Label>
                  <div className="flex space-x-2">
                    <Input 
                      id="apiKey" 
                      value={apiSettings.apiKey} 
                      readOnly 
                      className="font-mono text-sm"
                    />
                    <Button 
                      variant="outline"
                      onClick={handleGenerateApiKey}
                      disabled={generateApiKeyMutation.isPending}
                    >
                      {generateApiKeyMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        "Regenerate"
                      )}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Use this API key to authenticate requests to the ModerateAI API
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Webhook Configuration</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="enableWebhooks">Enable Webhooks</Label>
                    <Switch 
                      id="enableWebhooks" 
                      checked={apiSettings.enableWebhooks}
                      onCheckedChange={(checked) => setApiSettings(prev => ({ ...prev, enableWebhooks: checked }))}
                    />
                  </div>
                  
                  <div className="mt-4 space-y-2">
                    <Label htmlFor="webhookUrl">Webhook URL</Label>
                    <Input 
                      id="webhookUrl" 
                      placeholder="https://your-server.com/webhook" 
                      value={apiSettings.webhookUrl}
                      onChange={(e) => setApiSettings(prev => ({ ...prev, webhookUrl: e.target.value }))}
                      disabled={!apiSettings.enableWebhooks}
                    />
                    <p className="text-sm text-muted-foreground">
                      We'll send POST requests to this URL when events occur
                    </p>
                  </div>
                </div>

                <div className="space-y-2 mt-4">
                  <Label htmlFor="webhook-events">Webhook Events</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="event-conversation" className="rounded" defaultChecked />
                      <label htmlFor="event-conversation" className="text-sm">
                        Conversation events
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="event-moderation" className="rounded" defaultChecked />
                      <label htmlFor="event-moderation" className="text-sm">
                        Moderation actions
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="event-integration" className="rounded" defaultChecked />
                      <label htmlFor="event-integration" className="text-sm">
                        Integration changes
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="event-team" className="rounded" />
                      <label htmlFor="event-team" className="text-sm">
                        Team member changes
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-medium">API Settings</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="enableLogging">Request Logging</Label>
                      <p className="text-sm text-muted-foreground">
                        Log API requests for debugging
                      </p>
                    </div>
                    <Switch 
                      id="enableLogging" 
                      checked={apiSettings.enableLogging}
                      onCheckedChange={(checked) => setApiSettings(prev => ({ ...prev, enableLogging: checked }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="rateLimit">Rate Limit (requests per minute)</Label>
                    <Select 
                      value={apiSettings.rateLimit}
                      onValueChange={(value) => setApiSettings(prev => ({ ...prev, rateLimit: value }))}
                    >
                      <SelectTrigger id="rateLimit">
                        <SelectValue placeholder="Select rate limit" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="60">60</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                        <SelectItem value="500">500</SelectItem>
                        <SelectItem value="1000">1,000</SelectItem>
                        <SelectItem value="unlimited">Unlimited</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between items-center border-t px-6 py-4">
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Download API Docs
              </Button>
              <Button 
                onClick={handleSaveApiSettings} 
                disabled={saveApiSettingsMutation.isPending}
              >
                {saveApiSettingsMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save API Settings
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Billing Information</CardTitle>
              <CardDescription>
                Manage your subscription and payment methods
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-md border p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-base font-medium">Current Plan</h3>
                    <div className="mt-1 flex items-center">
                      <span className="text-2xl font-bold">Pro</span>
                      <Badge className="ml-2 bg-green-100 text-green-800">Active</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Billed monthly • Renews on July 12, 2023
                    </p>
                  </div>
                  <Button>
                    Upgrade Plan
                  </Button>
                </div>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  <div className="border rounded-md p-3">
                    <p className="text-sm text-muted-foreground">Monthly Price</p>
                    <p className="text-xl font-bold">$79</p>
                  </div>
                  <div className="border rounded-md p-3">
                    <p className="text-sm text-muted-foreground">Next Payment</p>
                    <p className="text-xl font-bold">Jul 12, 2023</p>
                  </div>
                  <div className="border rounded-md p-3">
                    <p className="text-sm text-muted-foreground">AI Requests</p>
                    <p className="text-xl font-bold">45,230 / 100,000</p>
                  </div>
                  <div className="border rounded-md p-3">
                    <p className="text-sm text-muted-foreground">Active Integrations</p>
                    <p className="text-xl font-bold">2 / 5</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Payment Methods</h3>
                <div className="border rounded-md divide-y">
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="h-10 w-16 bg-gray-200 rounded flex items-center justify-center mr-3">
                        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
                          <path d="M2 10H22" stroke="currentColor" strokeWidth="2" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium">•••• •••• •••• 4242</p>
                        <p className="text-sm text-muted-foreground">Expires 12/24</p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <Badge className="mr-2">Default</Badge>
                      <Button variant="ghost" size="sm">
                        Edit
                      </Button>
                    </div>
                  </div>
                  <div className="p-4 flex items-center">
                    <Button variant="outline">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Payment Method
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Billing History</h3>
                <div className="border rounded-md">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-border">
                      <thead className="bg-accent">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Date
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Description
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Amount
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Status
                          </th>
                          <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Invoice
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        <tr>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                            Jun 12, 2023
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            ModerateAI Pro Plan
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                            $79.00
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100/20 text-green-700 dark:text-green-400">
                              Paid
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <Button variant="ghost" size="sm">
                              Download
                            </Button>
                          </td>
                        </tr>
                        <tr>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                            May 12, 2023
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            ModerateAI Pro Plan
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                            $79.00
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100/20 text-green-700 dark:text-green-400">
                              Paid
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <Button variant="ghost" size="sm">
                              Download
                            </Button>
                          </td>
                        </tr>
                        <tr>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                            Apr 12, 2023
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            ModerateAI Pro Plan
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                            $79.00
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100/20 text-green-700 dark:text-green-400">
                              Paid
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <Button variant="ghost" size="sm">
                              Download
                            </Button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="justify-between items-center border-t px-6 py-4">
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Download All Invoices
              </Button>
              <Button variant="outline" className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/20 border-red-200 dark:border-red-800">
                Cancel Subscription
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Account Confirmation Dialog */}
      <AlertDialog
        open={isDeleteAccountDialogOpen}
        onOpenChange={setIsDeleteAccountDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your
              account and remove all your data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              className="bg-red-500 hover:bg-red-600 dark:bg-red-700 dark:hover:bg-red-800"
            >
              {deleteAccountMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Settings;
