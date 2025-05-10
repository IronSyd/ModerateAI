import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  MessageSquare,
  Check,
  X,
  Loader2,
} from "lucide-react";

// Mock templates for now since we don't have templates in our schema yet
const mockTemplates = [
  {
    id: 1,
    name: "Welcome Message",
    content: "👋 Welcome to our community! How can I help you today?",
    category: "greetings",
    platform: "all",
  },
  {
    id: 2,
    name: "Product Inquiry Response",
    content: "Thank you for your interest in our product. Here are the key features and benefits: [Features]. Would you like me to provide more specific information about any aspect?",
    category: "support",
    platform: "website",
  },
  {
    id: 3,
    name: "Discord Community Rules",
    content: "Please follow our community guidelines:\n1. Be respectful\n2. No spam\n3. Keep discussions on-topic\n4. No NSFW content\n\nThank you for keeping our community a friendly place!",
    category: "moderation",
    platform: "discord",
  },
  {
    id: 4,
    name: "Pricing Question",
    content: "Our pricing plans are:\n• Basic: $29/month\n• Pro: $79/month\n• Enterprise: Custom pricing\n\nEach plan includes [Features]. Would you like to know more about a specific plan?",
    category: "support",
    platform: "all",
  },
  {
    id: 5,
    name: "Telegram Group Welcome",
    content: "Welcome to our Telegram group! Feel free to ask questions about our product. Our AI assistant is here to help 24/7.",
    category: "greetings",
    platform: "telegram",
  },
];

const Templates = () => {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    content: "",
    category: "support",
    platform: "all",
  });

  // In a real app, we'd use these queries
  // const { data: templates, isLoading } = useQuery({
  //   queryKey: ['/api/templates'],
  //   retry: false,
  // });

  // Simulate loading
  const isLoading = false;
  const templates = mockTemplates;

  // Filter templates based on search and active tab
  const filteredTemplates = templates?.filter(template => {
    // Filter by platform
    if (activeTab !== "all" && template.platform !== activeTab && template.platform !== "all") {
      return false;
    }
    
    // Filter by search query
    if (searchQuery && !template.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    return true;
  }) || [];

  const handleEditClick = (template) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      content: template.content,
      category: template.category,
      platform: template.platform,
    });
    setIsEditing(true);
  };

  const handleCreateClick = () => {
    setSelectedTemplate(null);
    setFormData({
      name: "",
      content: "",
      category: "support",
      platform: "all",
    });
    setIsCreating(true);
  };

  const handleDeleteClick = (template) => {
    setSelectedTemplate(template);
    setIsDeleteDialogOpen(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSelectChange = (name, value) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSaveTemplate = () => {
    // In a real app, this would call the API to save the template
    toast({
      title: isEditing ? "Template updated" : "Template created",
      description: `${formData.name} has been ${isEditing ? "updated" : "created"} successfully.`,
    });
    
    setIsEditing(false);
    setIsCreating(false);
  };

  const handleDeleteTemplate = () => {
    // In a real app, this would call the API to delete the template
    toast({
      title: "Template deleted",
      description: `${selectedTemplate.name} has been deleted.`,
    });
    
    setIsDeleteDialogOpen(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div></div> {/* Empty div to maintain the flex layout */}
        <Button onClick={handleCreateClick}>
          <Plus className="mr-2 h-4 w-4" />
          New Template
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Manage Templates</CardTitle>
          <CardDescription>
            Create and manage pre-written responses for common scenarios
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search templates..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="all">All Platforms</TabsTrigger>
              <TabsTrigger value="website">Website</TabsTrigger>
              <TabsTrigger value="telegram">Telegram</TabsTrigger>
              <TabsTrigger value="discord">Discord</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-0">
              {renderTemplatesList(filteredTemplates, isLoading)}
            </TabsContent>
            <TabsContent value="website" className="mt-0">
              {renderTemplatesList(filteredTemplates, isLoading)}
            </TabsContent>
            <TabsContent value="telegram" className="mt-0">
              {renderTemplatesList(filteredTemplates, isLoading)}
            </TabsContent>
            <TabsContent value="discord" className="mt-0">
              {renderTemplatesList(filteredTemplates, isLoading)}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Edit/Create Template Dialog */}
      <Dialog open={isEditing || isCreating} onOpenChange={(open) => {
        if (!open) {
          setIsEditing(false);
          setIsCreating(false);
        }
      }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Template" : "Create Template"}</DialogTitle>
            <DialogDescription>
              {isEditing 
                ? "Update your response template for consistent messaging."
                : "Create a new response template for consistent messaging."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                name="name"
                placeholder="Template name"
                className="col-span-3"
                value={formData.name}
                onChange={handleInputChange}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="category" className="text-right">
                Category
              </Label>
              <Select
                value={formData.category}
                onValueChange={(value) => handleSelectChange("category", value)}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="greetings">Greetings</SelectItem>
                  <SelectItem value="support">Support</SelectItem>
                  <SelectItem value="moderation">Moderation</SelectItem>
                  <SelectItem value="faq">FAQ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="platform" className="text-right">
                Platform
              </Label>
              <Select
                value={formData.platform}
                onValueChange={(value) => handleSelectChange("platform", value)}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Platforms</SelectItem>
                  <SelectItem value="website">Website</SelectItem>
                  <SelectItem value="telegram">Telegram</SelectItem>
                  <SelectItem value="discord">Discord</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="content" className="text-right pt-2">
                Content
              </Label>
              <Textarea
                id="content"
                name="content"
                placeholder="Template content"
                className="col-span-3 min-h-[150px]"
                value={formData.content}
                onChange={handleInputChange}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsEditing(false);
              setIsCreating(false);
            }}>
              Cancel
            </Button>
            <Button onClick={handleSaveTemplate}>Save Template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this template? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteTemplate}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  function renderTemplatesList(templates, isLoading) {
    if (isLoading) {
      return (
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="border rounded-lg p-4 space-y-3">
              <div className="h-5 bg-accent rounded w-1/3"></div>
              <div className="h-4 bg-accent rounded w-1/4"></div>
              <div className="h-10 bg-accent rounded w-full"></div>
            </div>
          ))}
        </div>
      );
    }

    if (!templates || templates.length === 0) {
      return (
        <div className="text-center py-12 border rounded-lg">
          <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <h3 className="mt-4 text-lg font-medium">No templates found</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Create your first template to get started.
          </p>
          <Button className="mt-6" onClick={handleCreateClick}>
            <Plus className="mr-2 h-4 w-4" />
            Create Template
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {templates.map((template) => (
          <div key={template.id} className="border rounded-lg p-5 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium text-foreground">{template.name}</h3>
                <div className="flex mt-1 items-center space-x-2">
                  <Badge variant="secondary" className="text-xs">
                    {template.category.charAt(0).toUpperCase() + template.category.slice(1)}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {template.platform === "all" 
                      ? "All Platforms" 
                      : template.platform.charAt(0).toUpperCase() + template.platform.slice(1)}
                  </Badge>
                </div>
              </div>
              <div className="flex space-x-1">
                <Button variant="ghost" size="sm" onClick={() => handleEditClick(template)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDeleteClick(template)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
            <div className="bg-accent rounded-md p-3 text-sm text-foreground/80 whitespace-pre-line">
              {template.content}
            </div>
          </div>
        ))}
      </div>
    );
  }
};

export default Templates;
