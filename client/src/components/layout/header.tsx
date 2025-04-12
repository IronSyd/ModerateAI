import { useState } from "react";
import { useLocation } from "wouter";
import { Menu, Bell, HelpCircle } from "lucide-react";
import { useMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";
import { NotificationMenu } from "../notifications/notification-menu";
import { HelpMenu } from "../help/help-menu";

const Header = () => {
  const isMobile = useMobile();
  const [location] = useLocation();
  const [, setIsSidebarOpen] = useState(!isMobile);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  
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
  
  // Close other menus when opening one
  const handleOpenNotification = () => {
    setHelpOpen(false);
    setNotificationOpen(!notificationOpen);
  };
  
  const handleOpenHelp = () => {
    setNotificationOpen(false);
    setHelpOpen(!helpOpen);
  };
  
  return (
    <div className="border-b bg-background sticky top-0 z-30">
      <div className="px-4 md:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center">
          {isMobile && (
            <button 
              onClick={() => setIsSidebarOpen(prev => !prev)}
              className="md:hidden mr-4 text-muted-foreground hover:text-foreground"
              aria-label="Toggle sidebar"
            >
              <Menu className="h-6 w-6" />
            </button>
          )}
          <h1 className="text-xl font-semibold text-foreground">{getPageTitle()}</h1>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="relative">
            <button 
              className="text-muted-foreground hover:text-foreground relative" 
              aria-label="Notifications"
              onClick={handleOpenNotification}
            >
              <Bell className="h-6 w-6" />
              <Badge className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[10px] min-w-[18px] h-[18px] flex items-center justify-center">
                2
              </Badge>
            </button>
            {notificationOpen && (
              <NotificationMenu onClose={() => setNotificationOpen(false)} />
            )}
          </div>
          <div className="relative">
            <button 
              className="text-muted-foreground hover:text-foreground" 
              aria-label="Help"
              onClick={handleOpenHelp}
            >
              <HelpCircle className="h-6 w-6" />
            </button>
            {helpOpen && (
              <HelpMenu onClose={() => setHelpOpen(false)} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Header;
