/**
 * Override function to ensure Discord integration setup is counted as completed
 * This is a workaround for when the API returns old data
 */

// This function will be used to manually override setup completion status
export function overrideSetupCompletion(
  platforms: any[],
  setupProgress: {
    aiConfig: boolean;
    websiteIntegration: boolean;
    telegramIntegration: boolean;
    discordIntegration: boolean;
    knowledgeBase: boolean;
  }
) {
  // Check if there's a Discord platform in active status
  const discordPlatform = platforms.find(p => p.type === "discord");
  
  if (discordPlatform && discordPlatform.status === "active") {
    // Force Discord integration to be marked as completed
    setupProgress.discordIntegration = true;
    console.log("Manually overriding Discord integration setup completion status to true");
  }
  
  return setupProgress;
}