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
  
  // Scroll to bottom whenever messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
      // In a real app, this would call the backend API
      // For demo, we'll simulate an AI response
      setTimeout(() => {
        const aiResponse = generateDemoResponse(inputMessage);
        setMessages(prev => [...prev, {
          id: `ai-${Date.now()}`,
          content: aiResponse,
          sender: "ai",
          timestamp: new Date()
        }]);
        setIsLoading(false);
      }, 1500);
      
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
    
    if (input.includes("pricing")) {
      return "Our pricing is flexible based on your needs. The Basic plan starts at $29/month, the Pro plan at $79/month, and we offer custom Enterprise solutions. Would you like specific details about any of these plans?";
    } else if (input.includes("integration") || input.includes("connect")) {
      return "Integration is simple! You can connect your platforms through our dashboard. We support Website, Telegram, and Discord currently. Each integration has its own setup wizard that will guide you through the process.";
    } else if (input.includes("ai") || input.includes("model")) {
      return "Our AI uses state-of-the-art language models that are fine-tuned for customer support and community moderation. You can customize the AI's tone, response length, and knowledge base through the AI Configuration panel.";
    } else if (input.includes("hello") || input.includes("hi")) {
      return "Hello! How can I help you today with your AI customer support or community moderation needs?";
    }
    
    return "I understand you're asking about " + userInput + ". Could you provide more details so I can give you a more specific answer?";
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col h-[500px]">
      {/* Chat Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center">
        <div className="flex-1">
          <h3 className="text-base font-medium text-gray-800">Website Chat Widget Preview</h3>
          <p className="text-xs text-gray-500">Test your AI responses before deploying</p>
        </div>
        <div>
          <Button variant="ghost" size="sm" className="text-gray-400 hover:text-gray-500 p-1">
            <MoreVertical className="h-5 w-5" />
          </Button>
        </div>
      </div>
      
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div 
            key={message.id} 
            className={`flex items-start ${message.sender === "user" ? "justify-end" : ""}`}
          >
            {message.sender !== "user" && (
              <div className="flex-shrink-0">
                <Avatar className="h-10 w-10">
                  <AvatarImage src="" />
                  <AvatarFallback className="bg-primary-100">
                    <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </AvatarFallback>
                </Avatar>
              </div>
            )}
            
            <div 
              className={`
                ${message.sender === "user" ? "bg-primary-500 text-white" : "bg-gray-100 text-gray-800"}
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
                <AvatarFallback className="bg-primary-100">
                  <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="ml-3 bg-gray-100 rounded-lg px-4 py-3">
              <div className="flex space-x-1">
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"></div>
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0.4s" }}></div>
              </div>
            </div>
          </div>
        )}
        
        {/* Empty div for scrolling to bottom */}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Chat Input */}
      <div className="border-t border-gray-200 p-4">
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
        <div className="mt-2 flex items-center text-xs text-gray-500">
          <Info className="h-4 w-4 mr-1" />
          This is a demo environment. Changes won't affect your live chat.
        </div>
      </div>
    </div>
  );
};

export default DemoChatInterface;
