import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateAIResponse, moderateContent } from "./lib/openai";
import { 
  insertPlatformSchema, 
  insertConversationSchema, 
  insertMessageSchema, 
  insertAiConfigurationSchema,
  insertModerationActionSchema
} from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware (simplified for demo)
  const authMiddleware = async (req: Request, res: Response, next: Function) => {
    // In a real app, this would validate JWT/session
    // For MVP, we'll use the demo user
    const user = await storage.getUserByUsername("demo");
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    req.user = user;
    next();
  };

  // Health check
  app.get("/api/health", (req, res) => {
    res.status(200).json({ status: "ok" });
  });
  
  // Direct OpenAI chat completion for the website demo interface
  app.post("/api/openai-demo", async (req, res) => {
    try {
      const { message } = req.body;
      
      if (!message) {
        return res.status(400).json({ message: "Message is required" });
      }
      
      // Create a system prompt focused on ModerateAI features
      const systemPrompt = 
        "You are an AI assistant for ModerateAI, a SaaS platform that provides customer support " + 
        "and community moderation across multiple platforms (Website, Telegram, Discord). " + 
        "Answer user questions in a helpful, friendly, and concise manner. " +
        "Focus on information about ModerateAI's features, pricing, and integrations. " +
        "Keep responses under 150 words.";
      
      const response = await generateAIResponse(
        message,
        [], // No conversation history
        systemPrompt,
        75, // Friendly tone
        50  // Moderate length
      );
      
      res.status(200).json({ content: response });
    } catch (error) {
      console.error("Error with direct OpenAI call:", error);
      res.status(500).json({ message: "Error generating AI response" });
    }
  });

  // Dashboard stats
  app.get("/api/dashboard/stats", authMiddleware, async (req, res) => {
    try {
      const conversationCount = await storage.getConversationCount();
      const messageCount = await storage.getMessageCount();
      const moderationActionCount = await storage.getModerationActionCount();
      const responseRate = await storage.getResponseRate();

      res.status(200).json({
        totalConversations: conversationCount,
        aiResponses: messageCount,
        moderationActions: moderationActionCount,
        responseRate: responseRate
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Error fetching dashboard stats" });
    }
  });

  // Recent activity
  app.get("/api/dashboard/recent-activity", authMiddleware, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 5;
      const recentActivity = await storage.getRecentActivity(limit);
      res.status(200).json(recentActivity);
    } catch (error) {
      console.error("Error fetching recent activity:", error);
      res.status(500).json({ message: "Error fetching recent activity" });
    }
  });

  // Platforms
  app.get("/api/platforms", authMiddleware, async (req, res) => {
    try {
      const platforms = await storage.getPlatformsByUserId(req.user.id);
      res.status(200).json(platforms);
    } catch (error) {
      console.error("Error fetching platforms:", error);
      res.status(500).json({ message: "Error fetching platforms" });
    }
  });

  app.get("/api/platforms/:id", authMiddleware, async (req, res) => {
    try {
      const platform = await storage.getPlatform(parseInt(req.params.id));
      if (!platform) {
        return res.status(404).json({ message: "Platform not found" });
      }
      res.status(200).json(platform);
    } catch (error) {
      console.error("Error fetching platform:", error);
      res.status(500).json({ message: "Error fetching platform" });
    }
  });

  app.post("/api/platforms", authMiddleware, async (req, res) => {
    try {
      const result = insertPlatformSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: fromZodError(result.error).message });
      }

      const platform = await storage.createPlatform({
        ...result.data,
        userId: req.user.id
      });
      res.status(201).json(platform);
    } catch (error) {
      console.error("Error creating platform:", error);
      res.status(500).json({ message: "Error creating platform" });
    }
  });

  app.patch("/api/platforms/:id", authMiddleware, async (req, res) => {
    try {
      const platformId = parseInt(req.params.id);
      const platform = await storage.getPlatform(platformId);
      
      if (!platform) {
        return res.status(404).json({ message: "Platform not found" });
      }
      
      if (platform.userId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const updatedPlatform = await storage.updatePlatform(platformId, req.body);
      res.status(200).json(updatedPlatform);
    } catch (error) {
      console.error("Error updating platform:", error);
      res.status(500).json({ message: "Error updating platform" });
    }
  });

  app.delete("/api/platforms/:id", authMiddleware, async (req, res) => {
    try {
      const platformId = parseInt(req.params.id);
      const platform = await storage.getPlatform(platformId);
      
      if (!platform) {
        return res.status(404).json({ message: "Platform not found" });
      }
      
      if (platform.userId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      await storage.deletePlatform(platformId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting platform:", error);
      res.status(500).json({ message: "Error deleting platform" });
    }
  });

  // Conversations
  app.get("/api/conversations", authMiddleware, async (req, res) => {
    try {
      const platformId = req.query.platformId ? parseInt(req.query.platformId as string) : undefined;
      
      let conversations = [];
      if (platformId) {
        const platform = await storage.getPlatform(platformId);
        if (!platform || platform.userId !== req.user.id) {
          return res.status(403).json({ message: "Unauthorized" });
        }
        conversations = await storage.getConversationsByPlatformId(platformId);
      } else {
        // Get all platforms for user, then get conversations for each
        const platforms = await storage.getPlatformsByUserId(req.user.id);
        const allConversations = await Promise.all(
          platforms.map(platform => storage.getConversationsByPlatformId(platform.id))
        );
        conversations = allConversations.flat();
      }
      
      res.status(200).json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ message: "Error fetching conversations" });
    }
  });

  app.get("/api/conversations/:id", authMiddleware, async (req, res) => {
    try {
      const conversation = await storage.getConversation(parseInt(req.params.id));
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      
      // Check if user has access to this conversation
      const platform = await storage.getPlatform(conversation.platformId);
      if (!platform || platform.userId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      res.status(200).json(conversation);
    } catch (error) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ message: "Error fetching conversation" });
    }
  });

  app.post("/api/conversations", authMiddleware, async (req, res) => {
    try {
      const result = insertConversationSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: fromZodError(result.error).message });
      }
      
      // Check if user has access to the platform
      const platform = await storage.getPlatform(result.data.platformId);
      if (!platform || platform.userId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      const conversation = await storage.createConversation(result.data);
      res.status(201).json(conversation);
    } catch (error) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ message: "Error creating conversation" });
    }
  });

  app.patch("/api/conversations/:id", authMiddleware, async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const conversation = await storage.getConversation(conversationId);
      
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      
      // Check if user has access to this conversation
      const platform = await storage.getPlatform(conversation.platformId);
      if (!platform || platform.userId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      const updatedConversation = await storage.updateConversation(conversationId, req.body);
      res.status(200).json(updatedConversation);
    } catch (error) {
      console.error("Error updating conversation:", error);
      res.status(500).json({ message: "Error updating conversation" });
    }
  });

  // Messages
  app.get("/api/conversations/:id/messages", authMiddleware, async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const conversation = await storage.getConversation(conversationId);
      
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      
      // Check if user has access to this conversation
      const platform = await storage.getPlatform(conversation.platformId);
      if (!platform || platform.userId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      const messages = await storage.getMessagesByConversationId(conversationId);
      res.status(200).json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Error fetching messages" });
    }
  });

  app.post("/api/conversations/:id/messages", authMiddleware, async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const conversation = await storage.getConversation(conversationId);
      
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      
      // Check if user has access to this conversation
      const platform = await storage.getPlatform(conversation.platformId);
      if (!platform || platform.userId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      const messageData = { ...req.body, conversationId };
      const result = insertMessageSchema.safeParse(messageData);
      
      if (!result.success) {
        return res.status(400).json({ message: fromZodError(result.error).message });
      }
      
      const message = await storage.createMessage(result.data);
      res.status(201).json(message);
    } catch (error) {
      console.error("Error creating message:", error);
      res.status(500).json({ message: "Error creating message" });
    }
  });

  // AI Response generation
  app.post("/api/generate-response", authMiddleware, async (req, res) => {
    try {
      const { conversationId, message } = req.body;
      
      if (!conversationId || !message) {
        return res.status(400).json({ message: "Conversation ID and message are required" });
      }
      
      const conversation = await storage.getConversation(parseInt(conversationId));
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      
      // Check if user has access to this conversation
      const platform = await storage.getPlatform(conversation.platformId);
      if (!platform || platform.userId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      // Get the active AI configuration
      const aiConfig = await storage.getActiveAiConfiguration(req.user.id);
      if (!aiConfig) {
        return res.status(404).json({ message: "No active AI configuration found" });
      }
      
      // Create user message
      const userMessage = await storage.createMessage({
        conversationId: conversation.id,
        content: message,
        sender: "user",
        metadata: null
      });
      
      // Get previous messages to build conversation history
      const previousMessages = await storage.getMessagesByConversationId(conversation.id);
      const conversationHistory = previousMessages.map(msg => ({
        role: msg.sender === "user" ? "user" : "assistant",
        content: msg.content
      }));
      
      // Generate AI response
      const aiResponse = await generateAIResponse(
        message,
        conversationHistory,
        aiConfig.systemPrompt || "",
        aiConfig.responseStyle,
        aiConfig.responseLength
      );
      
      // Save AI response
      const aiMessage = await storage.createMessage({
        conversationId: conversation.id,
        content: aiResponse,
        sender: "ai",
        metadata: null
      });
      
      res.status(200).json({ message: aiMessage });
    } catch (error) {
      console.error("Error generating response:", error);
      res.status(500).json({ message: "Error generating response" });
    }
  });

  // Content moderation
  app.post("/api/moderate-content", authMiddleware, async (req, res) => {
    try {
      const { content, platformId } = req.body;
      
      if (!content) {
        return res.status(400).json({ message: "Content is required" });
      }
      
      if (platformId) {
        const platform = await storage.getPlatform(parseInt(platformId));
        if (!platform || platform.userId !== req.user.id) {
          return res.status(403).json({ message: "Unauthorized" });
        }
      }
      
      // Get the active AI configuration for strictness level
      const aiConfig = await storage.getActiveAiConfiguration(req.user.id);
      const strictnessLevel = aiConfig?.moderationStrictness || 50;
      
      // Moderate the content
      const moderationResult = await moderateContent(content, strictnessLevel);
      
      // If flagged and platform ID provided, create a moderation action
      if (moderationResult.flagged && platformId) {
        await storage.createModerationAction({
          platformId: parseInt(platformId),
          conversationId: null,
          messageId: null,
          action: "flag",
          reason: moderationResult.reason || "Flagged by content moderation",
          automatic: true
        });
      }
      
      res.status(200).json(moderationResult);
    } catch (error) {
      console.error("Error moderating content:", error);
      res.status(500).json({ message: "Error moderating content" });
    }
  });

  // AI Configurations
  app.get("/api/ai-configurations", authMiddleware, async (req, res) => {
    try {
      const configurations = await storage.getAiConfigurationsByUserId(req.user.id);
      res.status(200).json(configurations);
    } catch (error) {
      console.error("Error fetching AI configurations:", error);
      res.status(500).json({ message: "Error fetching AI configurations" });
    }
  });

  app.get("/api/ai-configurations/active", authMiddleware, async (req, res) => {
    try {
      const activeConfig = await storage.getActiveAiConfiguration(req.user.id);
      
      if (!activeConfig) {
        return res.status(404).json({ message: "No active AI configuration found" });
      }
      
      res.status(200).json(activeConfig);
    } catch (error) {
      console.error("Error fetching active AI configuration:", error);
      res.status(500).json({ message: "Error fetching active AI configuration" });
    }
  });

  app.post("/api/ai-configurations", authMiddleware, async (req, res) => {
    try {
      const result = insertAiConfigurationSchema.safeParse({
        ...req.body,
        userId: req.user.id
      });
      
      if (!result.success) {
        return res.status(400).json({ message: fromZodError(result.error).message });
      }
      
      const aiConfiguration = await storage.createAiConfiguration(result.data);
      res.status(201).json(aiConfiguration);
    } catch (error) {
      console.error("Error creating AI configuration:", error);
      res.status(500).json({ message: "Error creating AI configuration" });
    }
  });

  app.patch("/api/ai-configurations/:id", authMiddleware, async (req, res) => {
    try {
      const configId = parseInt(req.params.id);
      const config = await storage.getAiConfiguration(configId);
      
      if (!config) {
        return res.status(404).json({ message: "AI configuration not found" });
      }
      
      if (config.userId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      const updatedConfig = await storage.updateAiConfiguration(configId, req.body);
      res.status(200).json(updatedConfig);
    } catch (error) {
      console.error("Error updating AI configuration:", error);
      res.status(500).json({ message: "Error updating AI configuration" });
    }
  });

  // Knowledge Bases
  app.get("/api/knowledge-bases", authMiddleware, async (req, res) => {
    try {
      const knowledgeBases = await storage.getKnowledgeBasesByUserId(req.user.id);
      res.status(200).json(knowledgeBases);
    } catch (error) {
      console.error("Error fetching knowledge bases:", error);
      res.status(500).json({ message: "Error fetching knowledge bases" });
    }
  });

  app.get("/api/knowledge-bases/active", authMiddleware, async (req, res) => {
    try {
      const activeKnowledgeBase = await storage.getActiveKnowledgeBase(req.user.id);
      
      if (!activeKnowledgeBase) {
        return res.status(404).json({ message: "No active knowledge base found" });
      }
      
      res.status(200).json(activeKnowledgeBase);
    } catch (error) {
      console.error("Error fetching active knowledge base:", error);
      res.status(500).json({ message: "Error fetching active knowledge base" });
    }
  });

  // Moderation Actions
  app.get("/api/moderation-actions", authMiddleware, async (req, res) => {
    try {
      const platformId = req.query.platformId ? parseInt(req.query.platformId as string) : undefined;
      const conversationId = req.query.conversationId ? parseInt(req.query.conversationId as string) : undefined;
      
      let actions = [];
      
      if (platformId) {
        // Check if user has access to platform
        const platform = await storage.getPlatform(platformId);
        if (!platform || platform.userId !== req.user.id) {
          return res.status(403).json({ message: "Unauthorized" });
        }
        
        actions = await storage.getModerationActionsByPlatformId(platformId);
      } else if (conversationId) {
        // Check if user has access to conversation
        const conversation = await storage.getConversation(conversationId);
        if (!conversation) {
          return res.status(404).json({ message: "Conversation not found" });
        }
        
        const platform = await storage.getPlatform(conversation.platformId);
        if (!platform || platform.userId !== req.user.id) {
          return res.status(403).json({ message: "Unauthorized" });
        }
        
        actions = await storage.getModerationActionsByConversationId(conversationId);
      } else {
        return res.status(400).json({ message: "Either platformId or conversationId is required" });
      }
      
      res.status(200).json(actions);
    } catch (error) {
      console.error("Error fetching moderation actions:", error);
      res.status(500).json({ message: "Error fetching moderation actions" });
    }
  });

  app.post("/api/moderation-actions", authMiddleware, async (req, res) => {
    try {
      const result = insertModerationActionSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ message: fromZodError(result.error).message });
      }
      
      // Check if user has access to the platform
      const platform = await storage.getPlatform(result.data.platformId);
      if (!platform || platform.userId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      const moderationAction = await storage.createModerationAction(result.data);
      res.status(201).json(moderationAction);
    } catch (error) {
      console.error("Error creating moderation action:", error);
      res.status(500).json({ message: "Error creating moderation action" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
