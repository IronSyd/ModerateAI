import { eq, desc, and } from "drizzle-orm";
import { db } from "../db";
import { chatHistory, chatConfigurations, trainingInsights } from "@shared/schema";
import type { InsertChatHistory, InsertTrainingInsights, ChatHistory, TrainingInsights } from "@shared/schema";
import { analyzeAdminConversations } from "./openai";

export class ChatHistoryManager {
  
  /**
   * Store a chat message for potential training use
   */
  async storeChatMessage(
    chatConfigId: number,
    platformId: number,
    externalUserId: string,
    content: string,
    messageType: "user" | "admin" | "bot" | "system" = "user",
    isAdmin: boolean = false,
    metadata?: any
  ): Promise<ChatHistory> {
    const chatHistoryData: InsertChatHistory = {
      chatConfigurationId: chatConfigId,
      platformId: platformId,
      externalUserId: externalUserId,
      externalUsername: metadata?.username || null,
      messageId: metadata?.messageId || null,
      content: content,
      messageType: messageType,
      isAdmin: isAdmin,
      replyToMessageId: metadata?.replyToMessageId || null,
      threadContext: metadata?.threadContext || null,
      metadata: metadata || null,
      sentAt: new Date(),
      isUsedForTraining: false
    };

    const [result] = await db.insert(chatHistory).values(chatHistoryData).returning();
    return result;
  }

  /**
   * Get admin chat history for a specific chat configuration
   */
  async getAdminChatHistory(chatConfigId: number, limit: number = 100): Promise<ChatHistory[]> {
    return await db
      .select()
      .from(chatHistory)
      .where(and(
        eq(chatHistory.chatConfigurationId, chatConfigId),
        eq(chatHistory.isAdmin, true)
      ))
      .orderBy(desc(chatHistory.sentAt))
      .limit(limit);
  }

  /**
   * Get conversation threads for training analysis
   */
  async getConversationThreads(chatConfigId: number, limit: number = 50): Promise<ChatHistory[][]> {
    const messages = await db
      .select()
      .from(chatHistory)
      .where(eq(chatHistory.chatConfigurationId, chatConfigId))
      .orderBy(desc(chatHistory.sentAt))
      .limit(limit * 10); // Get more messages to form threads

    // Group messages into conversation threads
    const threads: ChatHistory[][] = [];
    let currentThread: ChatHistory[] = [];
    let lastMessageTime: Date | null = null;

    for (const message of messages.reverse()) {
      const messageTime = new Date(message.sentAt);
      
      // Start new thread if gap > 30 minutes or first message
      if (!lastMessageTime || (messageTime.getTime() - lastMessageTime.getTime()) > 30 * 60 * 1000) {
        if (currentThread.length > 0) {
          threads.push([...currentThread]);
        }
        currentThread = [message];
      } else {
        currentThread.push(message);
      }
      
      lastMessageTime = messageTime;
    }

    if (currentThread.length > 0) {
      threads.push(currentThread);
    }

    return threads.slice(0, limit);
  }

  /**
   * Analyze admin conversations and extract training insights
   */
  async analyzeAndLearnFromAdminHistory(chatConfigId: number, userId: number): Promise<TrainingInsights[]> {
    const adminHistory = await this.getAdminChatHistory(chatConfigId, 200);
    
    if (adminHistory.length < 5) {
      throw new Error("Insufficient admin chat history for analysis");
    }

    // Get conversation threads to understand context
    const threads = await this.getConversationThreads(chatConfigId, 20);
    
    // Use OpenAI to analyze patterns
    const analysisResult = await analyzeAdminConversations(adminHistory, threads);
    
    const insights: TrainingInsights[] = [];
    
    // Store each insight in the database
    for (const pattern of analysisResult.patterns) {
      const insightData: InsertTrainingInsights = {
        userId: userId,
        chatConfigurationId: chatConfigId,
        insightType: pattern.type,
        pattern: pattern.description,
        context: pattern.context,
        confidence: pattern.confidence,
        usageCount: 0,
        successRate: 0,
        isActive: true,
        learnedFrom: "admin_history"
      };

      const [insight] = await db.insert(trainingInsights).values(insightData).returning();
      insights.push(insight);
    }

    // Mark the analyzed messages as used for training
    const messageIds = adminHistory.map(msg => msg.id);
    if (messageIds.length > 0) {
      await db
        .update(chatHistory)
        .set({ isUsedForTraining: true })
        .where(eq(chatHistory.id, messageIds[0])); // This is a simplified approach
    }

    return insights;
  }

