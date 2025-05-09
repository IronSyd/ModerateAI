import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/hooks/use-theme";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Moon, Sun, Globe } from "lucide-react";

const PreferencesPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { theme: currentTheme, setTheme, isLoading: themeLoading } = useTheme();
  const [isLoading, setIsLoading] = useState(false);

  // Preference states
  const [language, setLanguage] = useState<string>("en");
  const [emailNotifications, setEmailNotifications] = useState<boolean>(true);
  const [actionNotifications, setActionNotifications] = useState<boolean>(true);
  const [marketingEmails, setMarketingEmails] = useState<boolean>(false);
  const [sessionTimeout, setSessionTimeout] = useState<string>("60");

  const savePreferences = async () => {
    try {
      setIsLoading(true);
      // In a real app, this would save the user preferences through an API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast({
        title: "Preferences saved",
        description: "Your preferences have been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "There was an error saving your preferences.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="py-6 space-y-6">
      <h1 className="text-3xl font-bold">Preferences</h1>
      <p className="text-muted-foreground">
        Manage your user preferences and settings.
      </p>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>
                Customize how the application looks.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Theme</Label>
                <div className="grid grid-cols-3 gap-4">
                  <Button
                    onClick={() => setTheme("light")}
                    variant={currentTheme === "light" ? "default" : "outline"}
                    className={`flex flex-row justify-center items-center h-12 w-full ${
                      currentTheme === "light" ? "bg-primary text-white" : "bg-transparent"
                    }`}
                    disabled={themeLoading}
                  >
                    <Sun className="h-5 w-5 mr-2" />
                    Light
                  </Button>
                  <Button
                    onClick={() => setTheme("dark")}
                    variant={currentTheme === "dark" ? "default" : "outline"}
                    className={`flex flex-row justify-center items-center h-12 w-full ${
                      currentTheme === "dark" ? "bg-primary text-white" : "bg-transparent"
                    }`}
                    disabled={themeLoading}
                  >
                    <Moon className="h-5 w-5 mr-2" />
                    Dark
                  </Button>
                  <Button
                    onClick={() => setTheme("system")}
                    variant={currentTheme === "system" ? "default" : "outline"}
                    className={`flex flex-row justify-center items-center h-12 w-full ${
                      currentTheme === "system" ? "bg-primary text-white" : "bg-transparent"
                    }`}
                    disabled={themeLoading}
                  >
                    <Globe className="h-5 w-5 mr-2" />
                    System
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Language</Label>
                <Select
                  value={language}
                  onValueChange={setLanguage}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="de">German</SelectItem>
                    <SelectItem value="ja">Japanese</SelectItem>
                    <SelectItem value="zh">Chinese (Simplified)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>
                Control how you receive notifications.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="email-notifications">Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications via email.
                  </p>
                </div>
                <Switch
                  id="email-notifications"
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="action-notifications">Action Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified about platform activities.
                  </p>
                </div>
                <Switch
                  id="action-notifications"
                  checked={actionNotifications}
                  onCheckedChange={setActionNotifications}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="marketing-emails">Marketing Emails</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive product updates and promotional offers.
                  </p>
                </div>
                <Switch
                  id="marketing-emails"
                  checked={marketingEmails}
                  onCheckedChange={setMarketingEmails}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Session Settings</CardTitle>
              <CardDescription>
                Configure your session preferences.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Session Timeout</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically log out after inactivity.
                  </p>
                </div>
                <Select
                  value={sessionTimeout}
                  onValueChange={setSessionTimeout}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 min</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="120">2 hours</SelectItem>
                    <SelectItem value="240">4 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end">
          <Button onClick={savePreferences} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Preferences"
            )}
          </Button>
        </div>
      </div>
  );
};

export default PreferencesPage;