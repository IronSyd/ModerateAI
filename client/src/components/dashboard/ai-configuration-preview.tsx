import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { FileBadge } from "lucide-react";

type AIConfigurationPreviewProps = {
  config: {
    responseStyle: number;
    responseStyleText: string;
    responseLength: number;
    responseLengthText: string;
    moderationStrictness: number;
    moderationStrictnessText: string;
  };
  knowledgeBase: {
    name: string;
    documentCount: number;
  };
  isLoading: boolean;
};

const AIConfigurationPreview = ({ 
  config, 
  knowledgeBase,
  isLoading 
}: AIConfigurationPreviewProps) => {
  if (isLoading) {
    return (
      <div className="bg-card rounded-lg shadow-sm border border-border p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-5 bg-muted rounded w-1/3"></div>
          <div className="space-y-3">
            <div className="h-3 bg-muted rounded w-1/4"></div>
            <div className="h-2 bg-muted rounded"></div>
            <div className="h-3 bg-muted rounded w-1/4"></div>
            <div className="h-2 bg-muted rounded"></div>
            <div className="h-3 bg-muted rounded w-1/4"></div>
            <div className="h-2 bg-muted rounded"></div>
          </div>
          <div className="h-10 bg-muted rounded"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-card rounded-lg shadow-sm border border-border p-6">
      <h3 className="text-base font-medium text-foreground mb-4">Current AI Model Settings</h3>
      
      <div className="space-y-4">
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="block text-sm font-medium text-foreground">Response Style</label>
            <span className="text-xs text-muted-foreground">{config.responseStyleText}</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full" 
              style={{ width: `${config.responseStyle}%` }}
            ></div>
          </div>
        </div>
        
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="block text-sm font-medium text-foreground">Response Length</label>
            <span className="text-xs text-muted-foreground">{config.responseLengthText}</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full" 
              style={{ width: `${config.responseLength}%` }}
            ></div>
          </div>
        </div>
        
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="block text-sm font-medium text-foreground">Moderation Strictness</label>
            <span className="text-xs text-muted-foreground">{config.moderationStrictnessText}</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full" 
              style={{ width: `${config.moderationStrictness}%` }}
            ></div>
          </div>
        </div>
      </div>
      
      <div className="border-t border-border mt-5 pt-5">
        <h4 className="text-sm font-medium text-foreground mb-3">Active Knowledge Base</h4>
        <div className="flex items-center justify-between p-3 bg-secondary/10 rounded-md">
          <div className="flex items-center">
            <FileBadge className="h-5 w-5 text-muted-foreground mr-2" />
            <span className="text-sm text-foreground">{knowledgeBase.name}</span>
          </div>
          <span className="text-xs text-muted-foreground">{knowledgeBase.documentCount} docs</span>
        </div>
      </div>
      
      <div className="mt-6">
        <Link href="/ai-configuration">
          <Button className="w-full">
            Edit Configuration
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default AIConfigurationPreview;
