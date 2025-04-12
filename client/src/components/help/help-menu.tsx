import React from "react";
import { 
  BookOpen, 
  ChevronRight, 
  Headphones, 
  HelpCircle, 
  Info, 
  MessageSquare, 
  Puzzle, 
  Search, 
  VideoIcon,
  MessageCircle,
  ShieldAlert
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type HelpCategory = {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  articles?: HelpArticle[];
};

type HelpArticle = {
  id: string;
  title: string;
  category: string;
  preview: string;
  popular?: boolean;
  new?: boolean;
};

const helpCategories: HelpCategory[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    description: 'Learn the basics of ModerateAI',
    icon: <Info className="h-5 w-5 text-blue-500" />,
    articles: [
      {
        id: 'onboarding',
        title: 'Setting up your first platform',
        category: 'getting-started',
        preview: 'Learn how to connect your first platform to ModerateAI',
        popular: true
      },
      {
        id: 'ai-config',
        title: 'AI configuration basics',
        category: 'getting-started',
        preview: 'Understanding response styles and moderation strictness',
        new: true
      }
    ]
  },
  {
    id: 'platform-integration',
    title: 'Platform Integration',
    description: 'Connect various platforms',
    icon: <Puzzle className="h-5 w-5 text-green-500" />,
    articles: [
      {
        id: 'website-integration',
        title: 'Website chat widget setup',
        category: 'platform-integration',
        preview: 'How to add the chat widget to your website'
      },
      {
        id: 'telegram-bot',
        title: 'Creating a Telegram bot',
        category: 'platform-integration',
        preview: 'Connect ModerateAI to your Telegram channels'
      },
      {
        id: 'discord-setup',
        title: 'Discord server integration',
        category: 'platform-integration',
        preview: 'Automatic moderation for Discord servers'
      }
    ]
  },
  {
    id: 'ai-configuration',
    title: 'AI Configuration',
    description: 'Optimize AI responses',
    icon: <MessageCircle className="h-5 w-5 text-purple-500" />
  },
  {
    id: 'moderation',
    title: 'Content Moderation',
    description: 'Set up moderation rules',
    icon: <ShieldAlert className="h-5 w-5 text-orange-500" />
  },
  {
    id: 'videos',
    title: 'Video Tutorials',
    description: 'Watch step-by-step guides',
    icon: <VideoIcon className="h-5 w-5 text-red-500" />
  },
  {
    id: 'support',
    title: 'Support',
    description: 'Get help from our team',
    icon: <Headphones className="h-5 w-5 text-gray-500" />
  }
];

const popularArticles: HelpArticle[] = [
  {
    id: 'onboarding',
    title: 'Setting up your first platform',
    category: 'getting-started',
    preview: 'Learn how to connect your first platform to ModerateAI',
    popular: true
  },
  {
    id: 'website-integration',
    title: 'Website chat widget setup',
    category: 'platform-integration',
    preview: 'How to add the chat widget to your website'
  },
  {
    id: 'ai-training',
    title: 'Training a custom AI model',
    category: 'ai-configuration',
    preview: 'How to use your data to improve AI responses'
  },
  {
    id: 'content-rules',
    title: 'Setting up content filtering rules',
    category: 'moderation',
    preview: 'Create custom rules for content moderation'
  }
];

const newArticles: HelpArticle[] = [
  {
    id: 'ai-config',
    title: 'AI configuration basics',
    category: 'getting-started',
    preview: 'Understanding response styles and moderation strictness',
    new: true
  },
  {
    id: 'team-roles',
    title: 'Team roles and permissions',
    category: 'getting-started',
    preview: 'Managing access for your team members',
    new: true
  }
];

export function HelpMenu({ onClose }: { onClose: () => void }) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<'popular' | 'categories' | 'new'>('popular');
  
  return (
    <div className="relative z-50">
      <div className="fixed inset-0" onClick={onClose}></div>
      <div className="absolute right-0 mt-2 w-96 bg-white rounded-md shadow-lg overflow-hidden border border-gray-200 max-h-[80vh] flex flex-col">
        <div className="p-3 border-b">
          <h3 className="text-lg font-semibold mb-2">Help Center</h3>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              type="search"
              placeholder="Search help articles..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        
        <div className="border-b">
          <div className="flex">
            <button 
              className={`flex-1 py-2 text-sm font-medium ${activeTab === 'popular' ? 'text-primary border-b-2 border-primary' : 'text-gray-600'}`}
              onClick={() => setActiveTab('popular')}
            >
              Popular
            </button>
            <button 
              className={`flex-1 py-2 text-sm font-medium ${activeTab === 'categories' ? 'text-primary border-b-2 border-primary' : 'text-gray-600'}`}
              onClick={() => setActiveTab('categories')}
            >
              Categories
            </button>
            <button 
              className={`flex-1 py-2 text-sm font-medium ${activeTab === 'new' ? 'text-primary border-b-2 border-primary' : 'text-gray-600'}`}
              onClick={() => setActiveTab('new')}
            >
              New
            </button>
          </div>
        </div>
        
        <div className="overflow-y-auto flex-grow">
          {activeTab === 'popular' && (
            <div className="p-3 space-y-3">
              <h4 className="text-sm font-medium text-gray-500">POPULAR ARTICLES</h4>
              {popularArticles.map((article) => (
                <button 
                  key={article.id}
                  className="w-full text-left p-3 hover:bg-gray-50 rounded-md cursor-pointer flex items-start"
                  onClick={() => {
                    // Would open article in a real app
                    onClose();
                  }}
                >
                  <BookOpen className="h-5 w-5 text-gray-400 mr-3 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <h5 className="font-medium text-gray-900">{article.title}</h5>
                    <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">{article.preview}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          
          {activeTab === 'categories' && (
            <div className="p-3 space-y-3">
              <h4 className="text-sm font-medium text-gray-500">BROWSE BY CATEGORY</h4>
              {helpCategories.map((category) => (
                <button 
                  key={category.id}
                  className="w-full text-left p-3 hover:bg-gray-50 rounded-md cursor-pointer flex items-center"
                  onClick={() => {
                    // Would open category in a real app
                    onClose();
                  }}
                >
                  <div className="mr-3 flex-shrink-0">
                    {category.icon}
                  </div>
                  <div className="min-w-0 flex-grow">
                    <h5 className="font-medium text-gray-900">{category.title}</h5>
                    <p className="text-sm text-gray-600">{category.description}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
          
          {activeTab === 'new' && (
            <div className="p-3 space-y-3">
              <h4 className="text-sm font-medium text-gray-500">NEWLY ADDED</h4>
              {newArticles.map((article) => (
                <button 
                  key={article.id}
                  className="w-full text-left p-3 hover:bg-gray-50 rounded-md cursor-pointer flex items-start"
                  onClick={() => {
                    // Would open article in a real app
                    onClose();
                  }}
                >
                  <BookOpen className="h-5 w-5 text-gray-400 mr-3 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center">
                      <h5 className="font-medium text-gray-900">{article.title}</h5>
                      <Badge className="ml-2 bg-green-100 text-green-800 hover:bg-green-100">New</Badge>
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">{article.preview}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        
        <div className="border-t p-3 bg-gray-50">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium">Need more help?</h4>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="text-sm" onClick={onClose}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Live Chat
            </Button>
            <Button variant="outline" className="text-sm" onClick={onClose}>
              <Headphones className="h-4 w-4 mr-2" />
              Support Ticket
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}