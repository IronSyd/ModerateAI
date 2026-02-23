import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  BarChart3,
  MessagesSquare, 
  Users,
  UserCog,
  Settings as SettingsCog,
  Database,
  Globe
} from "lucide-react";
import { SiDiscord, SiTelegram } from "react-icons/si";
import { Logo } from "@/components/logo";
import { useMobile } from "@/hooks/use-mobile";
import { useAdminUser } from "@/hooks/use-admin-user";
import { useAuth } from "@/hooks/use-auth";

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
    icon: <BarChart3 className="h-5 w-5 mr-3" />,
    label: "Deep Analytics",
    path: "/analytics/deep"
  },
  {
    icon: <MessagesSquare className="h-5 w-5 mr-3" />,
    label: "Conversations",
    path: "/conversations"
  },
  {
    icon: <Database className="h-5 w-5 mr-3" />,
    label: "Knowledge Base",
    path: "/knowledge-base"
  },


];

const integrationItems: SidebarItem[] = [
  {
    icon: <SiTelegram />,
    label: "Telegram",
    path: "/integrations/telegram"
  },
  {
    icon: <SiDiscord />,
    label: "Discord",
    path: "/integrations/discord"
  },
  {
    icon: <Globe />,
    label: "Website",
    path: "/integrations/website"
  }
];

const teamItems: SidebarItem[] = [
  {
    icon: <Users className="h-5 w-5 mr-3" />,
    label: "Team",
    path: "/team"
  },
];

const settingsItems: SidebarItem[] = [
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
  const { isAdminUser } = useAdminUser();
  const { user } = useAuth();

  const workspaceRole = (user as any)?.workspaceRole ?? null;
  const isWorkspaceAdmin = isAdminUser || workspaceRole === "admin";

  const adminItems: SidebarItem[] = isAdminUser
    ? [
        {
          icon: <UserCog className="h-5 w-5 mr-3" />,
          label: "Users",
          path: "/admin/users",
        },
        {
          icon: <BarChart3 className="h-5 w-5 mr-3" />,
          label: "Learning Ops",
          path: "/admin/ops/admin-history-learning",
        },
      ]
    : [];
  
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
      <Link 
        href={item.path}
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
      </Link>
    );
  };
  
  const SidebarSection = ({ title, items }: { title: string; items: SidebarItem[] }) => {
    return (
      <>
        {title && (
          <div className="px-4 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {title}
          </div>
        )}
        {items.map((item) => (
          <NavItem key={item.path} item={item} />
        ))}
      </>
    );
  };
  
  const sidebarClasses = `fixed inset-y-0 left-0 z-50 w-64 bg-background shadow-lg transform transition-transform duration-300 ease-in-out flex flex-col ${
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
        <div className="h-[60px] px-4 border-b border-border flex items-center">
          <Logo size="md" className="hover:opacity-90 transition-opacity" />
        </div>
        
        {/* Navigation Links */}
        <nav className="flex-1 py-4 overflow-y-auto">
          <SidebarSection title="" items={mainItems} />
          <SidebarSection title="" items={integrationItems} />
          {isWorkspaceAdmin && <SidebarSection title="" items={teamItems} />}
          {isAdminUser && <SidebarSection title="" items={adminItems} />}
          <SidebarSection title="" items={settingsItems} />
        </nav>
      </div>
      
      {/* Mobile toggle button - in the Header component */}
    </>
  );
};

export default Sidebar;
