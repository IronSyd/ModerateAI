import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Settings, Users, MessageCircle, Shield, Bot, Trash2 } from 'lucide-react';
import { ChatConfigurationDialog } from './ChatConfigurationDialog';
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
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface ChatConfiguration {
  id: number;
  platformId: number;
  externalId: string;
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
  aiConfiguration?: {
    name: string;
  };
  knowledgeBase?: {
    name: string;
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

interface ChatConfigurationListProps {
  chatConfigurations: ChatConfiguration[];
  knowledgeBases: KnowledgeBase[];
  platformId: number;
}

export function ChatConfigurationList({ 
  chatConfigurations, 
  knowledgeBases,
  platformId 
}: ChatConfigurationListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedChat, setSelectedChat] = useState<ChatConfiguration | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<ChatConfiguration | null>(null);

  const quickToggleMutation = useMutation({
    mutationFn: async ({ chatId, isActive }: { chatId: number; isActive: boolean }) => {
      return fetch(`/api/chat-configurations/${chatId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ isActive })
      }).then(res => res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update chat configuration',
        variant: 'destructive'
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (chatId: number) => {
      const response = await fetch(`/api/chat-configurations/${chatId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete chat configuration');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Chat configuration deleted successfully',
      });
      queryClient.invalidateQueries({ queryKey: [`/api/platforms/${platformId}/chat-configurations`] });
      queryClient.invalidateQueries({ queryKey: ['/api/platforms'] });
      setDeleteDialogOpen(false);
      setChatToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete chat configuration',
        variant: 'destructive'
      });
    }
  });

  const handleConfigure = (chat: ChatConfiguration) => {
    setSelectedChat(chat);
    setDialogOpen(true);
  };

  const handleQuickToggle = (chat: ChatConfiguration, isActive: boolean) => {
    quickToggleMutation.mutate({ chatId: chat.id, isActive });
  };

  const handleDelete = (chat: ChatConfiguration) => {
    setChatToDelete(chat);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (chatToDelete) {
      deleteMutation.mutate(chatToDelete.id);
    }
  };

  const getChatTypeIcon = (type: string) => {
    switch (type) {
      case 'private':
        return <MessageCircle className="h-4 w-4" />;
      case 'group':
      case 'supergroup':
        return <Users className="h-4 w-4" />;
      default:
        return <MessageCircle className="h-4 w-4" />;
    }
  };

  const getChatTypeBadge = (type: string) => {
    const variants = {
      private: 'default',
      group: 'secondary',
      supergroup: 'outline'
    } as const;
    
    return (
      <Badge variant={variants[type as keyof typeof variants] || 'default'}>
        {type}
      </Badge>
    );
  };

  if (chatConfigurations.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Chat Configurations</h3>
          <p className="text-muted-foreground mb-4">
            Your bot will automatically create configurations when it receives messages from new chats or groups.
          </p>
          <p className="text-sm text-muted-foreground">
            Make sure your bot token is configured and the bot is added to groups or channels.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Chat Configurations</h3>
          <Badge variant="secondary">
            {chatConfigurations.length} chat{chatConfigurations.length !== 1 ? 's' : ''}
          </Badge>
        </div>

        <div className="grid gap-4">
          {chatConfigurations.map((chat) => (
            <Card key={chat.id} className="transition-colors hover:bg-muted/50">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      {getChatTypeIcon(chat.chatType)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold truncate">
                          {chat.chatName || `Chat ${chat.externalId}`}
                        </h4>
                        {getChatTypeBadge(chat.chatType)}
                      </div>
                      
                      <p className="text-sm text-muted-foreground font-mono mb-3">
                        ID: {chat.externalId}
                      </p>

                      <div className="flex flex-wrap items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Bot className="h-3 w-3" />
                          <span className="text-muted-foreground">AI:</span>
                          <span>{chat.aiConfiguration?.name || 'Not configured'}</span>
                        </div>
                        
                        {chat.knowledgeBase && (
                          <div className="flex items-center gap-1">
                            <span className="text-muted-foreground">KB:</span>
                            <span>{chat.knowledgeBase.name}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          {chat.settings.contentFilteringEnabled && (
                            <Badge variant="outline" className="text-xs">
                              <Shield className="h-3 w-3 mr-1" />
                              Content Filter
                            </Badge>
                          )}
                          
                          {chat.settings.spamProtectionEnabled && (
                            <Badge variant="outline" className="text-xs">
                              <Shield className="h-3 w-3 mr-1" />
                              Spam Protection
                            </Badge>
                          )}
                          
                          {chat.settings.mentionOnlyMode && (
                            <Badge variant="outline" className="text-xs">
                              Mention Only
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Active</span>
                      <Switch
                        checked={chat.isActive}
                        onCheckedChange={(checked) => handleQuickToggle(chat, checked)}
                        disabled={quickToggleMutation.isPending}
                      />
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleConfigure(chat)}
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Configure
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(chat)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <ChatConfigurationDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        chatConfig={selectedChat}
        knowledgeBases={knowledgeBases}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Chat Configuration</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the configuration for "{chatToDelete?.chatName || chatToDelete?.chatId}"?
              <br /><br />
              This action cannot be undone. The bot will stop responding to this chat and all settings will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <>Deleting...</>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Configuration
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}