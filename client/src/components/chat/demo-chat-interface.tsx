import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Info, MoreVertical, Send } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

type Message = {
  id: string;
  content: string;
  sender: "user" | "ai" | "system";
  timestamp: Date;
};

const DemoChatInterface = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      content: "👋 Hi there! I'm your AI assistant. How can I help you today?",
      sender: "ai",
      timestamp: new Date()
    }
  ]);
  
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Force scroll whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      forceScrollToBottom();
    }
  }, [messages]);
  
  // Force scroll on initial load
  useEffect(() => {
    forceScrollToBottom();
  }, []);
  
  // Extremely aggressive scrolling implementation that uses multiple techniques
  const forceScrollToBottom = () => {
    // Schedule multiple scroll attempts with increasing delays
    [0, 50, 100, 300, 500].forEach(delay => {
      setTimeout(() => {
        const chatContainer = document.querySelector('.demo-chat-messages-container');
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
      // Call the OpenAI API via our backend endpoint
      // First create a dummy conversation if none exists
      let conversationId = 1; // For demo purposes, we'll use conversation ID 1
      
      // Try to determine if this is a question about the platform that we can handle with the fallback generator
      const input = userMessage.content.toLowerCase();
      const isPlatformQuestion = 
        input.includes("platform") || 
        input.includes("about") && input.includes("this") ||
        input.includes("tell me about") ||
        input.includes("what is this");
        
      // Use the local fallback generator for platform questions
      if (isPlatformQuestion) {
        console.log("Platform question detected, using local fallback generator");
        const aiResponse = generateDemoResponse(userMessage.content);
        
        setMessages(prev => [...prev, {
          id: `ai-${Date.now()}`,
          content: aiResponse,
          sender: "ai",
          timestamp: new Date()
        }]);
      } else {
        try {
          console.log("Sending to OpenAI demo endpoint...");
          // Cast response to unknown first, then to our expected type to avoid TypeScript errors
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
            const aiResponse = generateDemoResponse(userMessage.content);
            
            setMessages(prev => [...prev, {
              id: `ai-${Date.now()}`,
              content: aiResponse,
              sender: "ai",
              timestamp: new Date()
            }]);
          } else {
            // Use the API response
            const aiContent = directResponse.content || 
                             "I'm sorry, I couldn't generate a response at this time.";
                             
            setMessages(prev => [...prev, {
              id: `ai-${Date.now()}`,
              content: aiContent,
              sender: "ai",
              timestamp: new Date()
            }]);
          }
        } catch (error) {
          console.error("OpenAI demo failed:", error);
          
          // If the API call fails, use the demo response generator
          const aiResponse = generateDemoResponse(userMessage.content);
          
          setMessages(prev => [...prev, {
            id: `ai-${Date.now()}`,
            content: aiResponse,
            sender: "ai",
            timestamp: new Date()
          }]);
        }
      }
      setIsLoading(false);
      
    } catch (error) {
      console.error("Error sending message:", error);
      setIsLoading(false);
      
      // Add error message
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        content: "Sorry, there was an error processing your request. Please try again.",
        sender: "system",
        timestamp: new Date()
      }]);
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
    } else if (input.includes("platform") || input.includes("website") || input.includes("discord") || input.includes("telegram") || input.includes("about") || input.includes("this")) {
      return "ModerateAI is a powerful SaaS platform designed for AI-powered customer support and community moderation across various digital channels. Key features include multi-platform support for websites, Telegram, and Discord; intelligent, AI-powered responses using OpenAI technology; and automatic content filtering and moderation based on customizable settings. Additionally, it offers knowledge base integration and an analytics dashboard to track conversations, response rates, and moderation actions.";
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
    <div className="bg-card rounded-lg shadow-sm border border-border flex flex-col h-[500px]">
      {/* Chat Header */}
      <div className="px-6 py-4 border-b border-border flex items-center">
        <div className="flex-1">
          <h3 className="text-base font-medium text-foreground">Website Chat Widget Preview</h3>
          <p className="text-xs text-muted-foreground">Test your AI responses before deploying</p>
        </div>
        <div>
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground p-1">
            <MoreVertical className="h-5 w-5" />
          </Button>
        </div>
      </div>
      
      {/* Chat Messages - improved with better scrolling support */}
      <div className="demo-chat-messages-container flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth scrollbar scrollbar-thin scrollbar-thumb-primary/30 scrollbar-track-transparent scrollbar-thumb-rounded-full">
        {messages.map((message) => (
          <div 
            key={message.id} 
            className={`flex items-start ${message.sender === "user" ? "justify-end" : ""}`}
          >
            {message.sender !== "user" && (
              <div className="flex-shrink-0">
                <Avatar className="h-10 w-10">
                  <AvatarImage src="" />
                  <AvatarFallback className="bg-primary/20">
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </AvatarFallback>
                </Avatar>
              </div>
            )}
            
            <div 
              className={`
                ${message.sender === "user" ? "bg-primary text-primary-foreground" : "bg-secondary/30 text-foreground"}
                ${message.sender === "user" ? "" : "ml-3"}
                rounded-lg px-4 py-3 max-w-[80%]
              `}
            >
              <p className="text-sm whitespace-pre-line">{message.content}</p>
            </div>
          </div>
        ))}
        
        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <Avatar className="h-10 w-10">
                <AvatarImage src="" />
                <AvatarFallback className="bg-primary/20">
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="ml-3 bg-secondary/30 rounded-lg px-4 py-3">
              <div className="flex space-x-1">
                <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce"></div>
                <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0.4s" }}></div>
              </div>
            </div>
          </div>
        )}
        
        {/* Empty div for scrolling to bottom */}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Chat Input */}
      <div className="border-t border-border p-4">
        <div className="flex items-center">
          <Textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 resize-none"
            placeholder="Type a test message..."
            rows={1}
          />
          <Button 
            onClick={handleSendMessage} 
            className="ml-3"
            disabled={isLoading || !inputMessage.trim()}
          >
            <Send className="h-4 w-4 mr-2" />
            Send
          </Button>
        </div>
        <div className="mt-2 flex items-center text-xs text-muted-foreground">
          <Info className="h-4 w-4 mr-1" />
          This is a demo environment. Changes won't affect your live chat.
        </div>
      </div>
    </div>
  );
};

export default DemoChatInterface;