  /**
   * Get all chat history for a specific chat configuration
   */
  async getChatHistoryByChatConfiguration(chatConfigId: number, limit: number = 100): Promise<ChatHistory[]> {
    return await db
      .select()
      .from(chatHistory)
      .where(eq(chatHistory.chatConfigurationId, chatConfigId))
      .orderBy(desc(chatHistory.sentAt))
      .limit(limit);
  }

  /**
   * Get active training insights for a chat configuration
   */
  async getActiveInsights(chatConfigId: number): Promise<TrainingInsights[]> {
    return await db
      .select()
      .from(trainingInsights)
      .where(and(
        eq(trainingInsights.chatConfigurationId, chatConfigId),
        eq(trainingInsights.isActive, true)
      ))
      .orderBy(desc(trainingInsights.confidence));
  }

  /**
   * Apply training insights to improve AI responses
   */
  async getContextualInsights(chatConfigId: number, messageContent: string, conversationContext?: any): Promise<TrainingInsights[]> {
    const allInsights = await this.getActiveInsights(chatConfigId);
    
    // Filter insights based on content relevance
    const relevantInsights = allInsights.filter(insight => {
      const pattern = insight.pattern.toLowerCase();
      const content = messageContent.toLowerCase();
      
      // Simple keyword matching - could be enhanced with embeddings
      const keywords = pattern.split(/\s+/).filter(word => word.length > 3);
      return keywords.some(keyword => content.includes(keyword));
    });

    return relevantInsights.sort((a, b) => (b.confidence * b.successRate) - (a.confidence * a.successRate));
  }

  /**
   * Update insight usage and success metrics
   */
  async updateInsightMetrics(insightId: number, wasSuccessful: boolean): Promise<void> {
    const [insight] = await db
      .select()
      .from(trainingInsights)
      .where(eq(trainingInsights.id, insightId));

    if (!insight) return;

    const newUsageCount = insight.usageCount + 1;
    const currentSuccesses = Math.round((insight.successRate / 100) * insight.usageCount);
    const newSuccesses = currentSuccesses + (wasSuccessful ? 1 : 0);
    const newSuccessRate = Math.round((newSuccesses / newUsageCount) * 100);

    await db
      .update(trainingInsights)
      .set({
        usageCount: newUsageCount,
        successRate: newSuccessRate,
        updatedAt: new Date()
      })
      .where(eq(trainingInsights.id, insightId));
  }

  /**
   * Check if a chat configuration has history learning enabled
   */
  async isHistoryLearningEnabled(chatConfigId: number): Promise<boolean> {
    const [config] = await db
      .select()
      .from(chatConfigurations)
      .where(eq(chatConfigurations.id, chatConfigId));

    if (!config) return false;

    const settings = config.settings as any;
    return settings?.enableHistoryLearning === true;
  }

  /**
   * Check if admin learning mode is enabled for a chat
   */
  async isAdminLearningModeEnabled(chatConfigId: number): Promise<boolean> {
    const [config] = await db
      .select()
      .from(chatConfigurations)
      .where(eq(chatConfigurations.id, chatConfigId));

    if (!config) return false;

    const settings = config.settings as any;
    return settings?.adminLearningMode === true;
  }

  /**
   * Get a specific training insight by ID
   */
  async getTrainingInsight(insightId: number): Promise<TrainingInsights | null> {
    const [insight] = await db
      .select()
      .from(trainingInsights)
      .where(eq(trainingInsights.id, insightId))
      .limit(1);
    
    return insight || null;
  }

  /**
   * Update a training insight
   */
  async updateTrainingInsight(insightId: number, updates: Partial<TrainingInsights>): Promise<TrainingInsights> {
    const [updatedInsight] = await db
      .update(trainingInsights)
      .set(updates)
      .where(eq(trainingInsights.id, insightId))
      .returning();
    
    return updatedInsight;
  }
}

export const chatHistoryManager = new ChatHistoryManager();