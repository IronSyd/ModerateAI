import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { TrainingManagementDialog } from '../TrainingManagementDialog';
import { Brain, Plus, Trash2 } from 'lucide-react';

type LockSchedule = {
  id: string;
  recurrence: 'daily' | 'weekly';
  daysOfWeek: number[];
  lockAt: string;
  unlockAt: string;
  isEnabled: boolean;
};

interface ChatConfiguration {
  id: number;
  platformId: number;
  externalId: string;
  chatName: string;
  chatType: 'private' | 'group' | 'supergroup';
  aiConfigurationId: number | null;
  knowledgeBaseId: number | null;
  isActive: boolean;
  settings: {
    mentionOnlyMode?: boolean;
    welcomeMessage?: string;
    enableHistoryLearning?: boolean;
    adminLearningMode?: boolean;
    proactiveResponses?: boolean;
  };
  lockSettings?: {
    scheduleEnabled?: boolean;
    schedulePaused?: boolean;
    timezone?: string;
    schedules?: LockSchedule[];
    autoLockEnabled?: boolean;
    thresholdCount?: number;
    windowMinutes?: number;
    lockDurationMinutes?: number;
  };
}

interface KnowledgeBase {
  id: number;
  name: string;
  description: string;
}

interface ChatConfigurationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  chatConfig: ChatConfiguration | null;
  knowledgeBases: KnowledgeBase[];
}

const WEEKDAY_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

