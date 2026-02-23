import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Brain, Plus, Trash2 } from 'lucide-react';
import { TrainingManagementDialog } from '../TrainingManagementDialog';

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
  chatType: string;
  aiConfigurationId?: number;
  knowledgeBaseId?: number;
  settings?: {
    mentionOnlyMode?: boolean;
    proactiveResponses?: boolean;
    enableHistoryLearning?: boolean;
    adminLearningMode?: boolean;
    welcomeMessage?: string;
    enabledChannels?: { [channelId: string]: boolean };
    totalChannels?: number;
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
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  aiConfiguration?: {
    name: string;
  };
  knowledgeBase?: {
    name: string;
  };
}

interface KnowledgeBase {
  id: number;
  name: string;
}

interface ChatConfigurationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatConfiguration: ChatConfiguration | null;
  knowledgeBases: KnowledgeBase[];
  platformId: number;
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
  open,
  onOpenChange,
  chatConfiguration,
  knowledgeBases,
  platformId,
}: ChatConfigurationDialogProps) {
  const { toast } = useToast();
  const [showTrainingDialog, setShowTrainingDialog] = useState(false);

  const [formData, setFormData] = useState({
    knowledgeBaseId: chatConfiguration?.knowledgeBaseId ?? null,
    isActive: chatConfiguration?.isActive ?? false,
    mentionOnlyMode: chatConfiguration?.settings?.mentionOnlyMode !== false,
    proactiveResponses: chatConfiguration?.settings?.proactiveResponses !== false,
    enableHistoryLearning: chatConfiguration?.settings?.enableHistoryLearning ?? false,
    adminLearningMode: chatConfiguration?.settings?.adminLearningMode ?? false,
    scheduleEnabled: chatConfiguration?.lockSettings?.scheduleEnabled ?? false,
    schedulePaused: chatConfiguration?.lockSettings?.schedulePaused ?? false,
    timezone: chatConfiguration?.lockSettings?.timezone ?? 'UTC',
    schedules: chatConfiguration?.lockSettings?.schedules ?? [],
  });

  useEffect(() => {
    if (!chatConfiguration) return;
    setFormData({
      knowledgeBaseId: chatConfiguration.knowledgeBaseId ?? null,
      isActive: chatConfiguration.isActive,
      mentionOnlyMode: chatConfiguration.settings?.mentionOnlyMode !== false,
      proactiveResponses: chatConfiguration.settings?.proactiveResponses !== false,
      enableHistoryLearning: chatConfiguration.settings?.enableHistoryLearning ?? false,
      adminLearningMode: chatConfiguration.settings?.adminLearningMode ?? false,
      scheduleEnabled: chatConfiguration.lockSettings?.scheduleEnabled ?? false,
      schedulePaused: chatConfiguration.lockSettings?.schedulePaused ?? false,
      timezone: chatConfiguration.lockSettings?.timezone ?? 'UTC',
      schedules: chatConfiguration.lockSettings?.schedules ?? [],
    });
  }, [chatConfiguration]);

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!chatConfiguration) {
        throw new Error('Chat configuration not found');
      }

      const response = await fetch(`/api/chat-configurations/${chatConfiguration.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          knowledgeBaseId: data.knowledgeBaseId,
          isActive: data.isActive,
          settings: {
            ...chatConfiguration.settings,
            mentionOnlyMode: data.mentionOnlyMode,
            proactiveResponses: data.proactiveResponses,
            enableHistoryLearning: data.enableHistoryLearning,
            adminLearningMode: data.adminLearningMode,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.message || 'Failed to update configuration');
      }

      const lockResponse = await fetch(`/api/chat-configurations/${chatConfiguration.id}/lock-settings`, {
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
        title: 'Configuration updated',
        description: 'Discord server settings have been saved successfully.',
      });
      queryClient.invalidateQueries({ queryKey: [`/api/platforms/${platformId}/chat-configurations`] });
      queryClient.invalidateQueries({ queryKey: ['/api/platforms'] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Update failed',
        description: error?.message || 'There was an error updating the configuration. Please try again.',
        variant: 'destructive',
      });
    },
  });

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

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    updateMutation.mutate(formData);
  };

  if (!chatConfiguration) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure Discord {chatConfiguration.chatType}</DialogTitle>
          <DialogDescription>
            Customize AI behavior and moderation settings for "{chatConfiguration.chatName}"
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label className="text-base">Active</Label>
                <p className="text-sm text-muted-foreground">
                  Enable AI responses for this {chatConfiguration.chatType.toLowerCase()}
                </p>
              </div>
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => handleInputChange('isActive', checked)}
              />
            </div>

            <div className="space-y-2">
              <Label>Knowledge Base</Label>
              <Select
                value={formData.knowledgeBaseId ? String(formData.knowledgeBaseId) : 'none'}
                onValueChange={(value) => handleInputChange('knowledgeBaseId', value === 'none' ? null : Number(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select knowledge base" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No knowledge base</SelectItem>
                  {knowledgeBases.map((kb) => (
                    <SelectItem key={kb.id} value={String(kb.id)}>
                      {kb.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-medium">Response Settings</h4>

              <div className="flex flex-row items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label className="text-sm">Mention Only Mode</Label>
                  <p className="text-xs text-muted-foreground">Bot only responds when mentioned with @ModerateAI</p>
                </div>
                <Switch
                  checked={formData.mentionOnlyMode}
                  onCheckedChange={(checked) => handleInputChange('mentionOnlyMode', checked)}
                />
              </div>

              <div className="flex flex-row items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label className="text-sm">Proactive Responses</Label>
                  <p className="text-xs text-muted-foreground">
                    Bot responds to relevant questions even without being mentioned
                  </p>
                </div>
                <Switch
                  checked={formData.proactiveResponses !== false}
                  onCheckedChange={(checked) => handleInputChange('proactiveResponses', checked)}
                />
              </div>

              <div className="flex flex-row items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label className="text-sm">History Learning</Label>
                  <p className="text-xs text-muted-foreground">Store eligible chat messages so ModerateAI can learn from admin interactions over time.</p>
                </div>
                <Switch
                  checked={formData.enableHistoryLearning}
                  onCheckedChange={(checked) => handleInputChange('enableHistoryLearning', checked)}
                />
              </div>

              <div className="flex flex-row items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label className="text-sm">Admin Learning Mode</Label>
                  <p className="text-xs text-muted-foreground">Automatically analyzes new admin messages on a schedule (manual analysis is still available).</p>
                </div>
                <Switch
                  checked={formData.adminLearningMode}
                  onCheckedChange={(checked) => handleInputChange('adminLearningMode', checked)}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-medium">Timed Locking</h4>

              <div className="flex flex-row items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label className="text-sm">Scheduled auto-lock</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically lock and unlock this destination based on your configured schedule.
                  </p>
                </div>
                <Switch
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
                <Label htmlFor="discord-lock-timezone">Timezone (IANA)</Label>
                <Input
                  id="discord-lock-timezone"
                  value={formData.timezone}
                  onChange={(event) => handleInputChange('timezone', event.target.value)}
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

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Lock at</Label>
                            <Input
                              type="time"
                              value={rule.lockAt}
                              onChange={(event) => updateSchedule(index, { lockAt: event.target.value })}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Unlock at</Label>
                            <Input
                              type="time"
                              value={rule.unlockAt}
                              onChange={(event) => updateSchedule(index, { unlockAt: event.target.value })}
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
          </div>

          <DialogFooter className="flex justify-between">
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
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>

      {showTrainingDialog && chatConfiguration && (
        <TrainingManagementDialog
          isOpen={showTrainingDialog}
          onClose={() => setShowTrainingDialog(false)}
          chatConfigId={chatConfiguration.id}
          chatName={chatConfiguration.chatName || chatConfiguration.externalId}
        />
      )}
    </Dialog>
  );
}
