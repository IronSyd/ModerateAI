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
import { Settings, Hash, VolumeX } from 'lucide-react';
import { ChatConfigurationDialog } from './ChatConfigurationDialog';

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
  lastActivity?: string;
  memberCount?: number;
}

interface AiConfiguration {
  id: number;
  name: string;
}

interface KnowledgeBase {
  id: number;
  name: string;
}

interface ChatConfigurationListProps {
  chatConfigurations: ChatConfiguration[];
  aiConfigurations: AiConfiguration[];
  knowledgeBases: KnowledgeBase[];
  platformId: number;
}

export function ChatConfigurationList({
  chatConfigurations,
  aiConfigurations,
  knowledgeBases,
  platformId,
}: ChatConfigurationListProps) {
  const { toast } = useToast();
  const [selectedChat, setSelectedChat] = useState<ChatConfiguration | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

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
      queryClient.invalidateQueries({ queryKey: [`/api/platforms/${platformId}/chat-configurations`] });
    },
    onError: () => {
      toast({
        title: "Toggle failed",
        description: "Could not update the chat configuration. Please try again.",
        variant: "destructive",
      });
    },
  });

  const openConfiguration = (chat: ChatConfiguration) => {
    setSelectedChat(chat);
    setDialogOpen(true);
  };

  const toggleChat = (chat: ChatConfiguration) => {
    quickToggleMutation.mutate({
      chatId: chat.id,
      isActive: !chat.isActive,
    });
  };

  const getChatIcon = (chatType: string) => {
    switch (chatType.toLowerCase()) {
      case 'text':
      case 'channel':
        return <Hash className="h-4 w-4" />;
      case 'voice':
        return <VolumeX className="h-4 w-4" />;
      default:
        return <Hash className="h-4 w-4" />;
    }
  };

  const getAiConfigName = (aiConfigId?: number) => {
    if (!aiConfigId) return 'None';
    const config = aiConfigurations.find(c => c.id === aiConfigId);
    return config?.name || 'Unknown';
  };

  const getKnowledgeBaseName = (kbId?: number) => {
    if (!kbId) return 'None';
    const kb = knowledgeBases.find(k => k.id === kbId);
    return kb?.name || 'Unknown';
  };

  if (!chatConfigurations || chatConfigurations.length === 0) {
    return (
      <div className="text-center py-8">
        <Hash className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Discord servers/channels found</h3>
        <p className="text-muted-foreground mb-4">
          Your Discord bot hasn't been added to any servers yet, or hasn't received any messages.
        </p>
        <p className="text-sm text-muted-foreground">
          Once your bot is added to Discord servers and receives messages, they will appear here for configuration.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Server/Channel</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>AI Config</TableHead>
              <TableHead>Knowledge Base</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Features</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {chatConfigurations.map((chat) => (
              <TableRow key={chat.id}>
                <TableCell>
                  <div className="flex items-center space-x-2">
                    {getChatIcon(chat.chatType)}
                    <div>
                      <div className="font-medium">{chat.chatTitle}</div>
                      <div className="text-sm text-muted-foreground">
                        {chat.memberCount ? `${chat.memberCount} members` : 'Unknown size'}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {chat.chatType}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="text-sm">
                    {getAiConfigName(chat.aiConfigurationId)}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-sm">
                    {getKnowledgeBaseName(chat.knowledgeBaseId)}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={chat.isActive}
                      onCheckedChange={() => toggleChat(chat)}
                      disabled={quickToggleMutation.isPending}
                    />
                    <Badge
                      variant={chat.isActive ? "secondary" : "outline"}
                    >
                      {chat.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {chat.settings?.contentFilteringEnabled && (
                      <Badge variant="outline" className="text-xs">
                        Filter
                      </Badge>
                    )}
                    {chat.settings?.spamProtectionEnabled && (
                      <Badge variant="outline" className="text-xs">
                        Anti-spam
                      </Badge>
                    )}
                    {chat.settings?.mentionOnlyMode && (
                      <Badge variant="outline" className="text-xs">
                        Mention only
                      </Badge>
                    )}
                    {chat.settings?.welcomeMessage && (
                      <Badge variant="outline" className="text-xs">
                        Welcome
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openConfiguration(chat)}
                  >
                    <Settings className="h-4 w-4" />
                    Configure
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ChatConfigurationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        chatConfig={selectedChat}
        aiConfigurations={aiConfigurations}
        knowledgeBases={knowledgeBases}
      />
    </>
  );
}