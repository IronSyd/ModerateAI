import { useState, useEffect } from 'react';
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

interface WebsiteConfiguration {
  id: number;
  userId: number;
  name: string;
  domain: string | null;
  authToken: string;
  aiConfigurationId: number | null;
  knowledgeBaseId: number | null;
  config: {
    widgetTitle?: string;
    welcomeMessage?: string;
    primaryColor?: string;
    position?: string;
    allowFileUploads?: boolean;
    collectVisitorInfo?: boolean;
    showTypingIndicator?: boolean;
    autoOpenDelay?: number;
  };
  isActive: boolean;
}

interface AIConfiguration {
  id: number;
  name: string;
  systemPrompt?: string;
  responseStyle?: string;
  maxResponseLength?: number;
}

interface KnowledgeBase {
  id: number;
  name: string;
  description?: string;
}

interface WebsiteConfigurationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  websiteConfig: WebsiteConfiguration | null;
  aiConfigurations: AIConfiguration[];
  knowledgeBases: KnowledgeBase[];
}

export function WebsiteConfigurationDialog({
  isOpen,
  onClose,
  websiteConfig,
  aiConfigurations,
  knowledgeBases
}: WebsiteConfigurationDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    name: websiteConfig?.name || '',
    domain: websiteConfig?.domain || '',
    aiConfigurationId: websiteConfig?.aiConfigurationId || null,
    knowledgeBaseId: websiteConfig?.knowledgeBaseId || null,
    isActive: websiteConfig?.isActive ?? true,
    // Widget configuration
    widgetTitle: websiteConfig?.config?.widgetTitle || 'Chat with us',
    welcomeMessage: websiteConfig?.config?.welcomeMessage || 'Hi there! How can I help you today?',
    primaryColor: websiteConfig?.config?.primaryColor || '#3B82F6',
    position: websiteConfig?.config?.position || 'bottom-right',
    allowFileUploads: websiteConfig?.config?.allowFileUploads ?? false,
    collectVisitorInfo: websiteConfig?.config?.collectVisitorInfo ?? true,
    showTypingIndicator: websiteConfig?.config?.showTypingIndicator ?? true,
    autoOpenDelay: websiteConfig?.config?.autoOpenDelay || 3000
  });

  useEffect(() => {
    if (websiteConfig) {
      setFormData({
        name: websiteConfig.name,
        domain: websiteConfig.domain || '',
        aiConfigurationId: websiteConfig.aiConfigurationId,
        knowledgeBaseId: websiteConfig.knowledgeBaseId,
        isActive: websiteConfig.isActive,
        widgetTitle: websiteConfig.config?.widgetTitle || 'Chat with us',
        welcomeMessage: websiteConfig.config?.welcomeMessage || 'Hi there! How can I help you today?',
        primaryColor: websiteConfig.config?.primaryColor || '#3B82F6',
        position: websiteConfig.config?.position || 'bottom-right',
        allowFileUploads: websiteConfig.config?.allowFileUploads ?? false,
        collectVisitorInfo: websiteConfig.config?.collectVisitorInfo ?? true,
        showTypingIndicator: websiteConfig.config?.showTypingIndicator ?? true,
        autoOpenDelay: websiteConfig.config?.autoOpenDelay || 3000
      });
    } else {
      // Reset form for new configuration
      setFormData({
        name: '',
        domain: '',
        aiConfigurationId: null,
        knowledgeBaseId: null,
        isActive: true,
        widgetTitle: 'Chat with us',
        welcomeMessage: 'Hi there! How can I help you today?',
        primaryColor: '#3B82F6',
        position: 'bottom-right',
        allowFileUploads: false,
        collectVisitorInfo: true,
        showTypingIndicator: true,
        autoOpenDelay: 3000
      });
    }
  }, [websiteConfig]);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        name: data.name,
        domain: data.domain || null,
        aiConfigurationId: data.aiConfigurationId || null,
        knowledgeBaseId: data.knowledgeBaseId || null,
        isActive: data.isActive,
        config: {
          widgetTitle: data.widgetTitle,
          welcomeMessage: data.welcomeMessage,
          primaryColor: data.primaryColor,
          position: data.position,
          allowFileUploads: data.allowFileUploads,
          collectVisitorInfo: data.collectVisitorInfo,
          showTypingIndicator: data.showTypingIndicator,
          autoOpenDelay: data.autoOpenDelay
        }
      };

      if (websiteConfig) {
        return fetch(`/api/website-configurations/${websiteConfig.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload)
        }).then(res => res.json());
      } else {
        return fetch('/api/website-configurations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload)
        }).then(res => res.json());
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/website-configurations'] });
      toast({
        title: websiteConfig ? 'Configuration updated' : 'Configuration created',
        description: `Website configuration has been ${websiteConfig ? 'updated' : 'created'} successfully.`
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || `Failed to ${websiteConfig ? 'update' : 'create'} configuration`,
        variant: 'destructive'
      });
    }
  });

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast({
        title: 'Validation error',
        description: 'Please enter a name for the website configuration.',
        variant: 'destructive'
      });
      return;
    }

    saveMutation.mutate(formData);
  };

  console.log('Dialog component render - isOpen:', isOpen);
  
  if (!isOpen) {
    console.log('Dialog not showing because isOpen is false');
    return null;
  }
  
  console.log('Dialog should be visible now');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {websiteConfig ? 'Edit Website Configuration' : 'Create Website Configuration'}
          </DialogTitle>
        </DialogHeader>
        
        <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Configuration Name *</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="My Website Chat"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="domain">Domain (optional)</Label>
              <Input
                id="domain"
                name="domain"
                value={formData.domain}
                onChange={(e) => setFormData(prev => ({ ...prev, domain: e.target.value }))}
                placeholder="example.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="aiConfig">AI Configuration</Label>
              <Select 
                name="aiConfig"
                value={formData.aiConfigurationId?.toString() || 'default'} 
                onValueChange={(value) => setFormData(prev => ({ 
                  ...prev, 
                  aiConfigurationId: value === 'default' ? null : parseInt(value) 
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select AI configuration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Use Default AI Configuration</SelectItem>
                  {aiConfigurations.map(config => (
                    <SelectItem key={config.id} value={config.id.toString()}>
                      {config.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="knowledgeBase">Knowledge Base</Label>
              <Select 
                name="knowledgeBase"
                value={formData.knowledgeBaseId?.toString() || 'default'} 
                onValueChange={(value) => setFormData(prev => ({ 
                  ...prev, 
                  knowledgeBaseId: value === 'default' ? null : parseInt(value) 
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select knowledge base" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Use Default Knowledge Base</SelectItem>
                  {knowledgeBases.map(kb => (
                    <SelectItem key={kb.id} value={kb.id.toString()}>
                      {kb.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Widget Configuration</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="widgetTitle">Widget Title</Label>
                <Input
                  id="widgetTitle"
                  name="widgetTitle"
                  value={formData.widgetTitle}
                  onChange={(e) => setFormData(prev => ({ ...prev, widgetTitle: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="primaryColor">Primary Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="primaryColor"
                    name="primaryColor"
                    type="color"
                    value={formData.primaryColor}
                    onChange={(e) => setFormData(prev => ({ ...prev, primaryColor: e.target.value }))}
                    className="w-16 h-10 p-1"
                  />
                  <Input
                    id="primaryColorText"
                    name="primaryColorText"
                    value={formData.primaryColor}
                    onChange={(e) => setFormData(prev => ({ ...prev, primaryColor: e.target.value }))}
                    placeholder="#3B82F6"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="welcomeMessage">Welcome Message</Label>
              <Textarea
                id="welcomeMessage"
                name="welcomeMessage"
                value={formData.welcomeMessage}
                onChange={(e) => setFormData(prev => ({ ...prev, welcomeMessage: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="position">Widget Position</Label>
                <Select 
                  name="position"
                  value={formData.position} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, position: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bottom-right">Bottom Right</SelectItem>
                    <SelectItem value="bottom-left">Bottom Left</SelectItem>
                    <SelectItem value="top-right">Top Right</SelectItem>
                    <SelectItem value="top-left">Top Left</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="autoOpenDelay">Auto-open Delay (ms)</Label>
                <Input
                  id="autoOpenDelay"
                  name="autoOpenDelay"
                  type="number"
                  value={formData.autoOpenDelay}
                  onChange={(e) => setFormData(prev => ({ ...prev, autoOpenDelay: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium">Widget Features</h4>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="isActive">Configuration Active</Label>
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="collectVisitorInfo">Collect Visitor Information</Label>
                  <Switch
                    id="collectVisitorInfo"
                    checked={formData.collectVisitorInfo}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, collectVisitorInfo: checked }))}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="showTypingIndicator">Show Typing Indicator</Label>
                  <Switch
                    id="showTypingIndicator"
                    checked={formData.showTypingIndicator}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, showTypingIndicator: checked }))}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="allowFileUploads">Allow File Uploads</Label>
                  <Switch
                    id="allowFileUploads"
                    checked={formData.allowFileUploads}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, allowFileUploads: checked }))}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : (websiteConfig ? 'Update Configuration' : 'Create Configuration')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}