const createSchedule = (): LockSchedule => ({
  id: `schedule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  recurrence: 'daily',
  daysOfWeek: [],
  lockAt: '22:00',
  unlockAt: '07:00',
  isEnabled: true,
});

export function ChatConfigurationDialog({
  isOpen,
  onClose,
  chatConfig,
  knowledgeBases,
}: ChatConfigurationDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showTrainingDialog, setShowTrainingDialog] = useState(false);

  const [formData, setFormData] = useState({
    knowledgeBaseId: chatConfig?.knowledgeBaseId || null,
    isActive: chatConfig?.isActive ?? true,
    mentionOnlyMode: chatConfig?.settings?.mentionOnlyMode ?? false,
    proactiveResponses: chatConfig?.settings?.proactiveResponses ?? true,
    enableHistoryLearning: chatConfig?.settings?.enableHistoryLearning ?? false,
    adminLearningMode: chatConfig?.settings?.adminLearningMode ?? false,
    welcomeMessage: chatConfig?.settings?.welcomeMessage || '',
    scheduleEnabled: chatConfig?.lockSettings?.scheduleEnabled ?? false,
    schedulePaused: chatConfig?.lockSettings?.schedulePaused ?? false,
    timezone: chatConfig?.lockSettings?.timezone ?? 'UTC',
    schedules: chatConfig?.lockSettings?.schedules ?? [],
  });

  useEffect(() => {
    if (chatConfig) {
      setFormData({
        knowledgeBaseId: chatConfig.knowledgeBaseId || null,
        isActive: chatConfig.isActive ?? true,
        mentionOnlyMode: chatConfig.settings?.mentionOnlyMode ?? false,
        proactiveResponses: chatConfig.settings?.proactiveResponses ?? true,
        enableHistoryLearning: chatConfig.settings?.enableHistoryLearning ?? false,
        adminLearningMode: chatConfig.settings?.adminLearningMode ?? false,
        welcomeMessage: chatConfig.settings?.welcomeMessage || '',
        scheduleEnabled: chatConfig?.lockSettings?.scheduleEnabled ?? false,
        schedulePaused: chatConfig?.lockSettings?.schedulePaused ?? false,
        timezone: chatConfig?.lockSettings?.timezone ?? 'UTC',
        schedules: chatConfig?.lockSettings?.schedules ?? [],
      });
    }
  }, [chatConfig]);

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!chatConfig) return;
      const response = await fetch(`/api/chat-configurations/${chatConfig.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          aiConfigurationId: chatConfig.aiConfigurationId,
          knowledgeBaseId: data.knowledgeBaseId,
          isActive: data.isActive,
          settings: {
            mentionOnlyMode: data.mentionOnlyMode,
            proactiveResponses: data.proactiveResponses,
            enableHistoryLearning: data.enableHistoryLearning,
            adminLearningMode: data.adminLearningMode,
            welcomeMessage: data.welcomeMessage,
          },
        }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.message || 'Failed to update chat configuration');
      }

      const lockResponse = await fetch(`/api/chat-configurations/${chatConfig.id}/lock-settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          scheduleEnabled: data.scheduleEnabled,
          schedulePaused: data.schedulePaused,
          timezone: data.timezone,
          schedules: data.schedules,
        }),
      });
      if (!lockResponse.ok) {
        const error = await lockResponse.json().catch(() => ({}));
        throw new Error(error?.message || 'Failed to update lock settings');
      }

      return lockResponse.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Chat configuration updated successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/platforms'] });
      queryClient.invalidateQueries({ queryKey: ['/api/platforms', chatConfig?.platformId, 'chat-configurations'] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update chat configuration',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  const handleInputChange = (field: keyof typeof formData, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const updateSchedule = (index: number, patch: Partial<LockSchedule>) => {
    setFormData((prev) => {
      const next = [...prev.schedules];
      next[index] = { ...next[index], ...patch };
      if (next[index].recurrence === 'daily') {
        next[index].daysOfWeek = [];
      }
      return { ...prev, schedules: next };
    });
  };

  const toggleWeeklyDay = (index: number, day: number) => {
    setFormData((prev) => {
      const next = [...prev.schedules];
      const rule = next[index];
      const set = new Set(rule.daysOfWeek || []);
      if (set.has(day)) {
        set.delete(day);
      } else {
        set.add(day);
      }
      next[index] = {
        ...rule,
        daysOfWeek: Array.from(set).sort((a, b) => a - b),
      };
      return { ...prev, schedules: next };
    });
  };

  const addSchedule = () => {
    if (formData.schedules.length >= 20) return;
    handleInputChange('schedules', [...formData.schedules, createSchedule()]);
  };

  const removeSchedule = (id: string) => {
    handleInputChange(
      'schedules',
      formData.schedules.filter((schedule) => schedule.id !== id),
    );
  };

  if (!chatConfig) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure {chatConfig.chatName || chatConfig.externalId}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Basic Settings</h3>

            <div className="flex items-center justify-between">
              <Label htmlFor="isActive">Enable Bot for this Chat</Label>
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => handleInputChange('isActive', checked)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="knowledgeBase">Knowledge Base</Label>
              <Select
                value={formData.knowledgeBaseId?.toString() || 'none'}
                onValueChange={(value) => handleInputChange('knowledgeBaseId', value === 'none' ? null : parseInt(value, 10))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select knowledge base" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No knowledge base</SelectItem>
                  {knowledgeBases.map((kb) => (
                    <SelectItem key={kb.id} value={kb.id.toString()}>
                      {kb.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Chat Behavior</h3>

            {chatConfig.chatType === 'group' || chatConfig.chatType === 'supergroup' ? (
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="mentionOnlyMode">Mention Only Mode</Label>
                  <p className="text-sm text-muted-foreground">Bot only responds when mentioned</p>
                </div>
                <Switch
                  id="mentionOnlyMode"
                  checked={formData.mentionOnlyMode}
                  onCheckedChange={(checked) => handleInputChange('mentionOnlyMode', checked)}
                />
              </div>
            ) : null}

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="proactiveResponses">Proactive Responses</Label>
                <p className="text-sm text-muted-foreground">
                  Bot responds to relevant questions even without being mentioned
                </p>
              </div>
              <Switch
                id="proactiveResponses"
                checked={formData.proactiveResponses !== false}
                onCheckedChange={(checked) => handleInputChange('proactiveResponses', checked)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="welcomeMessage">Welcome Message</Label>
              <Textarea
                id="welcomeMessage"
                placeholder="Enter welcome message for new users..."
                value={formData.welcomeMessage}
                onChange={(e) => handleInputChange('welcomeMessage', e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">AI Training & Learning</h3>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="enableHistoryLearning">History Learning</Label>
                <p className="text-sm text-muted-foreground">Store eligible chat messages so ModerateAI can learn from admin interactions over time.</p>
              </div>
              <Switch
                id="enableHistoryLearning"
                checked={formData.enableHistoryLearning}
                onCheckedChange={(checked) => handleInputChange('enableHistoryLearning', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="adminLearningMode">Admin Learning Mode</Label>
                <p className="text-sm text-muted-foreground">Automatically analyzes new admin messages on a schedule (manual analysis is still available).</p>
              </div>
              <Switch
                id="adminLearningMode"
                checked={formData.adminLearningMode}
                onCheckedChange={(checked) => handleInputChange('adminLearningMode', checked)}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Timed Locking</h3>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="scheduleEnabled">Scheduled auto-lock</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically lock and unlock this destination based on your configured schedule.
                </p>
              </div>
              <Switch
                id="scheduleEnabled"
                checked={formData.scheduleEnabled}
                onCheckedChange={(checked) => handleInputChange('scheduleEnabled', checked)}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Schedule status</p>
                <p className="text-xs text-muted-foreground">
                  {formData.schedulePaused
                    ? 'Paused by manual override. Resume to re-enable auto schedule control.'
                    : 'Running when schedule is enabled.'}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!formData.schedulePaused}
                onClick={() => handleInputChange('schedulePaused', false)}
              >
                Resume Schedule
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lock-timezone">Timezone (IANA)</Label>
              <Input
                id="lock-timezone"
                value={formData.timezone}
                onChange={(e) => handleInputChange('timezone', e.target.value)}
                placeholder="e.g. Africa/Lagos"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Schedule rules</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={formData.schedules.length >= 20}
                  onClick={addSchedule}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Rule
                </Button>
              </div>

              {formData.schedules.length === 0 ? (
                <p className="text-xs text-muted-foreground">No rules yet. Add at least one daily or weekly lock window.</p>
              ) : (
                <div className="space-y-3">
                  {formData.schedules.map((rule, index) => (
                    <div key={rule.id} className="rounded-lg border p-3 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <Select
                          value={rule.recurrence}
                          onValueChange={(value: 'daily' | 'weekly') => updateSchedule(index, { recurrence: value })}
                        >
                          <SelectTrigger className="w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                          </SelectContent>
                        </Select>

                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Enabled</span>
                          <Switch
                            checked={rule.isEnabled}
                            onCheckedChange={(checked) => updateSchedule(index, { isEnabled: checked })}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeSchedule(rule.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Lock at</Label>
                          <Input
                            type="time"
                            value={rule.lockAt}
                            onChange={(e) => updateSchedule(index, { lockAt: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Unlock at</Label>
                          <Input
                            type="time"
                            value={rule.unlockAt}
                            onChange={(e) => updateSchedule(index, { unlockAt: e.target.value })}
                          />
                        </div>
                      </div>

                      {rule.recurrence === 'weekly' ? (
                        <div className="space-y-2">
                          <Label className="text-xs">Days</Label>
                          <div className="flex flex-wrap gap-2">
                            {WEEKDAY_OPTIONS.map((day) => {
                              const selected = (rule.daysOfWeek || []).includes(day.value);
                              return (
                                <Button
                                  key={day.value}
                                  type="button"
                                  size="sm"
                                  variant={selected ? 'default' : 'outline'}
                                  onClick={() => toggleWeeklyDay(index, day.value)}
                                >
                                  {day.label}
                                </Button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowTrainingDialog(true)}
              disabled={!formData.enableHistoryLearning && !formData.adminLearningMode}
              className="flex items-center gap-2"
            >
              <Brain className="h-4 w-4" />
              Manage Training
            </Button>
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </form>

        {showTrainingDialog && chatConfig && (
          <TrainingManagementDialog
            isOpen={showTrainingDialog}
            onClose={() => setShowTrainingDialog(false)}
            chatConfigId={chatConfig.id}
            chatName={chatConfig.chatName || chatConfig.externalId}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
