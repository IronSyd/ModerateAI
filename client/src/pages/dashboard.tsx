import { useState, useEffect, useLayoutEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import WelcomeBanner from "@/components/dashboard/welcome-banner";
import SetupSteps from "@/components/dashboard/setup-steps";
import StatsCard from "@/components/dashboard/stats-card";
import PlatformIntegrationCard from "@/components/dashboard/platform-integration-card";
import RecentActivityList from "@/components/dashboard/recent-activity-list";

import DemoChatInterface from "@/components/chat/fixed-demo-chat-interface";
import { MessagesSquare, MonitorSmartphone, CheckCircle } from "lucide-react";


const Dashboard = () => {
  // Scroll handling now done at the App level

  // Fetch dashboard stats
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['/api/dashboard/stats'],
    retry: false,
  });
  
  // Fetch platforms
  const { data: platforms, isLoading: isLoadingPlatforms } = useQuery({
    queryKey: ['/api/platforms'],
    retry: false,
  });
  
  // Fetch recent activity
  const { data: recentActivity, isLoading: isLoadingActivity } = useQuery({
    queryKey: ['/api/dashboard/recent-activity'],
    retry: false,
  });
  

  

  
  // Setup progress tracker
  const totalSetupSteps = 3; // Website, Telegram, Discord integrations
  const [completedSteps, setCompletedSteps] = useState(0);
  const [setupProgress, setSetupProgress] = useState({
    websiteIntegration: false,
    telegramIntegration: false,
    discordIntegration: false,
  });
  
  // Update completed steps based on data
  useEffect(() => {
    if (platforms) {
      let completed = 0;
      // Create initial progress object
      const progress = {
        websiteIntegration: false,
        telegramIntegration: false,
        discordIntegration: false,
      };
      

      
      // Check platform integrations
      if (platforms) {
        const websitePlatform = platforms.find(p => p.type === "website");
        if (websitePlatform && websitePlatform.status === "active") {
          completed += 1;
          progress.websiteIntegration = true;
        }
        
        const telegramPlatform = platforms.find(p => p.type === "telegram");
        if (telegramPlatform && telegramPlatform.status === "active") {
          completed += 1;
          progress.telegramIntegration = true;
        }
        
        const discordPlatform = platforms.find(p => p.type === "discord");
        if (discordPlatform && discordPlatform.status === "active") {
          completed += 1;
          progress.discordIntegration = true;
        }
      }
      

      
      setCompletedSteps(completed);
      setSetupProgress(progress);
    }
  }, [platforms]);
  
  // Format stats for display
  const getStatsForDisplay = () => {
    if (isLoadingStats || !stats) {
      return [
        {
          title: "Total Conversations",
          value: "-",
          icon: <MessagesSquare className="h-6 w-6" />,
          iconBgColor: "bg-primary/20",
          iconColor: "text-primary",
          changeValue: 0,
          changeText: "vs last week"
        },
        {
          title: "AI Responses",
          value: "-",
          icon: <MonitorSmartphone className="h-6 w-6" />,
          iconBgColor: "bg-secondary/20",
          iconColor: "text-secondary",
          changeValue: 0,
          changeText: "vs last week"
        },
        {
          title: "Response Rate",
          value: "-",
          icon: <CheckCircle className="h-6 w-6" />,
          iconBgColor: "bg-green-600/20",
          iconColor: "text-green-500",
          changeValue: 0,
          changeText: "vs last week"
        }
      ];
    }
    
    return [
      {
        title: "Total Conversations",
        value: stats.totalConversations.toLocaleString(),
        icon: <MessagesSquare className="h-6 w-6" />,
        iconBgColor: "bg-primary/20",
        iconColor: "text-primary",
        changeValue: null,
        changeText: "vs last week"
      },
      {
        title: "AI Responses",
        value: stats.aiResponses.toLocaleString(),
        icon: <MonitorSmartphone className="h-6 w-6" />,
        iconBgColor: "bg-secondary/20",
        iconColor: "text-secondary",
        changeValue: null,
        changeText: "vs last week"
      },
      {
        title: "Response Rate",
        value: stats.responseRate > 0 ? `${stats.responseRate.toFixed(1)}%` : "0%",
        icon: <CheckCircle className="h-6 w-6" />,
        iconBgColor: "bg-green-600/20",
        iconColor: "text-green-500",
        changeValue: null,
        changeText: "vs last week"
      }
    ];
  };
  
  // Format AI config for display

  

  
  // Process activity data
  const processActivityData = () => {
    if (isLoadingActivity || !recentActivity) {
      return [];
    }
    
    return recentActivity.map((activity, index) => ({
      id: `activity-${index}`,
      user: {
        name: activity.user,
        avatar: ""
      },
      action: activity.action,
      platform: activity.platform as "website" | "discord" | "telegram",
      time: new Date(activity.time)
    }));
  };
  
  return (
    <div>
      {/* Welcome Banner with Setup Steps */}
      <WelcomeBanner
        completedSteps={completedSteps}
        totalSteps={totalSetupSteps}
        title="Welcome to ModerateAI"
        description="Set up your integrations to start moderating your communities."
        setupProgress={setupProgress}
      />
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6">
        {getStatsForDisplay().map((stat, index) => (
          <StatsCard
            key={index}
            title={stat.title}
            value={stat.value}
            icon={stat.icon}
            iconBgColor={stat.iconBgColor}
            iconColor={stat.iconColor}
            changeValue={stat.changeValue}
            changeText={stat.changeText}
          />
        ))}
      </div>
      
      {/* Integrations & Recent Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Platform Integrations */}
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold text-foreground mb-4">Platform Integrations</h2>
          <div className="bg-card rounded-lg shadow-sm border border-border">
            {isLoadingPlatforms ? (
              // Loading skeleton
              <>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="border-b border-border p-6 last:border-b-0">
                    <div className="animate-pulse flex items-start justify-between">
                      <div className="flex items-center">
                        <div className="rounded-lg bg-muted p-3 mr-4 h-12 w-12"></div>
                        <div>
                          <div className="h-4 bg-muted rounded w-24 mb-2"></div>
                          <div className="h-3 bg-muted rounded w-40"></div>
                        </div>
                      </div>
                      <div className="h-6 bg-muted rounded-full w-20"></div>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              // Display platforms
              platforms?.map((platform) => (
                <PlatformIntegrationCard
                  key={platform.id}
                  type={platform.type as "website" | "telegram" | "discord"}
                  name={platform.name}
                  description={
                    platform.type === "website" 
                      ? "Embed an AI assistant on your website" 
                      : platform.type === "telegram"
                      ? "Add AI responses to your Telegram groups"
                      : "Add AI moderation to your Discord server"
                  }
                  status={platform.status as "active" | "not_connected" | "setup_required"}
                />
              ))
            )}
          </div>
        </div>
        
        {/* Recent Activity */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">Recent Activity</h2>
          <RecentActivityList 
            activities={processActivityData()} 
            isLoading={isLoadingActivity} 
          />
        </div>
      </div>
      
      {/* Demo Chat Interface */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Demo Chat Interface</h2>
        <DemoChatInterface />
      </div>
    </div>
  );
};

export default Dashboard;
