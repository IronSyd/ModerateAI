import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Database, 
  FileText, 
  Plus, 
  Upload,
  Book,
  Search,
  MoreVertical,
  Trash2,
  Edit,
  Eye,
  X
} from "lucide-react";
import { CreateKnowledgeBaseDialog } from "@/components/knowledge/create-knowledge-base-dialog";
import { DocumentUploadDialog } from "@/components/knowledge/document-upload-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface KnowledgeBase {
  id: number;
  name: string;
  description: string | null;
  documentCount: number;
  isActive: boolean;
  createdAt: string;
}

interface KnowledgeDocument {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export default function KnowledgeBasePage() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedKnowledgeBase, setSelectedKnowledgeBase] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewingDocument, setViewingDocument] = useState<KnowledgeDocument | null>(null);

  // Fetch knowledge bases
  const { data: knowledgeBases = [], isLoading: isLoadingBases } = useQuery<KnowledgeBase[]>({
    queryKey: ["/api/knowledge-bases"],
  });

  // Fetch documents for selected knowledge base
  const { data: documents = [], isLoading: isLoadingDocs } = useQuery<KnowledgeDocument[]>({
    queryKey: [`/api/knowledge-bases/${selectedKnowledgeBase}/documents`],
    enabled: !!selectedKnowledgeBase,
  });

  const filteredBases = knowledgeBases.filter(base =>
    base.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (base.description && base.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleUploadClick = (knowledgeBaseId: number) => {
    setSelectedKnowledgeBase(knowledgeBaseId);
    setUploadDialogOpen(true);
  };

  if (isLoadingBases) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Knowledge Base</h1>
            <p className="text-muted-foreground">Manage your AI's knowledge and information</p>
          </div>
        </div>
        <div className="grid gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-1/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-3 bg-muted rounded w-full"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Knowledge Base</h1>
          <p className="text-muted-foreground">Manage your AI's knowledge and information</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Knowledge Base
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search knowledge bases..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Knowledge Bases Grid */}
      {filteredBases.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Knowledge Bases Found</h3>
            <p className="text-muted-foreground mb-4">
              {knowledgeBases.length === 0 
                ? "Create your first knowledge base to start storing information for your AI"
                : "No knowledge bases match your search criteria"
              }
            </p>
            {knowledgeBases.length === 0 && (
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Knowledge Base
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredBases.map((base) => (
            <Card key={base.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Book className="h-5 w-5 text-primary" />
                      {base.name}
                      {!base.isActive && (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </CardTitle>
                    {base.description && (
                      <CardDescription className="mt-1">
                        {base.description}
                      </CardDescription>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Documents</span>
                    <Badge variant="outline">
                      <FileText className="h-3 w-3 mr-1" />
                      {base.documentCount}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Created</span>
                    <span>{new Date(base.createdAt).toLocaleDateString()}</span>
                  </div>
                  
                  <div className="pt-2 space-y-2">
                    <Button 
                      className="w-full" 
                      onClick={() => handleUploadClick(base.id)}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Add Knowledge
                    </Button>
                    
                    {base.documentCount > 0 && (
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={() => setSelectedKnowledgeBase(base.id)}
                      >
                        <Search className="h-4 w-4 mr-2" />
                        View Documents ({base.documentCount})
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Documents Preview */}
      {selectedKnowledgeBase && documents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Documents in {knowledgeBases.find(b => b.id === selectedKnowledgeBase)?.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {documents.slice(0, 5).map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div 
                    className="flex-1 cursor-pointer" 
                    onClick={() => setViewingDocument(doc)}
                  >
                    <h4 className="font-medium hover:text-primary transition-colors">{doc.title}</h4>
                    <p className="text-sm text-muted-foreground">
                      Updated {new Date(doc.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setViewingDocument(doc)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setViewingDocument(doc)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
              {documents.length > 5 && (
                <p className="text-sm text-muted-foreground text-center pt-2">
                  And {documents.length - 5} more documents...
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <CreateKnowledgeBaseDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
      
      {selectedKnowledgeBase && (
        <DocumentUploadDialog
          open={uploadDialogOpen}
          onOpenChange={setUploadDialogOpen}
          knowledgeBaseId={selectedKnowledgeBase}
        />
      )}
      
      {/* Document Viewer Dialog */}
      <Dialog open={!!viewingDocument} onOpenChange={() => setViewingDocument(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {viewingDocument?.title}
                </DialogTitle>
                <DialogDescription>
                  Updated {viewingDocument && new Date(viewingDocument.updatedAt).toLocaleDateString()}
                  {viewingDocument && viewingDocument.createdAt !== viewingDocument.updatedAt && (
                    <span> • Created {new Date(viewingDocument.createdAt).toLocaleDateString()}</span>
                  )}
                </DialogDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewingDocument(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
          
          <ScrollArea className="flex-1 mt-4">
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground bg-background/50 rounded-md p-4 border">
                {viewingDocument?.content}
              </div>
            </div>
          </ScrollArea>
          
          <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
            <Button variant="outline" onClick={() => setViewingDocument(null)}>
              Close
            </Button>
            <Button onClick={() => {
              if (viewingDocument) {
                setViewingDocument(null);
                // TODO: Implement document editing functionality
                alert('Document editing functionality will be implemented soon!');
              }
            }}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Document
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}