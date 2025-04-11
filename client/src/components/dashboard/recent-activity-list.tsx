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
  // For demo placeholder images - in a real app, these would come from the backend
  const placeholderAvatars = [
    "https://images.unsplash.com/photo-1550525811-e5869dd03032?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
    "https://images.unsplash.com/photo-1463453091185-61582044d556?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
    "https://images.unsplash.com/photo-1502685104226-ee32379fefbe?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
  ];
  
  // Get platform badge color
  const getPlatformBadgeClass = (platform: string) => {
    switch (platform) {
      case "website":
        return "text-primary-600";
      case "discord":
        return "text-indigo-600";
      case "telegram":
        return "text-blue-600";
      default:
        return "text-gray-600";
    }
  };
  
  // Get platform badge dot color
  const getPlatformDotClass = (platform: string) => {
    switch (platform) {
      case "website":
        return "text-primary-500";
      case "discord":
        return "text-indigo-500";
      case "telegram":
        return "text-blue-500";
      default:
        return "text-gray-500";
    }
  };
  
  // Loading state
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start space-x-3">
              <div className="rounded-full bg-gray-200 h-10 w-10"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/3"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
      <div className="flow-root">
        <ul className="-my-5 divide-y divide-gray-200">
          {activities.map((activity, index) => (
            <li key={activity.id} className="py-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <Avatar>
                    <AvatarImage
                      src={activity.user.avatar || placeholderAvatars[index % placeholderAvatars.length]}
                      alt={activity.user.name}
                    />
                    <AvatarFallback>{activity.user.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                </div>
                <div className="ml-3 min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">{activity.user.name}</p>
                  <p className="text-sm text-gray-500">{activity.action}</p>
                  <div className="mt-1 flex items-center">
                    <span className={`inline-flex items-center text-xs font-medium ${getPlatformBadgeClass(activity.platform)}`}>
                      <svg className={`mr-1.5 h-3 w-3 ${getPlatformDotClass(activity.platform)}`} fill="currentColor" viewBox="0 0 8 8">
                        <circle cx="4" cy="4" r="3" />
                      </svg>
                      {activity.platform.charAt(0).toUpperCase() + activity.platform.slice(1)}
                    </span>
                    <span className="text-xs text-gray-500 mx-2">•</span>
                    <span className="text-xs text-gray-500">
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
        <Button variant="outline" className="w-full text-center">View all activity</Button>
      </div>
    </div>
  );
};

export default RecentActivityList;
