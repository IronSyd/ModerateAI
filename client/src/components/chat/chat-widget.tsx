import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  MessageSquare, X, Send, ChevronDown, ChevronUp, 
  MoreVertical, RefreshCw, Trash2, Copy, Download 
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Message = {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: Date;
};

// Define conversation starters for the chat widget that highlight platform features
const conversationStarters = [
  "How does multi-platform integration work across Discord, Telegram, and Web?",
  "Tell me about the AI-powered content moderation capabilities",
  "How can I train the AI with my own knowledge base?",
  "What analytics and insights does ModerateAI provide?",
  "Can I customize the AI's tone and response style?",
  "How does ModerateAI handle message threads and conversations?",
  "What languages does the platform support?",
  "How does the sentiment analysis feature work?"
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
  
  // Hide suggestions after user starts chatting
  useEffect(() => {
    if (messages.length > 1) {
      setShowSuggestions(false);
    }
  }, [messages.length]);
  
  // Force scroll whenever messages change with enhanced reliability
  useEffect(() => {
    if (messages.length > 0) {
      // Immediate scroll
      forceScrollToBottom();
      
      // Additional delayed scrolls to handle dynamic content loading
      const timeouts = [100, 300, 600, 1000, 1500].map(delay => 
        setTimeout(() => {
          // Direct access to container for more reliable scrolling
          const chatContainer = document.querySelector('.chat-messages-container');
          if (chatContainer) {
            chatContainer.scrollTop = chatContainer.scrollHeight + 1000;
          }
          
          if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({
              behavior: 'auto',
              block: 'end'
            });
          }
        }, delay)
      );
      
      // Cleanup function
      return () => {
        timeouts.forEach(timeout => clearTimeout(timeout));
      };
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
  
  // Ultra-aggressive scrolling implementation that uses multiple techniques
  const forceScrollToBottom = () => {
    // Schedule multiple scroll attempts with increasing delays
    [0, 50, 100, 300, 500, 800, 1200].forEach(delay => {
      setTimeout(() => {
        // Method 1: Direct querySelector on chat container
        const chatContainer = document.querySelector('.chat-messages-container');
        if (chatContainer) {
          // Direct DOM method
          chatContainer.scrollTop = chatContainer.scrollHeight;
          
          // Force layout recalculation - use proper typecasting to HTMLDivElement
          void (chatContainer as HTMLDivElement).offsetHeight;
          
          // Additional scroll attempt after forced layout recalculation
          chatContainer.scrollTop = 999999;
        }
        
        // Method 2: Use the ref for scrollIntoView (most reliable)
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({
            behavior: 'auto',
            block: 'end'
          });
        }
        
        // Method 3: Find the last message directly and scroll to it
        const lastMessage = document.querySelector('.chat-messages-container > div:last-child');
        if (lastMessage) {
          lastMessage.scrollIntoView({
            behavior: 'auto',
            block: 'end'
          });
        }
      }, delay);
    });
  };
  
  const handleSendMessage = async (message?: string) => {
    const messageToSend = message || inputMessage;
    if (!messageToSend.trim()) return;
    
    // Hide the conversation starters once a message is sent
    setShowSuggestions(false);
    
    // Add user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      content: messageToSend,
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
    
    // Exact matches for our conversation starters
    if (input.includes("multi-platform integration") || input.includes("how does multi-platform integration work")) {
      return "Our multi-platform integration connects your Website, Discord, and Telegram communities into a single dashboard. You can install ModerateAI on your website with a single line of JavaScript, connect to Discord through our OAuth app, and link to Telegram via the Telegram Bot API. All conversations from all platforms appear in a unified inbox, allowing your team to respond from one place regardless of where the conversation originated. The system automatically formats responses appropriately for each platform and maintains conversation context across platforms.";
    } else if (input.includes("ai-powered content moderation") || input.includes("content moderation capabilities")) {
      return "Our AI-powered content moderation uses advanced machine learning to detect and filter inappropriate content across all connected platforms. It detects profanity, hate speech, harassment, threats, NSFW content, spam, and potential scams. Each category has customizable severity thresholds and automatic actions (flag, hide, delete). For Discord, it can automatically warn users or apply timeouts. The system learns from your team's moderation decisions to improve accuracy over time, and provides detailed reports on moderation actions. You can even set platform-specific rules for different communities.";
    } else if (input.includes("train the ai") || input.includes("knowledge base") || input.includes("train the ai with my own knowledge base")) {
      return "You can train ModerateAI with your own knowledge base in several ways: 1) Upload documents (PDFs, Word docs, text files) containing product information, FAQs, or guidelines. 2) Connect to your existing help center or documentation site for automatic indexing. 3) Add specific Q&A pairs manually. The AI automatically extracts and organizes information from these sources, converting them into a vector database for semantic search. When a customer asks a question, the AI searches this knowledge base for relevant information before generating a response, ensuring accuracy and consistency with your official documentation.";
    } else if (input.includes("analytics") || input.includes("analytics and insights")) {
      return "ModerateAI's analytics dashboard provides comprehensive insights across all platforms: 1) Conversation metrics (volume, response time, resolution rate) 2) User engagement patterns 3) Common topics and questions 4) Moderation activity 5) AI performance statistics. You can filter data by platform, time period, and topic, and set up custom reports and alerts. The analytics engine also identifies trending topics and potential issues before they become widespread, helping you proactively address customer concerns. All data can be exported to CSV or accessed via API for integration with your existing analytics tools.";
    } else if (input.includes("customize") || input.includes("tone") || input.includes("response style")) {
      return "You can extensively customize the AI's tone and response style through our Configuration Manager. Settings include: 1) Tone spectrum from professional/formal to casual/friendly 2) Response length from concise to detailed 3) Personality traits like 'helpful', 'empathetic', or 'straightforward' 4) Custom vocabulary and phrases to use or avoid 5) Brand voice alignment. You can create multiple AI configurations for different use cases (e.g., support vs. sales) and test them side-by-side in our Playground environment before deploying. All settings can be adjusted anytime, and changes take effect immediately across all platforms.";
    } else if (input.includes("message threads") || input.includes("conversations") || input.includes("handle message threads")) {
      return "ModerateAI handles message threads and conversations intelligently across all platforms. It maintains conversation context over time, so it remembers previous interactions with each user. On Discord, it works natively with threads and replies. On websites, it manages full conversation history in chat widgets. On Telegram, it tracks conversation flow naturally. The system groups related messages together in your dashboard, even when they span multiple sessions or days. You can set conversation timeouts (when to consider a conversation ended) and configure automatic follow-ups for unresolved issues. Team members can also seamlessly hand off conversations to each other without disrupting the user experience.";
    } else if (input.includes("languages") || input.includes("language") || input.includes("what languages")) {
      return "ModerateAI supports over 30 languages including English, Spanish, French, German, Italian, Portuguese, Japanese, Korean, Chinese (Traditional and Simplified), Russian, Arabic, Hindi, and many more. The system can automatically detect the language being used and respond in the same language. This works seamlessly across all platforms. You can set preferred languages for each channel or let the system automatically adapt based on the user's language. The moderation system also works across all supported languages, detecting inappropriate content regardless of the language used. For specialized terminology, you can add custom vocabulary to the knowledge base in any supported language.";
    } else if (input.includes("sentiment analysis") || input.includes("sentiment") || input.includes("sentiment analysis feature")) {
      return "Our sentiment analysis feature automatically evaluates the emotional tone of all incoming messages. It categorizes sentiments as positive, neutral, or negative with specific subcategories (e.g., 'frustrated', 'satisfied', 'confused'). This helps prioritize urgent issues and route conversations to appropriate team members. The dashboard shows sentiment trends over time and by topic, helping identify recurring issues. You can set up alerts for severely negative sentiment that might require immediate attention. The system also tracks sentiment changes within conversations, so you can see if user satisfaction improves after interactions with your AI or team members. This data helps measure the effectiveness of your support and moderation strategies.";
    }
    
    // Original fallback responses for other topics
    else if (input.includes("price") || input.includes("cost") || input.includes("pricing") || input.includes("plan") || input.includes("subscription")) {
      return "Our pricing is flexible based on your needs. The Basic plan starts at $29/month, the Pro plan at $79/month, and we offer custom Enterprise solutions. Would you like specific details about any of these plans?";
    } else if (input.includes("integration") || input.includes("connect") || input.includes("setup") || input.includes("install") || input.includes("implement")) {
      return "Integration is simple! You can connect your platforms through our dashboard. We support Website, Telegram, and Discord currently. Each integration has its own setup wizard that will guide you through the process. For Discord, you'll create a bot and add it to your server. For Telegram, you'll connect to our bot API. For your website, we provide a JavaScript widget you can embed with a single line of code.";
    } else if (input.includes("ai") || input.includes("model") || input.includes("assistant") || input.includes("chatbot") || input.includes("intelligence")) {
      return "Our AI uses state-of-the-art GPT-4o language models that are fine-tuned for customer support and community moderation. You can customize the AI's tone (formal to casual), response length (concise to detailed), and enhance it with your own knowledge base. This lets you tailor responses to match your brand voice and provide accurate information about your specific products or services.";
    } else if (input.includes("hello") || input.includes("hi") || input.includes("hey") || input.includes("howdy") || input.includes("greetings")) {
      return "Hello! How can I help you today with your AI customer support or community moderation needs?";
    } else if (input.includes("features") || input.includes("capabilities") || input.includes("functions") || input.includes("what") || input.includes("do")) {
      return "ModerateAI offers multi-platform integration, intelligent content moderation, customizable AI configurations, and comprehensive analytics. Is there a specific feature you'd like to know more about?";
    } else if (input.includes("free") || input.includes("trial") || input.includes("demo") || input.includes("test") || input.includes("try")) {
      return "Yes, we offer a 14-day free trial with full access to all features. You don't need a credit card to get started. Would you like me to help you set up your free trial?";
    } else if (input.includes("moderation") || input.includes("moderate") || input.includes("filter") || input.includes("content") || input.includes("inappropriate") || input.includes("discord server")) {
      return "Our moderation system uses AI to detect and filter inappropriate content across all your platforms. You can set different moderation levels (Relaxed, Balanced, or Strict) and customize which types of content to flag or block (profanity, harassment, adult content, etc.). For Discord specifically, our bot can automatically delete violating messages, warn users, or even time them out based on your custom settings. The system learns from your moderation actions to improve over time.";
    } else if (input.includes("support") || input.includes("help") || input.includes("assistance") || input.includes("customer") || input.includes("complex")) {
      return "ModerateAI streamlines customer support by automatically handling common questions and routing complex issues to your team. For complex questions, our AI evaluates the query and can either provide a comprehensive answer using your knowledge base or create a support ticket and assign it to the appropriate team member. It can also follow up with users after their issues are resolved to gather feedback and continuously improve.";
    } else if (input.includes("platform") || input.includes("website") || input.includes("discord") || input.includes("telegram") || input.includes("about") || input.includes("this")) {
      return "ModerateAI is a powerful SaaS platform designed for AI-powered customer support and community moderation across various digital channels. Key features include multi-platform support for websites, Telegram, and Discord; intelligent, AI-powered responses using OpenAI technology; and automatic content filtering and moderation based on customizable settings. Additionally, it offers knowledge base integration and an analytics dashboard to track conversations, response rates, and moderation actions.";
    } else if (input.includes("report") || input.includes("data") || input.includes("performance")) {
      return "Our comprehensive analytics dashboard provides insights into conversation volume, response times, common topics, and moderation actions. You can track metrics such as average response time, user satisfaction ratings, most common user questions, and moderation efficiency across all platforms. The analytics also identify trending topics, helping you detect emerging issues before they become widespread. All data can be exported to CSV or integrated with popular business intelligence tools.";
    } else if (input.includes("kb") || input.includes("knowledge") || input.includes("information")) {
      return "You can create customized knowledge bases for your product by uploading documents, FAQs, manuals, or even website content. Our AI automatically indexes and analyzes this content to extract key information. When a user asks a question, the AI searches your knowledge base for the most relevant information. You can create multiple knowledge bases for different products or services, and our system will learn which sources to prioritize based on user interactions.";
    } else if (input.includes("multilingual") || input.includes("translate")) {
      return "Yes, ModerateAI supports over 30 languages! Our AI can detect the language being used and respond in the same language. This works across all platforms - website, Discord, and Telegram. You can set preferred languages for each platform or let the system automatically adapt. The moderation system also works in multiple languages, detecting inappropriate content regardless of the language used.";
    } else if (input.includes("detect") || input.includes("types of inappropriate") || input.includes("inappropriate content")) {
      return "ModerateAI can detect a wide range of inappropriate content including profanity, hate speech, harassment, threats, adult content, discrimination, personal information exposure, and potentially harmful links. Our advanced AI evaluates text in context, understanding nuance and intent rather than just flagging keywords. Each category has customizable severity thresholds, so you can adjust moderation based on your community standards and audience.";
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
  
  // Separate handler for the button to correctly handle React events
  const handleSendButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    handleSendMessage();
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
              {/* Dropdown Menu for Chat Options */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-1 rounded-full hover:bg-accent/50">
                    <MoreVertical className="h-4 w-4 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Chat Options</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => {
                      // Reset chat to initial state
                      setMessages([
                        {
                          id: "welcome",
                          content: "👋 Hi there! I'm the ModerateAI assistant. How can I help you today?",
                          sender: "ai",
                          timestamp: new Date()
                        }
                      ]);
                      setShowSuggestions(true);
                    }}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reset Chat
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      // Clear all messages except the welcome message
                      setMessages(messages.slice(0, 1));
                      setShowSuggestions(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear Chat
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      // Copy chat to clipboard
                      const chatText = messages
                        .map(msg => `${msg.sender === "ai" ? "Assistant" : "You"}: ${msg.content}`)
                        .join("\n\n");
                      navigator.clipboard.writeText(chatText);
                    }}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Chat
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      // Create and download chat transcript
                      const chatText = messages
                        .map(msg => `${msg.sender === "ai" ? "Assistant" : "You"} (${new Date(msg.timestamp).toLocaleString()}):\n${msg.content}`)
                        .join("\n\n");
                      
                      const blob = new Blob([chatText], { type: "text/plain" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `moderateai-chat-${new Date().toISOString().split("T")[0]}.txt`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Transcript
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <button 
                onClick={() => setIsMinimized(true)}
                className="p-1 rounded-full hover:bg-accent/50"
              >
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
              <button 
                onClick={() => {
                  setIsOpen(false);
                  // Reset chat to initial state when closing
                  setMessages([
                    {
                      id: "welcome",
                      content: "👋 Hi there! I'm the ModerateAI assistant. How can I help you today?",
                      sender: "ai",
                      timestamp: new Date()
                    }
                  ]);
                  setShowSuggestions(true);
                }}
                className="p-1 rounded-full hover:bg-accent/50"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>
          
          {/* Messages - improved scrolling container with custom scrollbar */}
          <div className="chat-messages-container flex-1 overflow-y-auto p-3 space-y-3 max-h-[18rem] min-h-[18rem] scroll-smooth scrollbar scrollbar-thin scrollbar-thumb-primary/30 scrollbar-track-transparent scrollbar-thumb-rounded-full">
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
            
            {/* Conversation Starters */}
            {showSuggestions && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground mb-2 font-medium">💬 Ask me about these features:</p>
                <div className="flex flex-wrap gap-2">
                  {conversationStarters.map((starter, index) => (
                    <button
                      key={index}
                      className="text-xs bg-primary/10 hover:bg-primary/20 text-primary font-medium rounded-full px-3 py-1.5 transition-colors border border-primary/20 hover:border-primary/30"
                      onClick={() => handleSendMessage(starter)}
                    >
                      {starter}
                    </button>
                  ))}
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
                onClick={handleSendButtonClick}
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
          onClick={() => {
            setIsOpen(false);
            // Reset chat to initial state when closing
            setMessages([
              {
                id: "welcome",
                content: "👋 Hi there! I'm the ModerateAI assistant. How can I help you today?",
                sender: "ai",
                timestamp: new Date()
              }
            ]);
            setShowSuggestions(true);
          }}
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