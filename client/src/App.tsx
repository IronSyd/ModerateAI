import { Switch, Route } from "wouter";
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
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";

function Router() {
  return (
    <div className="min-h-screen flex bg-gray-50 font-sans">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content */}
      <div className="flex-1">
        <Header />
        
        <div className="p-4 md:p-6">
          <Switch>
            <Route path="/" component={Dashboard} />
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
        </div>
      </div>
    </div>
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
