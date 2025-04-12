import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Search, Plus, Filter } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const Conversations = () => {
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  
  // Fetch conversations
  const { data: conversations, isLoading } = useQuery({
    queryKey: ['/api/conversations', platformFilter !== "all" ? platformFilter : null],
    retry: false,
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
  const filteredConversations = conversations?.filter(conversation => {
    // Filter by status
    if (statusFilter !== "all" && conversation.status !== statusFilter) {
      return false;
    }
    
    // Filter by search query (username)
    if (searchQuery && !conversation.externalUsername?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    return true;
  }) || [];
  
  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div className="mt-4 md:mt-0 space-y-2 md:space-y-0 md:space-x-2 flex flex-col md:flex-row md:ml-auto">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Conversation
          </Button>
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
  
  function renderConversationsTable(conversations, isLoading) {
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
          <Button>Start a conversation</Button>
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
            {conversations.map(conversation => {
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
                      {platformLabel[platform.type]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant[conversation.status] as any}>
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
