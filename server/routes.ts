import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  generateAIResponse, 
  generateKnowledgeBasedResponse, 
  moderateContent,
  trainOnConversations,
  generateImprovedSystemPrompt
} from "./lib/openai";
import { initializeBot, disconnectBot, initializeAllBots } from "./lib/telegram";
import { setupAuth } from "./auth";
import { 
  insertPlatformSchema, 
  insertConversationSchema, 
  insertMessageSchema, 
  insertAiConfigurationSchema,
  insertModerationActionSchema,
  insertConversationTrainingSchema
} from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

export async function registerRoutes(app: Express): Promise<Server> {

  // Set up authentication with Passport.js
  setupAuth(app);
  
  // TEMPORARY: Fix demo user password for testing
  app.get("/api/fix-demo-password", async (req, res) => {
    try {
      const { hashPassword } = await import("./auth");
      const { users } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const { db } = await import("./db");
      
      const hashedPassword = await hashPassword("demo123");
      
      await db.update(users)
        .set({ password: hashedPassword })
        .where(eq(users.username, "demo"));
      
      res.json({ success: true, message: "Demo password fixed" });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });
  
  // Auth middleware to check if the user is authenticated
  const authMiddleware = (req: Request, res: Response, next: Function) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
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
      
      // Get a demo user for accessing the knowledge base and AI configuration
      const demoUsers = await storage.getAllUsers();
      const demoUser = demoUsers.find(user => user.username === "demo") || demoUsers[0];
      
      if (!demoUser) {
        // Fallback if no demo user exists
        return res.status(500).json({ 
          message: "Demo user not found",
          error: "configuration_error"
        });
      }
      
      // Get active AI configuration
      const aiConfig = await storage.getActiveAiConfiguration(demoUser.id);
      
      // Get active knowledge base
      const knowledgeBase = await storage.getActiveKnowledgeBase(demoUser.id);
      
      // Create a more comprehensive system prompt with knowledge base information
      let systemPrompt = 
        "You are an AI assistant for ModerateAI, a SaaS platform that provides customer support " + 
        "and community moderation across multiple platforms (Website, Telegram, Discord). " + 
        "Answer user questions in a helpful, friendly, and concise manner. " +
        "Focus on information about ModerateAI's features, pricing, and integrations. " +
        "Keep responses under 150 words.";
      
      // Add knowledge base info
      if (knowledgeBase) {
        systemPrompt += `\n\nYou have access to the "${knowledgeBase.name}" knowledge base with ${knowledgeBase.documentCount} documents containing detailed product information.`;
      }
      
      // Add product information for better responses
      systemPrompt += `\n\nHere is key information about ModerateAI:
- Features: Multi-platform integration (Website, Telegram, Discord), AI-powered chat responses, content moderation, analytics dashboard, customizable AI configurations
- Pricing: Basic plan ($29/month), Pro plan ($79/month), Enterprise (custom pricing)
- Integration: Easy setup via web dashboard with platform-specific wizards
- Moderation: Customizable strictness levels, policy-based filtering, manual review options
- AI Configuration: Adjustable response style, length, and tone; knowledge base customization`;
      
      try {
        // Log the user message for debugging
        console.log(`[openai-demo] Processing request: "${message}"`);
        
        // Use knowledge-based response generation
        const response = await generateKnowledgeBasedResponse(
          message,
          [], // No conversation history 
          aiConfig?.systemPrompt || systemPrompt,
          aiConfig?.responseStyle || 75, // Friendly tone
          aiConfig?.responseLength || 50  // Moderate length
        );
        
        console.log(`[openai-demo] Generated response: "${response.substring(0, 100)}..."`);
        res.status(200).json({ content: response });
      } catch (openaiError: any) {
        // Log the specific OpenAI error for debugging
        console.error("Error generating AI response:", openaiError);
        
        // Return a specific error format that the client can detect and handle gracefully
        // Always use HTTP 200 with error field so the client can process it properly
        return res.status(200).json({ 
          error: "ai_service_error",
          errorType: openaiError.status === 429 ? "rate_limit_exceeded" : "service_error",
          message: "AI service is currently at capacity or experiencing issues.",
          status: openaiError.status || 500
        });
      }
    } catch (error: any) {
      console.error("Error with direct OpenAI call:", error);
      res.status(500).json({ 
        message: "Error generating AI response",
        error: error.message || "Unknown error"
      });
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
  
  // Billing information - available without authentication for demo purposes
  app.get("/api/billing", async (req, res) => {
    try {
      // Calculate dates relative to current date
      const today = new Date();
      
      // Next renewal date (10th of next month)
      const nextMonth = new Date(today);
      nextMonth.setMonth(today.getMonth() + 1);
      nextMonth.setDate(10);
      
      // Function to get previous months' dates on the 10th
      const getPreviousMonthDate = (monthsAgo: number) => {
        const date = new Date(today);
        date.setMonth(today.getMonth() - monthsAgo);
        date.setDate(10);
        return date.toISOString().split('T')[0];
      };
      
      // Current subscription info
      const planDetails = {
        name: "Pro",
        status: "active",
        price: 79,
        renewalDate: nextMonth.toISOString().split('T')[0],
        nextPaymentDate: nextMonth.toISOString().split('T')[0],
        aiResponsesLimit: 100000,
        aiResponsesUsed: 62845,
        activeIntegrations: 3
      };
      
      // Generate invoices for the past 3 months
      const invoices = [
        {
          id: "INV-2025-003",
          date: getPreviousMonthDate(0),
          description: "ModerateAI Pro Plan - Monthly",
          amount: "$79.00",
          status: "Paid"
        },
        {
          id: "INV-2025-002",
          date: getPreviousMonthDate(1),
          description: "ModerateAI Pro Plan - Monthly",
          amount: "$79.00",
          status: "Paid"
        },
        {
          id: "INV-2025-001",
          date: getPreviousMonthDate(2),
          description: "ModerateAI Pro Plan - Monthly",
          amount: "$79.00",
          status: "Paid"
        }
      ];
      
      res.status(200).json({
        plan: planDetails,
        invoices: invoices
      });
    } catch (error) {
      console.error("Error fetching billing info:", error);
      res.status(500).json({ message: "Error fetching billing information" });
    }
  });
  
  // Download single invoice by ID
  app.get("/api/billing/invoices/:id", async (req, res) => {
    try {
      const invoiceId = req.params.id;
      
      // Helper function to get invoice month and date
      const getInvoiceDate = (invoiceId: string) => {
        // For the demo, we'll use the current date and compute relative dates
        const today = new Date();
        
        // Extract the invoice number from the ID format INV-2025-00X
        const invoiceNum = invoiceId.split("-")[2];
        let monthsAgo = 0;
        
        if (invoiceNum === "001") monthsAgo = 2;
        else if (invoiceNum === "002") monthsAgo = 1;
        else if (invoiceNum === "003") monthsAgo = 0;
        
        const date = new Date(today);
        date.setMonth(today.getMonth() - monthsAgo);
        date.setDate(10);
        return date.toISOString().split('T')[0];
      };
      
      // In a real application, we would fetch the invoice from a database or Stripe
      // For now, we'll create a simple CSV string with updated date
      const invoiceData = `Invoice ID,${invoiceId}
Date,${getInvoiceDate(invoiceId)}
Description,ModerateAI Pro Plan - Monthly
Amount,$79.00
Status,Paid`;
      
      // Set headers for file download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoiceId}.csv`);
      
      // Send the CSV data
      res.status(200).send(invoiceData);
    } catch (error) {
      console.error("Error downloading invoice:", error);
      res.status(500).json({ message: "Error downloading invoice" });
    }
  });
  
  // Download all invoices
  app.get("/api/billing/invoices", async (req, res) => {
    try {
      // Helper function to get previous months' dates on the 10th
      const getPreviousMonthDate = (monthsAgo: number) => {
        const date = new Date();
        date.setMonth(date.getMonth() - monthsAgo);
        date.setDate(10);
        return date.toISOString().split('T')[0];
      };
      
      // In a real application, we would fetch all invoices from a database or Stripe
      // For now, we'll create a simple CSV with all invoice data using updated IDs and dates
      const allInvoicesData = `Invoice ID,Date,Description,Amount,Status
INV-2025-003,${getPreviousMonthDate(0)},ModerateAI Pro Plan - Monthly,$79.00,Paid
INV-2025-002,${getPreviousMonthDate(1)},ModerateAI Pro Plan - Monthly,$79.00,Paid
INV-2025-001,${getPreviousMonthDate(2)},ModerateAI Pro Plan - Monthly,$79.00,Paid`;
      
      // Set headers for file download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=all-invoices.csv');
      
      // Send the CSV data
      res.status(200).send(allInvoicesData);
    } catch (error) {
      console.error("Error downloading all invoices:", error);
      res.status(500).json({ message: "Error downloading all invoices" });
    }
  });
  
  // Cancel subscription
  app.post("/api/billing/cancel-subscription", async (req, res) => {
    try {
      // In a real application, this would connect to Stripe or another payment processor
      // to cancel the subscription
      
      // Simulate a successful cancellation
      setTimeout(() => {
        res.status(200).json({ 
          success: true,
          message: "Subscription successfully cancelled. Service will remain active until the end of the billing period."
        });
      }, 500); // Small delay to simulate processing
      
    } catch (error) {
      console.error("Error cancelling subscription:", error);
      res.status(500).json({ message: "Error cancelling subscription" });
    }
  });
  
  // Upgrade plan
  app.get("/api/billing/plans", async (req, res) => {
    try {
      // In a real application, this would fetch available plans from a database or Stripe
      const plans = [
        {
          id: "basic",
          name: "Basic",
          price: 49,
          features: [
            "15,000 AI responses/month",
            "Basic moderation rules",
            "Website and Telegram integration",
            "Email support"
          ]
        },
        {
          id: "pro",
          name: "Pro",
          price: 79,
          features: [
            "100,000 AI responses/month",
            "Advanced moderation rules",
            "All platform integrations",
            "Priority support",
            "Custom response templates"
          ]
        },
        {
          id: "enterprise",
          name: "Enterprise",
          price: 199,
          features: [
            "Unlimited AI responses",
            "Custom AI model training",
            "Enterprise-grade security",
            "Dedicated account manager",
            "API access",
            "Custom integrations"
          ]
        }
      ];
      
      res.status(200).json({ plans });
    } catch (error) {
      console.error("Error fetching plans:", error);
      res.status(500).json({ message: "Error fetching available plans" });
    }
  });
  
  // Upgrade subscription
  app.post("/api/billing/upgrade", async (req, res) => {
    try {
      const { planId } = req.body;
      
      if (!planId) {
        return res.status(400).json({ message: "Plan ID is required" });
      }
      
      // In a real application, this would connect to Stripe or another payment processor
      // to upgrade the subscription
      
      // Simulate a successful upgrade
      setTimeout(() => {
        res.status(200).json({ 
          success: true,
          message: "Plan successfully upgraded. The changes will be reflected in your next billing cycle."
        });
      }, 500); // Small delay to simulate processing
      
    } catch (error) {
      console.error("Error upgrading plan:", error);
      res.status(500).json({ message: "Error upgrading plan" });
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
  
  // All activity - for the activity page
  app.get("/api/activity", authMiddleware, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100; // Default to a larger number
      const recentActivity = await storage.getRecentActivity(limit);
      res.status(200).json(recentActivity);
    } catch (error) {
      console.error("Error fetching all activity:", error);
      res.status(500).json({ message: "Error fetching activity data" });
    }
  });

  // Platforms
  app.get("/api/platforms", authMiddleware, async (req, res) => {
    try {
      console.log(`Getting platforms for user ID: ${req.user.id}`);
      const platforms = await storage.getPlatformsByUserId(req.user.id);
      console.log(`Retrieved ${platforms.length} platforms:`, platforms.map(p => `${p.id}: ${p.name} (${p.type})`));
      res.status(200).json(platforms);
    } catch (error) {
      console.error("Error fetching platforms:", error);
      res.status(500).json({ message: "Error fetching platforms" });
    }
  });

  app.get("/api/platforms/:id", authMiddleware, async (req, res) => {
    try {
      const platformId = parseInt(req.params.id);
      console.log(`Getting platform ID: ${platformId} for user: ${req.user.id}`);
      
      const platform = await storage.getPlatform(platformId);
      if (!platform) {
        console.log(`Platform ID ${platformId} not found`);
        return res.status(404).json({ message: "Platform not found" });
      }
      
      console.log(`Successfully retrieved platform: ${platform.name} (${platform.type})`);
      res.status(200).json(platform);
    } catch (error) {
      console.error(`Error fetching platform ${req.params.id}:`, error);
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

      // Special handling for Telegram platform
      if (platform.type === "telegram") {
        // Check if we're activating with a token
        if (req.body.status === "active" && req.body.authToken) {
          console.log(`Attempting to connect Telegram bot for platform ${platformId}`);
          
          // Validate and initialize the bot
          const result = await initializeBot(platformId, req.body.authToken);
          
          // If failed, return error
          if (!result.success) {
            return res.status(400).json({ 
              message: result.message || "Failed to connect Telegram bot" 
            });
          }
          
          console.log(`Telegram bot connected successfully for platform ${platformId}`);
        } 
        // Check if we're disconnecting
        else if (platform.status === "active" && req.body.status === "not_connected") {
          console.log(`Disconnecting Telegram bot for platform ${platformId}`);
          disconnectBot(platformId);
        }
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
  
  // Knowledge Documents API
  app.get("/api/knowledge-bases/:id/documents", authMiddleware, async (req, res) => {
    try {
      const knowledgeBaseId = parseInt(req.params.id);
      const knowledgeBase = await storage.getKnowledgeBase(knowledgeBaseId);
      
      if (!knowledgeBase) {
        return res.status(404).json({ message: "Knowledge base not found" });
      }
      
      if (knowledgeBase.userId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      const documents = await storage.getKnowledgeDocumentsByKnowledgeBaseId(knowledgeBaseId);
      res.status(200).json(documents);
    } catch (error) {
      console.error("Error fetching knowledge documents:", error);
      res.status(500).json({ message: "Error fetching knowledge documents" });
    }
  });
  
  app.post("/api/knowledge-bases/:id/documents", authMiddleware, async (req, res) => {
    try {
      const knowledgeBaseId = parseInt(req.params.id);
      const knowledgeBase = await storage.getKnowledgeBase(knowledgeBaseId);
      
      if (!knowledgeBase) {
        return res.status(404).json({ message: "Knowledge base not found" });
      }
      
      if (knowledgeBase.userId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      const { title, content, metadata } = req.body;
      
      if (!title || !content) {
        return res.status(400).json({ message: "Title and content are required" });
      }
      
      const document = await storage.createKnowledgeDocument({
        knowledgeBaseId,
        title,
        content,
        metadata: metadata || {}
      });
      
      res.status(201).json(document);
    } catch (error) {
      console.error("Error creating knowledge document:", error);
      res.status(500).json({ message: "Error creating knowledge document" });
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

  // Conversation Training routes
  app.get("/api/conversation-trainings", authMiddleware, async (req, res) => {
    try {
      const platformId = req.query.platformId ? parseInt(req.query.platformId as string) : undefined;
      
      let trainings = [];
      if (platformId) {
        // Check if user has access to this platform
        const platform = await storage.getPlatform(platformId);
        if (!platform || platform.userId !== req.user.id) {
          return res.status(403).json({ message: "Unauthorized" });
        }
        
        trainings = await storage.getConversationTrainingsByPlatformId(platformId);
      } else {
        // Get all trainings for user, grouped by platform
        const platforms = await storage.getPlatformsByUserId(req.user.id);
        const allTrainings = await Promise.all(
          platforms.map(platform => storage.getConversationTrainingsByPlatformId(platform.id))
        );
        trainings = allTrainings.flat();
      }
      
      res.status(200).json(trainings);
    } catch (error) {
      console.error("Error fetching conversation trainings:", error);
      res.status(500).json({ message: "Error fetching conversation trainings" });
    }
  });
  
  app.get("/api/conversation-trainings/:id", authMiddleware, async (req, res) => {
    try {
      const trainingId = parseInt(req.params.id);
      const training = await storage.getConversationTraining(trainingId);
      
      if (!training) {
        return res.status(404).json({ message: "Training not found" });
      }
      
      // Check if user has access to this training
      const platform = await storage.getPlatform(training.platformId);
      if (!platform || platform.userId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      res.status(200).json(training);
    } catch (error) {
      console.error("Error fetching conversation training:", error);
      res.status(500).json({ message: "Error fetching conversation training" });
    }
  });
  
  app.post("/api/conversation-trainings", authMiddleware, async (req, res) => {
    try {
      const result = insertConversationTrainingSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: fromZodError(result.error).message });
      }
      
      // Check if user has access to the platform
      const platform = await storage.getPlatform(result.data.platformId);
      if (!platform || platform.userId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      // Create the training record
      const training = await storage.createConversationTraining({
        ...result.data,
        userId: req.user.id,
        status: "pending"
      });
      
      res.status(201).json(training);
      
      // Process training asynchronously
      processTraining(training.id).catch(err => {
        console.error(`Error processing training ${training.id}:`, err);
      });
    } catch (error) {
      console.error("Error creating conversation training:", error);
      res.status(500).json({ message: "Error creating conversation training" });
    }
  });
  
  // Helper function to process training asynchronously
  async function processTraining(trainingId: number) {
    try {
      // Get the training record
      const training = await storage.getConversationTraining(trainingId);
      if (!training) {
        console.error(`Training ${trainingId} not found`);
        return;
      }
      
      // Update status to 'in_progress' and set startedAt
      await storage.updateConversationTraining(trainingId, { 
        status: "in_progress", 
        startedAt: new Date() 
      });
      
      // Get platform to determine its type
      const platform = await storage.getPlatform(training.platformId);
      if (!platform) {
        throw new Error(`Platform ${training.platformId} not found`);
      }
      
      // Get AI configuration to update later
      const aiConfig = await storage.getActiveAiConfiguration(training.userId);
      if (!aiConfig) {
        throw new Error(`No active AI configuration found for user ${training.userId}`);
      }
      
      // Get conversations from the platform
      const conversations = await storage.getConversationsByPlatformId(training.platformId);
      if (conversations.length === 0) {
        // No conversations to process
        await storage.updateConversationTraining(trainingId, {
          status: "completed",
          completedAt: new Date(),
          processedConversations: 0,
          totalConversations: 0
        });
        return;
      }
      
      // Filter out conversations that don't have enough messages
      const validConversations = await Promise.all(
        conversations.map(async (conversation) => {
          const messages = await storage.getMessagesByConversationId(conversation.id);
          if (messages.length >= 3) { // Need at least 3 messages for meaningful training
            return {
              id: conversation.id,
              messages: messages.map(msg => ({ 
                sender: msg.sender, 
                content: msg.content 
              })),
              platformType: platform.type
            };
          }
          return null;
        })
      );
      
      // Filter out null entries
      const conversationsToProcess = validConversations.filter(Boolean);
      
      // Update total conversations count
      await storage.updateConversationTraining(trainingId, {
        totalConversations: conversationsToProcess.length
      });
      
      if (conversationsToProcess.length === 0) {
        // No valid conversations to process
        await storage.updateConversationTraining(trainingId, {
          status: "completed",
          completedAt: new Date(),
          processedConversations: 0
        });
        return;
      }
      
      // Process conversations in batches to avoid rate limits
      const batchSize = 5;
      const trainingResults = [];
      
      for (let i = 0; i < conversationsToProcess.length; i += batchSize) {
        const batch = conversationsToProcess.slice(i, i + batchSize);
        const batchResult = await trainOnConversations(batch);
        trainingResults.push(...batchResult.results);
        
        // Update progress
        await storage.updateConversationTraining(trainingId, {
          processedConversations: Math.min(i + batchSize, conversationsToProcess.length),
          lastTrainedConversationId: batch[batch.length - 1].id
        });
        
        // Add a delay between batches to avoid rate limits
        if (i + batchSize < conversationsToProcess.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      // Filter successful results
      const successfulResults = trainingResults.filter(result => result.success && result.analysis);
      
      if (successfulResults.length === 0) {
        // No successful results
        await storage.updateConversationTraining(trainingId, {
          status: "error",
          completedAt: new Date(),
          errorMessage: "No conversations could be processed successfully"
        });
        return;
      }
      
      // Generate improved system prompt based on the results
      const analyses = successfulResults.map(result => result.analysis);
      const improvedPromptResult = await generateImprovedSystemPrompt(aiConfig.systemPrompt || "", analyses);
      
      if (improvedPromptResult.success) {
        // Update AI configuration with improved prompt
        await storage.updateAiConfiguration(aiConfig.id, {
          systemPrompt: improvedPromptResult.improvedPrompt,
          trainingCompletedAt: new Date()
        });
        
        // Mark training as completed
        await storage.updateConversationTraining(trainingId, {
          status: "completed",
          completedAt: new Date()
        });
      } else {
        // Mark training as error
        await storage.updateConversationTraining(trainingId, {
          status: "error",
          completedAt: new Date(),
          errorMessage: "Failed to generate improved system prompt"
        });
      }
    } catch (error) {
      console.error(`Error processing training ${trainingId}:`, error);
      // Update training record with error
      await storage.updateConversationTraining(trainingId, {
        status: "error",
        completedAt: new Date(),
        errorMessage: error.message || "Unknown error occurred during training"
      });
    }
  }

  const httpServer = createServer(app);
  return httpServer;
}
