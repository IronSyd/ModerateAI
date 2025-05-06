import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, MessageSquareText } from "lucide-react";
import { Link } from "wouter";

// Mock widget demo component to simulate the chat widget
const MockChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{text: string, isUser: boolean}[]>([
    { text: "Hi there! How can I help you today?", isUser: false }
  ]);
  const [inputValue, setInputValue] = useState("");

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;
    
    // Add user message
    setMessages([...messages, { text: inputValue, isUser: true }]);
    setInputValue("");
    
    // Simulate AI response after a short delay
    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        { 
          text: "Thanks for your message! This is a demo of the ModerateAI chat widget. In a real implementation, this would be powered by your AI configuration and knowledge base.", 
          isUser: false 
        }
      ]);
    }, 1000);
  };

  return (
    <div className="relative z-50">
      {/* Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 p-4 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all"
          aria-label="Open chat"
        >
          <MessageSquareText className="h-6 w-6" />
        </button>
      )}

      {/* Chat Widget */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 w-80 sm:w-96 h-[500px] bg-card rounded-lg shadow-xl flex flex-col border border-border overflow-hidden">
          {/* Header */}
          <div className="bg-primary p-4 text-primary-foreground flex items-center justify-between">
            <h3 className="font-medium">Chat with ModerateAI</h3>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-primary-foreground/80 hover:text-primary-foreground"
              aria-label="Close chat"
            >
              ✕
            </button>
          </div>
          
          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto flex flex-col space-y-4">
            {messages.map((message, index) => (
              <div 
                key={index}
                className={`max-w-[80%] p-3 rounded-lg ${
                  message.isUser 
                    ? "bg-primary/10 ml-auto" 
                    : "bg-muted mr-auto"
                }`}
              >
                {message.text}
              </div>
            ))}
          </div>
          
          {/* Input */}
          <div className="p-4 border-t border-border">
            <div className="flex space-x-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                placeholder="Type your message here..."
                className="flex-1 bg-background border border-input px-3 py-2 text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                onClick={handleSendMessage}
                className="bg-primary text-primary-foreground p-2 rounded-md hover:bg-primary/90"
                aria-label="Send message"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const WebsiteDemoPage = () => {
  return (
    <div className="container py-8">
      <div className="flex items-center mb-8">
        <Link href="/integrations/website">
          <Button variant="ghost" className="mr-4 p-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Widget Demo Page</h1>
      </div>
      
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>ModerateAI Chat Widget Demo</CardTitle>
          <CardDescription>
            This is a demonstration of how the chat widget would work on your website.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Click the chat button in the bottom-right corner to open the widget and test how it works. 
            This is a simulated demo environment to help you visualize the widget on your own website.
          </p>
          <div className="text-sm bg-muted p-4 rounded-md mb-4">
            <strong>Note:</strong> This is a demonstration only. On your actual website, the widget will be connected to 
            your AI configuration and knowledge base to provide real answers to customer questions.
          </div>
          <Separator className="my-6" />
          <div className="text-center text-muted-foreground">
            <p>Your website content would appear here.</p>
            <p>The chat widget button appears in the bottom corner.</p>
          </div>
        </CardContent>
      </Card>
      
      {/* Demo chat widget */}
      <MockChatWidget />
    </div>
  );
};

export default WebsiteDemoPage;