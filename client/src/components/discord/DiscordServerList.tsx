import React, { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Settings, Hash, ChevronDown, ChevronRight, Server, AlertTriangle, Trash2, Lock, Unlock } from 'lucide-react';
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

interface DiscordChannel {
  id: string;
  name: string;
  type: string;
}

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
    mentionOnlyMode?: boolean;
    proactiveResponses?: boolean;
    respondToMentions?: boolean;
    respondToCommands?: boolean;
    privateResponses?: boolean;
    enabledChannels?: { [channelId: string]: boolean };
    totalChannels?: number;
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

interface KnowledgeBase {
  id: number;
  name: string;
}

interface DiscordServerListProps {
  chatConfigurations: ChatConfiguration[];
  knowledgeBases: KnowledgeBase[];
  platformId: number;
  channels: DiscordChannel[];
}

export function DiscordServerList({
  chatConfigurations,
  knowledgeBases,
  platformId,
  channels,
}: DiscordServerListProps) {
  const { toast } = useToast();
  const [selectedServer, setSelectedServer] = useState<ChatConfiguration | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedServers, setExpandedServers] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [serverToDelete, setServerToDelete] = useState<ChatConfiguration | null>(null);
  const [lockDialogOpen, setLockDialogOpen] = useState(false);
  const [serverToLock, setServerToLock] = useState<ChatConfiguration | null>(null);
  const [lockDurationMinutes, setLockDurationMinutes] = useState<string>('15');
  const [lockReason, setLockReason] = useState<string>('');
  const [nowMs, setNowMs] = useState<number>(Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const updateChannelMutation = useMutation({
    mutationFn: async ({ configId, channelId, enabled, settings }: { 
      configId: number; 
      channelId: string; 
      enabled: boolean;
      settings: any;
    }) => {
      const updatedEnabledChannels = { ...settings.enabledChannels };
      updatedEnabledChannels[channelId] = enabled;

      return fetch(`/api/chat-configurations/${configId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ 
          settings: {
            ...settings,
            enabledChannels: updatedEnabledChannels
          }
        })
      }).then(res => res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/platforms/${platformId}/chat-configurations`] });
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "Could not update the channel setting. Please try again.",
        variant: "destructive",
      });
    },
  });

  const serverToggleMutation = useMutation({
    mutationFn: async ({ configId, isActive }: { configId: number; isActive: boolean }) => {
      return fetch(`/api/chat-configurations/${configId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ isActive })
      }).then(res => res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/platforms/${platformId}/chat-configurations`] });
    },
    onError: () => {
      toast({
        title: "Toggle failed",
        description: "Could not update the server configuration. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteServerMutation = useMutation({
    mutationFn: async (configId: number) => {
      const response = await fetch(`/api/chat-configurations/${configId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        let message = 'Failed to delete server configuration';
        try {
          const error = await response.json();
          if (error?.message) {
            message = error.message;
          }
        } catch {
          // Ignore JSON parsing errors and use fallback text.
        }
        throw new Error(message);
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Server configuration deleted successfully',
      });
      queryClient.invalidateQueries({ queryKey: [`/api/platforms/${platformId}/chat-configurations`] });
      queryClient.invalidateQueries({ queryKey: [`/api/platforms/${platformId}/discord/discovered-servers`] });
      queryClient.invalidateQueries({ queryKey: [`/api/platforms/${platformId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/platforms'] });
      setDeleteDialogOpen(false);
      setServerToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to delete server configuration',
        variant: 'destructive',
      });
    },
  });

  const lockMutation = useMutation({
    mutationFn: async (payload: { configId: number; durationMinutes: number; reason?: string }) => {
      const response = await fetch(`/api/chat-configurations/${payload.configId}/lock`, {
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
        throw new Error(body?.message || 'Failed to apply lock');
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
      setServerToLock(null);
      setLockReason('');
    },
    onError: (error: any) => {
      toast({
        title: 'Lock failed',
        description: error?.message || 'Could not lock this server.',
        variant: 'destructive',
      });
    },
  });

  const unlockMutation = useMutation({
    mutationFn: async (configId: number) => {
      const response = await fetch(`/api/chat-configurations/${configId}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason: 'Unlocked from Discord integration.' }),
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
        description: error?.message || 'Could not unlock this server.',
        variant: 'destructive',
      });
    },
  });

  const openConfiguration = (server: ChatConfiguration) => {
    setSelectedServer(server);
    setDialogOpen(true);
  };

  const toggleServer = (server: ChatConfiguration) => {
    serverToggleMutation.mutate({
      configId: server.id,
      isActive: !server.isActive,
    });
  };

  const handleDelete = (server: ChatConfiguration) => {
    setServerToDelete(server);
    setDeleteDialogOpen(true);
  };

  const handleLockClick = (server: ChatConfiguration) => {
    setServerToLock(server);
    const defaultDuration = server.lockSettings?.lockDurationMinutes ?? 15;
    setLockDurationMinutes(String(defaultDuration));
    setLockReason('');
    setLockDialogOpen(true);
  };

  const confirmDelete = () => {
    if (!serverToDelete) return;
    deleteServerMutation.mutate(serverToDelete.id);
  };

  const toggleChannel = (server: ChatConfiguration, channelId: string, currentState: boolean) => {
    updateChannelMutation.mutate({
      configId: server.id,
      channelId,
      enabled: !currentState,
      settings: server.settings || {}
    });
  };

  const toggleExpanded = (serverId: string) => {
    const newExpanded = new Set(expandedServers);
    if (newExpanded.has(serverId)) {
      newExpanded.delete(serverId);
    } else {
      newExpanded.add(serverId);
    }
    setExpandedServers(newExpanded);
  };

  const getServerChannels = (serverId: string) => {
    return channels.filter(channel => 
      channel.type === 'text' && 
      (channel as any).guildId === serverId
    );
  };



  const getKnowledgeBaseName = (kbId?: number) => {
    if (!kbId) return 'Default';
    const kb = knowledgeBases.find(k => k.id === kbId);
    return kb?.name || 'Unknown';
  };

  const getAiConfigurationName = (server: ChatConfiguration) => {
    if (server.aiConfiguration?.name) {
      return server.aiConfiguration.name;
    }
    if (server.aiConfigurationId) {
      return `Config #${server.aiConfigurationId}`;
    }
    return 'Not configured';
  };

  const lockPresets = [5, 15, 30, 60];

  const resolveRemainingSeconds = (server: ChatConfiguration): number => {
    if (!server.lockState?.isLocked) return 0;
    if (server.lockState.endsAt) {
      const endsAtMs = new Date(server.lockState.endsAt).getTime();
      if (Number.isFinite(endsAtMs)) {
        return Math.max(0, Math.ceil((endsAtMs - nowMs) / 1000));
      }
    }
    return Math.max(0, Number(server.lockState.remainingSeconds ?? 0));
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
    () => serverToLock?.chatName || serverToLock?.externalId || 'this server',
    [serverToLock],
  );

  if (!chatConfigurations || chatConfigurations.length === 0) {
    return (
      <div className="text-center py-8">
        <Server className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Discord servers found</h3>
        <p className="text-muted-foreground mb-4">
          Your Discord bot hasn't been added to any servers yet.
        </p>
        <p className="text-sm text-muted-foreground">
          Once your bot joins Discord servers, they will appear here for configuration.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {chatConfigurations.map((server) => {
          const serverChannels = getServerChannels(server.externalId);
          const enabledChannels = server.settings?.enabledChannels || {};
          const enabledCount = serverChannels.filter((channel) => enabledChannels[channel.id] === true).length;
          const configuredChannelCount = Object.keys(enabledChannels).length;
          const totalChannelsSetting = Number(server.settings?.totalChannels || 0);
          const channelsUnavailable =
            serverChannels.length === 0 && (configuredChannelCount > 0 || totalChannelsSetting > 0);
          const isExpanded = expandedServers.has(server.externalId);
          
          return (
            <Card key={server.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-center space-x-3">
                    <Server className="h-5 w-5 text-blue-500" />
                    <div>
                      <CardTitle className="text-lg">{server.chatName}</CardTitle>
                      {channelsUnavailable ? (
                        <p className="text-sm text-amber-400 inline-flex items-center gap-1">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Channels unavailable - check bot permissions and refresh
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {enabledCount}/{serverChannels.length} channels enabled
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">AI:</span>
                          <span>{getAiConfigurationName(server)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">Knowledge Base:</span>
                          <span>{getKnowledgeBaseName(server.knowledgeBaseId)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-3">
                    {server.lockState?.isLocked ? (
                      <Badge variant="destructive">
                        <Lock className="h-3 w-3 mr-1" />
                        Locked {formatRemaining(resolveRemainingSeconds(server))}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Unlocked</Badge>
                    )}
                    {server.lockSettings?.scheduleEnabled ? (
                      <Badge variant={server.lockSettings?.schedulePaused ? 'outline' : 'secondary'}>
                        {server.lockSettings?.schedulePaused ? 'Schedule Paused' : 'Auto Schedule On'}
                      </Badge>
                    ) : null}

                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Respond</span>
                      <Switch
                        checked={server.isActive}
                        onCheckedChange={() => toggleServer(server)}
                        disabled={serverToggleMutation.isPending}
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {server.lockState?.isLocked ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => unlockMutation.mutate(server.id)}
                          disabled={unlockMutation.isPending}
                        >
                          <Unlock className="h-4 w-4 mr-2" />
                          Unlock
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleLockClick(server)}
                        >
                          <Lock className="h-4 w-4 mr-2" />
                          Lock
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openConfiguration(server)}
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Configure
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(server)}
                        disabled={deleteServerMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(server.externalId)}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between px-6 py-3 h-auto">
                    <span className="text-sm font-medium">
                      {channelsUnavailable ? "No channel inventory" : `${serverChannels.length} Text Channels`}
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    {channelsUnavailable ? (
                      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
                        Channel inventory is unavailable right now. Verify Discord bot permissions and use
                        <span className="font-medium"> Refresh Servers</span>.
                      </div>
                    ) : (
                      <div className="grid gap-2">
                        {serverChannels.map((channel) => {
                          const isEnabled = enabledChannels[channel.id] === true;
                          
                          return (
                            <div key={channel.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                              <div className="flex items-center space-x-2">
                                <Hash className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{channel.name}</span>
                              </div>
                              
                              <div className="flex items-center space-x-2">
                                <Badge variant={isEnabled ? "default" : "secondary"} className="text-xs">
                                  {isEnabled ? "Enabled" : "Disabled"}
                                </Badge>
                                <Switch
                                  checked={isEnabled}
                                  onCheckedChange={() => toggleChannel(server, channel.id, isEnabled)}
                                  disabled={!server.isActive || updateChannelMutation.isPending}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}
      </div>

      {selectedServer && (
        <ChatConfigurationDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          chatConfiguration={selectedServer}
          knowledgeBases={knowledgeBases}
          platformId={platformId}
        />
      )}

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setServerToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Server Configuration</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the configuration for "{serverToDelete?.chatName || serverToDelete?.externalId}"?
              <br /><br />
              This action cannot be undone. The bot will stop responding to this server until it is set up again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteServerMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteServerMutation.isPending ? (
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
              Temporarily set "{lockTargetName}" to read-only for non-admin members in enabled channels.
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
              <Label htmlFor="lock-duration-discord">Custom duration (minutes)</Label>
              <Input
                id="lock-duration-discord"
                type="number"
                min={1}
                max={1440}
                value={lockDurationMinutes}
                onChange={(event) => setLockDurationMinutes(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lock-reason-discord">Reason (optional)</Label>
              <Input
                id="lock-reason-discord"
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
              disabled={lockMutation.isPending || !serverToLock}
              onClick={() => {
                if (!serverToLock) return;
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
                  configId: serverToLock.id,
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
