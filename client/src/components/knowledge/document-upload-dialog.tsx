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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Loader2, 
  Upload, 
  FileText, 
  Globe, 
  HelpCircle, 
  MessageSquare,
  RefreshCcw,
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

type UrlSyncMode = "manual" | "scheduled";
type UrlSyncRecurrence = "daily" | "weekly";

const WEEKDAY_OPTIONS = [
  { label: "Sun", value: 0 },
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
];

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
  const [fileExtractedMetadata, setFileExtractedMetadata] = useState<Record<string, unknown> | null>(null);
  
  // URL scraping state
  const [url, setUrl] = useState("");
  const [urlTitle, setUrlTitle] = useState("");
  const [urlContent, setUrlContent] = useState("");
  const [isScrapingUrl, setIsScrapingUrl] = useState(false);
  
  // FAQ state
  const [faqTitle, setFaqTitle] = useState("Frequently Asked Questions");
  const [faqItems, setFaqItems] = useState<FAQItem[]>([{ question: "", answer: "" }]);
  
  // Q&A state (quick item)
  const [qaTitle, setQaTitle] = useState("");
  const [qaQuestion, setQaQuestion] = useState("");
  const [qaAnswer, setQaAnswer] = useState("");

  // URL Sync source state
  const [urlSyncName, setUrlSyncName] = useState("");
  const [urlSyncSeedUrl, setUrlSyncSeedUrl] = useState("");
  const [urlSyncPathPrefix, setUrlSyncPathPrefix] = useState("/");
  const [urlSyncMode, setUrlSyncMode] = useState<UrlSyncMode>("manual");
  const [urlSyncRecurrence, setUrlSyncRecurrence] = useState<UrlSyncRecurrence>("daily");
  const [urlSyncTime, setUrlSyncTime] = useState("09:00");
  const [urlSyncTimezone, setUrlSyncTimezone] = useState(
    typeof window !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" : "UTC",
  );
  const [urlSyncDaysOfWeek, setUrlSyncDaysOfWeek] = useState<number[]>([1]);

  const uploadMutation = useMutation({
    mutationFn: async (data: { title: string; content: string; metadata?: Record<string, unknown> }) => {
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
      queryClient.invalidateQueries({ queryKey: [`/api/knowledge-bases/${knowledgeBaseId}/documents`] });
    },
    onError: (error: any) => {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to add content. Please try again.",
        variant: "destructive",
      });
    },
  });

  const createUrlSourceMutation = useMutation({
    mutationFn: async (payload: {
      name?: string;
      seedUrl: string;
      pathPrefix: string;
      syncMode: UrlSyncMode;
      scheduleRecurrence?: UrlSyncRecurrence;
      scheduleDaysOfWeek?: number[];
      scheduleTime?: string;
      scheduleTimezone?: string;
    }) => {
      const res = await apiRequest("POST", `/api/knowledge-bases/${knowledgeBaseId}/url-sources`, payload);
      return res.json();
    },
    onSuccess: async (created: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/knowledge-bases/${knowledgeBaseId}/url-sources`] });
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-bases"] });
      toast({
        title: "URL sync source created",
        description: "You can now sync pages from this path into the knowledge base.",
      });
      return created;
    },
    onError: (error: any) => {
      toast({
        title: "URL sync source failed",
        description: error.message || "Failed to create URL sync source.",
        variant: "destructive",
      });
    },
  });

  const runUrlSourceSyncMutation = useMutation({
    mutationFn: async (sourceId: number) => {
      const res = await apiRequest("POST", `/api/knowledge-url-sources/${sourceId}/sync`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Sync started",
        description: "The URL sync run has started in the background.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Sync trigger failed",
        description: error.message || "Failed to start URL sync.",
        variant: "destructive",
      });
    },
  });

  const resetAllForms = () => {
    // Reset file upload
    setTitle("");
    setContent("");
    setFile(null);
    setFileExtractedMetadata(null);
    
    // Reset URL form
    setUrl("");
    setUrlTitle("");
    setUrlContent("");
    
    // Reset FAQ form
    setFaqTitle("Frequently Asked Questions");
    setFaqItems([{ question: "", answer: "" }]);
    
    // Reset Q&A form
    setQaTitle("");
    setQaQuestion("");
    setQaAnswer("");

    // Reset URL sync form
    setUrlSyncName("");
    setUrlSyncSeedUrl("");
    setUrlSyncPathPrefix("/");
    setUrlSyncMode("manual");
    setUrlSyncRecurrence("daily");
    setUrlSyncTime("09:00");
    setUrlSyncTimezone(typeof window !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" : "UTC");
    setUrlSyncDaysOfWeek([1]);
    
    // Reset to first tab
    setActiveTab("file");
  };

  const derivePathPrefixFromUrl = (value: string) => {
    try {
      const u = new URL(value);
      const path = u.pathname && u.pathname !== "/" ? u.pathname.replace(/\/+$/, "") || "/" : "/";
      setUrlSyncPathPrefix(path.startsWith("/") ? path : `/${path}`);
    } catch {
      // ignore invalid URL while typing
    }
  };

  const toggleUrlSyncWeekday = (day: number, checked: boolean) => {
    setUrlSyncDaysOfWeek((prev) => {
      const next = checked ? [...prev, day] : prev.filter((d) => d !== day);
      return Array.from(new Set(next)).sort((a, b) => a - b);
    });
  };

  const isUrlSyncScheduled = urlSyncMode === "scheduled";
  const isUrlSyncInvalid =
    !urlSyncSeedUrl.trim() ||
    !urlSyncPathPrefix.trim() ||
    (isUrlSyncScheduled &&
      (!urlSyncTime.trim() ||
        (urlSyncRecurrence === "weekly" && urlSyncDaysOfWeek.length === 0) ||
        !urlSyncTimezone.trim()));

  const isUrlSyncBusy = createUrlSourceMutation.isPending || runUrlSourceSyncMutation.isPending;

  const handleCreateUrlSyncSource = async (runImmediately: boolean) => {
    if (isUrlSyncInvalid) {
      toast({
        title: "Missing URL sync details",
        description: "Please provide a valid seed URL, path prefix, and schedule fields.",
        variant: "destructive",
      });
      return;
    }

    const payload: any = {
      name: urlSyncName.trim() || undefined,
      seedUrl: urlSyncSeedUrl.trim(),
      pathPrefix: urlSyncPathPrefix.trim(),
      syncMode: urlSyncMode,
    };
    if (isUrlSyncScheduled) {
      payload.scheduleRecurrence = urlSyncRecurrence;
      payload.scheduleTime = urlSyncTime;
      payload.scheduleTimezone = urlSyncTimezone;
      if (urlSyncRecurrence === "weekly") {
        payload.scheduleDaysOfWeek = urlSyncDaysOfWeek;
      }
    }

    try {
      const created = await createUrlSourceMutation.mutateAsync(payload);
      if (runImmediately && created?.id) {
        await runUrlSourceSyncMutation.mutateAsync(created.id);
      }
      onOpenChange(false);
      resetAllForms();
    } catch {
      // handled in mutation callbacks
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    setIsFileReading(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const response = await apiRequest("POST", `/api/knowledge-bases/${knowledgeBaseId}/documents/parse-file`, formData);
      const parsed = await response.json();

      setTitle(String(parsed.title || selectedFile.name.replace(/\.[^/.]+$/, "")));
      setContent(String(parsed.content || ""));
      setFileExtractedMetadata(
        parsed?.metadata && typeof parsed.metadata === "object"
          ? (parsed.metadata as Record<string, unknown>)
          : null,
      );

      toast({
        title: "File processed",
        description: "Content extracted on the server. Review and edit before saving if needed.",
      });
    } catch (error: any) {
      setContent("");
      setFileExtractedMetadata(null);
      toast({
        title: "File processing failed",
        description: error.message || "Failed to parse the selected file.",
        variant: "destructive",
      });
    } finally {
      setIsFileReading(false);
    }
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
      const response = await apiRequest("POST", "/api/extract-url-content", { url });
      const data = await response.json();
      
      // Set the extracted data
      setUrlTitle(data.title || `Content from ${new URL(url).hostname}`);
      setUrlContent(data.content || "");
      setIsScrapingUrl(false);
      
      toast({
        title: "URL processed",
        description: "URL content has been extracted successfully",
      });
    } catch (error: any) {
      setIsScrapingUrl(false);
      setUrlContent("");
      toast({
        title: "URL processing failed",
        description: error.message || "Failed to process the URL. Please check the URL and try again.",
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
        submissionContent = `Source URL: ${url}\n\n${urlContent}`;
        if (!url.trim() || !urlTitle.trim() || !urlContent.trim()) {
          toast({
            title: "Missing information",
            description: "Please extract content from the URL first",
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

      case "url-sync":
        return;
    }
    
    uploadMutation.mutate({
      title: submissionTitle,
      content: submissionContent,
      metadata: activeTab === "file" ? (fileExtractedMetadata || undefined) : undefined,
    });
  };

  const isUploading = uploadMutation.isPending;
  const isFileDisabled = isUploading || isFileReading || !title.trim() || !content.trim();
  const isUrlDisabled = isUploading || isScrapingUrl || !url.trim() || !urlTitle.trim() || !urlContent.trim();
  const isFaqDisabled = isUploading || faqItems.filter(item => item.question.trim() && item.answer.trim()).length === 0;
  const isQaDisabled = isUploading || !qaQuestion.trim() || !qaAnswer.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Knowledge</DialogTitle>
          <DialogDescription>
            Add content to your knowledge base. The AI will use this information to answer user questions.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-5 mb-4">
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
            <TabsTrigger value="url-sync">
              <RefreshCcw className="h-4 w-4 mr-2" />
              URL Sync
            </TabsTrigger>
          </TabsList>
          
          <form onSubmit={handleSubmit}>
            <TabsContent value="file" className="space-y-4">
              <div>
                <Label htmlFor="file">Select File</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".txt,.md,.csv,.json,.pdf,.doc,.docx,.xlsx,.pptx"
                  onChange={handleFileChange}
                  disabled={isUploading}
                  className="mt-1 cursor-pointer"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Supported formats: .txt, .md, .csv, .json, .pdf, .docx, .xlsx, .pptx (.doc: convert to .docx)
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
                  className="min-h-[120px] mt-1"
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
                <div className="min-h-[120px] max-h-[300px] mt-1 border rounded-md p-4 text-sm bg-muted/50 overflow-y-auto">
                  {isScrapingUrl ? (
                    <div className="h-full space-y-3">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-5/6" />
                      <Skeleton className="h-3 w-3/4" />
                    </div>
                  ) : urlContent ? (
                    <div>
                      <p className="font-semibold text-sm mb-3 text-primary flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        Extracted Content ({urlContent.length.toLocaleString()} characters)
                      </p>
                      <div className="prose prose-sm max-w-none">
                        <div className="whitespace-pre-line text-xs leading-relaxed text-foreground/90 space-y-2">
                          {urlContent.substring(0, 1000)}
                          {urlContent.length > 1000 && (
                            <div className="mt-3 pt-2 border-t border-border">
                              <p className="text-xs text-muted-foreground italic">
                                Preview showing first 1,000 characters of {urlContent.length.toLocaleString()} total characters.
                                Full content will be saved to knowledge base.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : url ? (
                    <p className="text-muted-foreground">Click the extract button to fetch content from {url}</p>
                  ) : (
                    <p className="text-muted-foreground">Enter a URL and click extract to preview content</p>
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
                  className="min-h-[100px] mt-1"
                />
              </div>
            </TabsContent>

            <TabsContent value="url-sync" className="space-y-4">
              <div className="rounded-md border p-3 bg-muted/30">
                <p className="text-sm font-medium">Managed URL Sync</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Crawl and re-sync pages under a path prefix into your knowledge base. Each page becomes one document.
                </p>
              </div>

              <div>
                <Label htmlFor="urlSyncName">Source Name (Optional)</Label>
                <Input
                  id="urlSyncName"
                  value={urlSyncName}
                  onChange={(e) => setUrlSyncName(e.target.value)}
                  placeholder="Docs site (e.g. Product Docs)"
                  disabled={isUrlSyncBusy}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  File content is extracted server-side so binary formats can be parsed before saving.
                </p>
              </div>

              <div>
                <Label htmlFor="urlSyncSeedUrl">Seed URL</Label>
                <Input
                  id="urlSyncSeedUrl"
                  value={urlSyncSeedUrl}
                  onChange={(e) => {
                    setUrlSyncSeedUrl(e.target.value);
                    derivePathPrefixFromUrl(e.target.value);
                  }}
                  placeholder="https://example.com/docs"
                  disabled={isUrlSyncBusy}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Crawl is limited to the same host and the path prefix below.
                </p>
              </div>

              <div>
                <Label htmlFor="urlSyncPathPrefix">Path Prefix</Label>
                <Input
                  id="urlSyncPathPrefix"
                  value={urlSyncPathPrefix}
                  onChange={(e) => setUrlSyncPathPrefix(e.target.value)}
                  placeholder="/docs"
                  disabled={isUrlSyncBusy}
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Sync Mode</Label>
                  <Select value={urlSyncMode} onValueChange={(v: UrlSyncMode) => setUrlSyncMode(v)} disabled={isUrlSyncBusy}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {isUrlSyncScheduled && (
                  <div>
                    <Label>Recurrence</Label>
                    <Select
                      value={urlSyncRecurrence}
                      onValueChange={(v: UrlSyncRecurrence) => setUrlSyncRecurrence(v)}
                      disabled={isUrlSyncBusy}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {isUrlSyncScheduled && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="urlSyncTime">Run Time</Label>
                      <Input
                        id="urlSyncTime"
                        type="time"
                        value={urlSyncTime}
                        onChange={(e) => setUrlSyncTime(e.target.value)}
                        disabled={isUrlSyncBusy}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="urlSyncTimezone">Timezone</Label>
                      <Input
                        id="urlSyncTimezone"
                        value={urlSyncTimezone}
                        onChange={(e) => setUrlSyncTimezone(e.target.value)}
                        placeholder="UTC"
                        disabled={isUrlSyncBusy}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  {urlSyncRecurrence === "weekly" && (
                    <div>
                      <Label>Days of Week</Label>
                      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mt-2">
                        {WEEKDAY_OPTIONS.map((day) => (
                          <label
                            key={day.value}
                            className="flex items-center gap-2 text-sm border rounded-md px-2 py-2 cursor-pointer"
                          >
                            <Checkbox
                              checked={urlSyncDaysOfWeek.includes(day.value)}
                              onCheckedChange={(checked) => toggleUrlSyncWeekday(day.value, checked === true)}
                              disabled={isUrlSyncBusy}
                            />
                            <span>{day.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
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

              {activeTab === "url-sync" ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleCreateUrlSyncSource(false)}
                    disabled={isUrlSyncBusy || isUrlSyncInvalid}
                  >
                    {createUrlSourceMutation.isPending && !runUrlSourceSyncMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <RefreshCcw className="h-4 w-4 mr-2" />
                        Create Source
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleCreateUrlSyncSource(true)}
                    disabled={isUrlSyncBusy || isUrlSyncInvalid}
                  >
                    {isUrlSyncBusy ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Working...
                      </>
                    ) : (
                      <>
                        <RefreshCcw className="h-4 w-4 mr-2" />
                        Create & Run First Sync
                      </>
                    )}
                  </Button>
                </>
              ) : (
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
              )}
            </DialogFooter>
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
