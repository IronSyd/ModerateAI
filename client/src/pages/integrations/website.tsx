import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { WebsiteConfigurationList } from "@/components/website/WebsiteConfigurationList";
import { Link } from "wouter";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Globe,
  Copy,
  CheckCircle,
  Code,
  MonitorSmartphone,
  Settings,
  Save,
} from "lucide-react";

const WebsiteIntegration = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("setup");
  const [copied, setCopied] = useState(false);
  const [configFormData, setConfigFormData] = useState({
    widgetTitle: "Chat with us",
    welcomeMessage: "Hi there! How can I help you today?",
    primaryColor: "#3B82F6",
    position: "right",
    autoOpen: false,
    showAgentAvatar: true,
  });

  // Fetch website configurations
  const { data: websiteConfigurations = [], isLoading } = useQuery({
    queryKey: ['/api/website-configurations'],
    retry: false,
  });

  // Fetch AI configurations
  const { data: aiConfigurations = [], isLoading: isLoadingAI } = useQuery({
    queryKey: ['/api/ai-configurations'],
    retry: false,
  });

  // Fetch knowledge bases  
  const { data: knowledgeBases = [], isLoading: isLoadingKB } = useQuery({
    queryKey: ['/api/knowledge-bases'],
    retry: false,
  });

  // Simulated widget code for embedding
  const widgetCode = `<script>
  (function(w, d, s, o) {
    w['ModerateAI'] = o;
    w[o] = w[o] || function() {
      (w[o].q = w[o].q || []).push(arguments)
    };
    var js = d.createElement(s);
    js.async = 1;
    js.src = 'https://cdn.moderateai.com/widget.js';
    var fjs = d.getElementsByTagName(s)[0];
    fjs.parentNode.insertBefore(js, fjs);
  })(window, document, 'script', 'mai');
  
  mai('init', 'REPLACE_WITH_YOUR_AUTH_TOKEN');
</script>`;

  // Update platform configuration
  const updatePlatformMutation = useMutation({
    mutationFn: async (data: typeof configFormData) => {
      return apiRequest("PATCH", `/api/platforms/1`, {
        name: "Website Chat Widget",
        config: data,
        status: "active",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/1'] });
      queryClient.invalidateQueries({ queryKey: ['/api/platforms'] });
      toast({
        title: "Success",
        description: "Website integration configuration saved successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to save configuration. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCopyCode = () => {
    navigator.clipboard.writeText(widgetCode);
    setCopied(true);
    toast({
      title: "Code copied",
      description: "Widget code has been copied to clipboard",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setConfigFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSwitchChange = (name: string, checked: boolean) => {
    setConfigFormData(prev => ({
      ...prev,
      [name]: checked
    }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setConfigFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSaveConfig = () => {
    updatePlatformMutation.mutate(configFormData);
  };

  // Note: Platform config initialization removed as platform data is not currently fetched

  // Widget preview
  const WidgetPreview = () => (
    <div className="border rounded-lg p-4">
      <div className="relative mx-auto md:ml-auto" style={{ width: "300px", maxWidth: "100%" }}>
        <div 
          className="rounded-lg shadow-lg overflow-hidden" 
          style={{ borderColor: configFormData.primaryColor }}
        >
          {/* Chat header */}
          <div 
            className="px-4 py-3 flex items-center" 
            style={{ backgroundColor: configFormData.primaryColor, color: "white" }}
          >
            {configFormData.showAgentAvatar && (
              <Avatar className="h-8 w-8 mr-2">
                <AvatarImage src="" />
                <AvatarFallback className="bg-white/20 text-white">
                  AI
                </AvatarFallback>
              </Avatar>
            )}
            <div>
              <h3 className="font-medium">{configFormData.widgetTitle}</h3>
            </div>
          </div>
          
          {/* Chat body */}
          <div className="bg-background p-4 h-[200px] overflow-y-auto">
            <div className="flex mb-3">
              {configFormData.showAgentAvatar && (
                <Avatar className="h-8 w-8 mr-2 flex-shrink-0">
                  <AvatarImage src="" />
                  <AvatarFallback className="text-white" style={{ backgroundColor: configFormData.primaryColor }}>
                    AI
                  </AvatarFallback>
                </Avatar>
              )}
              <div className="bg-accent rounded-lg py-2 px-3 ml-2 max-w-[80%]">
                <p className="text-sm">{configFormData.welcomeMessage}</p>
              </div>
            </div>
            
            <div className="flex justify-end mb-3">
              <div className="rounded-lg py-2 px-3 mr-2 max-w-[80%] text-white" style={{ backgroundColor: configFormData.primaryColor }}>
                <p className="text-sm">Hello, I have a question about your services.</p>
              </div>
            </div>
          </div>
          
          {/* Input area */}
          <div className="bg-accent border-t px-4 py-3">
            <div className="flex">
              <Input className="mr-2" placeholder="Type a message..." disabled />
              <Button variant="ghost" size="sm" className="px-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill={configFormData.primaryColor}>
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
                </svg>
              </Button>
            </div>
          </div>
        </div>
        
        {/* Chat bubble button */}
        <div 
          className="absolute bottom-4 right-4 rounded-full w-14 h-14 flex items-center justify-center shadow-lg text-white"
          style={{ 
            backgroundColor: configFormData.primaryColor,
            right: configFormData.position === "right" ? "10px" : "auto",
            left: configFormData.position === "left" ? "10px" : "auto",
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Website Integration</h1>
          <p className="text-muted-foreground">Configure multiple website chat instances with different knowledge bases and AI configurations</p>
        </div>
        <Badge variant="outline" className="capitalize">
          {(websiteConfigurations as any[]).length} Configuration{(websiteConfigurations as any[]).length !== 1 ? 's' : ''}
        </Badge>
      </div>

      <Tabs defaultValue="configurations" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="configurations">
            <Globe className="h-4 w-4 mr-2" />
            Configurations
          </TabsTrigger>
          <TabsTrigger value="setup">
            <Code className="h-4 w-4 mr-2" />
            Setup Guide
          </TabsTrigger>
          <TabsTrigger value="customize">
            <Settings className="h-4 w-4 mr-2" />
            Widget Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="configurations" className="m-0">
          <WebsiteConfigurationList
            websiteConfigurations={websiteConfigurations as any[]}
            aiConfigurations={aiConfigurations as any[]}
            knowledgeBases={knowledgeBases as any[]}
          />
        </TabsContent>

        <TabsContent value="setup" className="m-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Setup Instructions</CardTitle>
                  <CardDescription>
                    Follow these steps to add the ModerateAI chat widget to your website
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3">
                        <h3 className="text-lg font-medium">1. Copy the widget code</h3>
                        <p className="text-sm text-muted-foreground">
                          Add this code to your website's HTML, just before the closing &lt;/body&gt; tag:
                        </p>
                        <div className="relative">
                          <div className="bg-accent p-4 rounded-lg font-mono text-sm overflow-x-auto">
                            <pre>{widgetCode}</pre>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="absolute top-2 right-2"
                            onClick={handleCopyCode}
                          >
                            {copied ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h3 className="text-lg font-medium">2. Verify installation</h3>
                        <p className="text-sm text-muted-foreground">
                          After adding the code, refresh your website to see the chat widget in action.
                          The widget will appear as a chat button in the bottom corner of your site.
                        </p>
                      </div>

                      <div className="space-y-3">
                        <h3 className="text-lg font-medium">3. Test your widget</h3>
                        <p className="text-sm text-muted-foreground">
                          Try sending a test message to ensure your widget is properly connected
                          to the ModerateAI platform.
                        </p>
                        <div className="flex space-x-4">
                          <Link href="/integrations/website-demo">
                            <Button variant="outline">
                              <Globe className="mr-2 h-4 w-4" />
                              Visit Demo Page
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle>Widget Preview</CardTitle>
                  <CardDescription>
                    How your chat widget will appear on your website
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <WidgetPreview />
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="customize" className="m-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Customize Widget</CardTitle>
                  <CardDescription>
                    Configure how your chat widget looks and behaves
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <Label htmlFor="widgetTitle">Widget Title</Label>
                          <Input
                            id="widgetTitle"
                            name="widgetTitle"
                            placeholder="Chat with us"
                            value={configFormData.widgetTitle}
                            onChange={handleInputChange}
                          />
                          <p className="text-sm text-muted-foreground">The title displayed at the top of the chat widget</p>
                        </div>

                        <div className="space-y-3">
                          <Label htmlFor="primaryColor">Primary Color</Label>
                          <div className="flex items-center space-x-3">
                            <div 
                              className="w-8 h-8 rounded-full border"
                              style={{ backgroundColor: configFormData.primaryColor }}
                            ></div>
                            <Input
                              id="primaryColor"
                              name="primaryColor"
                              type="text"
                              placeholder="#3B82F6"
                              value={configFormData.primaryColor}
                              onChange={handleInputChange}
                            />
                          </div>
                          <p className="text-sm text-muted-foreground">Brand color for your chat widget</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label htmlFor="welcomeMessage">Welcome Message</Label>
                        <Textarea
                          id="welcomeMessage"
                          name="welcomeMessage"
                          placeholder="Hi there! How can I help you today?"
                          value={configFormData.welcomeMessage}
                          onChange={handleInputChange}
                        />
                        <p className="text-sm text-muted-foreground">Initial message shown when a user opens the chat</p>
                      </div>

                      <Separator />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <Label htmlFor="position">Widget Position</Label>
                          <Select
                            value={configFormData.position}
                            onValueChange={(value) => handleSelectChange("position", value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select position" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="right">Bottom Right</SelectItem>
                              <SelectItem value="left">Bottom Left</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-sm text-muted-foreground">Where to place the chat button on your website</p>
                        </div>

                        <div className="space-y-5">
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label htmlFor="autoOpen">Auto Open</Label>
                              <p className="text-sm text-muted-foreground">Automatically open chat after page load</p>
                            </div>
                            <Switch
                              id="autoOpen"
                              checked={configFormData.autoOpen}
                              onCheckedChange={(checked) => handleSwitchChange("autoOpen", checked)}
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label htmlFor="showAgentAvatar">Show Agent Avatar</Label>
                              <p className="text-sm text-muted-foreground">Display AI assistant profile image</p>
                            </div>
                            <Switch
                              id="showAgentAvatar"
                              checked={configFormData.showAgentAvatar}
                              onCheckedChange={(checked) => handleSwitchChange("showAgentAvatar", checked)}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <Button onClick={handleSaveConfig} disabled={updatePlatformMutation.isPending}>
                          {updatePlatformMutation.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="mr-2 h-4 w-4" />
                          )}
                          Save Configuration
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle>Widget Preview</CardTitle>
                  <CardDescription>
                    How your chat widget will appear on your website
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <WidgetPreview />
                </CardContent>
              </Card>

              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Page Triggers</CardTitle>
                  <CardDescription>
                    Control when to show your chat widget
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Show on all pages</Label>
                        <p className="text-xs text-muted-foreground">Widget appears on every page</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Exit intent popup</Label>
                        <p className="text-xs text-muted-foreground">Open when user tries to leave</p>
                      </div>
                      <Switch />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Time-based trigger</Label>
                        <p className="text-xs text-muted-foreground">Open after time on page</p>
                      </div>
                      <Switch />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="m-0">
          <Card>
            <CardHeader>
              <CardTitle>Widget Analytics</CardTitle>
              <CardDescription>
                Performance metrics for your website chat widget
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <MonitorSmartphone className="mx-auto h-12 w-12 text-muted-foreground/30" />
                  <h3 className="mt-4 text-lg font-medium">Analytics Coming Soon</h3>
                  <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                    We're building detailed analytics for your website chat widget.
                    Check back soon to see conversation volume, response times, and user satisfaction metrics.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WebsiteIntegration;
