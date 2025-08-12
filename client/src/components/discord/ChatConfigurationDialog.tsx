import React from 'react';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Brain } from 'lucide-react';
import { TrainingManagementDialog } from '../TrainingManagementDialog';
import { useState } from 'react';

interface ChatConfiguration {
  id: number;
  platformId: number;
  externalId: string;
  chatName: string;
  chatType: string;
  aiConfigurationId?: number;
  knowledgeBaseId?: number;
  settings?: {
    contentFilteringEnabled?: boolean;
    spamProtectionEnabled?: boolean;
    mentionOnlyMode?: boolean;
    proactiveResponses?: boolean;
    enableHistoryLearning?: boolean;
    adminLearningMode?: boolean;
    welcomeMessage?: string;
    respondToMentions?: boolean;
    respondToCommands?: boolean;
    privateResponses?: boolean;
    enabledChannels?: { [channelId: string]: boolean };
    totalChannels?: number;
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  aiConfiguration?: {
    name: string;
  };
  knowledgeBase?: {
    name: string;
  };
}

interface AiConfiguration {
  id: number;
  name: string;
}

interface KnowledgeBase {
  id: number;
  name: string;
}

interface ChatConfigurationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatConfiguration: ChatConfiguration;
  aiConfigurations: AiConfiguration[];
  knowledgeBases: KnowledgeBase[];
  platformId: number;
}

