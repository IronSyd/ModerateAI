import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Upload } from "lucide-react";

interface DocumentUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  knowledgeBaseId: number;
}

export function DocumentUploadDialog({
  open,
  onOpenChange,
  knowledgeBaseId,
}: DocumentUploadDialogProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isFileReading, setIsFileReading] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: async (data: { title: string; content: string }) => {
      return apiRequest("POST", `/api/knowledge-bases/${knowledgeBaseId}/documents`, data);
    },
    onSuccess: () => {
      // Reset form
      setTitle("");
      setContent("");
      setFile(null);
      
      // Close dialog
      onOpenChange(false);
      
      // Show success toast
      toast({
        title: "Document uploaded",
        description: "Your document has been added to the knowledge base",
      });
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-bases"] });
    },
    onError: (error: any) => {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload document. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    setIsFileReading(true);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        // Extract title from filename (remove extension)
        const fileName = selectedFile.name.replace(/\.[^/.]+$/, "");
        setTitle(fileName);
        
        // Set content from file
        setContent(event.target.result as string);
        setIsFileReading(false);
      }
    };
    reader.onerror = () => {
      toast({
        title: "File reading error",
        description: "Failed to read the selected file",
        variant: "destructive",
      });
      setIsFileReading(false);
    };
    
    reader.readAsText(selectedFile);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !content.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide both a title and content for your document",
        variant: "destructive",
      });
      return;
    }
    
    uploadMutation.mutate({ title, content });
  };

  const isUploading = uploadMutation.isPending;
  const isDisabled = isUploading || isFileReading || !title.trim() || !content.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            Add a document to your knowledge base. The AI will use this information to answer user questions.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div className="space-y-4">
            <div>
              <Label htmlFor="file">Select File (Optional)</Label>
              <Input
                id="file"
                type="file"
                accept=".txt,.md,.csv,.json"
                onChange={handleFileChange}
                disabled={isUploading}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Supported formats: .txt, .md, .csv, .json
              </p>
            </div>
            
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Document title"
                disabled={isUploading || isFileReading}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Paste or type document content here"
                disabled={isUploading || isFileReading}
                className="min-h-[200px] mt-1"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isDisabled}>
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Document
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}