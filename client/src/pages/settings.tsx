import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import { Textarea } from "@/components/ui/textarea";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Save,
  User,
  Bell,
  ShieldCheck,
  Download,
  FileDown,
  Globe,
  Lock,
  Trash2,
  LogOut,
  Loader2,
  AlertTriangle,
  Eye,
  EyeOff,
} from "lucide-react";

type WorkspaceFeatures = {
  historyDays: number | null;
  sentimentAnalysis: boolean;
  analyticsTier: "none" | "standard" | "deep";
  dataExport: boolean;
  auditLog: boolean;
};

type WorkspaceSettingsResponse = {
  moderationPreset: "basic" | "custom" | "advanced";
  moderationRules: {
    blockedKeywords: string[];
    allowedKeywords: string[];
    strictness: number;
  };
  allowedModerationPresets: Array<"basic" | "custom" | "advanced">;
  defaultModerationPreset: "basic" | "custom" | "advanced";
  features: WorkspaceFeatures;
};

function parseApiErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const raw = error.message || "";
  const colonIndex = raw.indexOf(":");
  if (colonIndex === -1) return raw || fallback;
  const payload = raw.slice(colonIndex + 1).trim();
  try {
    const parsed = JSON.parse(payload) as { message?: string };
    if (parsed?.message) return parsed.message;
  } catch {
    // ignore JSON parse errors and fallback to raw text
  }
  return payload || raw || fallback;
}

