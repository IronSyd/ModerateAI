import React, { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { ChevronLeft, HelpCircle, BookOpen, Printer, Share } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useReadArticles } from "@/hooks/use-read-articles";

// Basic article content for demo purposes
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
        
        <h3 className="text-xl font-semibold mt-6">Configure your AI assistant</h3>
        <p>
          Once connected, you can customize how your AI assistant responds to messages.
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
          Navigate to Integrations → Website in your ModerateAI dashboard to find your widget code.
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
      </div>
    )
  },
  'discord-setup': {
    title: 'Discord server integration',
    category: 'Platform Integration',
    content: (
      <div className="space-y-4">
        <p>
          Integrate ModerateAI with your Discord server to provide AI-powered moderation and assistance
          for your community. This guide will help you set up and configure the integration.
        </p>
      </div>
    )
  },
  'ai-training': {
    title: 'Training a custom AI model',
    category: 'AI Configuration',
    content: (
      <div className="space-y-4">
        <p>
          Training a custom AI model allows your ModerateAI assistant to provide more accurate and
          specific responses based on your unique content and requirements.
        </p>
      </div>
    )
  },
  'analytics-dashboard': {
    title: 'User Analytics Dashboard',
    category: 'AI Configuration',
    content: (
      <div className="space-y-4">
        <p>
          The Analytics Dashboard provides valuable insights into how users interact with your AI
          assistants across all platforms. This guide explains how to access and interpret this data.
        </p>
      </div>
    )
  },
  'response-templates': {
    title: 'Creating AI Response Templates',
    category: 'AI Configuration',
    content: (
      <div className="space-y-4">
        <p>
          Response templates help your AI provide consistent, accurate answers to common questions.
          This guide shows you how to create effective templates for various scenarios.
        </p>
      </div>
    )
  },
  'custom-responses': {
    title: 'Custom Response Templates',
    category: 'Moderation',
    content: (
      <div className="space-y-4">
        <p>
          Custom response templates allow you to create personalized, scenario-specific responses
          for your AI assistant. This guide explains how to build and manage effective templates.
        </p>
      </div>
    )
  },
  'banned-words': {
    title: 'Managing banned words and phrases',
    category: 'Moderation',
    content: (
      <div className="space-y-4">
        <p>
          Creating and maintaining a comprehensive banned words list is essential for effective content
          moderation. This guide explains how to set up and manage these filters in ModerateAI.
        </p>
      </div>
    )
  },
  'moderation-levels': {
    title: 'Understanding moderation levels',
    category: 'Moderation',
    content: (
      <div className="space-y-4">
        <p>
          Moderation levels in ModerateAI determine how strictly content is filtered across your platforms.
          This guide helps you understand and configure these levels appropriately.
        </p>
      </div>
    )
  },
  'intro-video': {
    title: 'Introduction to ModerateAI',
    category: 'Videos',
    content: (
      <div className="space-y-4">
        <p>
          Welcome to the Introduction to ModerateAI video tutorial. This comprehensive overview
          will get you familiar with the platform's key features and capabilities.
        </p>
      </div>
    )
  },
  'telegram-video': {
    title: 'Setting up Telegram integration',
    category: 'Videos',
    content: (
      <div className="space-y-4">
        <p>
          This video tutorial walks you through the complete process of setting up and configuring 
          the Telegram integration for ModerateAI. Follow along for step-by-step instructions.
        </p>
      </div>
    )
  },
  'contact-support': {
    title: 'How to contact support',
    category: 'Support',
    content: (
      <div className="space-y-4">
        <p>
          ModerateAI offers multiple support channels to help you resolve issues and answer 
          questions. This guide covers all available options and how to use them effectively.
        </p>
      </div>
    )
  },
  'billing-support': {
    title: 'Billing and subscription help',
    category: 'Support',
    content: (
      <div className="space-y-4">
        <p>
          This guide provides information about ModerateAI's billing processes, subscription management,
          and how to get help with billing-related questions.
        </p>
      </div>
    )
  },
  'team-roles': {
    title: 'Team roles and permissions',
    category: 'Getting Started',
    content: (
      <div className="space-y-4">
        <p>
          Setting up the right team roles and permissions is crucial for efficient collaboration 
          and security. This guide explains ModerateAI's role-based access control system.
        </p>
      </div>
    )
  },
  'telegram-integration': {
    title: 'Telegram Bot Integration',
    category: 'Platform Integration',
    content: (
      <div className="space-y-4">
        <p>
          The Telegram integration allows you to connect ModerateAI to your Telegram channels and groups,
          providing AI-powered moderation and engagement. This comprehensive guide walks you through the setup process.
        </p>
      </div>
    )
  },
  'discord-integration': {
    title: 'Discord Server Integration',
    category: 'Platform Integration',
    content: (
      <div className="space-y-4">
        <p>
          Integrate ModerateAI with your Discord server to provide AI-powered moderation, 
          support, and engagement for your community. This guide covers the complete setup process.
        </p>
      </div>
    )
  }
};

