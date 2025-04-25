import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Info, MoreVertical, Send, Trash, RefreshCw, Copy, Download } from "lucide-react";
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
  sender: "user" | "ai" | "system";
  timestamp: Date;
};

// Define conversation starters for the chat interface that highlight platform features
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

const DemoChatInterface = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      content: "👋 Hi there! I'm your AI assistant. How can I help you today with ModerateAI?",
      sender: "ai",
      timestamp: new Date()
    }
  ]);
  
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  
  // Hide suggestions after user starts chatting
  useEffect(() => {
    if (messages.length > 1) {
      setShowSuggestions(false);
    }
  }, [messages.length]);
  
  // Create a ref for the chat container to control scrolling
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  // Scroll to bottom of chat - defined as useCallback to prevent recreation on every render
  const scrollToBottom = useCallback(() => {
    if (chatContainerRef.current) {
      // Use a specific method that only affects this container
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, []);
  
  // Force scroll whenever messages change
  useEffect(() => {
    // Small timeout to ensure DOM is updated
    const timer = setTimeout(() => {
      scrollToBottom();
    }, 100);
    
    return () => clearTimeout(timer);
  }, [messages, scrollToBottom]);
  
  // Force scroll on initial load
  useEffect(() => {
    scrollToBottom();
  }, [scrollToBottom]);
  
  // Handle keyboard shortcuts like Enter to send message
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (inputMessage.trim()) {
        handleSendMessage();
      }
    }
  };
  
  // Button click handler
  const handleSendButtonClick = () => {
    if (inputMessage.trim()) {
      handleSendMessage();
    }
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
      return "Yes, we offer a free tier that lets you experience the core features with moderate usage limits. It includes one platform integration, basic moderation rules, and our standard AI responses. You can upgrade anytime as your needs grow. Would you like to learn more about our paid plans?";
    } else if (input.includes("documentation") || input.includes("docs") || input.includes("guide") || input.includes("help") || input.includes("tutorial")) {
      return "Our documentation is comprehensive and includes step-by-step guides, video tutorials, and API references. You'll find platform-specific integration guides, best practices for AI training, and sample configurations. Our support team also offers free onboarding calls for all paid plans to help you get started.";
    } else if (input.includes("difference") || input.includes("compare") || input.includes("versus") || input.includes("vs") || input.includes("better than")) {
      return "What sets ModerateAI apart is our seamless multi-platform integration, advanced AI customization options, and specialized focus on both customer support and content moderation in a single solution. Many competitors offer either support OR moderation tools, but we combine both with powerful customization options at a more competitive price point.";
    }
    
    // Catch-all response for unrecognized queries
    return "Thanks for your question about " + userInput + ". ModerateAI helps businesses manage customer communications and community content across multiple platforms with AI-powered responses and content moderation. Would you like to know more about our features, pricing, or platform integrations?";
  };
  
  return (
    <div className="bg-card rounded-lg shadow-sm border border-border flex flex-col h-[500px]">
      {/* Chat Header */}
      <div className="px-6 py-4 border-b border-border flex items-center">
        <div className="flex-1">
          <h3 className="text-base font-medium text-foreground">Website Chat Widget Preview</h3>
          <p className="text-xs text-muted-foreground">Test your AI responses before deploying</p>
        </div>
        <div className="relative">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-muted-foreground hover:text-foreground p-1"
              >
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Chat Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => {
                  // Reset conversation
                  setMessages([{
                    id: "welcome",
                    content: "👋 Hi there! I'm your AI assistant. How can I help you today with ModerateAI?",
                    sender: "ai",
                    timestamp: new Date()
                  }]);
                  setShowSuggestions(true);
                }}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Reset Chat
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  // Clear all messages except the welcome message
                  setMessages([]);
                  setShowSuggestions(true);
                  // Add the welcome message after a short delay
                  setTimeout(() => {
                    setMessages([{
                      id: "welcome",
                      content: "👋 Hi there! I'm your AI assistant. How can I help you today with ModerateAI?",
                      sender: "ai",
                      timestamp: new Date()
                    }]);
                  }, 100);
                }}
              >
                <Trash className="mr-2 h-4 w-4" />
                Clear Chat
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  // Copy chat to clipboard
                  const chatText = messages
                    .map(msg => `${msg.sender === 'user' ? 'You' : 'AI'}: ${msg.content}`)
                    .join('\n\n');
                  navigator.clipboard.writeText(chatText);
                }}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy Chat
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  // Download chat transcript
                  const chatText = messages
                    .map(msg => `${msg.sender === 'user' ? 'You' : 'AI'}: ${msg.content}`)
                    .join('\n\n');
                  const blob = new Blob([chatText], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'moderateai-chat-transcript.txt';
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Download Transcript
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {/* Chat Messages Container - with isolated scroll container */}
      <div 
        ref={chatContainerRef}
        className="chat-widget-container flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth scrollbar scrollbar-thin scrollbar-thumb-primary/30 scrollbar-track-transparent scrollbar-thumb-rounded-full"
      >
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
            onClick={handleSendButtonClick} 
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