import { Router, Request, Response, NextFunction } from 'express';
import { chatHistoryManager } from '../lib/chatHistoryManager';
import { storage } from '../storage';
import { getWorkspaceOwnerId, hasWorkspaceRole, type WorkspaceRole } from '../workspace';

const router = Router();

// Auth middleware for training routes
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

const requireWorkspaceRole = (required: WorkspaceRole) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!hasWorkspaceRole(req.user as any, required)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    return next();
  };
};

/**
 * Trigger training analysis for a specific chat configuration
 */
router.post('/analyze-chat-history/:chatConfigId', requireAuth, requireWorkspaceRole("moderator"), async (req, res) => {
  try {
    const { chatConfigId } = req.params;
    const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
    
    const chatConfigIdNum = parseInt(chatConfigId);
    if (isNaN(chatConfigIdNum)) {
      return res.status(400).json({ error: 'Invalid chat configuration ID' });
    }

    // Verify the chat configuration belongs to user's platform
    const chatConfig = await storage.getChatConfiguration(chatConfigIdNum);
    if (!chatConfig) {
      return res.status(404).json({ error: 'Chat configuration not found' });
    }

    const platform = await storage.getPlatform(chatConfig.platformId);
    if (!platform || platform.userId !== workspaceOwnerId) {
      return res.status(403).json({ error: 'Unauthorized access to this chat configuration' });
    }

    // Check if admin learning mode is enabled
    const adminLearningEnabled = await chatHistoryManager.isAdminLearningModeEnabled(chatConfigIdNum);
    if (!adminLearningEnabled) {
      return res.status(400).json({ 
        error: 'Admin learning mode is not enabled for this chat. Enable it in chat settings first.' 
      });
    }

    // Perform the analysis
    const insights = await chatHistoryManager.analyzeAndLearnFromAdminHistory(chatConfigIdNum, workspaceOwnerId);

    res.json({
      success: true,
      message: `Successfully analyzed admin history and created ${insights.length} training insights`,
      insights: insights.map(insight => ({
        id: insight.id,
        type: insight.insightType,
        pattern: insight.pattern,
        confidence: insight.confidence,
        learnedFrom: insight.learnedFrom
      }))
    });

  } catch (error) {
    console.error('Error analyzing chat history:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to analyze chat history' 
    });
  }
});

/**
 * Get training insights for a chat configuration
 */
router.get('/insights/:chatConfigId', requireAuth, async (req, res) => {
  try {
    const { chatConfigId } = req.params;
    const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
    
    const chatConfigIdNum = parseInt(chatConfigId);
    if (isNaN(chatConfigIdNum)) {
      return res.status(400).json({ error: 'Invalid chat configuration ID' });
    }

    // Verify access
    const chatConfig = await storage.getChatConfiguration(chatConfigIdNum);
    if (!chatConfig) {
      return res.status(404).json({ error: 'Chat configuration not found' });
    }

    const platform = await storage.getPlatform(chatConfig.platformId);
    if (!platform || platform.userId !== workspaceOwnerId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const insights = await chatHistoryManager.getActiveInsights(chatConfigIdNum);

    res.json({
      insights: insights.map(insight => ({
        id: insight.id,
        type: insight.insightType,
        pattern: insight.pattern,
        confidence: insight.confidence,
        usageCount: insight.usageCount,
        successRate: insight.successRate,
        learnedFrom: insight.learnedFrom,
        createdAt: insight.createdAt
      }))
    });

  } catch (error) {
    console.error('Error fetching training insights:', error);
    res.status(500).json({ error: 'Failed to fetch training insights' });
  }
});

/**
 * Get chat history for a specific chat configuration (admin only)
 */
router.get('/chat-history/:chatConfigId', requireAuth, requireWorkspaceRole("moderator"), async (req, res) => {
  try {
    const { chatConfigId } = req.params;
    const { limit = '50', adminOnly = 'false' } = req.query;
    const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
    
    const chatConfigIdNum = parseInt(chatConfigId);
    const limitNum = parseInt(limit as string);
    
    if (isNaN(chatConfigIdNum)) {
      return res.status(400).json({ error: 'Invalid chat configuration ID' });
    }

    // Verify access
    const chatConfig = await storage.getChatConfiguration(chatConfigIdNum);
    if (!chatConfig) {
      return res.status(404).json({ error: 'Chat configuration not found' });
    }

    const platform = await storage.getPlatform(chatConfig.platformId);
    if (!platform || platform.userId !== workspaceOwnerId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    let history;
    if (adminOnly === 'true') {
      history = await chatHistoryManager.getAdminChatHistory(chatConfigIdNum, limitNum);
    } else {
      history = await chatHistoryManager.getChatHistoryByChatConfiguration(chatConfigIdNum, limitNum);
    }

    res.json({
      history: history.map(msg => ({
        id: msg.id,
        content: msg.content,
        messageType: msg.messageType,
        isAdmin: msg.isAdmin,
        externalUsername: msg.externalUsername,
        sentAt: msg.sentAt,
        isUsedForTraining: msg.isUsedForTraining
      }))
    });

  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

/**
 * Toggle insight active status
 */
router.patch('/insights/:insightId/toggle', requireAuth, requireWorkspaceRole("moderator"), async (req, res) => {
  try {
    const { insightId } = req.params;
    const workspaceOwnerId = getWorkspaceOwnerId(req.user as any);
    
    const insightIdNum = parseInt(insightId);
    if (isNaN(insightIdNum)) {
      return res.status(400).json({ error: 'Invalid insight ID' });
    }

    // Get insight and verify ownership
    const insight = await chatHistoryManager.getTrainingInsight(insightIdNum);
    if (!insight) {
      return res.status(404).json({ error: 'Training insight not found' });
    }

    if (insight.userId !== workspaceOwnerId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Toggle active status
    const updatedInsight = await chatHistoryManager.updateTrainingInsight(insightIdNum, {
      isActive: !insight.isActive
    });

    res.json({
      success: true,
      insight: updatedInsight
    });

  } catch (error) {
    console.error('Error toggling insight:', error);
    res.status(500).json({ error: 'Failed to toggle insight' });
  }
});

export default router;
