import { storage } from "../storage";
import { chatHistoryManager } from "./chatHistoryManager";
import { recordOpsEvent } from "./ops-monitor";
import {
  adminHistoryAutoAnalysisEnabled,
  adminHistoryAutoAnalysisIntervalMs,
  adminHistoryAutoAnalysisMinNewAdminMessages,
} from "../config/runtime-flags";

type AutoAnalysisSweepResult = {
  processed: number;
  analyzed: number;
  skippedThreshold: number;
  failed: number;
  skipped: boolean;
};

type AutoAnalysisDestinationRun = {
  runId: number;
  recordedAt: string;
  platformType: "telegram" | "discord";
  platformId: number;
  chatConfigurationId: number;
  destinationExternalId: string;
  status: "analyzed" | "skipped_threshold" | "failed";
  pendingAdminMessages: number;
  threshold: number;
  insightsCreatedOrUpdated?: number;
  reason?: string;
  error?: string;
};

type AutoAnalysisDebugState = {
  enabled: boolean;
  running: boolean;
  runCount: number;
  currentRunId: number | null;
  lastStartedAt: string | null;
  lastCompletedAt: string | null;
  lastError: string | null;
  lastResult: AutoAnalysisSweepResult | null;
  currentProgress: {
    processed: number;
    analyzed: number;
    skippedThreshold: number;
    failed: number;
  } | null;
  config: {
    intervalMs: number;
    minNewAdminMessages: number;
  };
  inProgressChatConfigIds: number[];
  recentDestinations: AutoAnalysisDestinationRun[];
};

let sweepRunning = false;
const chatConfigsInProgress = new Set<number>();
let autoAnalysisRunCounter = 0;
const MAX_AUTO_ANALYSIS_DEBUG_ROWS = 200;
const autoAnalysisDebugState: AutoAnalysisDebugState = {
  enabled: adminHistoryAutoAnalysisEnabled,
  running: false,
  runCount: 0,
  currentRunId: null,
  lastStartedAt: null,
  lastCompletedAt: null,
  lastError: null,
  lastResult: null,
  currentProgress: null,
  config: {
    intervalMs: adminHistoryAutoAnalysisIntervalMs,
    minNewAdminMessages: adminHistoryAutoAnalysisMinNewAdminMessages,
  },
  inProgressChatConfigIds: [],
  recentDestinations: [],
};

function pushAutoAnalysisDestinationRun(entry: AutoAnalysisDestinationRun): void {
  autoAnalysisDebugState.recentDestinations.unshift(entry);
  if (autoAnalysisDebugState.recentDestinations.length > MAX_AUTO_ANALYSIS_DEBUG_ROWS) {
    autoAnalysisDebugState.recentDestinations.length = MAX_AUTO_ANALYSIS_DEBUG_ROWS;
  }
}

function syncAutoAnalysisInProgress(): void {
  autoAnalysisDebugState.inProgressChatConfigIds = Array.from(chatConfigsInProgress.values()).sort((a, b) => a - b);
}

export function getAdminHistoryAutoAnalysisDebugState(): AutoAnalysisDebugState {
  return {
    ...autoAnalysisDebugState,
    config: { ...autoAnalysisDebugState.config },
    currentProgress: autoAnalysisDebugState.currentProgress ? { ...autoAnalysisDebugState.currentProgress } : null,
    lastResult: autoAnalysisDebugState.lastResult ? { ...autoAnalysisDebugState.lastResult } : null,
    inProgressChatConfigIds: [...autoAnalysisDebugState.inProgressChatConfigIds],
    recentDestinations: autoAnalysisDebugState.recentDestinations.map((item) => ({ ...item })),
  };
}

function isAutoAnalysisEligibleSettings(settingsRaw: unknown): boolean {
  const settings = (settingsRaw as any) ?? {};
  return settings.enableHistoryLearning === true && settings.adminLearningMode === true;
}