export function ChatConfigurationDialog({
  open,
  onOpenChange,
  chatConfiguration,
  aiConfigurations,
  knowledgeBases,
  platformId,
}: ChatConfigurationDialogProps) {
  const { toast } = useToast();
  const [showTrainingDialog, setShowTrainingDialog] = useState(false);

  const form = useForm({
    defaultValues: {
      aiConfigurationId: chatConfiguration?.aiConfigurationId || null,
      knowledgeBaseId: chatConfiguration?.knowledgeBaseId || null,
      isActive: chatConfiguration?.isActive || false,
      contentFilteringEnabled: chatConfiguration?.settings?.contentFilteringEnabled !== false,
      proactiveResponses: chatConfiguration?.settings?.proactiveResponses !== false,
      respondToMentions: chatConfiguration?.settings?.respondToMentions !== false,
      respondToCommands: chatConfiguration?.settings?.respondToCommands !== false,
      privateResponses: chatConfiguration?.settings?.privateResponses || false,
      enableHistoryLearning: chatConfiguration?.settings?.enableHistoryLearning || false,
      adminLearningMode: chatConfiguration?.settings?.adminLearningMode || false,
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      return fetch(`/api/chat-configurations/${chatConfiguration.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          aiConfigurationId: data.aiConfigurationId ? parseInt(data.aiConfigurationId) : null,
          knowledgeBaseId: data.knowledgeBaseId ? parseInt(data.knowledgeBaseId) : null,
          isActive: data.isActive,
          settings: {
            ...chatConfiguration?.settings, // Preserve existing settings like enabledChannels
            contentFilteringEnabled: data.contentFilteringEnabled,
            proactiveResponses: data.proactiveResponses,
            respondToMentions: data.respondToMentions,
            respondToCommands: data.respondToCommands,
            privateResponses: data.privateResponses,
            enableHistoryLearning: data.enableHistoryLearning,
            adminLearningMode: data.adminLearningMode,
          }
        })
      }).then(res => res.json());
    },
    onSuccess: () => {
      toast({
        title: "Configuration updated",
        description: "Discord server settings have been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/platforms/${platformId}/chat-configurations`] });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "There was an error updating the configuration. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: any) => {
    updateMutation.mutate(data);
  };

  React.useEffect(() => {
    if (chatConfiguration) {
      form.reset({
        aiConfigurationId: chatConfiguration.aiConfigurationId || null,
        knowledgeBaseId: chatConfiguration.knowledgeBaseId || null,
        isActive: chatConfiguration.isActive,
        contentFilteringEnabled: chatConfiguration.settings?.contentFilteringEnabled !== false,
        proactiveResponses: chatConfiguration.settings?.proactiveResponses !== false,
        respondToMentions: chatConfiguration.settings?.respondToMentions !== false,
        respondToCommands: chatConfiguration.settings?.respondToCommands !== false,
        privateResponses: chatConfiguration.settings?.privateResponses || false,
        enableHistoryLearning: chatConfiguration.settings?.enableHistoryLearning || false,
        adminLearningMode: chatConfiguration.settings?.adminLearningMode || false,
      });
    }
  }, [chatConfiguration, form]);

  if (!chatConfiguration) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Configure Discord {chatConfiguration.chatType}</DialogTitle>
          <DialogDescription>
            Customize AI behavior and moderation settings for "{chatConfiguration.chatName}"
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Active
                      </FormLabel>
                      <FormDescription>
                        Enable AI responses for this {chatConfiguration.chatType.toLowerCase()}
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

              <FormField
                control={form.control}
                name="aiConfigurationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>AI Configuration</FormLabel>
                    <Select
                      value={field.value ? String(field.value) : "none"}
                      onValueChange={(value) => field.onChange(value === "none" ? null : Number(value))}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select AI configuration" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No AI configuration</SelectItem>
                        {aiConfigurations.map((config) => (
                          <SelectItem key={config.id} value={String(config.id)}>
                            {config.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="knowledgeBaseId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Knowledge Base</FormLabel>
                    <Select
                      value={field.value ? String(field.value) : "none"}
                      onValueChange={(value) => field.onChange(value === "none" ? null : Number(value))}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select knowledge base" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No knowledge base</SelectItem>
                        {knowledgeBases.map((kb) => (
                          <SelectItem key={kb.id} value={String(kb.id)}>
                            {kb.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <h4 className="text-sm font-medium">Response Settings</h4>
                
                <FormField
                  control={form.control}
                  name="respondToMentions"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm">Respond to Mentions</FormLabel>
                        <FormDescription className="text-xs">
                          Bot responds when mentioned with @ModerateAI
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

                <FormField
                  control={form.control}
                  name="respondToCommands"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm">Respond to Commands</FormLabel>
                        <FormDescription className="text-xs">
                          Bot responds to slash commands and other bot interactions
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

                <FormField
                  control={form.control}
                  name="privateResponses"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm">Private Responses</FormLabel>
                        <FormDescription className="text-xs">
                          Send responses as direct messages instead of in channels
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

                <FormField
                  control={form.control}
                  name="contentFilteringEnabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm">Content Filtering</FormLabel>
                        <FormDescription className="text-xs">
                          Automatically detect and remove inappropriate content
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

                <FormField
                  control={form.control}
                  name="proactiveResponses"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm">Proactive Responses</FormLabel>
                        <FormDescription className="text-xs">
                          Bot responds to relevant questions even without being mentioned
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value !== false}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="enableHistoryLearning"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm">History Learning</FormLabel>
                        <FormDescription className="text-xs">
                          Store chat messages for continuous AI improvement
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

                <FormField
                  control={form.control}
                  name="adminLearningMode"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm">Admin Learning Mode</FormLabel>
                        <FormDescription className="text-xs">
                          Learn from admin responses to improve AI behavior
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
              </div>


            </div>

            <DialogFooter className="flex justify-between">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowTrainingDialog(true)}
                disabled={!form.watch('enableHistoryLearning') && !form.watch('adminLearningMode')}
                className="flex items-center gap-2"
              >
                <Brain className="h-4 w-4" />
                Manage Training
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? (
                    <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>

      {/* Training Management Dialog */}
      {showTrainingDialog && chatConfiguration && (
        <TrainingManagementDialog
          isOpen={showTrainingDialog}
          onClose={() => setShowTrainingDialog(false)}
          chatConfigId={chatConfiguration.id}
          chatName={chatConfiguration.chatName || chatConfiguration.externalId}
        />
      )}
    </Dialog>
  );
}