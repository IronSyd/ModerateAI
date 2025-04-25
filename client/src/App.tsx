import { Switch, Route, useLocation } from "wouter";
import { useEffect, useLayoutEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Conversations from "@/pages/conversations";
import AiConfiguration from "@/pages/ai-configuration";
import Templates from "@/pages/templates";
import WebsiteIntegration from "@/pages/integrations/website";
import TelegramIntegration from "@/pages/integrations/telegram";
import DiscordIntegration from "@/pages/integrations/discord";
import Team from "@/pages/team";
import Settings from "@/pages/settings";
import ActivityPage from "@/pages/activity";
import LandingPage from "@/pages/landing";
import AuthPage from "@/pages/auth-page";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { AuthProvider } from "@/hooks/use-auth";
import { AdminUserProvider } from "@/hooks/use-admin-user";
import { ProtectedRoute } from "@/lib/protected-route";

// Dashboard layout with sidebar and header
function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Scroll to top when dashboard layout mounts or location changes
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    
    // Prevent scrolling for a short time after mounting to avoid auto-scrolling
    const preventScroll = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };
    
    document.addEventListener('scroll', preventScroll, { passive: false });
    
    // Remove the event listener after a short delay to allow normal scrolling
    const timer = setTimeout(() => {
      document.removeEventListener('scroll', preventScroll);
    }, 500);
    
    return () => {
      clearTimeout(timer);
      document.removeEventListener('scroll', preventScroll);
    };
  }, []);
  
  return (
    <div className="min-h-screen flex bg-background font-sans">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content */}
      <div className="flex-1">
        <Header />
        
        <div className="p-4 md:p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

function Router() {
  const [location] = useLocation();
  
  // Reset scroll position on route changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
  
  // Check if current path is the landing page, auth page, or requires the dashboard layout
  const isPublicPage = location === "/" || location === "/auth";
  
  // If it's a public page, render without dashboard layout
  if (isPublicPage) {
    return (
      <Switch>
        <Route path="/" component={LandingPage} />
        <Route path="/auth" component={AuthPage} />
        <Route component={NotFound} />
      </Switch>
    );
  }
  
  // For all other routes, use the dashboard layout with protected routes
  return (
    <DashboardLayout>
      <Switch>
        <ProtectedRoute path="/dashboard" component={Dashboard} />
        <ProtectedRoute path="/conversations" component={Conversations} />
        <ProtectedRoute path="/ai-configuration" component={AiConfiguration} />
        <ProtectedRoute path="/templates" component={Templates} />
        <ProtectedRoute path="/integrations/website" component={WebsiteIntegration} />
        <ProtectedRoute path="/integrations/telegram" component={TelegramIntegration} />
        <ProtectedRoute path="/integrations/discord" component={DiscordIntegration} />
        <ProtectedRoute path="/team" component={Team} />
        <ProtectedRoute path="/settings" component={Settings} />
        <ProtectedRoute path="/activity" component={ActivityPage} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AdminUserProvider>
          <Router />
          <Toaster />
        </AdminUserProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
