import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Settings, Globe, Copy, Trash2, ExternalLink } from 'lucide-react';
import { WebsiteConfigurationDialog } from './WebsiteConfigurationDialog';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  createdAt: string;
  updatedAt: string;
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

interface WebsiteConfigurationListProps {
  websiteConfigurations: WebsiteConfiguration[];
  aiConfigurations: AIConfiguration[];
  knowledgeBases: KnowledgeBase[];
}

export function WebsiteConfigurationList({ 
  websiteConfigurations, 
  aiConfigurations,
  knowledgeBases
}: WebsiteConfigurationListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedWebsite, setSelectedWebsite] = useState<WebsiteConfiguration | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [websiteToDelete, setWebsiteToDelete] = useState<WebsiteConfiguration | null>(null);

  const quickToggleMutation = useMutation({
    mutationFn: async ({ websiteId, isActive }: { websiteId: number; isActive: boolean }) => {
      return fetch(`/api/website-configurations/${websiteId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ isActive })
      }).then(res => res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/website-configurations'] });
    },
    onError: () => {
      toast({
        title: "Toggle failed",
        description: "Could not update the website configuration. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (websiteId: number) => {
      return fetch(`/api/website-configurations/${websiteId}`, {
        method: 'DELETE',
        credentials: 'include'
      }).then(res => res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/website-configurations'] });
      toast({
        title: "Configuration deleted",
        description: "Website configuration has been deleted successfully."
      });
      setDeleteDialogOpen(false);
      setWebsiteToDelete(null);
    },
    onError: () => {
      toast({
        title: "Delete failed",
        description: "Could not delete the website configuration. Please try again.",
        variant: "destructive",
      });
    },
  });

  const openConfiguration = (website: WebsiteConfiguration) => {
    setSelectedWebsite(website);
    setDialogOpen(true);
  };

  const openNewConfiguration = () => {
    console.log('Button clicked!');
    setSelectedWebsite(null);
    setDialogOpen(prev => {
      console.log('Previous dialogOpen state:', prev);
      console.log('Setting dialogOpen to true');
      return true;
    });
  };

  const copyToken = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      toast({
        title: "Token copied",
        description: "Authentication token has been copied to clipboard."
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Could not copy token to clipboard.",
        variant: "destructive"
      });
    }
  };

  const confirmDelete = (website: WebsiteConfiguration) => {
    setWebsiteToDelete(website);
    setDeleteDialogOpen(true);
  };

  const handleDelete = () => {
    if (websiteToDelete) {
      deleteMutation.mutate(websiteToDelete.id);
    }
  };

  const getAiConfigName = (aiConfigId: number | null) => {
    if (!aiConfigId) return 'Default AI';
    const config = aiConfigurations.find(c => c.id === aiConfigId);
    return config?.name || 'Unknown AI Config';
  };

  const getKnowledgeBaseName = (kbId: number | null) => {
    if (!kbId) return 'Default Knowledge Base';
    const kb = knowledgeBases.find(k => k.id === kbId);
    return kb?.name || 'Unknown Knowledge Base';
  };

  if (websiteConfigurations.length === 0) {
    return (
      <div className="text-center py-8">
        <Globe className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-semibold text-gray-900">No website configurations</h3>
        <p className="mt-1 text-sm text-gray-500">Get started by creating your first website chat configuration.</p>
        <div className="mt-6">
          <Button onClick={openNewConfiguration}>
            <Globe className="h-4 w-4 mr-2" />
            Create Website Configuration
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium">Website Configurations</h3>
          <Button onClick={openNewConfiguration}>
            <Globe className="h-4 w-4 mr-2" />
            Create New
          </Button>
        </div>

        <div className="grid gap-4">
          {websiteConfigurations.map((website) => (
            <Card key={website.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Globe className="h-5 w-5 text-blue-600" />
                    <div>
                      <CardTitle className="text-lg">{website.name}</CardTitle>
                      {website.domain && (
                        <p className="text-sm text-gray-500 mt-1">{website.domain}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={website.isActive}
                      onCheckedChange={(checked) => 
                        quickToggleMutation.mutate({ 
                          websiteId: website.id, 
                          isActive: checked 
                        })
                      }
                    />
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium">AI Configuration</p>
                    <p className="text-gray-600">{getAiConfigName(website.aiConfigurationId)}</p>
                  </div>
                  <div>
                    <p className="font-medium">Knowledge Base</p>
                    <p className="text-gray-600">{getKnowledgeBaseName(website.knowledgeBaseId)}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Widget Settings:</span>
                    <div className="flex gap-2">
                      {website.config?.collectVisitorInfo && (
                        <Badge variant="outline" className="text-xs">Visitor Info</Badge>
                      )}
                      {website.config?.showTypingIndicator && (
                        <Badge variant="outline" className="text-xs">Typing Indicator</Badge>
                      )}
                      {website.config?.allowFileUploads && (
                        <Badge variant="outline" className="text-xs">File Uploads</Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-600">
                    <p><strong>Title:</strong> {website.config?.widgetTitle || 'Chat with us'}</p>
                    <p><strong>Position:</strong> {website.config?.position || 'bottom-right'}</p>
                    {website.config?.primaryColor && (
                      <p className="flex items-center gap-2">
                        <strong>Color:</strong> 
                        <span 
                          className="w-4 h-4 rounded border"
                          style={{ backgroundColor: website.config.primaryColor }}
                        ></span>
                        {website.config.primaryColor}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Authentication Token:</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 p-2 bg-gray-100 rounded text-xs font-mono truncate">
                      {website.authToken}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToken(website.authToken)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openConfiguration(website)}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Configure
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => confirmDelete(website)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {console.log('Rendering WebsiteConfigurationDialog with dialogOpen:', dialogOpen)}
      <WebsiteConfigurationDialog
        isOpen={dialogOpen}
        onClose={() => {
          console.log('Dialog onClose called');
          setDialogOpen(false);
        }}
        websiteConfig={selectedWebsite}
        aiConfigurations={aiConfigurations}
        knowledgeBases={knowledgeBases}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Website Configuration</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{websiteToDelete?.name}"? This action cannot be undone.
              All conversations and settings for this website configuration will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Configuration'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}