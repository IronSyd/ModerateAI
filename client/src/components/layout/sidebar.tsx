import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import UserProfile from "./user-profile";
import { 
  LayoutDashboard, 
  MessagesSquare, 
  Settings as SettingsIcon, 
  Clipboard, 
  Globe, 
  SendHorizontal, 
  MessageSquareMore,
  Users,
  Settings as SettingsCog,
  Activity
} from "lucide-react";
import { Logo } from "@/components/logo";
import { useMobile } from "@/hooks/use-mobile";

type SidebarItem = {
  icon: React.ReactNode;
  label: string;
  path: string;
};

const mainItems: SidebarItem[] = [
  {
    icon: <LayoutDashboard className="h-5 w-5 mr-3" />,
    label: "Dashboard",
    path: "/dashboard"
  },
  {
    icon: <MessagesSquare className="h-5 w-5 mr-3" />,
    label: "Conversations",
    path: "/conversations"
  },
  {
    icon: <SettingsIcon className="h-5 w-5 mr-3" />,
    label: "AI Configuration",
    path: "/ai-configuration"
  },
  {
    icon: <Activity className="h-5 w-5 mr-3" />,
    label: "Train AI",
    path: "/train-ai"
  },
  {
    icon: <Clipboard className="h-5 w-5 mr-3" />,
    label: "Templates",
    path: "/templates"
  }
];

const integrationItems: SidebarItem[] = [
  {
    icon: <Globe className="h-5 w-5 mr-3" />,
    label: "Website",
    path: "/integrations/website"
  },
  {
    icon: <SendHorizontal className="h-5 w-5 mr-3" />,
    label: "Telegram",
    path: "/integrations/telegram"
  },
  {
    icon: <MessageSquareMore className="h-5 w-5 mr-3" />,
    label: "Discord",
    path: "/integrations/discord"
  }
];

const settingsItems: SidebarItem[] = [
  {
    icon: <Users className="h-5 w-5 mr-3" />,
    label: "Team",
    path: "/team"
  },
  {
    icon: <SettingsCog className="h-5 w-5 mr-3" />,
    label: "Settings",
    path: "/settings"
  }
];

const Sidebar = () => {
  const [location] = useLocation();
  const isMobile = useMobile();
  const [isOpen, setIsOpen] = useState(!isMobile);
  
  // Close sidebar on mobile when location changes
  useEffect(() => {
    if (isMobile) {
      setIsOpen(false);
    }
  }, [location, isMobile]);
  
  // Toggle sidebar visibility when window resizes
  useEffect(() => {
    setIsOpen(!isMobile);
  }, [isMobile]);
  
  const NavItem = ({ item }: { item: SidebarItem }) => {
    const isActive = location === item.path;
    
    return (
      <Link href={item.path}>
        <a 
          className={`flex items-center px-4 py-3 hover:bg-accent ${
            isActive 
              ? "text-foreground bg-accent/60 border-r-4 border-primary" 
              : "text-muted-foreground"
          }`}
        >
          {React.cloneElement(item.icon as React.ReactElement, { 
            className: `h-5 w-5 mr-3 ${isActive ? "text-primary" : "text-muted-foreground"}`
          })}
          {item.label}
        </a>
      </Link>
    );
  };
  
  const SidebarSection = ({ title, items }: { title: string; items: SidebarItem[] }) => {
    return (
      <>
        <div className="px-4 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {title}
        </div>
        {items.map((item) => (
          <NavItem key={item.path} item={item} />
        ))}
      </>
    );
  };
  
  const sidebarClasses = `fixed md:static inset-y-0 left-0 z-50 w-64 bg-background shadow-lg transform transition-transform duration-300 ease-in-out flex flex-col ${
    isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
  }`;
  
  return (
    <>
      {/* Overlay */}
      {isOpen && isMobile && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <div className={sidebarClasses}>
        {/* Logo - Clickable and links to homepage */}
        <div className="p-4 border-b border-border">
          <Logo size="md" className="hover:opacity-90 transition-opacity" />
        </div>
        
        {/* Navigation Links */}
        <nav className="flex-1 py-4 overflow-y-auto">
          <SidebarSection title="Main" items={mainItems} />
          <SidebarSection title="Integrations" items={integrationItems} />
          <SidebarSection title="Settings" items={settingsItems} />
        </nav>
        
        {/* User Profile */}
        <UserProfile />
      </div>
      
      {/* Mobile toggle button - in the Header component */}
    </>
  );
};

export default Sidebar;
