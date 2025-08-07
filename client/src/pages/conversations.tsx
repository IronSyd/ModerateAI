import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Plus, Filter } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

// Type definitions
type Conversation = {
  id: number;
  platformId: number;
  externalUserId: string;
  externalUsername?: string;
  externalId?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type Platform = {
  id: number;
  type: string;
  name: string;
  status: string;
};

const Conversations = () => {
  const { toast } = useToast();
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isNewConversationOpen, setIsNewConversationOpen] = useState(false);
  const [newConversationData, setNewConversationData] = useState({
    platformId: "",
    externalUserId: "",
    externalUsername: "",
    externalId: "",
    status: "active"
  });
  
  // Fetch conversations
  const { data: conversations, isLoading, refetch: refetchConversations } = useQuery({
    queryKey: ['/api/conversations', platformFilter !== "all" ? platformFilter : null],
    retry: false,
  });
  
  // Fetch platforms for new conversation dialog
  const { data: platforms } = useQuery({
    queryKey: ['/api/platforms'],
    retry: false,
  });
  
  // Create conversation mutation
  const createConversationMutation = useMutation({
    mutationFn: async (conversationData: any) => {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(conversationData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create conversation');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Conversation created",
        description: "New conversation has been created successfully.",
      });
      setIsNewConversationOpen(false);
      setNewConversationData({
        platformId: "",
        externalUserId: "",
        externalUsername: "",
        externalId: "",
        status: "active"
      });
      refetchConversations();
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating conversation",
        description: error.message || "Failed to create conversation",
        variant: "destructive",
      });
    },
  });
  
  // Platform type to display label
  const platformLabel = {
    website: "Website",
    telegram: "Telegram",
    discord: "Discord"
  };
  
  // Status badge variant
  const statusBadgeVariant = {
    active: "success",
    closed: "secondary",
    archived: "outline"
  };
  
  // Filter conversations based on search and filters
  const filteredConversations = (conversations as Conversation[] || []).filter((conversation: Conversation) => {
    // Filter by status
    if (statusFilter !== "all" && conversation.status !== statusFilter) {
      return false;
    }
    
    // Filter by search query (username)
    if (searchQuery && !conversation.externalUsername?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    return true;
  });
  
  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div className="mt-4 md:mt-0 space-y-2 md:space-y-0 md:space-x-2 flex flex-col md:flex-row md:ml-auto">
          <Dialog open={isNewConversationOpen} onOpenChange={setIsNewConversationOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Conversation
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create New Conversation</DialogTitle>
                <DialogDescription>
                  Start a new conversation with a user on one of your connected platforms.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="platform" className="text-right">
                    Platform
                  </Label>
                  <Select
                    value={newConversationData.platformId}
                    onValueChange={(value) => setNewConversationData({...newConversationData, platformId: value})}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select platform" />
                    </SelectTrigger>
                    <SelectContent>
                      {(platforms as Platform[] || []).map((platform: Platform) => (
                        <SelectItem key={platform.id} value={platform.id.toString()}>
                          {platform.name} ({platform.type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="username" className="text-right">
                    Username
                  </Label>
                  <Input
                    id="username"
                    placeholder="Enter username"
                    className="col-span-3"
                    value={newConversationData.externalUsername}
                    onChange={(e) => setNewConversationData({...newConversationData, externalUsername: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="userId" className="text-right">
                    User ID
                  </Label>
                  <Input
                    id="userId"
                    placeholder="Enter user ID"
                    className="col-span-3"
                    value={newConversationData.externalUserId}
                    onChange={(e) => setNewConversationData({...newConversationData, externalUserId: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="externalId" className="text-right">
                    Channel/Chat ID
                  </Label>
                  <Input
                    id="externalId"
                    placeholder="Optional: Channel or Chat ID"
                    className="col-span-3"
                    value={newConversationData.externalId}
                    onChange={(e) => setNewConversationData({...newConversationData, externalId: e.target.value})}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  onClick={() => {
                    if (!newConversationData.platformId || !newConversationData.externalUserId) {
                      toast({
                        title: "Validation Error",
                        description: "Platform and User ID are required",
                        variant: "destructive",
                      });
                      return;
                    }
                    createConversationMutation.mutate({
                      platformId: parseInt(newConversationData.platformId),
                      externalUserId: newConversationData.externalUserId,
                      externalUsername: newConversationData.externalUsername || "Unknown User",
                      externalId: newConversationData.externalId || null,
                      status: "active"
                    });
                  }}
                  disabled={createConversationMutation.isPending}
                >
                  {createConversationMutation.isPending ? "Creating..." : "Create Conversation"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Manage Conversations</CardTitle>
          <CardDescription>
            View and manage all customer conversations across your connected platforms.
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <Tabs defaultValue="all" className="w-full" onValueChange={setPlatformFilter}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
              <TabsList>
                <TabsTrigger value="all">All Platforms</TabsTrigger>
                <TabsTrigger value="website">Website</TabsTrigger>
                <TabsTrigger value="telegram">Telegram</TabsTrigger>
                <TabsTrigger value="discord">Discord</TabsTrigger>
              </TabsList>
              
              <div className="flex flex-col md:flex-row gap-2 mt-4 md:mt-0">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search by name..."
                    className="pl-8 max-w-xs"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
                
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <TabsContent value="all" className="m-0">
              {renderConversationsTable(filteredConversations, isLoading)}
            </TabsContent>
            
            <TabsContent value="website" className="m-0">
              {renderConversationsTable(filteredConversations, isLoading)}
            </TabsContent>
            
            <TabsContent value="telegram" className="m-0">
              {renderConversationsTable(filteredConversations, isLoading)}
            </TabsContent>
            
            <TabsContent value="discord" className="m-0">
              {renderConversationsTable(filteredConversations, isLoading)}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
  
  function renderConversationsTable(conversations: Conversation[], isLoading: boolean) {
    if (isLoading) {
      return (
        <div className="animate-pulse">
          <div className="h-8 bg-accent rounded w-full mb-4"></div>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-12 bg-accent rounded w-full mb-2"></div>
          ))}
        </div>
      );
    }
    
    if (!conversations || conversations.length === 0) {
      return (
        <div className="py-12 text-center">
          <p className="text-muted-foreground mb-4">No conversations found</p>
          <Button onClick={() => setIsNewConversationOpen(true)}>Start a conversation</Button>
        </div>
      );
    }
    
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Platform</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Update</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {conversations.map((conversation: Conversation) => {
              const platform = conversation.platformId ? 
                { type: "website" } : // This would come from the API in a real app
                { type: "website" };
              
              return (
                <TableRow key={conversation.id}>
                  <TableCell className="font-medium">
                    {conversation.externalUsername || "Anonymous User"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {platformLabel[platform.type as keyof typeof platformLabel] || platform.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant[conversation.status as keyof typeof statusBadgeVariant] as any}>
                      {conversation.status.charAt(0).toUpperCase() + conversation.status.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {formatDistanceToNow(new Date(conversation.updatedAt), { addSuffix: true })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm">View</Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  }
};

export default Conversations;
