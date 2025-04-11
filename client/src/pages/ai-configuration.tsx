import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, FileBadge, Bot, MessageSquare } from "lucide-react";

// Define form schema
const aiConfigFormSchema = z.object({
  name: z.string().min(2, {
    message: "Configuration name must be at least 2 characters.",
  }),
  responseStyle: z.number().min(0).max(100),
  responseLength: z.number().min(0).max(100),
  moderationStrictness: z.number().min(0).max(100),
  isActive: z.boolean(),
  model: z.string().min(1, {
    message: "Please select an AI model.",
  }),
  systemPrompt: z.string().optional(),
});

type AIConfigFormValues = z.infer<typeof aiConfigFormSchema>;

const AIConfiguration = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("general");

  // Fetch active AI configuration
  const { data: activeConfig, isLoading: isLoadingConfig } = useQuery({
    queryKey: ['/api/ai-configurations/active'],
    retry: false,
  });

  // Fetch knowledge bases
  const { data: knowledgeBases, isLoading: isLoadingKnowledgeBases } = useQuery({
    queryKey: ['/api/knowledge-bases'],
    retry: false,
  });

  // Form for AI configuration
  const form = useForm<AIConfigFormValues>({
    resolver: zodResolver(aiConfigFormSchema),
    defaultValues: {
      name: "",
      responseStyle: 75,
      responseLength: 40,
      moderationStrictness: 50,
      isActive: true,
      model: "gpt-4o",
      systemPrompt: "",
    },
  });

  // Update form when data is loaded
  useState(() => {
    if (activeConfig && !form.formState.isDirty) {
      form.reset({
        name: activeConfig.name,
        responseStyle: activeConfig.responseStyle,
        responseLength: activeConfig.responseLength,
        moderationStrictness: activeConfig.moderationStrictness,
        isActive: activeConfig.isActive,
        model: activeConfig.model,
        systemPrompt: activeConfig.systemPrompt || "",
      });
    }
  });

  // Save AI configuration
  const saveMutation = useMutation({
    mutationFn: async (values: AIConfigFormValues) => {
      if (activeConfig) {
        return apiRequest("PATCH", `/api/ai-configurations/${activeConfig.id}`, values);
      } else {
        return apiRequest("POST", "/api/ai-configurations", values);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-configurations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ai-configurations/active'] });
      toast({
        title: "Success",
        description: "AI configuration saved successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to save AI configuration. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const onSubmit = (values: AIConfigFormValues) => {
    saveMutation.mutate(values);
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

  const getModerationStrictnessLabel = (value: number) => {
    if (value <= 25) return "Lenient";
    if (value <= 50) return "Balanced";
    if (value <= 75) return "Strict";
    return "Very Strict";
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">AI Configuration</h1>
        <Button onClick={form.handleSubmit(onSubmit)} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Changes
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
                        <TabsTrigger value="moderation">Moderation</TabsTrigger>
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

                      <TabsContent value="moderation" className="space-y-6">
                        <FormField
                          control={form.control}
                          name="moderationStrictness"
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex justify-between mb-2">
                                <FormLabel>Moderation Strictness</FormLabel>
                                <span className="text-sm text-muted-foreground">
                                  {getModerationStrictnessLabel(field.value)}
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
                                Set how strictly content is moderated in your community
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <h4 className="text-sm font-medium">Automatic Moderation Actions</h4>
                            <Switch defaultChecked />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Card className="p-3 flex items-center space-x-3">
                              <Switch id="flag" defaultChecked />
                              <label htmlFor="flag" className="text-sm font-medium">
                                Flag inappropriate content
                              </label>
                            </Card>
                            <Card className="p-3 flex items-center space-x-3">
                              <Switch id="warn" defaultChecked />
                              <label htmlFor="warn" className="text-sm font-medium">
                                Warn users
                              </label>
                            </Card>
                            <Card className="p-3 flex items-center space-x-3">
                              <Switch id="delete" />
                              <label htmlFor="delete" className="text-sm font-medium">
                                Delete content automatically
                              </label>
                            </Card>
                            <Card className="p-3 flex items-center space-x-3">
                              <Switch id="block" />
                              <label htmlFor="block" className="text-sm font-medium">
                                Block repeat offenders
                              </label>
                            </Card>
                          </div>
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
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md mb-3">
                    <div className="flex items-center">
                      <FileBadge className="h-5 w-5 text-gray-400 mr-2" />
                      <span className="text-sm text-gray-700">
                        {knowledgeBases?.[0]?.name || "Product Documentation"}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-xs text-gray-500">
                      Active
                    </Badge>
                  </div>

                  <div className="flex flex-col space-y-3 mb-6">
                    {(knowledgeBases || []).slice(1, 3).map((kb, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                        <div className="flex items-center">
                          <FileBadge className="h-5 w-5 text-gray-400 mr-2" />
                          <span className="text-sm text-gray-700">{kb.name}</span>
                        </div>
                        <Button variant="ghost" size="sm" className="h-8 px-2">
                          Activate
                        </Button>
                      </div>
                    ))}
                  </div>

                  <Button variant="outline" className="w-full mb-4">
                    Upload Documents
                  </Button>
                  <Button variant="outline" className="w-full">
                    Create New Knowledge Base
                  </Button>
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
                    <Bot className="h-5 w-5 text-gray-500 mr-3" />
                    <div>
                      <h4 className="text-sm font-medium">Proactive Responses</h4>
                      <p className="text-xs text-gray-500">
                        AI responds without triggers
                      </p>
                    </div>
                  </div>
                  <Switch />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <MessageSquare className="h-5 w-5 text-gray-500 mr-3" />
                    <div>
                      <h4 className="text-sm font-medium">Conversation Memory</h4>
                      <p className="text-xs text-gray-500">
                        Remember past interactions
                      </p>
                    </div>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <bot className="h-5 w-5 text-gray-500 mr-3" />
                    <div>
                      <h4 className="text-sm font-medium">Sentiment Analysis</h4>
                      <p className="text-xs text-gray-500">
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
    </div>
  );
};

export default AIConfiguration;
