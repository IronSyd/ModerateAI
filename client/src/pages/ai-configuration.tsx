import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Save, FileBadge, Bot, MessageSquare, Upload, Database, Check, CheckCircle, AlertCircle, Activity, SendHorizontal, Flag, LogIn } from "lucide-react";
import { DocumentUploadDialog } from "@/components/knowledge/document-upload-dialog";
import { CreateKnowledgeBaseDialog } from "@/components/knowledge/create-knowledge-base-dialog";
import { AuthDialog } from "@/components/auth-dialog";

// Define form schema
const aiConfigFormSchema = z.object({
  name: z.string().min(2, {
    message: "Configuration name must be at least 2 characters.",
  }),
  responseStyle: z.number().min(0).max(100),
  responseLength: z.number().min(0).max(100),
  isActive: z.boolean(),
  model: z.string().min(1, {
    message: "Please select an AI model.",
  }),
  systemPrompt: z.string().optional(),
});

type AIConfigFormValues = z.infer<typeof aiConfigFormSchema>;

const AIConfiguration = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("general");
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showCreateKbDialog, setShowCreateKbDialog] = useState(false);
  const [selectedKnowledgeBaseId, setSelectedKnowledgeBaseId] = useState<number | null>(null);
  const [selectedPlatformId, setSelectedPlatformId] = useState<string>("");

  // Define types for API responses
  interface AIConfig {
    id: number;
    name: string;
    responseStyle: number;
    responseLength: number;
    isActive: boolean;
    model: string;
    systemPrompt?: string;
  }

  interface KnowledgeBase {
    id: number;
    name: string;
    description?: string;
    documentCount?: number;
    isActive: boolean;
  }

  interface Platform {
    id: number;
    name: string;
    type: string;
  }

  interface Training {
    id: number;
    createdAt: string;
    status: string;
    conversationCount?: number;
    platformId: number;
  }

  // Fetch active AI configuration
  const { data: activeConfig, isLoading: isLoadingConfig } = useQuery<AIConfig>({
    queryKey: ['/api/ai-configurations/active'],
    retry: false,
  });

  // Fetch knowledge bases
  const { data: knowledgeBases, isLoading: isLoadingKnowledgeBases } = useQuery<KnowledgeBase[]>({
    queryKey: ['/api/knowledge-bases'],
    retry: false,
  });
  
  // Fetch platforms (for training)
  const {
    data: platforms,
    isLoading: isLoadingPlatforms,
    error: platformsError,
  } = useQuery<Platform[]>({
    queryKey: ["/api/platforms"],
    enabled: !!user,
  });

  // Fetch existing trainings
  const {
    data: trainings,
    isLoading: isLoadingTrainings,
    error: trainingsError,
  } = useQuery<Training[]>({
    queryKey: ["/api/conversation-trainings", selectedPlatformId],
    enabled: !!user && !!selectedPlatformId,
  });

  // Form for AI configuration
  const form = useForm<AIConfigFormValues>({
    resolver: zodResolver(aiConfigFormSchema),
    defaultValues: {
      name: "",
      responseStyle: 75,
      responseLength: 40,
      isActive: true,
      model: "gpt-4o",
      systemPrompt: "",
    },
  });

  // Update form when data is loaded
  useEffect(() => {
    if (activeConfig && !form.formState.isDirty) {
      form.reset({
        name: activeConfig.name,
        responseStyle: activeConfig.responseStyle,
        responseLength: activeConfig.responseLength,
        isActive: activeConfig.isActive,
        model: activeConfig.model,
        systemPrompt: activeConfig.systemPrompt || "",
      });
    }
  }, [activeConfig, form]);

  // Save AI configuration
  const saveMutation = useMutation({
    mutationFn: async (values: AIConfigFormValues) => {
      try {
        console.log("Attempting to save configuration:", values);
        if (activeConfig) {
          console.log(`Updating existing config with ID ${activeConfig.id}`);
          return await apiRequest("PATCH", `/api/ai-configurations/${activeConfig.id}`, values);
        } else {
          console.log("Creating new AI configuration");
          return await apiRequest("POST", "/api/ai-configurations", values);
        }
      } catch (error) {
        console.error("Error in mutation function:", error);
        throw error;
      }
    },
    onSuccess: (response) => {
      console.log("Save successful, response:", response);
      queryClient.invalidateQueries({ queryKey: ['/api/ai-configurations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ai-configurations/active'] });
      toast({
        title: "Success",
        description: "AI configuration saved successfully.",
      });
    },
    onError: (error: any) => {
      console.error("Save mutation error:", error);
      // Extract more detailed error info if available
      const errorMessage = error.message || "Failed to save AI configuration. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // State for auth dialog
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [pendingFormValues, setPendingFormValues] = useState<AIConfigFormValues | null>(null);
  
  // Handle form submission
  const onSubmit = (values: AIConfigFormValues) => {
    console.log("Submitting form with values:", values);
    console.log("Form state:", form.formState);
    
    // Check authentication
    if (!user) {
      setPendingFormValues(values);
      setShowAuthDialog(true);
      return;
    }
    
    saveMutation.mutate(values);
  };
  
  // Handle successful login
  const handleLoginSuccess = () => {
    if (pendingFormValues) {
      saveMutation.mutate(pendingFormValues);
      setPendingFormValues(null);
    }
  };
  
  // Start a new training
  const startTrainingMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/conversation-trainings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          platformId: parseInt(selectedPlatformId),
          status: "pending",
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to start training");
      }

      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Training started",
        description: "AI training process has started. This may take a few minutes.",
      });
      // Refetch trainings
      queryClient.invalidateQueries({
        queryKey: ["/api/conversation-trainings", selectedPlatformId],
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to start training",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">Pending</span>;
      case "in_progress":
        return <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">In Progress</span>;
      case "completed":
        return <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">Completed</span>;
      case "error":
        return <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs">Error</span>;
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs">{status}</span>;
    }
  };

  // Format slider value labels
  const getResponseStyleLabel = (value: number) => {
    if (value <= 25) return "Formal";
    if (value <= 50) return "Professional";
    if (value <= 75) return "Friendly";
    return "Casual";
  };

  const getResponseLengthLabel = (value: number) => {
    if (value <= 25) return "Very Concise";
    if (value <= 50) return "Concise";
    if (value <= 75) return "Detailed";
    return "Comprehensive";
  };



  return (
    <div>
      {!user && (
        <Card className="mb-6 border-sky-200 bg-sky-200">
          <CardContent className="p-4">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 mr-2 text-sky-700" />
              <div>
                <h3 className="font-medium text-sky-900">Authentication Required</h3>
                <p className="text-sm text-sky-800">
                  Please log in to save configuration changes and access all features.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      <div className="flex items-center justify-between mb-6">
        <div>
          {saveMutation.isError && (
            <p className="text-sm text-destructive">
              <AlertCircle className="h-4 w-4 inline mr-1" />
              Error saving configuration
            </p>
          )}
          {saveMutation.isSuccess && (
            <p className="text-sm text-green-600">
              <CheckCircle className="h-4 w-4 inline mr-1" />
              Configuration saved successfully
            </p>
          )}
        </div>
        <Button 
          onClick={user ? form.handleSubmit(onSubmit) : () => setShowAuthDialog(true)} 
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : !user ? (
            <>
              <LogIn className="mr-2 h-4 w-4" />
              Login to Save
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>AI Model Settings</CardTitle>
              <CardDescription>
                Configure how your AI assistant responds to customer inquiries
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingConfig ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <Tabs
                      defaultValue="general"
                      value={activeTab}
                      onValueChange={setActiveTab}
                      className="w-full"
                    >
                      <TabsList className="grid grid-cols-3 mb-6">
                        <TabsTrigger value="general">General</TabsTrigger>
                        <TabsTrigger value="responses">Responses</TabsTrigger>
                        <TabsTrigger value="training">
                          <Activity className="h-4 w-4 mr-2" />
                          Training
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="general" className="space-y-6">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Configuration Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Default Configuration" {...field} />
                              </FormControl>
                              <FormDescription>
                                Name this configuration for easy reference
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="model"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>AI Model</FormLabel>
                              <FormControl>
                                <select
                                  className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                  {...field}
                                >
                                  <option value="gpt-4o">GPT-4o (Recommended)</option>
                                  <option value="gpt-4o-mini">GPT-4o Mini (Faster)</option>
                                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Economy)</option>
                                </select>
                              </FormControl>
                              <FormDescription>
                                Select the AI model that powers your assistant
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="isActive"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">Active Configuration</FormLabel>
                                <FormDescription>
                                  Make this your active AI configuration
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </TabsContent>

                      <TabsContent value="responses" className="space-y-6">
                        <FormField
                          control={form.control}
                          name="responseStyle"
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex justify-between mb-2">
                                <FormLabel>Response Style</FormLabel>
                                <span className="text-sm text-muted-foreground">
                                  {getResponseStyleLabel(field.value)}
                                </span>
                              </div>
                              <FormControl>
                                <Slider
                                  min={0}
                                  max={100}
                                  step={1}
                                  defaultValue={[field.value]}
                                  onValueChange={(vals) => field.onChange(vals[0])}
                                />
                              </FormControl>
                              <FormDescription>
                                Adjust how formal or casual your AI assistant sounds
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="responseLength"
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex justify-between mb-2">
                                <FormLabel>Response Length</FormLabel>
                                <span className="text-sm text-muted-foreground">
                                  {getResponseLengthLabel(field.value)}
                                </span>
                              </div>
                              <FormControl>
                                <Slider
                                  min={0}
                                  max={100}
                                  step={1}
                                  defaultValue={[field.value]}
                                  onValueChange={(vals) => field.onChange(vals[0])}
                                />
                              </FormControl>
                              <FormDescription>
                                Control how detailed your AI responses will be
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="systemPrompt"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>System Prompt</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="You are a helpful customer support assistant. Be concise and professional."
                                  className="min-h-[120px]"
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>
                                Customize the core instructions for your AI assistant
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </TabsContent>


                      
                      <TabsContent value="training" className="space-y-6">
                        <div className="space-y-4">
                          <Alert>
                            <AlertCircle className="h-4 w-4 mr-2" />
                            <AlertTitle>AI Training</AlertTitle>
                            <AlertDescription>
                              Train your AI on past conversations to improve response quality and accuracy.
                              This process analyzes previous interactions to better understand your users.
                            </AlertDescription>
                          </Alert>
                          
                          <div className="space-y-4">
                            <h3 className="text-lg font-medium">Select Platform</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                              Choose which platform's conversations to use for training your AI assistant.
                            </p>
                            
                            {isLoadingPlatforms ? (
                              <div className="flex items-center space-x-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Loading platforms...</span>
                              </div>
                            ) : platforms && platforms.length > 0 ? (
                              <Select
                                value={selectedPlatformId}
                                onValueChange={setSelectedPlatformId}
                              >
                                <SelectTrigger className="w-full md:w-[300px]">
                                  <SelectValue placeholder="Select a platform" />
                                </SelectTrigger>
                                <SelectContent>
                                  {platforms && platforms.map((platform: Platform) => (
                                    <SelectItem key={platform.id} value={platform.id.toString()}>
                                      {platform.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <div className="text-center p-6 border border-dashed rounded-lg">
                                <h3 className="text-md font-medium mb-1">No platforms available</h3>
                                <p className="text-sm text-muted-foreground mb-4">
                                  Please set up a platform integration first
                                </p>
                                <div className="flex justify-center gap-3">
                                  <Button 
                                    variant="outline" 
                                    onClick={() => window.location.href = "/integrations/discord"}
                                  >
                                    <MessageSquare className="h-4 w-4 mr-2" />
                                    Discord Integration
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    onClick={() => window.location.href = "/integrations/telegram"}
                                  >
                                    <SendHorizontal className="h-4 w-4 mr-2" />
                                    Telegram Integration
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {selectedPlatformId && (
                            <div className="space-y-4 mt-6">
                              <div className="flex items-center justify-between">
                                <h3 className="text-lg font-medium">Training History</h3>
                                <Button
                                  onClick={() => startTrainingMutation.mutate()}
                                  disabled={startTrainingMutation.isPending}
                                >
                                  {startTrainingMutation.isPending ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      Training...
                                    </>
                                  ) : (
                                    <>
                                      <Activity className="mr-2 h-4 w-4" />
                                      Start New Training
                                    </>
                                  )}
                                </Button>
                              </div>
                              
                              {isLoadingTrainings ? (
                                <div className="flex items-center justify-center py-6">
                                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                </div>
                              ) : trainings && trainings.length > 0 ? (
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Started</TableHead>
                                      <TableHead>Status</TableHead>
                                      <TableHead>Conversations</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {trainings.map((training: Training) => (
                                      <TableRow key={training.id}>
                                        <TableCell>{formatDate(training.createdAt)}</TableCell>
                                        <TableCell>{getStatusBadge(training.status)}</TableCell>
                                        <TableCell>{training.conversationCount || "N/A"}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              ) : (
                                <div className="text-center p-6 border border-dashed rounded-lg">
                                  <Activity className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                                  <h3 className="text-md font-medium mb-1">No training history</h3>
                                  <p className="text-sm text-muted-foreground mb-4">
                                    Start your first AI training session to improve responses
                                  </p>
                                </div>
                              )}
                              
                              {trainings && trainings.some((t: Training) => t.status === "in_progress") && (
                                <div className="space-y-2 mt-4">
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium">Training in progress</span>
                                    <span className="text-sm text-muted-foreground">
                                      {Math.round(Math.random() * 100)}%
                                    </span>
                                  </div>
                                  <Progress value={Math.round(Math.random() * 100)} />
                                  <p className="text-xs text-muted-foreground">
                                    Processing conversations and creating embeddings...
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </TabsContent>
                    </Tabs>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Knowledge Base</CardTitle>
              <CardDescription>
                Manage your AI's knowledge sources
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingKnowledgeBases ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  {knowledgeBases && knowledgeBases.length > 0 ? (
                    <div className="flex flex-col space-y-3 mb-6">
                      {knowledgeBases.map((kb: KnowledgeBase) => (
                        <div key={kb.id} className="flex items-center justify-between p-3 bg-card rounded-md border">
                          <div className="flex items-center">
                            <FileBadge className="h-5 w-5 text-muted-foreground mr-2" />
                            <div>
                              <span className="text-sm font-medium text-foreground">{kb.name}</span>
                              {kb.description && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {kb.description}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground">
                                {kb.documentCount || 0} documents
                              </p>
                            </div>
                          </div>
                          {kb.isActive ? (
                            <Badge className="text-xs">Active</Badge>
                          ) : (
                            <Button variant="ghost" size="sm" className="h-8 px-2">
                              Activate
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center p-6 border border-dashed rounded-lg mb-6">
                      <Database className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                      <h3 className="text-md font-medium mb-1">No knowledge bases yet</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Create your first knowledge base to train your AI
                      </p>
                    </div>
                  )}

                  <Button 
                    variant="outline" 
                    className="w-full mb-4"
                    onClick={() => {
                      if (!user) {
                        setShowAuthDialog(true);
                        return;
                      }
                      setShowCreateKbDialog(true);
                    }}
                  >
                    {!user ? (
                      <>
                        <LogIn className="mr-2 h-4 w-4" />
                        Create Knowledge Base
                      </>
                    ) : (
                      <>
                        <Database className="mr-2 h-4 w-4" />
                        Create Knowledge Base
                      </>
                    )}
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => {
                      if (!user) {
                        setShowAuthDialog(true);
                        return;
                      }

                      const activeKb = knowledgeBases && knowledgeBases[0];
                      if (activeKb) {
                        setSelectedKnowledgeBaseId(activeKb.id);
                        setShowUploadDialog(true);
                      } else {
                        toast({
                          title: "No knowledge base available",
                          description: "Please create a knowledge base first",
                          variant: "destructive"
                        });
                      }
                    }}
                  >
                    {!user ? (
                      <>
                        <LogIn className="mr-2 h-4 w-4" />
                        Add Content
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Add Content
                      </>
                    )}
                  </Button>
                  
                  {/* Document Upload Dialog */}
                  {selectedKnowledgeBaseId && (
                    <DocumentUploadDialog
                      open={showUploadDialog}
                      onOpenChange={setShowUploadDialog}
                      knowledgeBaseId={selectedKnowledgeBaseId}
                    />
                  )}
                  
                  {/* Create Knowledge Base Dialog */}
                  <CreateKnowledgeBaseDialog
                    open={showCreateKbDialog}
                    onOpenChange={setShowCreateKbDialog}
                  />
                </>
              )}
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>AI Features</CardTitle>
              <CardDescription>
                Additional capabilities for your AI
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Bot className="h-5 w-5 text-muted-foreground mr-3" />
                    <div>
                      <h4 className="text-sm font-medium text-foreground">Proactive Responses</h4>
                      <p className="text-xs text-muted-foreground">
                        AI responds without triggers
                      </p>
                    </div>
                  </div>
                  <Switch />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <MessageSquare className="h-5 w-5 text-muted-foreground mr-3" />
                    <div>
                      <h4 className="text-sm font-medium text-foreground">Conversation Memory</h4>
                      <p className="text-xs text-muted-foreground">
                        Remember past interactions
                      </p>
                    </div>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Bot className="h-5 w-5 text-muted-foreground mr-3" />
                    <div>
                      <h4 className="text-sm font-medium text-foreground">Sentiment Analysis</h4>
                      <p className="text-xs text-muted-foreground">
                        Detect user emotions
                      </p>
                    </div>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Auth Dialog */}
      <AuthDialog
        open={showAuthDialog}
        onOpenChange={setShowAuthDialog}
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  );
};

export default AIConfiguration;