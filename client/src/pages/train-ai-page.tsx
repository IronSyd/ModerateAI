import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { queryClient } from "@/lib/queryClient";
import { Loader2, Check, AlertCircle, Activity } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

export default function TrainAIPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedPlatformId, setSelectedPlatformId] = useState<string>("");

  // Fetch platforms
  const {
    data: platforms,
    isLoading: isLoadingPlatforms,
    error: platformsError,
  } = useQuery({
    queryKey: ["/api/platforms"],
    enabled: !!user,
  });

  // Fetch existing trainings
  const {
    data: trainings,
    isLoading: isLoadingTrainings,
    error: trainingsError,
  } = useQuery({
    queryKey: ["/api/conversation-trainings", selectedPlatformId],
    enabled: !!user && !!selectedPlatformId,
  });

  // Start a new training
  const startTrainingMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/conversation-trainings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          platformId: parseInt(selectedPlatformId),
          status: "pending",
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to start training");
      }

      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Training started",
        description: "AI training process has started. This may take a few minutes.",
      });
      // Refetch trainings
      queryClient.invalidateQueries({
        queryKey: ["/api/conversation-trainings", selectedPlatformId],
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to start training",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">Pending</span>;
      case "in_progress":
        return <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">In Progress</span>;
      case "completed":
        return <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">Completed</span>;
      case "error":
        return <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs">Error</span>;
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs">{status}</span>;
    }
  };

  if (isLoadingPlatforms) {
    return (
      <div className="container mx-auto py-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (platformsError) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load platforms. Please try again later.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Train AI Assistant</h1>
      
      <Card className="p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Start New Training</h2>
        <p className="text-gray-600 mb-4">
          Train your AI assistant on previous conversations to improve its responses.
          The system will analyze conversation patterns, user intents, and effective
          responses to enhance AI performance.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="w-full sm:w-1/2">
            <label className="block text-sm font-medium mb-2">
              Select Platform
            </label>
            <Select
              value={selectedPlatformId}
              onValueChange={setSelectedPlatformId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a platform" />
              </SelectTrigger>
              <SelectContent>
                {Array.isArray(platforms) ? platforms.map((platform) => (
                  <SelectItem key={platform.id} value={platform.id.toString()}>
                    {platform.name} ({platform.type})
                  </SelectItem>
                )) : (
                  <SelectItem value="no-platforms" disabled>
                    No platforms available
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          
          <div className="w-full sm:w-1/2 flex items-end">
            <Button
              onClick={() => startTrainingMutation.mutate()}
              disabled={!selectedPlatformId || startTrainingMutation.isPending}
              className="w-full"
            >
              {startTrainingMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting Training...
                </>
              ) : (
                <>
                  <Activity className="mr-2 h-4 w-4" />
                  Start Training
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>
      
      <h2 className="text-xl font-semibold mb-4">Training History</h2>
      
      {isLoadingTrainings ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : trainingsError ? (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load training history. Please try again later.
          </AlertDescription>
        </Alert>
      ) : !selectedPlatformId ? (
        <Alert className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Select a platform</AlertTitle>
          <AlertDescription>
            Please select a platform to view training history.
          </AlertDescription>
        </Alert>
      ) : trainings && trainings.length === 0 ? (
        <Alert className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No training history</AlertTitle>
          <AlertDescription>
            No training sessions found for this platform.
          </AlertDescription>
        </Alert>
      ) : (
        <Table>
          <TableCaption>List of AI training sessions</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Started</TableHead>
              <TableHead>Completed</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Result</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trainings && trainings.map((training) => (
              <TableRow key={training.id}>
                <TableCell>{training.id}</TableCell>
                <TableCell>{getStatusBadge(training.status)}</TableCell>
                <TableCell>
                  {training.startedAt ? formatDate(training.startedAt) : "Not started"}
                </TableCell>
                <TableCell>
                  {training.completedAt ? formatDate(training.completedAt) : "Not completed"}
                </TableCell>
                <TableCell className="w-48">
                  {training.status === "in_progress" ? (
                    <div className="space-y-1">
                      <Progress 
                        value={
                          training.totalConversations > 0 
                            ? (training.processedConversations / training.totalConversations) * 100 
                            : 0
                        } 
                      />
                      <p className="text-xs text-gray-500">
                        {training.processedConversations} / {training.totalConversations} conversations
                      </p>
                    </div>
                  ) : training.status === "completed" ? (
                    <div className="flex items-center text-green-600">
                      <Check className="mr-1 h-4 w-4" />
                      <span>Complete</span>
                    </div>
                  ) : training.status === "error" ? (
                    <div className="text-red-600">Failed</div>
                  ) : (
                    <div className="text-gray-500">Waiting</div>
                  )}
                </TableCell>
                <TableCell>
                  {training.status === "error" && training.errorMessage ? (
                    <span className="text-red-600 text-sm">{training.errorMessage}</span>
                  ) : training.status === "completed" ? (
                    <span className="text-green-600 text-sm">AI prompt updated successfully</span>
                  ) : (
                    <span className="text-gray-500 text-sm">-</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}