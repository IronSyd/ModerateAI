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
import AuthPage from "@/pages/auth-page";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";

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
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
