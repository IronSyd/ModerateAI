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
  },
  'ai-config': {
    title: 'AI configuration basics',
    category: 'Getting Started',
    content: (
      <div className="space-y-4">
        <p>
          Understanding and configuring your AI's behavior is essential for providing 
          effective support and moderation. This guide explains the key configuration options.
        </p>
        
        <h3 className="text-xl font-semibold mt-6">Response Style</h3>
        <p>
          You can customize how your AI responds to users by adjusting these settings:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Tone</strong> - Choose from Professional, Friendly, or Casual</li>
          <li><strong>Detail Level</strong> - Set how comprehensive responses should be</li>
          <li><strong>Personality</strong> - Add specific personality traits to your AI</li>
        </ul>
        
        <div className="bg-primary/10 p-4 rounded-md border border-primary/20 mt-6">
          <h4 className="font-semibold text-primary flex items-center">
            <HelpCircle className="h-4 w-4 mr-2" />
            Best Practice
          </h4>
          <p className="text-sm mt-1">
            Match your AI's tone to your brand voice. For customer support, a friendly professional
            tone usually works best.
          </p>
        </div>
        
        <h3 className="text-xl font-semibold mt-6">Moderation Settings</h3>
        <p>
          Control what content your AI will filter or flag:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Content Filtering</strong> - Block inappropriate language and content</li>
          <li><strong>Spam Protection</strong> - Detect and handle repeated or spam messages</li>
          <li><strong>Custom Rules</strong> - Create specific rules for your community's needs</li>
        </ul>
        
        <h3 className="text-xl font-semibold mt-6">Knowledge Base</h3>
        <p>
          Your AI can pull information from your knowledge base to provide more accurate responses:
        </p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>Go to AI Configuration → Knowledge Base</li>
          <li>Upload documents or add URLs to websites with your information</li>
          <li>The AI will automatically reference this information when responding to related questions</li>
        </ol>
      </div>
    )
  },
  'telegram-bot': {
    title: 'Creating a Telegram bot',
    category: 'Platform Integration',
    content: (
      <div className="space-y-4">
        <p>
          Connecting ModerateAI to Telegram allows you to bring AI-powered moderation and support
          to your Telegram groups and channels. This guide walks you through the process.
        </p>
        
        <h3 className="text-xl font-semibold mt-6">Step 1: Create a Telegram bot</h3>
        <p>
          Before connecting to ModerateAI, you need to create a bot on Telegram:
        </p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>Open Telegram and search for @BotFather</li>
          <li>Start a chat with BotFather and send the command /newbot</li>
          <li>Follow the instructions to name your bot</li>
          <li>BotFather will give you an API token - save this for the next step</li>
        </ol>
        
        <h3 className="text-xl font-semibold mt-6">Step 2: Connect to ModerateAI</h3>
        <p>
          Now connect your Telegram bot to ModerateAI:
        </p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>In ModerateAI, go to Integrations → Telegram</li>
          <li>Enter your Telegram bot token in the configuration field</li>
          <li>Click "Connect" to establish the connection</li>
        </ol>
        
        <div className="bg-primary/10 p-4 rounded-md border border-primary/20 mt-6">
          <h4 className="font-semibold text-primary flex items-center">
            <HelpCircle className="h-4 w-4 mr-2" />
            Important
          </h4>
          <p className="text-sm mt-1">
            Keep your bot token secret. If compromised, anyone could control your bot.
            You can reset it with BotFather if needed.
          </p>
        </div>
        
        <h3 className="text-xl font-semibold mt-6">Step 3: Add your bot to groups</h3>
        <p>
          To use your bot in Telegram groups:
        </p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>Open the Telegram group where you want to add the bot</li>
          <li>Click on the group name at the top to open group info</li>
          <li>Select "Add member" and search for your bot's username</li>
          <li>Add the bot and give it admin privileges for moderation functions</li>
        </ol>
      </div>
    )
  },
  'content-rules': {
    title: 'Setting up content filtering rules',
    category: 'Moderation',
    content: (
      <div className="space-y-4">
        <p>
          Content filtering is essential for maintaining a healthy community environment.
          ModerateAI offers powerful tools to automatically detect and handle inappropriate content.
        </p>
        
        <h3 className="text-xl font-semibold mt-6">Default Filtering Categories</h3>
        <p>
          ModerateAI provides these pre-configured filtering categories:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Profanity</strong> - Detects and filters offensive language</li>
          <li><strong>Hate Speech</strong> - Identifies discriminatory or hateful content</li>
          <li><strong>Personal Attacks</strong> - Catches insults and targeted harassment</li>
          <li><strong>NSFW Content</strong> - Filters sexually explicit material</li>
          <li><strong>Spam</strong> - Catches repetitive or promotional content</li>
        </ul>
        
        <h3 className="text-xl font-semibold mt-6">Setting Moderation Levels</h3>
        <p>
          For each category, you can set one of these moderation levels:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Off</strong> - No filtering for this category</li>
          <li><strong>Low</strong> - Only catches clear violations</li>
          <li><strong>Medium</strong> - Balanced approach (recommended)</li>
          <li><strong>High</strong> - Strict filtering, may catch some edge cases</li>
          <li><strong>Maximum</strong> - Zero tolerance, highest sensitivity</li>
        </ul>
        
        <div className="bg-primary/10 p-4 rounded-md border border-primary/20 mt-6">
          <h4 className="font-semibold text-primary flex items-center">
            <HelpCircle className="h-4 w-4 mr-2" />
            Tip
          </h4>
          <p className="text-sm mt-1">
            Start with Medium settings and adjust based on your community needs. 
            Too strict filtering may frustrate users, while too lenient may not protect your community.
          </p>
        </div>
        
        <h3 className="text-xl font-semibold mt-6">Creating Custom Rules</h3>
        <p>
          Beyond the default categories, you can create custom rules:
        </p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>Go to AI Configuration → Content Rules → Custom Rules</li>
          <li>Click "Add New Rule" and provide a name</li>
          <li>Define patterns to match (keywords, phrases, or regex)</li>
          <li>Set the action to take when triggered (warn, delete, mute user, etc.)</li>
        </ol>
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