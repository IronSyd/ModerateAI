import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

type ActivityItem = {
  id: string;
  user: {
    name: string;
    avatar: string;
  };
  action: string;
  platform: "website" | "discord" | "telegram";
  time: Date;
};

type RecentActivityListProps = {
  activities: ActivityItem[];
  isLoading: boolean;
};

const RecentActivityList = ({ activities, isLoading }: RecentActivityListProps) => {
  // Get appropriate avatar based on user type
  const getAvatarForUser = (userName: string) => {
    if (userName === 'ai') {
      return undefined; // Will use fallback with "AI" initials
    }
    // For actual users, could use their profile image here
    return undefined; // Will use fallback with user initials
  };
  
  // Get platform badge color
  const getPlatformBadgeClass = (platform: string) => {
    switch (platform) {
      case "website":
        return "text-primary";
      case "discord":
        return "text-indigo-400";
      case "telegram":
        return "text-blue-400";
      default:
        return "text-muted-foreground";
    }
  };
  
  // Get platform badge dot color
  const getPlatformDotClass = (platform: string) => {
    switch (platform) {
      case "website":
        return "text-primary";
      case "discord":
        return "text-indigo-400";
      case "telegram":
        return "text-blue-400";
      default:
        return "text-muted-foreground";
    }
  };
  
  // Loading state
  if (isLoading) {
    return (
      <div className="bg-card rounded-lg shadow-sm p-4 border border-border">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start space-x-3">
              <div className="rounded-full bg-muted h-10 w-10"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded w-1/4"></div>
                <div className="h-3 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/3"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-card rounded-lg shadow-sm p-4 border border-border">
      <div className="flow-root">
        <ul className="-my-5 divide-y divide-border">
          {activities.map((activity, index) => (
            <li key={activity.id} className="py-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <Avatar>
                    <AvatarImage
                      src={activity.user.avatar || getAvatarForUser(activity.user.name)}
                      alt={activity.user.name}
                    />
                    <AvatarFallback className={activity.user.name === 'ai' ? 'bg-blue-500 text-white' : 'bg-gray-500 text-white'}>
                      {activity.user.name === 'ai' ? 'AI' : activity.user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="ml-3 min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{activity.user.name}</p>
                  <p className="text-sm text-muted-foreground">{activity.action}</p>
                  <div className="mt-1 flex items-center">
                    <span className={`inline-flex items-center text-xs font-medium ${getPlatformBadgeClass(activity.platform)}`}>
                      <svg className={`mr-1.5 h-3 w-3 ${getPlatformDotClass(activity.platform)}`} fill="currentColor" viewBox="0 0 8 8">
                        <circle cx="4" cy="4" r="3" />
                      </svg>
                      {activity.platform.charAt(0).toUpperCase() + activity.platform.slice(1)}
                    </span>
                    <span className="text-xs text-muted-foreground mx-2">•</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(activity.time, { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-5">
        <Button 
          variant="outline" 
          className="w-full text-center"
          onClick={() => window.location.href = "/activity"}
        >
          View all activity
        </Button>
      </div>
    </div>
  );
};

export default RecentActivityList;
