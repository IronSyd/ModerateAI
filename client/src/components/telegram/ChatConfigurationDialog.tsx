import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface ChatConfiguration {
  id: number;
  platformId: number;
  chatId: string;
  chatName: string;
  chatType: 'private' | 'group' | 'supergroup';
  aiConfigurationId: number | null;
  knowledgeBaseId: number | null;
  isActive: boolean;
  settings: {
    contentFilteringEnabled?: boolean;
    spamProtectionEnabled?: boolean;
    mentionOnlyMode?: boolean;
    welcomeMessage?: string;
  };
}

interface AIConfiguration {
  id: number;
  name: string;
  systemPrompt: string;
  responseStyle: string;
  maxResponseLength: number;
}

interface KnowledgeBase {
  id: number;
  name: string;
  description: string;
}

interface ChatConfigurationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  chatConfig: ChatConfiguration | null;
  knowledgeBases: KnowledgeBase[];
}

export function ChatConfigurationDialog({
  isOpen,
  onClose,
  chatConfig,
  knowledgeBases
}: ChatConfigurationDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    knowledgeBaseId: chatConfig?.knowledgeBaseId || null,
    isActive: chatConfig?.isActive ?? true,
    contentFilteringEnabled: chatConfig?.settings?.contentFilteringEnabled ?? true,
    spamProtectionEnabled: chatConfig?.settings?.spamProtectionEnabled ?? true,
    mentionOnlyMode: chatConfig?.settings?.mentionOnlyMode ?? false,
    welcomeMessage: chatConfig?.settings?.welcomeMessage || '',
    // AI Configuration settings embedded directly
    aiName: chatConfig?.aiConfiguration?.name || `${chatConfig?.chatName} AI`,
    systemPrompt: chatConfig?.aiConfiguration?.systemPrompt || '',
    responseStyle: chatConfig?.aiConfiguration?.responseStyle || 'friendly',
    maxResponseLength: chatConfig?.aiConfiguration?.maxResponseLength || 300
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
        title: 'Success',
        description: 'Chat configuration updated successfully'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/platforms'] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update chat configuration',
        variant: 'destructive'
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (!chatConfig) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Configure {chatConfig.chatName || chatConfig.chatId}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Basic Settings</h3>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="isActive">Enable Bot for this Chat</Label>
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => handleInputChange('isActive', checked)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="welcomeMessage">Welcome Message</Label>
              <Textarea
                id="welcomeMessage"
                value={formData.welcomeMessage}
                onChange={(e) => handleInputChange('welcomeMessage', e.target.value)}
                placeholder="Enter a welcome message for new users..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="knowledgeBase">Knowledge Base</Label>
              <Select
                value={formData.knowledgeBaseId?.toString() || 'none'}
                onValueChange={(value) => handleInputChange('knowledgeBaseId', value === 'none' ? null : parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select knowledge base" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No knowledge base</SelectItem>
                  {knowledgeBases.map((kb) => (
                    <SelectItem key={kb.id} value={kb.id.toString()}>
                      {kb.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* AI Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">AI Configuration</h3>
            
            <div className="space-y-2">
              <Label htmlFor="aiName">AI Assistant Name</Label>
              <Input
                id="aiName"
                value={formData.aiName}
                onChange={(e) => handleInputChange('aiName', e.target.value)}
                placeholder="Enter AI assistant name..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="systemPrompt">System Prompt</Label>
              <Textarea
                id="systemPrompt"
                value={formData.systemPrompt}
                onChange={(e) => handleInputChange('systemPrompt', e.target.value)}
                placeholder="Enter system prompt to define AI behavior..."
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="responseStyle">Response Style</Label>
                <Select
                  value={formData.responseStyle}
                  onValueChange={(value) => handleInputChange('responseStyle', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="formal">Formal</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="friendly">Friendly</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxResponseLength">Max Response Length</Label>
                <Input
                  id="maxResponseLength"
                  type="number"
                  value={formData.maxResponseLength}
                  onChange={(e) => handleInputChange('maxResponseLength', parseInt(e.target.value))}
                  min="50"
                  max="1000"
                />
              </div>
            </div>
          </div>

          {/* Chat Behavior */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Chat Behavior</h3>
            
            {chatConfig.chatType === 'group' || chatConfig.chatType === 'supergroup' ? (
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="mentionOnlyMode">Mention Only Mode</Label>
                  <p className="text-sm text-muted-foreground">Bot only responds when mentioned</p>
                </div>
                <Switch
                  id="mentionOnlyMode"
                  checked={formData.mentionOnlyMode}
                  onCheckedChange={(checked) => handleInputChange('mentionOnlyMode', checked)}
                />
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="welcomeMessage">Welcome Message</Label>
              <Textarea
                id="welcomeMessage"
                placeholder="Enter welcome message for new users..."
                value={formData.welcomeMessage}
                onChange={(e) => handleInputChange('welcomeMessage', e.target.value)}
                rows={3}
              />
            </div>
          </div>

          {/* Moderation Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Moderation Settings</h3>
            
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="contentFiltering">Content Filtering</Label>
                <p className="text-sm text-muted-foreground">Remove inappropriate content</p>
              </div>
              <Switch
                id="contentFiltering"
                checked={formData.contentFilteringEnabled}
                onCheckedChange={(checked) => handleInputChange('contentFilteringEnabled', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="spamProtection">Spam Protection</Label>
                <p className="text-sm text-muted-foreground">Detect and remove spam messages</p>
              </div>
              <Switch
                id="spamProtection"
                checked={formData.spamProtectionEnabled}
                onCheckedChange={(checked) => handleInputChange('spamProtectionEnabled', checked)}
              />
            </div>
          </div>

          {/* Chat Info */}
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <h4 className="font-medium">Chat Information</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Chat ID:</span>
                <span className="ml-2 font-mono">{chatConfig.chatId}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Type:</span>
                <span className="ml-2 capitalize">{chatConfig.chatType}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}