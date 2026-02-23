import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { History, Brain, TrendingUp, MessageSquare, Users, ToggleLeft, ToggleRight } from 'lucide-react';

interface TrainingInsight {
  id: number;
  type: string;
  pattern: string;
  confidence: number;
  usageCount: number;
  successRate: number;
  learnedFrom: string;
  createdAt: string;
  isActive: boolean;
}

interface ChatHistoryMessage {
  id: number;
  content: string;
  messageType: 'user' | 'bot' | 'admin';
  isAdmin: boolean;
  externalUsername?: string;
  sentAt: string;
  isUsedForTraining: boolean;
}

interface TrainingManagementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  chatConfigId: number;
  chatName: string;
}

export function TrainingManagementDialog({
  isOpen,
  onClose,
  chatConfigId,
  chatName
}: TrainingManagementDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'insights' | 'history' | 'analysis'>('insights');

  // Fetch training insights
  const { data: insights, isLoading: insightsLoading } = useQuery({
    queryKey: [`/api/training/insights/${chatConfigId}`],
    enabled: isOpen && activeTab === 'insights'
  });

  // Fetch chat history
  const { data: chatHistory, isLoading: historyLoading } = useQuery({
    queryKey: [`/api/training/chat-history/${chatConfigId}`, { adminOnly: 'true', limit: '100' }],
    enabled: isOpen && activeTab === 'history'
  });

  // Analyze chat history mutation
  const analyzeHistoryMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/training/analyze-chat-history/${chatConfigId}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to analyze chat history');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Analysis Complete',
        description: `Successfully created ${data.insights?.length || 0} training insights`,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/training/insights/${chatConfigId}`] });
    },
    onError: (error: any) => {
      toast({
        title: 'Analysis Failed',
        description: error.message || 'Failed to analyze chat history',
        variant: 'destructive'
      });
    }
  });

  // Toggle insight status mutation
  const toggleInsightMutation = useMutation({
    mutationFn: async (insightId: number) => {
      const response = await fetch(`/api/training/insights/${insightId}/toggle`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update insight');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Insight status updated',
      });
      queryClient.invalidateQueries({ queryKey: [`/api/training/insights/${chatConfigId}`] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update insight',
        variant: 'destructive'
      });
    }
  });

  const handleAnalyzeHistory = () => {
    analyzeHistoryMutation.mutate();
  };

  const handleToggleInsight = (insightId: number) => {
    toggleInsightMutation.mutate(insightId);
  };

  const getInsightTypeIcon = (type: string) => {
    switch (type) {
      case 'response_pattern':
        return <MessageSquare className="h-4 w-4" />;
      case 'admin_behavior':
        return <Users className="h-4 w-4" />;
      case 'improvement':
        return <TrendingUp className="h-4 w-4" />;
      default:
        return <Brain className="h-4 w-4" />;
    }
  };

  const getInsightTypeColor = (type: string) => {
    switch (type) {
      case 'response_pattern':
        return 'bg-blue-100 text-blue-800';
      case 'admin_behavior':
        return 'bg-green-100 text-green-800';
      case 'improvement':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Training Management - {chatName}
          </DialogTitle>
        </DialogHeader>

        {/* Tab Navigation */}
        <div className="flex space-x-4 border-b">
          <button
            onClick={() => setActiveTab('insights')}
            className={`pb-2 px-1 border-b-2 transition-colors ${
              activeTab === 'insights'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Training Insights
            </div>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-2 px-1 border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Admin History
            </div>
          </button>
          <button
            onClick={() => setActiveTab('analysis')}
            className={`pb-2 px-1 border-b-2 transition-colors ${
              activeTab === 'analysis'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Run Analysis
            </div>
          </button>
        </div>

        <div className="space-y-4">
          {/* Training Insights Tab */}
          {activeTab === 'insights' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Active Training Insights</h3>
                <Badge variant="secondary">
                  {(insights as any)?.insights?.filter((i: TrainingInsight) => i.isActive).length || 0} Active
                </Badge>
              </div>

              {insightsLoading ? (
                <div className="space-y-3 py-2">
                  {[1, 2, 3].map((row) => (
                    <div key={row} className="p-4 border rounded-lg space-y-2">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-5 w-28 rounded-full" />
                        <Skeleton className="h-5 w-24 rounded-full" />
                      </div>
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  ))}
                </div>
              ) : !(insights as any)?.insights?.length ? (
                <div className="text-center py-8 text-gray-500">
                  No training insights found. Automatic analysis runs on a schedule when enough new admin messages are available, or you can run a manual analysis now.
                </div>
              ) : (
                <div className="space-y-3">
                  {(insights as any).insights.map((insight: TrainingInsight) => (
                    <div
                      key={insight.id}
                      className={`p-4 border rounded-lg ${
                        insight.isActive ? 'bg-white' : 'bg-gray-50 opacity-75'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {getInsightTypeIcon(insight.type)}
                            <Badge className={getInsightTypeColor(insight.type)}>
                              {insight.type.replace('_', ' ')}
                            </Badge>
                            <Badge variant="outline">
                              {Math.round(insight.confidence || 0)}% confidence
                            </Badge>
                          </div>
                          <p className="text-sm font-medium mb-1">{insight.pattern}</p>
                          <p className="text-xs text-gray-500 mb-2">
                            Learned from: {insight.learnedFrom}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>Used {insight.usageCount} times</span>
                            <span>Success rate: {Math.round(insight.successRate || 0)}%</span>
                            <span>Created: {new Date(insight.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleInsight(insight.id)}
                          disabled={toggleInsightMutation.isPending}
                        >
                          {insight.isActive ? (
                            <ToggleRight className="h-4 w-4 text-green-600" />
                          ) : (
                            <ToggleLeft className="h-4 w-4 text-gray-400" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Chat History Tab */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Admin Chat History</h3>
                <Badge variant="secondary">
                  {(chatHistory as any)?.history?.filter((m: ChatHistoryMessage) => m.isAdmin).length || 0} Admin Messages
                </Badge>
              </div>

              {historyLoading ? (
                <div className="space-y-2 py-2">
                  {[1, 2, 3, 4].map((row) => (
                    <div key={row} className="p-3 border rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-5 w-20 rounded-full" />
                        <Skeleton className="h-3 w-36" />
                      </div>
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-5/6" />
                    </div>
                  ))}
                </div>
              ) : !(chatHistory as any)?.history?.length ? (
                <div className="text-center py-8 text-gray-500">
                  No admin chat history found. Make sure admin learning mode is enabled and admins have participated in conversations.
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {(chatHistory as any).history
                    .filter((msg: ChatHistoryMessage) => msg.isAdmin)
                    .map((msg: ChatHistoryMessage) => (
                    <div
                      key={msg.id}
                      className={`p-3 border rounded-lg ${
                        msg.isUsedForTraining ? 'bg-blue-50 border-blue-200' : 'bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">Admin</Badge>
                          {msg.externalUsername && (
                            <span className="text-sm text-gray-600">@{msg.externalUsername}</span>
                          )}
                          {msg.isUsedForTraining && (
                            <Badge className="bg-blue-100 text-blue-800">Used for Training</Badge>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(msg.sentAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm">{msg.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Analysis Tab */}
          {activeTab === 'analysis' && (
            <div className="space-y-4">
              <div className="text-center py-8">
                <Brain className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Analyze Admin Conversations</h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  Admin history is analyzed automatically on a schedule when enough new admin messages are available. Use manual analysis anytime to refresh insights immediately.
                </p>
                
                <Button
                  onClick={handleAnalyzeHistory}
                  disabled={analyzeHistoryMutation.isPending}
                  size="lg"
                >
                  {analyzeHistoryMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Analyze Chat History
                    </>
                  )}
                </Button>

                {analyzeHistoryMutation.isPending && (
                  <div className="mt-4">
                    <Progress value={undefined} className="w-full" />
                    <p className="text-sm text-gray-500 mt-2">
                      Analyzing admin conversations and generating training insights...
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <Separator />

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
