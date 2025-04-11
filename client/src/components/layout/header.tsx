import { useState } from "react";
import { useLocation } from "wouter";
import { Menu, Bell, HelpCircle } from "lucide-react";
import { useMobile } from "@/hooks/use-mobile";

const Header = () => {
  const isMobile = useMobile();
  const [location] = useLocation();
  const [, setIsSidebarOpen] = useState(!isMobile);
  
  // Get page title based on current route
  const getPageTitle = () => {
    if (location === "/") return "Dashboard";
    if (location === "/conversations") return "Conversations";
    if (location === "/ai-configuration") return "AI Configuration";
    if (location === "/templates") return "Templates";
    if (location === "/integrations/website") return "Website Integration";
    if (location === "/integrations/telegram") return "Telegram Integration";
    if (location === "/integrations/discord") return "Discord Integration";
    if (location === "/team") return "Team";
    if (location === "/settings") return "Settings";
    return "ModerateAI";
  };
  
  return (
    <div className="border-b bg-white sticky top-0 z-30">
      <div className="px-4 md:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center">
          {isMobile && (
            <button 
              onClick={() => setIsSidebarOpen(prev => !prev)}
              className="md:hidden mr-4 text-gray-500 hover:text-gray-700"
              aria-label="Toggle sidebar"
            >
              <Menu className="h-6 w-6" />
            </button>
          )}
          <h1 className="text-xl font-semibold text-gray-800">{getPageTitle()}</h1>
        </div>
        
        <div className="flex items-center space-x-4">
          <button className="text-gray-500 hover:text-gray-700" aria-label="Notifications">
            <Bell className="h-6 w-6" />
          </button>
          <button className="text-gray-500 hover:text-gray-700" aria-label="Help">
            <HelpCircle className="h-6 w-6" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Header;
