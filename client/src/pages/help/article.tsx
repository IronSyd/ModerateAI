import React, { useState, useEffect } from "react";
import { useParams } from "wouter";
import { ChevronLeft, HelpCircle, BookOpen, Printer, Share } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

// Article content for demo purposes
const articleContent: Record<string, {
  title: string;
  category: string;
  content: React.ReactNode;
}> = {
  'onboarding': {
    title: 'Setting up your first platform',
    category: 'Getting Started',
    content: (
      <div className="space-y-4">
        <p>Welcome to ModerateAI! This guide will help you connect your first platform to our AI moderation system.</p>
        
        <h3 className="text-xl font-semibold mt-6">Choose a platform</h3>
        <p>
          ModerateAI supports several platforms including:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Website Chat</strong> - Add our chat widget to your website</li>
          <li><strong>Telegram</strong> - Connect your Telegram bot or channels</li>
          <li><strong>Discord</strong> - Add ModerateAI to your Discord server</li>
        </ul>
        
        <h3 className="text-xl font-semibold mt-6">Connect your platform</h3>
        <p>
          Navigate to the Integrations section in the sidebar and select your preferred platform.
          Each platform has a step-by-step guide to complete the connection process.
        </p>
        
        <div className="bg-primary/10 p-4 rounded-md border border-primary/20 mt-6">
          <h4 className="font-semibold text-primary flex items-center">
            <HelpCircle className="h-4 w-4 mr-2" />
            Tip
          </h4>
          <p className="text-sm mt-1">
            The easiest platform to get started with is Website Chat, which requires just a single 
            line of code to be added to your website.
          </p>
        </div>
        
        <h3 className="text-xl font-semibold mt-6">Configure your AI assistant</h3>
        <p>
          Once connected, you can customize how your AI assistant responds to messages:
        </p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>Set a personalized welcome message</li>
          <li>Adjust the AI's tone and style</li>
          <li>Configure content moderation rules</li>
          <li>Set up automated responses for common questions</li>
        </ol>
        
        <h3 className="text-xl font-semibold mt-6">Test your integration</h3>
        <p>
          After setting up your platform, send a test message to ensure everything is working correctly.
          You should receive a response from the AI assistant based on your configuration.
        </p>
      </div>
    )
  },
  'website-integration': {
    title: 'Website chat widget setup',
    category: 'Platform Integration',
    content: (
      <div className="space-y-4">
        <p>
          Adding the ModerateAI chat widget to your website is straightforward and only requires 
          a single script tag. Follow these steps to get your chat widget up and running.
        </p>
        
        <h3 className="text-xl font-semibold mt-6">Step 1: Get your widget code</h3>
        <p>
          Navigate to Integrations → Website in your ModerateAI dashboard. You'll find your unique 
          widget code that looks something like this:
        </p>
        
        <div className="bg-muted p-3 rounded font-mono text-sm mt-2 overflow-x-auto">
          {`<script src="https://cdn.moderateai.com/widget.js?id=YOUR_WIDGET_ID" async></script>`}
        </div>
        
        <h3 className="text-xl font-semibold mt-6">Step 2: Add the code to your website</h3>
        <p>
          Copy the widget code and paste it into the <code>&lt;head&gt;</code> section of your website's HTML.
          Make sure to place it before the closing <code>&lt;/head&gt;</code> tag.
        </p>
        
        <div className="bg-primary/10 p-4 rounded-md border border-primary/20 mt-6">
          <h4 className="font-semibold text-primary flex items-center">
            <HelpCircle className="h-4 w-4 mr-2" />
            Tip
          </h4>
          <p className="text-sm mt-1">
            If you're using a content management system like WordPress, look for options to add code to 
            the header, or use a plugin that allows adding custom HTML.
          </p>
        </div>
        
        <h3 className="text-xl font-semibold mt-6">Step 3: Customize the widget</h3>
        <p>
          Return to the Website integration page in your dashboard to customize:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Chat widget colors and theme</li>
          <li>Widget position (bottom-right, bottom-left, etc.)</li>
          <li>Welcome message and bot name</li>
          <li>Chat bubble icon and badge</li>
        </ul>
        
        <h3 className="text-xl font-semibold mt-6">Step 4: Test your widget</h3>
        <p>
          After adding the widget code to your website, visit your site and look for the chat bubble 
          in the position you specified. Click on it to open the chat widget and test sending messages.
        </p>
      </div>
    )
  }
};

export default function HelpArticlePage() {
  const params = useParams();
  const articleId = params.articleId;
  const [article, setArticle] = useState<typeof articleContent[string] | null>(null);
  
  useEffect(() => {
    // In a real app, this would be an API call to fetch the article
    if (articleId && articleContent[articleId]) {
      setArticle(articleContent[articleId]);
    }
  }, [articleId]);
  
  if (!article) {
    return (
      <div className="max-w-3xl mx-auto py-8 px-4">
        <div className="flex items-center mb-6">
          <Link href="/help">
            <Button variant="outline" size="sm" className="mr-2">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Help Center
            </Button>
          </Link>
        </div>
        
        <div className="text-center py-12">
          <HelpCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">Article Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The help article you're looking for doesn't exist or has been moved.
          </p>
          <Link href="/help">
            <Button>Return to Help Center</Button>
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="flex items-center mb-6">
        <Link href="/help">
          <Button variant="outline" size="sm" className="mr-2">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Help Center
          </Button>
        </Link>
        <div className="text-sm text-muted-foreground">
          Help Center / {article.category} / {article.title}
        </div>
      </div>
      
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{article.title}</h1>
        <div className="flex items-center mt-2 text-muted-foreground text-sm">
          <BookOpen className="h-4 w-4 mr-1" />
          <span>{article.category}</span>
        </div>
      </div>
      
      <div className="flex justify-end mb-6 space-x-2">
        <Button variant="outline" size="sm">
          <Printer className="h-4 w-4 mr-1" />
          Print
        </Button>
        <Button variant="outline" size="sm">
          <Share className="h-4 w-4 mr-1" />
          Share
        </Button>
      </div>
      
      <Separator className="mb-6" />
      
      <div className="prose prose-blue max-w-none dark:prose-invert">
        {article.content}
      </div>
      
      <Separator className="my-8" />
      
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Was this article helpful?</h3>
        <div className="flex justify-center space-x-2">
          <Button variant="outline">Yes, thanks!</Button>
          <Button variant="outline">No, I need more help</Button>
        </div>
      </div>
    </div>
  );
}