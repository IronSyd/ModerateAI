import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageSquare, X, Send, ChevronDown, ChevronUp } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

type Message = {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: Date;
};

// Define conversation starters for the chat widget
const conversationStarters = [
  "How do I set up content moderation?",
  "Tell me about analytics features",
  "How can I customize the AI?",
  "Can I create a knowledge base?",
  "How does multi-platform work?",
  "What languages do you support?"
];

const ChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      content: "👋 Hi there! I'm the ModerateAI assistant. How can I help you today?",
      sender: "ai",
      timestamp: new Date()
    }
  ]);
  
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Open the chat widget after a short delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsOpen(true);
    }, 3000);
    
    return () => clearTimeout(timer);
  }, []);
  
  // Force scroll whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      forceScrollToBottom();
    }
  }, [messages]);
  
  // Force scroll when chat is opened or unminimized
  useEffect(() => {
    if (isOpen && !isMinimized) {
      forceScrollToBottom();
    }
  }, [isOpen, isMinimized]);
  
  // Handle window resize events
  useEffect(() => {
    const handleResize = () => {
      if (isOpen && !isMinimized) {
        forceScrollToBottom();
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, isMinimized]);
  
  // Extremely aggressive scrolling implementation that uses multiple techniques
  const forceScrollToBottom = () => {
    // Schedule multiple scroll attempts with increasing delays
    [0, 50, 100, 300, 500].forEach(delay => {
      setTimeout(() => {
        const chatContainer = document.querySelector('.chat-messages-container');
        if (chatContainer) {
          // Direct DOM method
          chatContainer.scrollTop = 999999;
        }
        
        if (messagesEndRef.current) {
          // Force scroll with scrollIntoView - this is the most reliable method
          messagesEndRef.current.scrollIntoView({
            behavior: 'auto',
            block: 'end'
          });
        }
      }, delay);
    });
  };
  
  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;
    
    // Add user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      content: inputMessage,
      sender: "user",
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);
    
    try {
      let aiResponse: string;
      
      try {
        // Try calling demo endpoint
        console.log("Sending to OpenAI demo endpoint...");
        const response = await apiRequest("POST", "/api/openai-demo", {
          message: userMessage.content
        });
        
        const directResponse = response as unknown as { 
          content?: string, 
          error?: string,
          errorType?: string,
          message?: string,
          status?: number 
        };
        
        // If the response contains an error field or has no content,
        // switch to the fallback demo generator
        if (directResponse?.error || 
            !directResponse?.content || 
            directResponse.errorType === "rate_limit_exceeded" ||
            directResponse.status === 429 ||
            (directResponse.content && directResponse.content.includes("I'm sorry, there was an error"))) {
          
          console.log("API response indicated an error, using fallback generator", directResponse);
          aiResponse = generateDemoResponse(userMessage.content);
        } else {
          aiResponse = directResponse.content;
        }
      } catch (error: any) {
        // Log error for troubleshooting
        console.error("OpenAI demo failed:", error);
        
        // If the API call fails, use the demo response generator
        console.log("Using fallback demo response generator due to API error");
        aiResponse = generateDemoResponse(userMessage.content);
      }
      
      // Add AI response to chat
      setMessages(prev => [...prev, {
        id: `ai-${Date.now()}`,
        content: aiResponse,
        sender: "ai",
        timestamp: new Date()
      }]);
      
    } catch (error) {
      console.error("Error sending message:", error);
      
      // Add fallback message
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        content: "Sorry, there was an error processing your request. Please try again later.",
        sender: "ai",
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const generateDemoResponse = (userInput: string): string => {
    const input = userInput.toLowerCase();
    
    // More comprehensive keyword matching
    if (input.includes("price") || input.includes("cost") || input.includes("pricing") || input.includes("plan") || input.includes("subscription")) {
      return "Our pricing is flexible based on your needs. The Basic plan starts at $29/month, the Pro plan at $79/month, and we offer custom Enterprise solutions. Would you like specific details about any of these plans?";
    } else if (input.includes("integration") || input.includes("connect") || input.includes("setup") || input.includes("install") || input.includes("implement")) {
      return "Integration is simple! You can connect your platforms through our dashboard. We support Website, Telegram, and Discord currently. Each integration has its own setup wizard that will guide you through the process.";
    } else if (input.includes("ai") || input.includes("model") || input.includes("assistant") || input.includes("chatbot") || input.includes("intelligence")) {
      return "Our AI uses state-of-the-art language models that are fine-tuned for customer support and community moderation. You can customize the AI's tone, response length, and knowledge base through the AI Configuration panel.";
    } else if (input.includes("hello") || input.includes("hi") || input.includes("hey") || input.includes("howdy") || input.includes("greetings")) {
      return "Hello! How can I help you today with your AI customer support or community moderation needs?";
    } else if (input.includes("features") || input.includes("capabilities") || input.includes("functions") || input.includes("what") || input.includes("do")) {
      return "ModerateAI offers multi-platform integration, intelligent content moderation, customizable AI configurations, and comprehensive analytics. Is there a specific feature you'd like to know more about?";
    } else if (input.includes("free") || input.includes("trial") || input.includes("demo") || input.includes("test") || input.includes("try")) {
      return "Yes, we offer a 14-day free trial with full access to all features. You don't need a credit card to get started. Would you like me to help you set up your free trial?";
    } else if (input.includes("moderation") || input.includes("moderate") || input.includes("filter") || input.includes("content")) {
      return "Our moderation system uses AI to detect and filter inappropriate content across all your platforms. You can set different moderation levels and customize which types of content to flag or block. The system learns from your moderation actions to improve over time.";
    } else if (input.includes("support") || input.includes("help") || input.includes("assistance") || input.includes("customer")) {
      return "ModerateAI streamlines customer support by automatically handling common questions and routing complex issues to your team. Our AI learns from past interactions to provide increasingly accurate responses, reducing your team's workload while maintaining high quality support.";
    } else if (input.includes("platform") || input.includes("website") || input.includes("discord") || input.includes("telegram")) {
      return "ModerateAI currently supports Website chat widgets, Telegram bots, and Discord bots. Each platform can be configured separately but managed from a single dashboard. We're constantly working on adding new platform integrations based on customer feedback.";
    } else if (input.includes("analytics") || input.includes("report") || input.includes("data") || input.includes("performance")) {
      return "Our comprehensive analytics dashboard provides insights into conversation volume, response times, common topics, and moderation actions. You can track performance across all platforms and export reports for further analysis.";
    }
    
    // Catch-all response for unrecognized queries
    return "Thanks for your question about " + userInput + ". ModerateAI helps businesses manage customer communications and community content across multiple platforms with AI-powered responses and content moderation. Would you like to know more about our features, pricing, or platform integrations?";
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col shadow-xl">
      {/* Chat Widget Body - visible when open and not minimized */}
      {isOpen && !isMinimized && (
        <div className="w-80 sm:w-96 bg-card border border-border rounded-t-lg flex flex-col">
          {/* Header */}
          <div className="p-3 border-b border-border flex items-center justify-between bg-primary/10">
            <div className="flex items-center">
              <div className="rounded-full bg-primary/20 p-1 mr-2">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
              <span className="font-medium">ModerateAI Assistant</span>
            </div>
            <div className="flex space-x-1">
              <button 
                onClick={() => setIsMinimized(true)}
                className="p-1 rounded-full hover:bg-accent/50"
              >
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-full hover:bg-accent/50"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>
          
          {/* Messages - improved scrolling container with custom scrollbar */}
          <div className="chat-messages-container flex-1 overflow-y-auto p-3 space-y-3 h-72 scroll-smooth scrollbar scrollbar-thin scrollbar-thumb-primary/30 scrollbar-track-transparent scrollbar-thumb-rounded-full">
            {messages.map((message) => (
              <div 
                key={message.id} 
                className={`flex items-start ${message.sender === "user" ? "justify-end" : ""}`}
              >
                {message.sender === "ai" && (
                  <div className="flex-shrink-0 mr-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src="" />
                      <AvatarFallback className="bg-primary/20">
                        <MessageSquare className="h-4 w-4 text-primary" />
                      </AvatarFallback>
                    </Avatar>
                  </div>
                )}
                
                <div 
                  className={`
                    rounded-lg px-3 py-2 max-w-[75%] text-sm whitespace-pre-wrap break-words
                    ${message.sender === "user" 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-accent/70 text-accent-foreground"
                    }
                  `}
                >
                  {message.content}
                </div>
              </div>
            ))}
            
            {/* Loading indicator */}
            {isLoading && (
              <div className="flex items-start">
                <div className="flex-shrink-0 mr-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src="" />
                    <AvatarFallback className="bg-primary/20">
                      <MessageSquare className="h-4 w-4 text-primary" />
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="bg-accent/70 rounded-lg px-3 py-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce"></div>
                    <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                    <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0.4s" }}></div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Ref for scrolling */}
            <div ref={messagesEndRef} />
          </div>
          
          {/* Input */}
          <div className="border-t border-border p-3">
            <div className="flex items-center">
              <Textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                className="resize-none min-h-[40px] max-h-[120px] flex-1"
                placeholder="Type your message..."
                rows={1}
              />
              <Button 
                className="ml-2 h-9 w-9 p-0" 
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isLoading}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Chat Button when minimized (already open, but minimized) */}
      {isOpen && isMinimized && (
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center bg-primary text-primary-foreground px-4 py-2 rounded-t-lg shadow-lg"
        >
          <MessageSquare className="h-5 w-5 mr-2" />
          <span className="font-medium">Chat with us</span>
          <ChevronUp className="h-4 w-4 ml-2" />
        </button>
      )}
      
      {/* Chat Button when widget is open but not minimized (close button) */}
      {isOpen && !isMinimized && (
        <Button
          className="w-full rounded-t-none border-t-0"
          onClick={() => setIsOpen(false)}
        >
          Close Chat
        </Button>
      )}
      
      {/* Floating chat button when the chat widget is completely closed */}
      {!isOpen && (
        <Button
          onClick={() => {
            setIsOpen(true);
            setIsMinimized(false);
          }}
          className="rounded-full h-14 w-14 p-0 shadow-lg flex items-center justify-center"
        >
          <MessageSquare className="h-6 w-6" />
        </Button>
      )}
    </div>
  );
};

export default ChatWidget;