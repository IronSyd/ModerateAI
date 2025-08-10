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
import { TrainingManagementDialog } from '../TrainingManagementDialog';
import { Brain } from 'lucide-react';

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
    mentionOnlyMode?: boolean;
    welcomeMessage?: string;
    enableHistoryLearning?: boolean;
    adminLearningMode?: boolean;
    proactiveResponses?: boolean;
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
  
  const [showTrainingDialog, setShowTrainingDialog] = useState(false);
  
  const [formData, setFormData] = useState({
    knowledgeBaseId: chatConfig?.knowledgeBaseId || null,
    isActive: chatConfig?.isActive ?? true,
    mentionOnlyMode: chatConfig?.settings?.mentionOnlyMode ?? false,
    proactiveResponses: chatConfig?.settings?.proactiveResponses ?? true,
    enableHistoryLearning: chatConfig?.settings?.enableHistoryLearning ?? false,
    adminLearningMode: chatConfig?.settings?.adminLearningMode ?? false,
    welcomeMessage: chatConfig?.settings?.welcomeMessage || ''
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
            mentionOnlyMode: data.mentionOnlyMode,
            proactiveResponses: data.proactiveResponses,
            enableHistoryLearning: data.enableHistoryLearning,
            adminLearningMode: data.adminLearningMode,
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

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="proactiveResponses">Proactive Responses</Label>
                <p className="text-sm text-muted-foreground">Bot responds to relevant questions even without being mentioned</p>
              </div>
              <Switch
                id="proactiveResponses"
                checked={formData.proactiveResponses !== false}
                onCheckedChange={(checked) => handleInputChange('proactiveResponses', checked)}
              />
            </div>

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



          {/* Training and Learning */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">AI Training & Learning</h3>
            
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="enableHistoryLearning">History Learning</Label>
                <p className="text-sm text-muted-foreground">Store chat messages for continuous AI improvement</p>
              </div>
              <Switch
                id="enableHistoryLearning"
                checked={formData.enableHistoryLearning}
                onCheckedChange={(checked) => handleInputChange('enableHistoryLearning', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="adminLearningMode">Admin Learning Mode</Label>
                <p className="text-sm text-muted-foreground">Learn from admin responses to improve AI behavior</p>
              </div>
              <Switch
                id="adminLearningMode"
                checked={formData.adminLearningMode}
                onCheckedChange={(checked) => handleInputChange('adminLearningMode', checked)}
              />
            </div>
          </div>





          {/* Actions */}
          <div className="flex justify-between">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setShowTrainingDialog(true)}
              disabled={!formData.enableHistoryLearning && !formData.adminLearningMode}
              className="flex items-center gap-2"
            >
              <Brain className="h-4 w-4" />
              Manage Training
            </Button>
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </form>

        {/* Training Management Dialog */}
        {showTrainingDialog && chatConfig && (
          <TrainingManagementDialog
            isOpen={showTrainingDialog}
            onClose={() => setShowTrainingDialog(false)}
            chatConfigId={chatConfig.id}
            chatName={chatConfig.chatName || chatConfig.chatId}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}