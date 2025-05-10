import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Menu, Bell, HelpCircle, LogOut } from "lucide-react";
import { useMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";
import { NotificationMenu } from "../notifications/notification-menu";
import { HelpMenu } from "../help/help-menu-new";
import { Logo } from "@/components/logo";
import { useAdminUser } from "@/hooks/use-admin-user";
import { useNotifications } from "@/hooks/use-notifications";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const Header = () => {
  const isMobile = useMobile();
  const [location, setLocation] = useLocation();
  const [, setIsSidebarOpen] = useState(!isMobile);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const { isAdminUser, adminUser } = useAdminUser();
  const { unreadCount, hasNewNotifications } = useNotifications();
  const { logoutMutation } = useAuth();
  const { toast } = useToast();
  
  // Get page title based on current route
  const getPageTitle = () => {
    if (location === "/dashboard") return "Dashboard";
    if (location === "/conversations") return "Conversations";
    if (location === "/ai-configuration") return "AI Configuration";
    if (location === "/templates") return "Templates";
    if (location === "/integrations/website") return "Website Chat Widget";
    if (location === "/integrations/telegram") return "Telegram Integration";
    if (location === "/integrations/discord") return "Discord Integration";
    if (location === "/team") return "Team";
    if (location === "/settings") return "Settings";
    if (location === "/activity") return "Activity Log";
    // Don't show title for help center pages
    if (location === "/help" || location.startsWith("/help/")) return "";
    
    // Get the current path without the leading slash
    const path = location.replace(/^\//, '');
    // Convert to title case with spaces (e.g., "my-page" becomes "My Page")
    if (path) {
      return path
        .split(/[-/]/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }
    
    return "";
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
  
  // Handle logout
  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        toast({
          title: "Logged out",
          description: "You have been successfully logged out.",
        });
        setLocation("/auth");
      }
    });
  };
  
  return (
    <div className="bg-background sticky top-0 z-30">
      <div className="px-4 py-4 flex items-center justify-between">
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
          
          {/* Added logo on mobile */}
          {isMobile && (
            <div className="mr-3">
              <Logo size="sm" className="hover:opacity-90 transition-opacity" />
            </div>
          )}
          
          <h1 className="text-xl font-semibold text-foreground">{getPageTitle()}</h1>
        </div>
        
        <div className="flex items-center space-x-4">
          {isAdminUser && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 px-2 py-0.5 rounded-md text-xs font-medium flex items-center">
                    <Avatar className="h-6 w-6 mr-2">
                      <AvatarFallback className="text-xs bg-red-200 text-red-700 dark:bg-red-800 dark:text-red-200">
                        A
                      </AvatarFallback>
                    </Avatar>
                    Admin Mode
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>You're currently using admin access</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <div className="relative">
            <button 
              className={cn(
                "text-muted-foreground hover:text-foreground relative",
                hasNewNotifications && "animate-pulse text-primary"
              )}
              aria-label="Notifications"
              onClick={handleOpenNotification}
            >
              <Bell className="h-6 w-6" />
              {unreadCount > 0 && (
                <Badge 
                  className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[10px] min-w-[18px] h-[18px] flex items-center justify-center"
                >
                  {unreadCount}
                </Badge>
              )}
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
          
          {/* Logout Button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  className="text-muted-foreground hover:text-foreground" 
                  aria-label="Logout"
                  onClick={handleLogout}
                >
                  <LogOut className="h-6 w-6" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Logout</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
};

export default Header;
