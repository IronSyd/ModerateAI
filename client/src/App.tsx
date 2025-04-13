import { Switch, Route, useLocation } from "wouter";
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
import LandingPage from "@/pages/landing";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";

// Dashboard layout with sidebar and header
function DashboardLayout({ children }: { children: React.ReactNode }) {
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
  
  // Check if current path is the landing page or requires the dashboard layout
  const isLandingPage = location === "/";
  
  // If it's the landing page, render without dashboard layout
  if (isLandingPage) {
    return (
      <Switch>
        <Route path="/" component={LandingPage} />
      </Switch>
    );
  }
  
  // For all other routes, use the dashboard layout
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/conversations" component={Conversations} />
        <Route path="/ai-configuration" component={AiConfiguration} />
        <Route path="/templates" component={Templates} />
        <Route path="/integrations/website" component={WebsiteIntegration} />
        <Route path="/integrations/telegram" component={TelegramIntegration} />
        <Route path="/integrations/discord" component={DiscordIntegration} />
        <Route path="/team" component={Team} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
