import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Pagination, 
  PaginationContent, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious 
} from "@/components/ui/pagination";
import { Search } from "lucide-react";
import { FilterBarShell, PageHeroShell, PageSectionCard, TableShell } from "@/components/layout/page-shells";

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

const ActivityPage = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const itemsPerPage = 20;
  
  // Fetch all activity data - in a real app, you would implement pagination and filtering on the server
  const { data: activityData, isLoading } = useQuery({
    queryKey: ['/api/activity'],
    retry: false,
  });
  
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
  
  // Process and filter activity data
  const processedActivities = () => {
    if (!activityData || !Array.isArray(activityData)) return [];
    
    let activities: ActivityItem[] = activityData.map((activity: any, index: number) => ({
      id: `activity-${activity.id || index}`,
      user: {
        name: activity.user,
        avatar: ""
      },
      action: activity.action,
      platform: activity.platform as "website" | "discord" | "telegram",
      time: new Date(activity.time)
    }));
    
    // Apply platform filter (skip if "all" is selected)
    if (platformFilter && platformFilter !== "all") {
      activities = activities.filter(activity => activity.platform === platformFilter);
    }
    
    // Apply search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      activities = activities.filter(activity => 
        activity.user.name.toLowerCase().includes(query) || 
        activity.action.toLowerCase().includes(query)
      );
    }
    
    return activities;
  };
  
  // Calculate pagination
  const filteredActivities = processedActivities();
  const totalPages = Math.ceil(filteredActivities.length / itemsPerPage);
  const paginatedActivities = filteredActivities.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  
  // Render loading state
  if (isLoading) {
    return (
      <div className="space-y-6 wave-v2-page wave-v2-activity">
        <PageHeroShell>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-foreground">Activity Log</h1>
            <p className="text-sm text-muted-foreground">
              Review message and moderation activity across website, Telegram, and Discord.
            </p>
          </div>
        </PageHeroShell>
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <Skeleton className="w-full sm:w-64 h-10 rounded-md" />
          <Skeleton className="w-full sm:w-48 h-10 rounded-md" />
        </div>
        <PageSectionCard className="p-6">
          <div className="space-y-6">
            {Array(10).fill(0).map((_, i) => (
              <div key={i} className="flex items-start space-x-3">
                <Skeleton className="rounded-full h-10 w-10" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 rounded w-1/4" />
                  <Skeleton className="h-3 rounded w-3/4" />
                  <Skeleton className="h-3 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        </PageSectionCard>
      </div>
    );
  }
  
  return (
    <div className="space-y-6 wave-v2-page wave-v2-activity">
      <PageHeroShell>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-foreground">Activity Log</h1>
            <p className="text-sm text-muted-foreground">
              Review platform activity with quick filtering and pagination controls.
            </p>
          </div>
          <Link href="/dashboard">
            <Button variant="outline">Back to Dashboard</Button>
          </Link>
        </div>
      </PageHeroShell>

      <FilterBarShell>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search activity..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="All platforms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All platforms</SelectItem>
              <SelectItem value="website">Website</SelectItem>
              <SelectItem value="discord">Discord</SelectItem>
              <SelectItem value="telegram">Telegram</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </FilterBarShell>

      <PageSectionCard className="p-6">
        {paginatedActivities.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No activity found</p>
          </div>
        ) : (
          <TableShell>
            <ul className="divide-y divide-border/70">
              {paginatedActivities.map((activity, index) => (
                <li key={activity.id} className="px-4 py-4">
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
                        <span className="text-xs text-muted-foreground mx-2">&middot;</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(activity.time, { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </TableShell>
        )}
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    href="#" 
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage > 1) setCurrentPage(currentPage - 1);
                    }}
                    className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  // Show a window of 5 pages centered around current page
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <PaginationItem key={pageNum}>
                      <PaginationLink 
                        href="#" 
                        onClick={(e) => {
                          e.preventDefault();
                          setCurrentPage(pageNum);
                        }}
                        isActive={currentPage === pageNum}
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
                
                <PaginationItem>
                  <PaginationNext 
                    href="#" 
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage < totalPages) setCurrentPage(currentPage + 1);
                    }}
                    className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </PageSectionCard>
    </div>
  );
};

export default ActivityPage;
