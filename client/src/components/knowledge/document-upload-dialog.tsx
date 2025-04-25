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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Loader2, 
  Upload, 
  FileText, 
  Globe, 
  HelpCircle, 
  MessageSquare 
} from "lucide-react";

interface DocumentUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  knowledgeBaseId: number;
}

interface FAQItem {
  question: string;
  answer: string;
}

export function DocumentUploadDialog({
  open,
  onOpenChange,
  knowledgeBaseId,
}: DocumentUploadDialogProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("file");
  
  // File upload state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isFileReading, setIsFileReading] = useState(false);
  
  // URL scraping state
  const [url, setUrl] = useState("");
  const [urlTitle, setUrlTitle] = useState("");
  const [isScrapingUrl, setIsScrapingUrl] = useState(false);
  
  // FAQ state
  const [faqTitle, setFaqTitle] = useState("Frequently Asked Questions");
  const [faqItems, setFaqItems] = useState<FAQItem[]>([{ question: "", answer: "" }]);
  
  // Q&A state (quick item)
  const [qaTitle, setQaTitle] = useState("");
  const [qaQuestion, setQaQuestion] = useState("");
  const [qaAnswer, setQaAnswer] = useState("");

  const uploadMutation = useMutation({
    mutationFn: async (data: { title: string; content: string }) => {
      return apiRequest("POST", `/api/knowledge-bases/${knowledgeBaseId}/documents`, data);
    },
    onSuccess: () => {
      // Reset forms
      resetAllForms();
      
      // Close dialog
      onOpenChange(false);
      
      // Show success toast
      toast({
        title: "Knowledge added",
        description: "Your content has been added to the knowledge base",
      });
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-bases"] });
    },
    onError: (error: any) => {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to add content. Please try again.",
        variant: "destructive",
      });
    },
  });

  const resetAllForms = () => {
    // Reset file upload
    setTitle("");
    setContent("");
    setFile(null);
    
    // Reset URL form
    setUrl("");
    setUrlTitle("");
    
    // Reset FAQ form
    setFaqTitle("Frequently Asked Questions");
    setFaqItems([{ question: "", answer: "" }]);
    
    // Reset Q&A form
    setQaTitle("");
    setQaQuestion("");
    setQaAnswer("");
    
    // Reset to first tab
    setActiveTab("file");
  };

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
  
  const handleUrlScrape = async () => {
    if (!url.trim()) {
      toast({
        title: "Missing URL",
        description: "Please enter a valid URL to scrape",
        variant: "destructive",
      });
      return;
    }
    
    setIsScrapingUrl(true);
    
    try {
      // In a real implementation, this would call your backend to scrape the URL
      // For now we'll simulate it with a timeout
      setTimeout(() => {
        // Extract domain as the title if not provided
        const urlObj = new URL(url);
        const domain = urlObj.hostname.replace('www.', '');
        
        setUrlTitle(urlTitle || `Content from ${domain}`);
        setIsScrapingUrl(false);
        
        toast({
          title: "URL processed",
          description: "URL content has been retrieved successfully",
        });
      }, 1500);
    } catch (error) {
      setIsScrapingUrl(false);
      toast({
        title: "URL processing failed",
        description: "Failed to process the URL. Please check the URL and try again.",
        variant: "destructive",
      });
    }
  };
  
  const addFaqItem = () => {
    setFaqItems([...faqItems, { question: "", answer: "" }]);
  };
  
  const removeFaqItem = (index: number) => {
    if (faqItems.length <= 1) return;
    const newItems = [...faqItems];
    newItems.splice(index, 1);
    setFaqItems(newItems);
  };
  
  const updateFaqItem = (index: number, field: 'question' | 'answer', value: string) => {
    const newItems = [...faqItems];
    newItems[index][field] = value;
    setFaqItems(newItems);
  };
  
  const prepareFaqContent = (): string => {
    let content = `# ${faqTitle}\n\n`;
    
    faqItems.forEach((item, index) => {
      if (item.question.trim() && item.answer.trim()) {
        content += `## Q${index + 1}: ${item.question}\n${item.answer}\n\n`;
      }
    });
    
    return content;
  };
  
  const prepareQaContent = (): string => {
    return `# ${qaTitle || "Quick Answer"}\n\n**Question:** ${qaQuestion}\n\n**Answer:** ${qaAnswer}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    let submissionTitle = "";
    let submissionContent = "";
    
    switch (activeTab) {
      case "file":
        submissionTitle = title;
        submissionContent = content;
        if (!title.trim() || !content.trim()) {
          toast({
            title: "Missing information",
            description: "Please provide both a title and content for your document",
            variant: "destructive",
          });
          return;
        }
        break;
        
      case "url":
        submissionTitle = urlTitle;
        submissionContent = `Source URL: ${url}\n\n${content}`;
        if (!url.trim() || !urlTitle.trim()) {
          toast({
            title: "Missing information",
            description: "Please provide both a URL and title",
            variant: "destructive",
          });
          return;
        }
        break;
        
      case "faq":
        const validFaqItems = faqItems.filter(item => item.question.trim() && item.answer.trim());
        if (validFaqItems.length === 0) {
          toast({
            title: "Missing FAQ items",
            description: "Please add at least one question and answer",
            variant: "destructive",
          });
          return;
        }
        submissionTitle = faqTitle;
        submissionContent = prepareFaqContent();
        break;
        
      case "qa":
        if (!qaQuestion.trim() || !qaAnswer.trim()) {
          toast({
            title: "Missing information",
            description: "Please provide both a question and answer",
            variant: "destructive",
          });
          return;
        }
        submissionTitle = qaTitle || `Q&A: ${qaQuestion.substring(0, 30)}...`;
        submissionContent = prepareQaContent();
        break;
    }
    
    uploadMutation.mutate({ title: submissionTitle, content: submissionContent });
  };

  const isUploading = uploadMutation.isPending;
  const isFileDisabled = isUploading || isFileReading || !title.trim() || !content.trim();
  const isUrlDisabled = isUploading || isScrapingUrl || !url.trim() || !urlTitle.trim();
  const isFaqDisabled = isUploading || faqItems.filter(item => item.question.trim() && item.answer.trim()).length === 0;
  const isQaDisabled = isUploading || !qaQuestion.trim() || !qaAnswer.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Add Knowledge</DialogTitle>
          <DialogDescription>
            Add content to your knowledge base. The AI will use this information to answer user questions.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-4 mb-4">
            <TabsTrigger value="file">
              <FileText className="h-4 w-4 mr-2" />
              File
            </TabsTrigger>
            <TabsTrigger value="url">
              <Globe className="h-4 w-4 mr-2" />
              URL
            </TabsTrigger>
            <TabsTrigger value="faq">
              <HelpCircle className="h-4 w-4 mr-2" />
              FAQ
            </TabsTrigger>
            <TabsTrigger value="qa">
              <MessageSquare className="h-4 w-4 mr-2" />
              Q&A
            </TabsTrigger>
          </TabsList>
          
          <form onSubmit={handleSubmit}>
            <TabsContent value="file" className="space-y-4">
              <div>
                <Label htmlFor="file">Select File</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".txt,.md,.csv,.json,.pdf"
                  onChange={handleFileChange}
                  disabled={isUploading}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Supported formats: .txt, .md, .csv, .json, .pdf
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
            </TabsContent>
            
            <TabsContent value="url" className="space-y-4">
              <div>
                <Label htmlFor="url">URL to Process</Label>
                <div className="flex mt-1 gap-2">
                  <Input
                    id="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com/page-to-scrape"
                    disabled={isUploading || isScrapingUrl}
                    className="flex-1"
                  />
                  <Button 
                    type="button" 
                    onClick={handleUrlScrape} 
                    disabled={isUploading || isScrapingUrl || !url.trim()}
                  >
                    {isScrapingUrl ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Globe className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Enter a URL to extract and process its content
                </p>
              </div>
              
              <div>
                <Label htmlFor="urlTitle">Title</Label>
                <Input
                  id="urlTitle"
                  value={urlTitle}
                  onChange={(e) => setUrlTitle(e.target.value)}
                  placeholder="Title for this URL content"
                  disabled={isUploading || isScrapingUrl}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label>Preview Content</Label>
                <div className="min-h-[150px] mt-1 border rounded-md p-3 text-sm bg-muted/50">
                  {isScrapingUrl ? (
                    <div className="flex flex-col items-center justify-center h-full">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="mt-2 text-sm text-muted-foreground">Processing URL...</p>
                    </div>
                  ) : url ? (
                    <p>Content will be extracted from {url}</p>
                  ) : (
                    <p className="text-muted-foreground">URL content will appear here</p>
                  )}
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="faq" className="space-y-4">
              <div>
                <Label htmlFor="faqTitle">FAQ Title</Label>
                <Input
                  id="faqTitle"
                  value={faqTitle}
                  onChange={(e) => setFaqTitle(e.target.value)}
                  placeholder="Title for this FAQ collection"
                  disabled={isUploading}
                  className="mt-1"
                />
              </div>
              
              <div className="space-y-4">
                <Label>FAQ Items</Label>
                
                {faqItems.map((item, index) => (
                  <div key={index} className="space-y-2 border rounded-md p-3">
                    <div className="flex justify-between items-center">
                      <Label htmlFor={`question-${index}`} className="text-sm">Question {index + 1}</Label>
                      {faqItems.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFaqItem(index)}
                          className="h-8 px-2"
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                    
                    <Input
                      id={`question-${index}`}
                      value={item.question}
                      onChange={(e) => updateFaqItem(index, 'question', e.target.value)}
                      placeholder="Enter a question"
                      disabled={isUploading}
                    />
                    
                    <Textarea
                      id={`answer-${index}`}
                      value={item.answer}
                      onChange={(e) => updateFaqItem(index, 'answer', e.target.value)}
                      placeholder="Enter the answer"
                      disabled={isUploading}
                      className="min-h-[100px]"
                    />
                  </div>
                ))}
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={addFaqItem}
                  disabled={isUploading}
                  className="w-full"
                >
                  Add FAQ Item
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="qa" className="space-y-4">
              <div>
                <Label htmlFor="qaTitle">Title (Optional)</Label>
                <Input
                  id="qaTitle"
                  value={qaTitle}
                  onChange={(e) => setQaTitle(e.target.value)}
                  placeholder="Quick Answer"
                  disabled={isUploading}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  A title will be generated from the question if not provided
                </p>
              </div>
              
              <div>
                <Label htmlFor="qaQuestion">Question</Label>
                <Input
                  id="qaQuestion"
                  value={qaQuestion}
                  onChange={(e) => setQaQuestion(e.target.value)}
                  placeholder="Enter a specific question"
                  disabled={isUploading}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="qaAnswer">Answer</Label>
                <Textarea
                  id="qaAnswer"
                  value={qaAnswer}
                  onChange={(e) => setQaAnswer(e.target.value)}
                  placeholder="Enter the detailed answer"
                  disabled={isUploading}
                  className="min-h-[150px] mt-1"
                />
              </div>
            </TabsContent>
            
            <DialogFooter className="mt-6">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                disabled={isUploading}
              >
                Cancel
              </Button>
              
              <Button 
                type="submit" 
                disabled={
                  (activeTab === "file" && isFileDisabled) ||
                  (activeTab === "url" && isUrlDisabled) ||
                  (activeTab === "faq" && isFaqDisabled) ||
                  (activeTab === "qa" && isQaDisabled)
                }
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Add to Knowledge Base
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}