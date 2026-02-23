import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Settings, Users, MessageCircle, Shield, Bot, Trash2, Lock, Unlock } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
    mentionOnlyMode?: boolean;
    welcomeMessage?: string;
  };
  lockState?: {
    isLocked: boolean;
    source: 'manual_app' | 'manual_chat' | 'auto' | null;
    startedAt: string | null;
    endsAt: string | null;
    remainingSeconds: number;
    reason: string | null;
  };
  lockSettings?: {
    scheduleEnabled?: boolean;
    schedulePaused?: boolean;
    timezone?: string;
    schedules?: Array<{
      id: string;
      recurrence: 'daily' | 'weekly';
      daysOfWeek: number[];
      lockAt: string;
      unlockAt: string;
      isEnabled: boolean;
    }>;
    autoLockEnabled?: boolean;
    thresholdCount?: number;
    windowMinutes?: number;
    lockDurationMinutes?: number;
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
  const [lockDialogOpen, setLockDialogOpen] = useState(false);
  const [chatToLock, setChatToLock] = useState<ChatConfiguration | null>(null);
  const [lockDurationMinutes, setLockDurationMinutes] = useState<string>('15');
  const [lockReason, setLockReason] = useState<string>('');
  const [nowMs, setNowMs] = useState<number>(Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

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
      queryClient.invalidateQueries({ queryKey: [`/api/platforms/${platformId}/chat-configurations`] });
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

  const lockMutation = useMutation({
    mutationFn: async (payload: { chatId: number; durationMinutes: number; reason?: string }) => {
      const response = await fetch(`/api/chat-configurations/${payload.chatId}/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          durationMinutes: payload.durationMinutes,
          reason: payload.reason || undefined,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.message || 'Failed to apply destination lock');
      }
      return body;
    },
    onSuccess: (body: any) => {
      toast({
        title: 'Lock updated',
        description: body?.message || 'Destination lock applied.',
      });
      queryClient.invalidateQueries({ queryKey: [`/api/platforms/${platformId}/chat-configurations`] });
      queryClient.invalidateQueries({ queryKey: ['/api/platforms'] });
      setLockDialogOpen(false);
      setChatToLock(null);
      setLockReason('');
    },
    onError: (error: any) => {
      toast({
        title: 'Lock failed',
        description: error?.message || 'Could not lock this destination.',
        variant: 'destructive',
      });
    },
  });

  const unlockMutation = useMutation({
    mutationFn: async (chatId: number) => {
      const response = await fetch(`/api/chat-configurations/${chatId}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason: 'Unlocked from Telegram integration.' }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.message || 'Failed to unlock destination');
      }
      return body;
    },
    onSuccess: (body: any) => {
      toast({
        title: 'Unlocked',
        description: body?.message || 'Destination unlocked.',
      });
      queryClient.invalidateQueries({ queryKey: [`/api/platforms/${platformId}/chat-configurations`] });
      queryClient.invalidateQueries({ queryKey: ['/api/platforms'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Unlock failed',
        description: error?.message || 'Could not unlock this destination.',
        variant: 'destructive',
      });
    },
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

  const handleLockClick = (chat: ChatConfiguration) => {
    setChatToLock(chat);
    const defaultDuration = chat.lockSettings?.lockDurationMinutes ?? 15;
    setLockDurationMinutes(String(defaultDuration));
    setLockReason('');
    setLockDialogOpen(true);
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

  const lockPresets = [5, 15, 30, 60];

  const resolveRemainingSeconds = (chat: ChatConfiguration): number => {
    if (!chat.lockState?.isLocked) return 0;
    if (chat.lockState.endsAt) {
      const endsAtMs = new Date(chat.lockState.endsAt).getTime();
      if (Number.isFinite(endsAtMs)) {
        return Math.max(0, Math.ceil((endsAtMs - nowMs) / 1000));
      }
    }
    return Math.max(0, Number(chat.lockState.remainingSeconds ?? 0));
  };

  const formatRemaining = (totalSeconds: number): string => {
    const seconds = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainderSeconds = seconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${remainderSeconds}s`;
    return `${remainderSeconds}s`;
  };

  const lockTargetName = useMemo(
    () => chatToLock?.chatName || chatToLock?.externalId || 'this destination',
    [chatToLock],
  );

  const getKnowledgeBaseName = (chat: ChatConfiguration) => {
    if (chat.knowledgeBase?.name) {
      return chat.knowledgeBase.name;
    }
    if (!chat.knowledgeBaseId) {
      return 'Default';
    }
    const kb = knowledgeBases.find((entry) => entry.id === chat.knowledgeBaseId);
    return kb?.name || `KB #${chat.knowledgeBaseId}`;
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
                        
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">Knowledge Base:</span>
                          <span>{getKnowledgeBaseName(chat)}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          {chat.settings.contentFilteringEnabled && (
                            <Badge variant="outline" className="text-xs">
                              <Shield className="h-3 w-3 mr-1" />
                              Content Filter
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
                    {chat.lockState?.isLocked ? (
                      <Badge variant="destructive">
                        <Lock className="h-3 w-3 mr-1" />
                        Locked {formatRemaining(resolveRemainingSeconds(chat))}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Unlocked</Badge>
                    )}
                    {chat.lockSettings?.scheduleEnabled ? (
                      <Badge variant={chat.lockSettings?.schedulePaused ? 'outline' : 'secondary'}>
                        {chat.lockSettings?.schedulePaused ? 'Schedule Paused' : 'Auto Schedule On'}
                      </Badge>
                    ) : null}

                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Respond</span>
                      <Switch
                        checked={chat.isActive}
                        onCheckedChange={(checked) => handleQuickToggle(chat, checked)}
                        disabled={quickToggleMutation.isPending}
                      />
                    </div>
                    
                    <div className="flex gap-2">
                      {chat.lockState?.isLocked ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => unlockMutation.mutate(chat.id)}
                          disabled={unlockMutation.isPending}
                        >
                          <Unlock className="h-4 w-4 mr-2" />
                          Unlock
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleLockClick(chat)}
                        >
                          <Lock className="h-4 w-4 mr-2" />
                          Lock
                        </Button>
                      )}

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
              Are you sure you want to delete the configuration for "{chatToDelete?.chatName || chatToDelete?.externalId}"?
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

      <Dialog open={lockDialogOpen} onOpenChange={setLockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lock Destination</DialogTitle>
            <DialogDescription>
              Temporarily set "{lockTargetName}" to read-only for non-admin members.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Duration presets</Label>
              <div className="flex flex-wrap gap-2">
                {lockPresets.map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    variant={lockDurationMinutes === String(preset) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setLockDurationMinutes(String(preset))}
                  >
                    {preset}m
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lock-duration">Custom duration (minutes)</Label>
              <Input
                id="lock-duration"
                type="number"
                min={1}
                max={1440}
                value={lockDurationMinutes}
                onChange={(event) => setLockDurationMinutes(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lock-reason">Reason (optional)</Label>
              <Input
                id="lock-reason"
                value={lockReason}
                onChange={(event) => setLockReason(event.target.value)}
                placeholder="e.g. raid cleanup"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setLockDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={lockMutation.isPending || !chatToLock}
              onClick={() => {
                if (!chatToLock) return;
                const parsedMinutes = Number.parseInt(lockDurationMinutes, 10);
                if (!Number.isFinite(parsedMinutes) || parsedMinutes < 1 || parsedMinutes > 1440) {
                  toast({
                    title: 'Invalid duration',
                    description: 'Enter a duration between 1 and 1440 minutes.',
                    variant: 'destructive',
                  });
                  return;
                }
                lockMutation.mutate({
                  chatId: chatToLock.id,
                  durationMinutes: parsedMinutes,
                  reason: lockReason.trim() || undefined,
                });
              }}
            >
              {lockMutation.isPending ? 'Applying...' : 'Apply Lock'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
