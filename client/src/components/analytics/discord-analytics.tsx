import React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, MessageSquare, ShieldAlert, Activity } from "lucide-react";

interface AnalyticsDataPoint {
  date: string;
  messageCount: number;
  moderationCount: number;
  userCount: number;
  activeChannels?: number;
}

interface AnalyticsSummary {
  totalMessages: number;
  totalModerationActions: number;
  activeUsers: number;
  activeChannels: number;
  period: string;
}

interface AnalyticsResponse {
  platformId: number;
  platformType: string;
  platformName: string;
  currentMetrics: AnalyticsDataPoint;
  historicalData: AnalyticsDataPoint[];
  summary: AnalyticsSummary;
}

interface DiscordAnalyticsProps {
  platformId?: number;
}

export function DiscordAnalytics({ platformId }: DiscordAnalyticsProps) {
  const { data, isLoading, error } = useQuery<AnalyticsResponse>({
    queryKey: [`/api/platforms/${platformId}/analytics`],
    enabled: !!platformId,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array(4).fill(0).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-3/4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-1/2 mb-2" />
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-12 text-center">
        <h3 className="text-lg font-medium">Unable to load analytics data</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Please try again later or contact support if the problem persists.
        </p>
      </div>
    );
  }

  const { summary, historicalData } = data;

  // Format data for charts
  const chartData = historicalData.map(point => ({
    ...point,
    date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  return (
    <div className="space-y-6">
      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <MessageSquare className="mr-2 h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold">{summary.totalMessages.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">{summary.period}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Moderation Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <ShieldAlert className="mr-2 h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold">{summary.totalModerationActions.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">{summary.period}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <Users className="mr-2 h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold">{summary.activeUsers.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Current</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Channels</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <Activity className="mr-2 h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold">{summary.activeChannels.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Current</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="messages">
        <TabsList className="mb-4">
          <TabsTrigger value="messages">Message Volume</TabsTrigger>
          <TabsTrigger value="moderation">Moderation</TabsTrigger>
          <TabsTrigger value="engagement">User Engagement</TabsTrigger>
        </TabsList>
        
        <TabsContent value="messages" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Message Volume</CardTitle>
              <CardDescription>
                Total messages sent per day in your Discord server
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartData}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#5865F2" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#5865F2" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Area 
                      type="monotone" 
                      dataKey="messageCount" 
                      stroke="#5865F2" 
                      fillOpacity={1} 
                      fill="url(#colorMessages)" 
                      name="Messages"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
            <CardFooter>
              <p className="text-sm text-muted-foreground">
                This chart shows the total number of messages sent each day in your Discord server
              </p>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="moderation" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Moderation Actions</CardTitle>
              <CardDescription>
                Number of moderation actions taken per day
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar 
                      dataKey="moderationCount" 
                      name="Moderation Actions" 
                      fill="#FF4654" 
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
            <CardFooter>
              <p className="text-sm text-muted-foreground">
                This chart shows the total number of moderation actions taken each day, including content filtering and warnings
              </p>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="engagement" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>User Engagement</CardTitle>
              <CardDescription>
                Active users and channels over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar 
                      dataKey="userCount" 
                      name="Active Users" 
                      fill="#57F287" 
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar 
                      dataKey="activeChannels" 
                      name="Active Channels" 
                      fill="#EB459E" 
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
            <CardFooter>
              <p className="text-sm text-muted-foreground">
                This chart shows the number of active users and channels in your Discord server each day
              </p>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}