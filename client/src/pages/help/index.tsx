import React from "react";
import { useLocation } from "wouter";
import { 
  Search, 
  BookOpen, 
  Info,
  MessageCircle,
  ShieldAlert,
  Puzzle,
  VideoIcon,
  Headphones,
  ChevronRight,
  ArrowRight
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// Types from help-menu.tsx
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

// Article Card Component
function ArticleCard({ article }: { article: HelpArticle }) {
  const [, navigate] = useLocation();
  
  return (
    <div 
      className="border rounded-lg p-4 hover:border-primary transition-colors cursor-pointer group"
      onClick={() => navigate(`/help/article/${article.id}`)}
    >
      <div className="flex items-start">
        <BookOpen className="h-5 w-5 text-primary mr-3 mt-0.5 flex-shrink-0" />
        <div className="min-w-0 flex-grow">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-foreground group-hover:text-primary truncate">
              {article.title}
            </h3>
            
            {article.new && (
              <Badge className="ml-2 bg-green-900/20 text-green-500 hover:bg-green-900/30">
                New
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{article.preview}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2" />
      </div>
    </div>
  );
}

// Category Card Component
function CategoryCard({ category }: { category: HelpCategory }) {
  const [, navigate] = useLocation();
  
  return (
    <div 
      className="border rounded-lg p-4 hover:border-primary transition-colors cursor-pointer group"
      onClick={() => navigate(`/help?category=${category.id}`)}
    >
      <div className="flex items-start">
        <div className="mr-3 flex-shrink-0">
          {category.icon}
        </div>
        <div className="min-w-0 flex-grow">
          <h3 className="font-medium text-foreground group-hover:text-primary">
            {category.title}
          </h3>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {category.description}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2" />
      </div>
    </div>
  );
}

export default function HelpCenterPage() {
  const [searchQuery, setSearchQuery] = React.useState("");
  // Use window.location to access the URL query string
  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null);
  const [, navigate] = useLocation();
  
  // State to track if viewing all articles
  const [viewingAllArticles, setViewingAllArticles] = React.useState(false);
  
  // Parse the URL query parameters
  React.useEffect(() => {
    // Function to parse the URL
    const updateFromUrl = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const category = urlParams.get('category');
      const viewAll = urlParams.get('all');
      
      if (category) {
        setSelectedCategory(category);
        setViewingAllArticles(false);
      } else if (viewAll === 'true') {
        setSelectedCategory(null);
        setViewingAllArticles(true);
      } else {
        setSelectedCategory(null);
        setViewingAllArticles(false);
      }
    };
    
    // Initial call
    updateFromUrl();
    
    // Set up event listener for URL changes
    window.addEventListener('popstate', updateFromUrl);
    
    // Cleanup
    return () => {
      window.removeEventListener('popstate', updateFromUrl);
    };
  }, []);
  
  // Get all articles from all categories
  const allArticles = React.useMemo(() => {
    const articles: HelpArticle[] = [];
    helpCategories.forEach(category => {
      if (category.articles) {
        articles.push(...category.articles);
      }
    });
    return articles;
  }, []);
  
  // Find selected category
  const selectedCategoryData = React.useMemo(() => {
    if (!selectedCategory) return null;
    return helpCategories.find(c => c.id === selectedCategory);
  }, [selectedCategory]);
  
  // Filter articles by category and search query
  const filteredArticles = React.useMemo(() => {
    let filtered = allArticles;
    
    // Filter by category if selected
    if (selectedCategory) {
      filtered = filtered.filter(article => article.category === selectedCategory);
    }
    
    // Filter by search query if provided
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(article => 
        article.title.toLowerCase().includes(query) || 
        article.preview.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [selectedCategory, searchQuery, allArticles]);

  return (
    <div className="max-w-5xl mx-auto px-4 pt-0 pb-8">
      <div className="bg-gradient-to-r from-primary/20 to-background border border-primary/10 rounded-xl p-8 mb-10">
        <h1 className="text-3xl font-bold mb-3">Help Center</h1>
        <p className="text-muted-foreground text-lg mb-6 max-w-2xl">
          Find guides, tutorials, and answers to common questions
        </p>
        
        {/* Search */}
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search help articles..."
            className="pl-10 pr-10 py-6 text-lg bg-background/80 border-primary/20 focus:border-primary"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-3.5 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </button>
          )}
        </div>
      </div>
      
      {/* Selected Category Banner */}
      {selectedCategoryData && (
        <div className="bg-primary/5 border border-primary/10 rounded-lg p-4 mb-8 flex items-center justify-between">
          <div className="flex items-center">
            <div className="mr-3">{selectedCategoryData.icon}</div>
            <div>
              <h2 className="font-semibold text-lg">{selectedCategoryData.title}</h2>
              <p className="text-sm text-muted-foreground">{selectedCategoryData.description}</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              // Clear the filter - navigate back to main help center
              navigate('/help');
              setSelectedCategory(null);
            }}
          >
            Clear Filter
          </Button>
        </div>
      )}
      
      {/* If user is searching, show search results */}
      {searchQuery.trim() ? (
        <div className="mb-12">
          <div className="flex items-center mb-4">
            <h2 className="text-2xl font-semibold">
              Search results for "{searchQuery}"
            </h2>
          </div>
          
          {filteredArticles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredArticles.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-muted/20 rounded-lg border border-border">
              <p className="text-muted-foreground">
                No articles found matching your search. Try different keywords.
              </p>
            </div>
          )}
        </div>
      ) : viewingAllArticles ? (
        /* All Articles View */
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold">All Help Articles</h2>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                // Go back to the main help page
                navigate('/help');
              }}
            >
              Back to Help Center
            </Button>
          </div>
          
          {allArticles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {allArticles.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-muted/20 rounded-lg border border-border">
              <p className="text-muted-foreground">
                No articles found.
              </p>
            </div>
          )}
        </div>
      ) : selectedCategory ? (
        /* Category Selected - Show Filtered Articles */
        <div className="mb-12">
          <div className="flex items-center mb-4">
            <h2 className="text-2xl font-semibold">Articles in {selectedCategoryData?.title}</h2>
          </div>
          
          {filteredArticles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredArticles.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-muted/20 rounded-lg border border-border">
              <p className="text-muted-foreground">
                No articles found in this category.
              </p>
            </div>
          )}
        </div>
      ) : (
        /* No Category Selected - Show Default Content */
        <>
          {/* Popular Articles */}
          <div className="mb-12">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold">Popular Articles</h2>
              <Button 
                variant="ghost" 
                className="text-primary"
                onClick={() => {
                  // Show all articles in a dedicated section
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                  // Set query to show all articles
                  navigate('/help?all=true');
                }}
              >
                View all
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {popularArticles.slice(0, 4).map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          </div>
          
          {/* Categories */}
          <div className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">Browse by Category</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {helpCategories.map((category) => (
                <CategoryCard key={category.id} category={category} />
              ))}
            </div>
          </div>
          
          {/* New Articles */}
          <div className="mb-12">
            <div className="flex items-center mb-4">
              <h2 className="text-2xl font-semibold">New Articles</h2>
              <Badge className="ml-3 bg-green-900/20 text-green-500 hover:bg-green-900/30">
                New
              </Badge>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {newArticles.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          </div>
        </>
      )}
      
      <Separator className="my-12" />
      
      {/* Need more help */}
      <div className="text-center max-w-2xl mx-auto">
        <h2 className="text-2xl font-semibold mb-4">Need more help?</h2>
        <p className="text-muted-foreground mb-6">
          If you couldn't find what you were looking for, our support team is ready to help.
        </p>
        
        <div className="flex justify-center space-x-4">
          <Button className="flex items-center" size="lg">
            <MessageCircle className="h-5 w-5 mr-2" />
            Live Chat
          </Button>
          <Button variant="outline" size="lg">
            <Headphones className="h-5 w-5 mr-2" />
            Contact Support
          </Button>
        </div>
      </div>
    </div>
  );
}