export async function runAdminHistoryAutoAnalysisSweep(): Promise<AutoAnalysisSweepResult> {
  if (!adminHistoryAutoAnalysisEnabled) {
    return { processed: 0, analyzed: 0, skippedThreshold: 0, failed: 0, skipped: true };
  }

  if (sweepRunning) {
    return { processed: 0, analyzed: 0, skippedThreshold: 0, failed: 0, skipped: true };
  }

  sweepRunning = true;
  autoAnalysisRunCounter += 1;
  autoAnalysisDebugState.running = true;
  autoAnalysisDebugState.currentRunId = autoAnalysisRunCounter;
  autoAnalysisDebugState.lastStartedAt = new Date().toISOString();
  autoAnalysisDebugState.lastError = null;
  autoAnalysisDebugState.currentProgress = {
    processed: 0,
    analyzed: 0,
    skippedThreshold: 0,
    failed: 0,
  };
  recordOpsEvent("ADMIN_HISTORY_AUTO_ANALYSIS_STARTED", {
    minNewAdminMessages: adminHistoryAutoAnalysisMinNewAdminMessages,
  });

  try {
    const result: AutoAnalysisSweepResult = {
      processed: 0,
      analyzed: 0,
      skippedThreshold: 0,
      failed: 0,
      skipped: false,
    };

    for (const platformType of ["telegram", "discord"] as const) {
      const platforms = (await storage.getPlatformsByType(platformType)).filter(
        (platform) => platform.status === "active" && Number.isFinite(Number(platform.userId)),
      );

      for (const platform of platforms) {
        const ownerUserId = Number(platform.userId);
        if (!Number.isFinite(ownerUserId) || ownerUserId <= 0) continue;

        const chatConfigs = await storage.getChatConfigurationsByPlatformId(platform.id);
        for (const chatConfig of chatConfigs) {
          if (!isAutoAnalysisEligibleSettings(chatConfig.settings)) continue;

          result.processed += 1;
          autoAnalysisDebugState.currentProgress = {
            processed: result.processed,
            analyzed: result.analyzed,
            skippedThreshold: result.skippedThreshold,
            failed: result.failed,
          };
          if (chatConfigsInProgress.has(chatConfig.id)) {
            continue;
          }

          let pendingAdminMessages = 0;
          try {
            pendingAdminMessages = await chatHistoryManager.countNewAdminMessagesPendingTraining(chatConfig.id);
          } catch (error) {
            result.failed += 1;
            recordOpsEvent("ADMIN_HISTORY_AUTO_ANALYSIS_FAILED", {
              platformType,
              platformId: platform.id,
              chatConfigurationId: chatConfig.id,
              destinationExternalId: chatConfig.externalId,
              reason: "count_pending_failed",
              error: error instanceof Error ? error.message : String(error),
            });
            continue;
          }

          if (pendingAdminMessages < adminHistoryAutoAnalysisMinNewAdminMessages) {
            result.skippedThreshold += 1;
            autoAnalysisDebugState.currentProgress = {
              processed: result.processed,
              analyzed: result.analyzed,
              skippedThreshold: result.skippedThreshold,
              failed: result.failed,
            };
            pushAutoAnalysisDestinationRun({
              runId: autoAnalysisRunCounter,
              recordedAt: new Date().toISOString(),
              platformType,
              platformId: platform.id,
              chatConfigurationId: chatConfig.id,
              destinationExternalId: chatConfig.externalId,
              status: "skipped_threshold",
              pendingAdminMessages,
              threshold: adminHistoryAutoAnalysisMinNewAdminMessages,
              reason: "below_threshold",
            });
            recordOpsEvent("ADMIN_HISTORY_AUTO_ANALYSIS_SKIPPED_THRESHOLD", {
              platformType,
              platformId: platform.id,
              chatConfigurationId: chatConfig.id,
              destinationExternalId: chatConfig.externalId,
              pendingAdminMessages,
              threshold: adminHistoryAutoAnalysisMinNewAdminMessages,
            }, { bucketKey: `ADMIN_HISTORY_AUTO_ANALYSIS_SKIPPED_THRESHOLD:${chatConfig.id}` });
            continue;
          }

          chatConfigsInProgress.add(chatConfig.id);
          syncAutoAnalysisInProgress();
          try {
            const insights = await chatHistoryManager.analyzeAndLearnFromAdminHistory(chatConfig.id, ownerUserId);
            result.analyzed += 1;
            autoAnalysisDebugState.currentProgress = {
              processed: result.processed,
              analyzed: result.analyzed,
              skippedThreshold: result.skippedThreshold,
              failed: result.failed,
            };
            pushAutoAnalysisDestinationRun({
              runId: autoAnalysisRunCounter,
              recordedAt: new Date().toISOString(),
              platformType,
              platformId: platform.id,
              chatConfigurationId: chatConfig.id,
              destinationExternalId: chatConfig.externalId,
              status: "analyzed",
              pendingAdminMessages,
              threshold: adminHistoryAutoAnalysisMinNewAdminMessages,
              insightsCreatedOrUpdated: insights.length,
            });
            recordOpsEvent("ADMIN_HISTORY_AUTO_ANALYSIS_COMPLETED", {
              platformType,
              platformId: platform.id,
              chatConfigurationId: chatConfig.id,
              destinationExternalId: chatConfig.externalId,
              pendingAdminMessages,
              insightsCreatedOrUpdated: insights.length,
            });
          } catch (error) {
            result.failed += 1;
            autoAnalysisDebugState.currentProgress = {
              processed: result.processed,
              analyzed: result.analyzed,
              skippedThreshold: result.skippedThreshold,
              failed: result.failed,
            };
            pushAutoAnalysisDestinationRun({
              runId: autoAnalysisRunCounter,
              recordedAt: new Date().toISOString(),
              platformType,
              platformId: platform.id,
              chatConfigurationId: chatConfig.id,
              destinationExternalId: chatConfig.externalId,
              status: "failed",
              pendingAdminMessages,
              threshold: adminHistoryAutoAnalysisMinNewAdminMessages,
              reason: "analysis_failed",
              error: error instanceof Error ? error.message : String(error),
            });
            recordOpsEvent("ADMIN_HISTORY_AUTO_ANALYSIS_FAILED", {
              platformType,
              platformId: platform.id,
              chatConfigurationId: chatConfig.id,
              destinationExternalId: chatConfig.externalId,
              pendingAdminMessages,
              reason: "analysis_failed",
              error: error instanceof Error ? error.message : String(error),
            });
            console.warn(
              `Admin-history auto-analysis failed for ${platformType} chatConfig=${chatConfig.id}:`,
              error,
            );
          } finally {
            chatConfigsInProgress.delete(chatConfig.id);
            syncAutoAnalysisInProgress();
          }
        }
      }
    }

    autoAnalysisDebugState.runCount = autoAnalysisRunCounter;
    autoAnalysisDebugState.lastCompletedAt = new Date().toISOString();
    autoAnalysisDebugState.lastResult = { ...result };
    return result;
  } catch (error) {
    autoAnalysisDebugState.lastError = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    sweepRunning = false;
    autoAnalysisDebugState.running = false;
    autoAnalysisDebugState.currentRunId = null;
    autoAnalysisDebugState.currentProgress = null;
    syncAutoAnalysisInProgress();
  }
}

export function scheduleAdminHistoryAutoAnalysisSweep(logFn: (line: string) => void): NodeJS.Timeout | null {
  if (!adminHistoryAutoAnalysisEnabled) {
    logFn("admin-history auto-analysis disabled");
    return null;
  }

  const runAndLog = async () => {
    try {
      const result = await runAdminHistoryAutoAnalysisSweep();
      if (!result.skipped) {
        logFn(
          `admin-history auto-analysis: processed=${result.processed}, analyzed=${result.analyzed}, skippedThreshold=${result.skippedThreshold}, failed=${result.failed}`,
        );
      }
    } catch (error: any) {
      logFn(`admin-history auto-analysis error: ${error?.message || "unknown error"}`);
    }
  };

  setTimeout(() => {
    void runAndLog();
  }, 90_000);

  return setInterval(() => {
    void runAndLog();
  }, adminHistoryAutoAnalysisIntervalMs);
}
