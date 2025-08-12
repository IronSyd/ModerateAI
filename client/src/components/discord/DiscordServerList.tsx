import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Settings, Hash, ChevronDown, ChevronRight, Server } from 'lucide-react';
import { ChatConfigurationDialog } from './ChatConfigurationDialog';

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
    spamProtectionEnabled?: boolean;
    mentionOnlyMode?: boolean;
    proactiveResponses?: boolean;
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

interface DiscordServerListProps {
  chatConfigurations: ChatConfiguration[];
  aiConfigurations: AiConfiguration[];
  knowledgeBases: KnowledgeBase[];
  platformId: number;
  channels: DiscordChannel[];
}

export function DiscordServerList({
  chatConfigurations,
  aiConfigurations,
  knowledgeBases,
  platformId,
  channels,
}: DiscordServerListProps) {
  const { toast } = useToast();
  const [selectedServer, setSelectedServer] = useState<ChatConfiguration | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedServers, setExpandedServers] = useState<Set<string>>(new Set());

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

  const getAiConfigName = (aiConfigId?: number) => {
    if (!aiConfigId) return 'Default';
    const config = aiConfigurations.find(c => c.id === aiConfigId);
    return config?.name || 'Unknown';
  };

  const getKnowledgeBaseName = (kbId?: number) => {
    if (!kbId) return 'Default';
    const kb = knowledgeBases.find(k => k.id === kbId);
    return kb?.name || 'Unknown';
  };

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
          const enabledCount = Object.values(enabledChannels).filter(Boolean).length;
          const isExpanded = expandedServers.has(server.externalId);
          
          return (
            <Card key={server.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Server className="h-5 w-5 text-blue-500" />
                    <div>
                      <CardTitle className="text-lg">{server.chatName}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {enabledCount}/{serverChannels.length} channels enabled
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <Badge variant={server.isActive ? "default" : "secondary"}>
                      {server.isActive ? "Active" : "Disabled"}
                    </Badge>
                    
                    <Switch
                      checked={server.isActive}
                      onCheckedChange={() => toggleServer(server)}
                      disabled={serverToggleMutation.isPending}
                    />
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openConfiguration(server)}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Configure
                    </Button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">AI Config:</span>
                    <span className="ml-2 font-medium">{getAiConfigName(server.aiConfigurationId)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Knowledge Base:</span>
                    <span className="ml-2 font-medium">{getKnowledgeBaseName(server.knowledgeBaseId)}</span>
                  </div>
                </div>
              </CardHeader>
              
              <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(server.externalId)}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between px-6 py-3 h-auto">
                    <span className="text-sm font-medium">
                      {serverChannels.length} Text Channels
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
                    <div className="grid gap-2">
                      {serverChannels.map((channel) => {
                        const isEnabled = enabledChannels[channel.id] !== false;
                        
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
                                size="sm"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
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
          aiConfigurations={aiConfigurations}
          knowledgeBases={knowledgeBases}
          platformId={platformId}
        />
      )}
    </>
  );
}