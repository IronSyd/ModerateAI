import { useState } from "react";
import { useLocation } from "wouter";
import { Menu, Bell, HelpCircle } from "lucide-react";
import { useMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";
import { NotificationMenu } from "../notifications/notification-menu";
import { HelpMenu } from "../help/help-menu-new";
import { useAdminUser } from "@/hooks/use-admin-user";
import { useNotifications } from "@/hooks/use-notifications";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type HeaderProps = {
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
};

const ROUTES_WITH_HERO_ONLY_TITLE = new Set<string>([
  "/dashboard",
  "/analytics/deep",
  "/conversations",
  "/knowledge-base",
  "/integrations/telegram",
  "/integrations/discord",
  "/integrations/website",
  "/team",
  "/admin/users",
  "/admin/ops/admin-history-learning",
  "/settings",
]);

const Header = ({ onToggleSidebar, isSidebarOpen = false }: HeaderProps) => {
  const isMobile = useMobile();
  const [location] = useLocation();
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const { isAdminUser } = useAdminUser();
  const { unreadCount, hasNewNotifications } = useNotifications();
  
  // Get page title based on current route
  const getPageTitle = () => {
    if (ROUTES_WITH_HERO_ONLY_TITLE.has(location)) return "";
    if (location === "/dashboard") return "Dashboard";
    if (location === "/analytics/deep") return "Deep Analytics";
    if (location === "/conversations") return "Conversations";
    if (location === "/ai-configuration") return "AI Configuration";
    if (location === "/templates") return "Response Templates"; // Show "Response Templates" instead of "Templates"
    if (location === "/integrations/website") return "Website Widget + Lead Capture";
    if (location === "/integrations/telegram") return "Telegram Integration";
    if (location === "/integrations/discord") return "Discord Integration";
    if (location === "/team") return "Team Management"; // Show "Team Management" instead of "Team"
    if (location === "/settings") return "Settings";
    if (location === "/activity") return "Activity Log";
    if (location === "/admin/users") return "User Management";
    if (location === "/admin/ops/admin-history-learning") return "Learning Ops";
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

  const pageTitle = getPageTitle();
  
  return (
    <div className="ui-top-header fixed top-0 left-0 right-0 md:left-64 z-30 border-b border-border/70 bg-background/80 backdrop-blur-md">
      <div className="h-[60px] px-3 sm:px-4 flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center">
          {isMobile && (
            <button 
              onClick={onToggleSidebar}
              className="md:hidden mr-2 rounded-md p-1 text-muted-foreground hover:bg-accent/35 hover:text-foreground"
              aria-label="Toggle sidebar"
              aria-expanded={isSidebarOpen}
            >
              <Menu className="h-6 w-6" />
            </button>
          )}

          {pageTitle ? (
            <h1 className="kinetic-headline text-lg sm:text-xl font-semibold tracking-tight text-foreground truncate">
              {pageTitle}
            </h1>
          ) : null}
        </div>
        
        <div className="flex items-center space-x-1.5 sm:space-x-3 md:space-x-4">
          {isAdminUser && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={cn(
                    "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded-md text-xs font-medium flex items-center whitespace-nowrap",
                    isMobile ? "px-2 py-0.5 gap-1" : "px-2 py-0.5"
                  )}>
                    <Avatar className={cn("h-6 w-6", isMobile ? "" : "mr-2")}>
                      <AvatarFallback className="text-xs bg-red-200 text-red-700 dark:bg-red-800 dark:text-red-200">
                        A
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden sm:inline">{!isMobile ? "Admin Mode" : "Admin"}</span>
                    <span className="sm:hidden">Admin</span>
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
                "relative rounded-md p-1 text-muted-foreground hover:bg-accent/35 hover:text-foreground",
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
              className="rounded-md p-1 text-muted-foreground hover:bg-accent/35 hover:text-foreground" 
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