export default function HelpArticlePage() {
  const params = useParams();
  const articleId = params.articleId;
  const [article, setArticle] = useState<typeof articleContent[string] | null>(null);
  const { markArticleAsRead } = useReadArticles();
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<'yes' | 'no' | null>(null);
  const [, navigate] = useLocation();
  
  useEffect(() => {
    // In a real app, this would be an API call to fetch the article
    if (articleId && articleContent[articleId]) {
      setArticle(articleContent[articleId]);
      
      // Mark article as read when it's viewed
      if (articleId) {
        markArticleAsRead(articleId);
      }
    }
    
    // Reset feedback state when article changes
    setFeedbackSubmitted(null);
  }, [articleId, markArticleAsRead, navigate]);
  
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
    <div className="max-w-3xl mx-auto pt-0 pb-8 px-4">
      <div className="flex items-center mb-4">
        <Link href="/help">
          <Button variant="outline" size="sm" className="mr-2">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Help Center
          </Button>
        </Link>
      </div>
      
      <div className="bg-gradient-to-r from-primary/20 to-background border border-primary/10 rounded-xl p-6 mb-6">
        <h1 className="text-3xl font-bold">{article.title}</h1>
        <div className="flex items-center mt-2 text-muted-foreground text-sm">
          <BookOpen className="h-4 w-4 mr-1" />
          <span>{article.category}</span>
        </div>
      </div>
      
      <div className="flex justify-end mb-6 space-x-2">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => window.print()}
        >
          <Printer className="h-4 w-4 mr-1" />
          Print
        </Button>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => {
            // Create a temporary input to copy the current URL
            const dummy = document.createElement('input');
            document.body.appendChild(dummy);
            dummy.value = window.location.href;
            dummy.select();
            document.execCommand('copy');
            document.body.removeChild(dummy);
            
            // Show an alert (in a real app, this would be a toast notification)
            alert('Link copied to clipboard!');
          }}
        >
          <Share className="h-4 w-4 mr-1" />
          Share
        </Button>
      </div>
      
      <Separator className="mb-6" />
      
      <div className="prose prose-blue max-w-none dark:prose-invert 
        prose-p:text-foreground 
        prose-headings:text-foreground 
        prose-strong:text-foreground 
        prose-strong:font-bold
        prose-li:text-foreground
        prose-a:text-primary
        prose-code:text-foreground
        prose-code:bg-primary/10
        prose-code:rounded
        prose-code:px-1
        prose-code:py-0.5
        prose-table:text-foreground
        prose-th:text-foreground
        prose-td:text-foreground
        prose-td:border-primary/20
        prose-th:border-primary/20">
        {article.content}
      </div>
      
      <Separator className="my-8" />
      
      <div className="text-center" data-feedback-section>
        <h3 className="text-lg font-semibold mb-2">Was this article helpful?</h3>
        
        <div className="flex justify-center space-x-2">
          <Button 
            variant="outline"
            onClick={() => {
              // Just display the thank you message directly instead of an alert
              const thankYouMessage = document.createElement('p');
              thankYouMessage.className = 'text-green-500 mt-2';
              thankYouMessage.textContent = 'Thank you for your feedback!';
              
              // Find the feedback section and append the message
              const feedbackSection = document.querySelector('[data-feedback-section]');
              if (feedbackSection) {
                // Clear any existing messages
                const existingMessage = feedbackSection.querySelector('p.mt-2');
                if (existingMessage) {
                  existingMessage.remove();
                }
                
                feedbackSection.appendChild(thankYouMessage);
              }
            }}
          >
            Yes, thanks!
          </Button>
          <Button 
            variant="outline"
            onClick={() => {
              // Just display the help message directly instead of an alert
              const helpMessage = document.createElement('p');
              helpMessage.className = 'text-foreground mt-2';
              helpMessage.textContent = 'We\'re sorry this article wasn\'t helpful. Please try browsing other articles or contact support.';
              
              // Find the feedback section and append the message
              const feedbackSection = document.querySelector('[data-feedback-section]');
              if (feedbackSection) {
                // Clear any existing messages
                const existingMessage = feedbackSection.querySelector('p.mt-2');
                if (existingMessage) {
                  existingMessage.remove();
                }
                
                feedbackSection.appendChild(helpMessage);
              }
            }}
          >
            No, I need more help
          </Button>
        </div>
      </div>
    </div>
  );
}