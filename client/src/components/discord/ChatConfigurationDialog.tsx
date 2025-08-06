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
import { Loader2 } from 'lucide-react';

interface ChatConfiguration {
  id: number;
  chatId: string;
  chatTitle: string;
  chatType: string;
  isActive: boolean;
  aiConfigurationId?: number;
  knowledgeBaseId?: number;
  settings?: {
    contentFilteringEnabled?: boolean;
    spamProtectionEnabled?: boolean;
    mentionOnlyMode?: boolean;
    welcomeMessage?: string;
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
  chatConfig: ChatConfiguration | null;
  aiConfigurations: AiConfiguration[];
  knowledgeBases: KnowledgeBase[];
}

export function ChatConfigurationDialog({
  open,
  onOpenChange,
  chatConfig,
  aiConfigurations,
  knowledgeBases,
}: ChatConfigurationDialogProps) {
  const { toast } = useToast();

  const form = useForm({
    defaultValues: {
      aiConfigurationId: chatConfig?.aiConfigurationId || '',
      knowledgeBaseId: chatConfig?.knowledgeBaseId || '',
      isActive: chatConfig?.isActive || false,
      contentFilteringEnabled: chatConfig?.settings?.contentFilteringEnabled !== false,
      spamProtectionEnabled: chatConfig?.settings?.spamProtectionEnabled !== false,
      mentionOnlyMode: chatConfig?.settings?.mentionOnlyMode !== false,
      welcomeMessage: chatConfig?.settings?.welcomeMessage || ''
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!chatConfig) return;
      return fetch(`/api/chat-configurations/${chatConfig.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          aiConfigurationId: data.aiConfigurationId,
          knowledgeBaseId: data.knowledgeBaseId,
          isActive: data.isActive,
          settings: {
            contentFilteringEnabled: data.contentFilteringEnabled,
            spamProtectionEnabled: data.spamProtectionEnabled,
            mentionOnlyMode: data.mentionOnlyMode,
            welcomeMessage: data.welcomeMessage
          }
        })
      }).then(res => res.json());
    },
    onSuccess: () => {
      toast({
        title: "Configuration updated",
        description: "Discord server/channel settings have been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/platforms'] });
      queryClient.invalidateQueries({ queryKey: [`/api/platforms/${chatConfig?.id}/chat-configurations`] });
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
    if (chatConfig) {
      form.reset({
        aiConfigurationId: chatConfig.aiConfigurationId || '',
        knowledgeBaseId: chatConfig.knowledgeBaseId || '',
        isActive: chatConfig.isActive,
        contentFilteringEnabled: chatConfig.settings?.contentFilteringEnabled !== false,
        spamProtectionEnabled: chatConfig.settings?.spamProtectionEnabled !== false,
        mentionOnlyMode: chatConfig.settings?.mentionOnlyMode !== false,
        welcomeMessage: chatConfig.settings?.welcomeMessage || ''
      });
    }
  }, [chatConfig, form]);

  if (!chatConfig) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Configure Discord {chatConfig.chatType}</DialogTitle>
          <DialogDescription>
            Customize AI behavior and moderation settings for "{chatConfig.chatTitle}"
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
                        Enable AI responses for this {chatConfig.chatType.toLowerCase()}
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
                      value={field.value ? String(field.value) : ''}
                      onValueChange={(value) => field.onChange(value ? Number(value) : null)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select AI configuration" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">No AI configuration</SelectItem>
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
                      value={field.value ? String(field.value) : ''}
                      onValueChange={(value) => field.onChange(value ? Number(value) : null)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select knowledge base" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">No knowledge base</SelectItem>
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
                <h4 className="text-sm font-medium">Moderation Settings</h4>
                
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
                  name="spamProtectionEnabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm">Spam Protection</FormLabel>
                        <FormDescription className="text-xs">
                          Detect and prevent spam messages
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
                  name="mentionOnlyMode"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm">Mention Only Mode</FormLabel>
                        <FormDescription className="text-xs">
                          Only respond when the bot is mentioned in messages
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

              <FormField
                control={form.control}
                name="welcomeMessage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Welcome Message</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Optional welcome message for new members..."
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Message sent to new members when they join the server
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
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
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}