// Password change form schema
const passwordSchema = z.object({
  currentPassword: z.string().min(1, { message: "Current password is required." }),
  newPassword: z.string().min(8, { message: "Password must be at least 8 characters." }),
  confirmPassword: z.string().min(8, { message: "Confirm password is required." }),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

const Settings = () => {
  const { toast } = useToast();
  const { user, logoutMutation } = useAuth();


  const [isDeleteAccountDialogOpen, setIsDeleteAccountDialogOpen] = useState(false);
  const [isChangePasswordDialogOpen, setIsChangePasswordDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [location, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("account");
  const [showPassword, setShowPassword] = useState(false);
  const isWorkspaceAdmin =
    user?.role === "owner" ||
    user?.role === "admin" ||
    !(user as any)?.workspaceOwnerId ||
    (user as any)?.workspaceRole === "admin";

  const [workspacePreset, setWorkspacePreset] = useState<"basic" | "custom" | "advanced">("basic");
  const [blockedKeywordsInput, setBlockedKeywordsInput] = useState("");
  const [allowedKeywordsInput, setAllowedKeywordsInput] = useState("");
  const [strictness, setStrictness] = useState("50");
  const [workspaceDirty, setWorkspaceDirty] = useState(false);
  const [auditActionFilter, setAuditActionFilter] = useState("all");
  
  // Password change form
  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });
  
  // Password change mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (data: z.infer<typeof passwordSchema>) => {
      // In a real app, this would update the user's password through an API call
      return new Promise<void>((resolve) => setTimeout(resolve, 1000));
    },
    onSuccess: () => {
      toast({
        title: "Password updated",
        description: "Your password has been updated successfully.",
      });
      passwordForm.reset();
      setIsChangePasswordDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "There was an error updating your password.",
        variant: "destructive",
      });
    },
  });

  // Parse URL params to get the tab
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    
    if (tabParam && ['account', 'notifications', 'workspace', 'billing'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [location]);

  // General settings state - Initialize with user data when available
  const [generalSettings, setGeneralSettings] = useState({
    firstName: "",
    lastName: "",
    email: "",
    timezone: "UTC",
  });

  // Update general settings when user data becomes available
  useEffect(() => {
    if (user) {
      const nameParts = (user.fullName || "").split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";
      
      setGeneralSettings(prev => ({
        ...prev,
        firstName,
        lastName,
        email: user.email || "",
      }));
    }
  }, [user]);

  // Define notification settings type
  type NotificationSettings = {
    emailNotifications: boolean;
    inAppNotifications: boolean;
    marketingEmails: boolean;
    weeklyDigest: boolean;
    alertNotifications: boolean;
  };
  
  // Default notification settings
  const defaultNotificationSettings: NotificationSettings = {
    emailNotifications: true,
    inAppNotifications: true,
    marketingEmails: false,
    weeklyDigest: true,
    alertNotifications: true,
  };
  
  // Load notification settings from localStorage or use defaults
  const [notificationSettings, setNotificationSettings] = useState(() => {
    const savedSettings = localStorage.getItem('notificationSettings');
    return savedSettings ? JSON.parse(savedSettings) : {...defaultNotificationSettings};
  });

  const {
    data: workspaceSettings,
    isLoading: isWorkspaceSettingsLoading,
    error: workspaceSettingsError,
  } = useQuery<WorkspaceSettingsResponse>({
    queryKey: ["/api/workspace/settings"],
    enabled: !!user && isWorkspaceAdmin,
    retry: false,
  });

  useEffect(() => {
    if (!workspaceSettings) return;
    setWorkspacePreset(workspaceSettings.moderationPreset);
    setBlockedKeywordsInput((workspaceSettings.moderationRules.blockedKeywords || []).join(", "));
    setAllowedKeywordsInput((workspaceSettings.moderationRules.allowedKeywords || []).join(", "));
    setStrictness(String(workspaceSettings.moderationRules.strictness ?? 50));
    setWorkspaceDirty(false);
  }, [workspaceSettings]);

  // Remove API settings state

  // Save profile settings
  const saveProfileMutation = useMutation({
    mutationFn: async (data: typeof generalSettings) => {
      // Simulate API call
      return new Promise<void>((resolve) => setTimeout(resolve, 1000));
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
      // Save to localStorage
      localStorage.setItem('notificationSettings', JSON.stringify(data));
      
      // Simulate API call - in a real app, this would send to the backend
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



  // Timezone names mapping
  const timezoneNames: Record<string, string> = {
    "UTC": "UTC (Coordinated Universal Time)",
    "America/New_York": "Eastern Time (ET)",
    "America/Chicago": "Central Time (CT)",
    "America/Denver": "Mountain Time (MT)",
    "America/Los_Angeles": "Pacific Time (PT)",
    "Europe/London": "London (GMT/BST)",
    "Europe/Paris": "Central European Time (CET)",
    "Europe/Moscow": "Moscow Time (MSK)",
    "Asia/Dubai": "Gulf Standard Time (GST)",
    "Asia/Kolkata": "India Standard Time (IST)",
    "Asia/Shanghai": "China Standard Time (CST)",
    "Asia/Tokyo": "Japan Standard Time (JST)",
    "Australia/Sydney": "Australian Eastern Time (AET)",
    "Pacific/Auckland": "New Zealand Standard Time (NZST)"
  };

  // Track if settings have been modified since last save
  const [isModified, setIsModified] = useState(false);
  
  // Handle timezone change
  const handleTimezoneChange = (timezone: string) => {
    setGeneralSettings(prev => ({ ...prev, timezone }));
    setIsModified(true);
  };

  // Handle form submissions
  const handleSaveProfile = () => {
    saveProfileMutation.mutate(generalSettings, {
      onSuccess: () => {
        // Reset the modified flag
        setIsModified(false);
        
        // Display timezone info in success toast if it's been changed
        const defaultTimezone = "UTC";
        
        let changeMessage = "Settings saved successfully";
        
        // Add timezone details if it's different from default
        if (generalSettings.timezone !== defaultTimezone) {
          changeMessage += `:\n• Timezone: ${timezoneNames[generalSettings.timezone] || generalSettings.timezone}`;
        }
        
        toast({
          title: "Profile updated",
          description: changeMessage,
        });
        
        // Apply the timezone change (in a real app, this would update the app timezone)
        console.log(`Timezone set to: ${generalSettings.timezone}`);
      }
    });
  };

  const handleResetNotifications = () => {
    // Reset state to defaults
    setNotificationSettings({...defaultNotificationSettings});
    
    // Remove from localStorage
    localStorage.removeItem('notificationSettings');
    
    toast({
      title: "Defaults restored",
      description: "Notification settings have been reset to defaults",
    });
  };

  const handleSaveNotifications = () => {
    saveNotificationsMutation.mutate(notificationSettings);
  };

  const normalizeKeywordInput = (input: string) =>
    input
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

  const saveWorkspaceSettingsMutation = useMutation({
    mutationFn: async () => {
      const safeStrictness = Math.max(0, Math.min(100, Number(strictness) || 0));
      const payload = {
        moderationPreset: workspacePreset,
        moderationRules: {
          blockedKeywords: normalizeKeywordInput(blockedKeywordsInput),
          allowedKeywords: normalizeKeywordInput(allowedKeywordsInput),
          strictness: safeStrictness,
        },
      };
      const response = await apiRequest("PATCH", "/api/workspace/settings", payload);
      return (await response.json()) as WorkspaceSettingsResponse;
    },
    onSuccess: () => {
      setWorkspaceDirty(false);
      queryClient.invalidateQueries({ queryKey: ["/api/workspace/settings"] });
      toast({
        title: "Workspace settings saved",
        description: "Moderation policy and rules were updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to save workspace settings",
        description: parseApiErrorMessage(error, "Could not update workspace settings."),
        variant: "destructive",
      });
    },
  });

  const downloadJsonFile = (filename: string, data: unknown) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const downloadTextFile = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const fetchAuditLog = async () => {
    try {
      const params = new URLSearchParams({ limit: "500" });
      if (auditActionFilter !== "all") {
        params.set("action", auditActionFilter);
      }

      const response = await fetch(`/api/audit-log?${params.toString()}`, { credentials: "include" });
      if (!response.ok) {
        const bodyText = await response.text();
        throw new Error(`${response.status}: ${bodyText}`);
      }
      const payload = await response.json();
      downloadJsonFile(`moderateai-audit-log-${Date.now()}.json`, payload);
      const selectedFilterLabel = auditActionFilter === "all" ? "all actions" : auditActionFilter;
      toast({
        title: "Audit log downloaded",
        description: `The audit log export (${selectedFilterLabel}) was saved as JSON.`,
      });
    } catch (error) {
      toast({
        title: "Audit log unavailable",
        description: parseApiErrorMessage(error, "This feature is available on Pro."),
        variant: "destructive",
      });
    }
  };

  const exportMessages = async (format: "json" | "csv") => {
    try {
      const response = await fetch(`/api/export/messages?format=${format}`, { credentials: "include" });
      if (!response.ok) {
        const bodyText = await response.text();
        throw new Error(`${response.status}: ${bodyText}`);
      }

      if (format === "csv") {
        const csv = await response.text();
        downloadTextFile(`moderateai-message-export-${Date.now()}.csv`, csv, "text/csv;charset=utf-8");
      } else {
        const payload = await response.json();
        downloadJsonFile(`moderateai-message-export-${Date.now()}.json`, payload);
      }

      toast({
        title: "Export complete",
        description: `Messages exported as ${format.toUpperCase()}.`,
      });
    } catch (error) {
      toast({
        title: "Export unavailable",
        description: parseApiErrorMessage(error, "This feature is available on Pro."),
        variant: "destructive",
      });
    }
  };

  const handleDeleteAccount = () => {
    deleteAccountMutation.mutate();
  };

  // Handle logout
  const handleLogout = async () => {
    await logoutMutation.mutateAsync(undefined);
    toast({
      title: "Logged out",
      description: "You have been successfully logged out.",
    });
    // Force navigation to auth page
    setLocation("/auth");
    // Also force a page reload to ensure clean state
    window.location.href = "/auth";
  };




  
  // Handle password change
  const handleChangePassword = (data: z.infer<typeof passwordSchema>) => {
    changePasswordMutation.mutate(data);
  };
  


  return (
    <div>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2 space-y-6">
        <TabsList>
          <TabsTrigger value="account">
            <User className="h-4 w-4 mr-2" />
            Account
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="h-4 w-4 mr-2" />
            Notifications
          </TabsTrigger>
          {isWorkspaceAdmin && (
            <TabsTrigger value="workspace">
              <ShieldCheck className="h-4 w-4 mr-2" />
              Workspace
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="account" className="space-y-6">
          <Card>
            <CardContent className="space-y-6">

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Preferences</h3>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select 
                    value={generalSettings.timezone}
                    onValueChange={handleTimezoneChange}
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
                      <SelectItem value="Europe/London">London (GMT/BST)</SelectItem>
                      <SelectItem value="Europe/Paris">Central European Time (CET)</SelectItem>
                      <SelectItem value="Europe/Moscow">Moscow Time (MSK)</SelectItem>
                      <SelectItem value="Asia/Dubai">Gulf Standard Time (GST)</SelectItem>
                      <SelectItem value="Asia/Kolkata">India Standard Time (IST)</SelectItem>
                      <SelectItem value="Asia/Shanghai">China Standard Time (CST)</SelectItem>
                      <SelectItem value="Asia/Tokyo">Japan Standard Time (JST)</SelectItem>
                      <SelectItem value="Australia/Sydney">Australian Eastern Time (AET)</SelectItem>
                      <SelectItem value="Pacific/Auckland">New Zealand Standard Time (NZST)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between items-center border-t px-6 py-4">
              <div>
                {isModified && (
                  <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300 mr-2">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Unsaved changes
                  </Badge>
                )}
                <Button variant="outline" onClick={() => {
                  setGeneralSettings({
                    firstName: "Demo",
                    lastName: "User",
                    email: "demo@example.com",
                    timezone: "UTC",
                  });
                  setIsModified(false);
                }} disabled={!isModified || saveProfileMutation.isPending}>
                  Cancel
                </Button>
              </div>
              <Button 
                onClick={handleSaveProfile} 
                disabled={saveProfileMutation.isPending || !isModified}
                variant={isModified ? "default" : "outline"}
              >
                {saveProfileMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {isModified ? "Save Changes" : "No Changes"}
              </Button>
            </CardFooter>
          </Card>

          <Card className="space-y-6">
            <CardHeader>
              <CardTitle>Account Actions</CardTitle>
              <CardDescription>
                Security-related actions for your account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Logout Option - without icon */}
              <div className="rounded-md border border-border p-4">
                <div className="text-sm text-muted-foreground">
                  <p>
                    Sign out of your account on this device.
                  </p>
                </div>
                <div className="mt-4">
                  <Button 
                    variant="outline"
                    onClick={handleLogout}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </Button>
                </div>
              </div>
              
              {/* Delete Account Option - without title */}
              <div className="rounded-md border border-red-900/30 bg-red-900/10 p-4">
                <div className="text-sm text-red-400/90">
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
                      onCheckedChange={(checked) => setNotificationSettings((prev: NotificationSettings) => ({ ...prev, emailNotifications: checked }))}
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
                      onCheckedChange={(checked) => setNotificationSettings((prev: NotificationSettings) => ({ ...prev, marketingEmails: checked }))}
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
                      onCheckedChange={(checked) => setNotificationSettings((prev: NotificationSettings) => ({ ...prev, weeklyDigest: checked }))}
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
                      onCheckedChange={(checked) => setNotificationSettings((prev: NotificationSettings) => ({ ...prev, inAppNotifications: checked }))}
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
                      onCheckedChange={(checked) => setNotificationSettings((prev: NotificationSettings) => ({ ...prev, alertNotifications: checked }))}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between items-center border-t px-6 py-4">
              <Button variant="outline" onClick={handleResetNotifications}>Reset Defaults</Button>
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

        {isWorkspaceAdmin && (
          <TabsContent value="workspace" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Moderation Controls</CardTitle>
                <CardDescription>
                  Configure workspace-wide moderation behavior based on your subscription tier.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {isWorkspaceSettingsLoading ? (
                  <div className="space-y-3">
                    <div className="h-9 rounded-md bg-muted animate-pulse" />
                    <div className="h-24 rounded-md bg-muted animate-pulse" />
                    <div className="h-24 rounded-md bg-muted animate-pulse" />
                  </div>
                ) : workspaceSettingsError ? (
                  <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {parseApiErrorMessage(workspaceSettingsError, "Failed to load workspace settings.")}
                  </div>
                ) : workspaceSettings ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">
                        History: {workspaceSettings.features.historyDays === null ? "Unlimited" : `${workspaceSettings.features.historyDays} days`}
                      </Badge>
                      <Badge variant={workspaceSettings.features.sentimentAnalysis ? "secondary" : "outline"}>
                        Sentiment: {workspaceSettings.features.sentimentAnalysis ? "Enabled" : "Unavailable on current tier"}
                      </Badge>
                      <Badge variant="secondary">Analytics: {workspaceSettings.features.analyticsTier}</Badge>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="moderationPreset">Moderation preset</Label>
                      <Select
                        value={workspacePreset}
                        onValueChange={(value: "basic" | "custom" | "advanced") => {
                          setWorkspacePreset(value);
                          setWorkspaceDirty(true);
                        }}
                      >
                        <SelectTrigger id="moderationPreset">
                          <SelectValue placeholder="Select moderation preset" />
                        </SelectTrigger>
                        <SelectContent>
                          {workspaceSettings.allowedModerationPresets.includes("basic") && (
                            <SelectItem value="basic">Basic</SelectItem>
                          )}
                          {workspaceSettings.allowedModerationPresets.includes("custom") && (
                            <SelectItem value="custom">Custom</SelectItem>
                          )}
                          {workspaceSettings.allowedModerationPresets.includes("advanced") && (
                            <SelectItem value="advanced">Advanced</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="blockedKeywords">Blocked keywords (comma-separated)</Label>
                        <Textarea
                          id="blockedKeywords"
                          placeholder="scam link, abusive phrase, harassment term"
                          value={blockedKeywordsInput}
                          onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => {
                            setBlockedKeywordsInput(event.target.value);
                            setWorkspaceDirty(true);
                          }}
                          disabled={!workspaceSettings.allowedModerationPresets.includes("custom") && !workspaceSettings.allowedModerationPresets.includes("advanced")}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="allowedKeywords">Allowed keywords (comma-separated)</Label>
                        <Textarea
                          id="allowedKeywords"
                          placeholder="support ticket, account reset"
                          value={allowedKeywordsInput}
                          onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => {
                            setAllowedKeywordsInput(event.target.value);
                            setWorkspaceDirty(true);
                          }}
                          disabled={!workspaceSettings.allowedModerationPresets.includes("custom") && !workspaceSettings.allowedModerationPresets.includes("advanced")}
                        />
                      </div>
                    </div>

                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="strictness">Moderation strictness (0-100)</Label>
                        <Input
                          id="strictness"
                          type="number"
                          min={0}
                          max={100}
                          value={strictness}
                          onChange={(event) => {
                            setStrictness(event.target.value);
                            setWorkspaceDirty(true);
                          }}
                          disabled={!workspaceSettings.allowedModerationPresets.includes("custom") && !workspaceSettings.allowedModerationPresets.includes("advanced")}
                        />
                      </div>
                    </div>
                  </>
                ) : null}
              </CardContent>
              <CardFooter className="border-t px-6 py-4 flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Changes apply to Telegram and Discord moderation behavior.
                </div>
                <Button
                  onClick={() => saveWorkspaceSettingsMutation.mutate()}
                  disabled={!workspaceDirty || saveWorkspaceSettingsMutation.isPending || !workspaceSettings}
                >
                  {saveWorkspaceSettingsMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save moderation settings
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pro Tools</CardTitle>
                <CardDescription>
                  Audit log and data export are available on Pro. Standard and Free can view analytics only.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="max-w-sm space-y-2">
                  <Label htmlFor="auditActionFilter">Audit action filter</Label>
                  <Select value={auditActionFilter} onValueChange={setAuditActionFilter}>
                    <SelectTrigger id="auditActionFilter">
                      <SelectValue placeholder="All actions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All actions</SelectItem>
                      <SelectItem value="workspace.settings_updated">Workspace settings updates</SelectItem>
                      <SelectItem value="data_export.messages">Data exports</SelectItem>
                      <SelectItem value="admin.billing_activate_plan">Billing plan activations</SelectItem>
                      <SelectItem value="admin.billing_allow">Billing allows</SelectItem>
                      <SelectItem value="admin.billing_downgrade_free">Downgrades to free</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <Button
                    variant="outline"
                    onClick={fetchAuditLog}
                    disabled={!workspaceSettings?.features.auditLog}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download Audit Log
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => exportMessages("json")}
                    disabled={!workspaceSettings?.features.dataExport}
                  >
                    <FileDown className="mr-2 h-4 w-4" />
                    Export JSON
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => exportMessages("csv")}
                    disabled={!workspaceSettings?.features.dataExport}
                  >
                    <FileDown className="mr-2 h-4 w-4" />
                    Export CSV
                  </Button>
                </div>
                {!workspaceSettings?.features.auditLog || !workspaceSettings?.features.dataExport ? (
                  <p className="text-sm text-muted-foreground">
                    Upgrade to Pro to enable audit log and full message export.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Pro tools are active for this workspace.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}


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

      {/* Change Password Dialog */}
      <AlertDialog open={isChangePasswordDialogOpen} onOpenChange={setIsChangePasswordDialogOpen}>
        <AlertDialogContent className="sm:max-w-[425px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Change Password</AlertDialogTitle>
            <AlertDialogDescription>
              Enter your current password and a new password below.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <Form {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit(handleChangePassword)} className="space-y-4 py-4">
              <FormField
                control={passwordForm.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input 
                          type={showPassword ? "text" : "password"} 
                          placeholder="Enter your current password" 
                          {...field} 
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-gray-600" />
                          ) : (
                            <Eye className="h-4 w-4 text-gray-600" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={passwordForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Enter your new password" {...field} />
                    </FormControl>
                    <FormDescription>
                      Password must be at least 8 characters long.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={passwordForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm New Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Confirm your new password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <AlertDialogFooter className="pt-4">
                <AlertDialogCancel
                  onClick={() => {
                    passwordForm.reset();
                  }}
                >
                  Cancel
                </AlertDialogCancel>
                <Button type="submit" disabled={changePasswordMutation.isPending}>
                  {changePasswordMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Password"
                  )}
                </Button>
              </AlertDialogFooter>
            </form>
          </Form>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Settings;
