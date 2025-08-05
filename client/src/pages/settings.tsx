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
  Globe,
  Lock,
  Trash2,
  LogOut,
  Loader2,
  AlertTriangle,
  Eye,
  EyeOff,
} from "lucide-react";

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
  const { logoutMutation } = useAuth();


  const [isDeleteAccountDialogOpen, setIsDeleteAccountDialogOpen] = useState(false);
  const [isChangePasswordDialogOpen, setIsChangePasswordDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [location, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("account");
  const [showPassword, setShowPassword] = useState(false);
  
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
    
    if (tabParam && ['account', 'notifications', 'billing'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [location]);

  // General settings state
  const [generalSettings, setGeneralSettings] = useState({
    firstName: "Demo",
    lastName: "User",
    email: "demo@example.com",
    timezone: "UTC",
  });

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
                      <div className="relative flex-1">
                        <Input 
                          id="password" 
                          type={showPassword ? "text" : "password"} 
                          value="DemoPassword123" 
                          className="pr-10"
                          disabled 
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      <Button 
                        variant="outline"
                        onClick={() => setIsChangePasswordDialogOpen(true)}
                      >
                        Change
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

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
                <div className="flex items-start">
                  <AlertTriangle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0 mt-0" />
                  <div className="flex-1">
                    <div className="text-sm text-red-400/90">
                      <p>
                        Permanently delete your account and all associated data. This action cannot be undone.
                      </p>
                    </div>
                    <div className="mt-4 flex justify-start">
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
                            <EyeOff className="h-4 w-4 text-gray-400" />
                          ) : (
                            <Eye className="h-4 w-4 text-gray-400" />
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
