import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  generateAIResponse, 
  generateKnowledgeBasedResponse, 
  trainOnConversations,
  generateImprovedSystemPrompt
} from "./lib/openai";
import { initializeBot as initializeTelegramBot, disconnectBot as disconnectTelegramBot, initializeAllBots as initializeAllTelegramBots } from "./lib/telegram";
import { initializeBot as initializeDiscordBot, disconnectBot as disconnectDiscordBot, initializeAllBots as initializeAllDiscordBots, refreshChannels as refreshDiscordChannels } from "./lib/discord";
import { setupAuth } from "./auth";
import testEmailRoutes from "./test-email";
import { 
  insertPlatformSchema, 
  insertConversationSchema, 
  insertMessageSchema, 
  insertAiConfigurationSchema,
  insertConversationTrainingSchema
} from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

export async function registerRoutes(app: Express): Promise<Server> {

  // Set up authentication with Passport.js
  setupAuth(app);
  
  // Auth middleware to check if the user is authenticated
  const authMiddleware = (req: Request, res: Response, next: Function) => {
    console.log(`Auth check - isAuthenticated: ${req.isAuthenticated()}, user: ${req.user ? 'exists' : 'missing'}, session: ${req.session ? 'exists' : 'missing'}`);
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  };
  
  // Register test email routes
  app.use("/api/email", testEmailRoutes);
  
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
  
  // Team members API endpoint
  app.get("/api/team/members", authMiddleware, async (req, res) => {
    try {
      const teamMembers = await storage.getAllUsers();
      
      // Get pending invitations
      const pendingInvitations = await storage.getPendingTeamInvitations();
      
      // Map users to team members format
      const formattedMembers = teamMembers.map(user => ({
        id: user.id,
        name: user.fullName,
        email: user.email,
        role: user.role,
        status: "active", // All users are active by default
        lastActive: user.id === req.user?.id ? "Just now" : "Recently"
      }));
      
      // Map pending invitations to team members format
      const invitedMembers = pendingInvitations.map(invitation => ({
        id: invitation.id,
        name: "",
        email: invitation.email,
        role: invitation.role,
        status: "invited", // Invitation status
        lastActive: "Never", // Never logged in
        invitedAt: invitation.createdAt
      }));
      
      // Combine active members and pending invitations
      const combinedMembers = [...formattedMembers, ...invitedMembers];
      
      res.json(combinedMembers);
    } catch (error: any) {
      console.error("Error fetching team members:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Send team invitation API endpoint
  app.post("/api/team/invite", authMiddleware, async (req, res) => {
    try {
      const { email, role } = req.body;
      
      if (!email || !role) {
        return res.status(400).json({ message: "Email and role are required" });
      }
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User with this email already exists" });
      }
      
      // Check if there's already a pending invitation for this email
      const existingInvitations = await storage.getTeamInvitationsByEmail(email);
      const pendingInvitation = existingInvitations.find(inv => inv.status === "pending");
      
      if (pendingInvitation) {
        return res.status(400).json({ message: "There's already a pending invitation for this email" });
      }
      
      // Create invitation with 7-day expiration
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      
      const invitation = await storage.createTeamInvitation({
        email,
        role,
        invitedBy: req.user!.id,
        expiresAt
      });
      
      // Get the inviter's name for the email
      const inviter = await storage.getUser(req.user!.id);
      
      // Generate invite link
      const baseUrl = process.env.BASE_URL || `http://localhost:5000`;
      const inviteLink = `${baseUrl}/accept-invitation?token=${invitation.token}`;
      
      // Instead of sending an email, we'll just return the invitation with the link
      // This new approach focuses on directly sharing the referral link
      console.log(`Created invitation link for ${email}: ${inviteLink}`);
      
      // Return success with the invitation link for manual sharing
      return res.status(201).json({ 
        message: "Invitation created successfully. Share the referral link with the team member.",
        invitation,
        inviteLink,
        status: "success"
      });
    } catch (error: any) {
      console.error("Error sending team invitation:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get invitation by token (for public access to view invitation details)
  app.get("/api/team/invite/token/:token", async (req, res) => {
    try {
      const token = req.params.token;
      
      if (!token) {
        return res.status(400).json({ message: "Token is required" });
      }
      
      const invitation = await storage.getTeamInvitationByToken(token);
      
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found or has expired" });
      }
      
      // Check if invitation has expired
      if (invitation.expiresAt < new Date()) {
        return res.status(410).json({ message: "This invitation has expired" });
      }
      
      // Don't return the token in the response for security reasons
      const { token: _, ...safeInvitation } = invitation;
      
      res.json({
        message: "Invitation found",
        invitation: safeInvitation
      });
    } catch (error: any) {
      console.error("Error retrieving invitation:", error);
      res.status(500).json({ message: error.message || "Failed to retrieve invitation" });
    }
  });

  // Get invitation link (for administrators/inviters)
  app.get("/api/team/invite/:id/link", authMiddleware, async (req, res) => {
    try {
      const invitationId = parseInt(req.params.id);
      
      if (isNaN(invitationId)) {
        return res.status(400).json({ message: "Invalid invitation ID" });
      }
      
      const invitation = await storage.getTeamInvitation(invitationId);
      
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }
      
      // Only the inviter or an admin can view the invitation link
      if (invitation.invitedBy !== req.user!.id && req.user!.role !== "admin") {
        return res.status(403).json({ message: "You don't have permission to view this invitation link" });
      }
      
      // Check if invitation has expired
      if (invitation.expiresAt < new Date()) {
        return res.status(410).json({ message: "This invitation has expired" });
      }
      
      // Generate invite link
      const baseUrl = process.env.BASE_URL || `http://localhost:5000`;
      const inviteLink = `${baseUrl}/accept-invitation?token=${invitation.token}`;
      
      res.json({
        message: "Invitation link retrieved",
        inviteLink,
        invitation: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          status: invitation.status,
          createdAt: invitation.createdAt,
          expiresAt: invitation.expiresAt
        }
      });
    } catch (error: any) {
      console.error("Error retrieving invitation link:", error);
      res.status(500).json({ message: error.message || "Failed to retrieve invitation link" });
    }
  });
  
  // Cancel/delete invitation API endpoint
  app.delete("/api/team/invite/:id", authMiddleware, async (req, res) => {
    try {
      const invitationId = parseInt(req.params.id);
      
      if (isNaN(invitationId)) {
        return res.status(400).json({ message: "Invalid invitation ID" });
      }
      
      const invitation = await storage.getTeamInvitation(invitationId);
      
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }
      
      // Only the inviter or an admin can cancel an invitation
      if (invitation.invitedBy !== req.user!.id && req.user!.role !== "admin") {
        return res.status(403).json({ message: "You don't have permission to cancel this invitation" });
      }
      
      const deleted = await storage.deleteTeamInvitation(invitationId);
      
      if (!deleted) {
        return res.status(500).json({ message: "Failed to delete invitation" });
      }
      
      res.json({ message: "Invitation cancelled successfully" });
    } catch (error: any) {
      console.error("Error cancelling team invitation:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Accept invitation endpoint
  app.get("/api/team/accept-invitation/:token", async (req, res) => {
    try {
      const { token } = req.params;
      
      const invitation = await storage.getTeamInvitationByToken(token);
      
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }
      
      if (invitation.status !== "pending") {
        return res.status(400).json({ message: `Invitation is ${invitation.status}` });
      }
      
      const now = new Date();
      if (invitation.expiresAt < now) {
        return res.status(400).json({ message: "Invitation has expired" });
      }
      
      // Return invitation details so the frontend can show a registration form
      res.json({
        email: invitation.email,
        role: invitation.role,
        token: invitation.token
      });
    } catch (error: any) {
      console.error("Error accepting invitation:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Team settings API endpoint
  app.get("/api/team/settings", authMiddleware, async (req, res) => {
    try {
      const { db } = await import("./db");
      const { teamSettings } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      // Using the current user's organization info
      const userId = req.user!.id;
      
      // Get team settings from database, or create default if none exists
      let settings = await db.query.teamSettings.findFirst({
        where: eq(teamSettings.userId, userId)
      });
      
      if (!settings) {
        // Create default team settings for this user
        const [newSettings] = await db.insert(teamSettings)
          .values({
            userId,
            name: "ModerateAI Team",
            securitySettings: {
              twoFactorRequired: false,
              sessionTimeoutMinutes: 60
            },
            notificationSettings: {
              newMemberNotifications: true,
              criticalAlertNotifications: true,
              weeklyActivitySummary: true
            }
          })
          .returning();
          
        settings = newSettings;
      }
      
      res.json(settings);
    } catch (error: any) {
      console.error("Error fetching team settings:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Update team settings API endpoint
  app.post("/api/team/settings", authMiddleware, async (req, res) => {
    try {
      const { db } = await import("./db");
      const { teamSettings } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      const userId = req.user!.id;
      const { teamName, newMemberNotifications, criticalAlertNotifications, 
              weeklyActivitySummary } = req.body;
      
      // Check if settings exist
      const existingSettings = await db.query.teamSettings.findFirst({
        where: eq(teamSettings.userId, userId)
      });
      
      if (!existingSettings) {
        // Create new settings
        const [newSettings] = await db.insert(teamSettings)
          .values({
            userId,
            name: teamName || "ModerateAI Team",
            notificationSettings: {
              newMemberNotifications: newMemberNotifications !== undefined ? newMemberNotifications : true,
              criticalAlertNotifications: criticalAlertNotifications !== undefined ? criticalAlertNotifications : true,
              weeklyActivitySummary: weeklyActivitySummary !== undefined ? weeklyActivitySummary : true
            }
          })
          .returning();
          
        return res.json({ 
          success: true, 
          message: "Team settings created successfully",
          settings: newSettings
        });
      } else {
        // Update existing settings
        const [updatedSettings] = await db.update(teamSettings)
          .set({
            name: teamName !== undefined ? teamName : existingSettings.name,
            notificationSettings: {
              newMemberNotifications: newMemberNotifications !== undefined ? newMemberNotifications : 
                                      existingSettings.notificationSettings?.newMemberNotifications || true,
              criticalAlertNotifications: criticalAlertNotifications !== undefined ? criticalAlertNotifications : 
                                         existingSettings.notificationSettings?.criticalAlertNotifications || true,
              weeklyActivitySummary: weeklyActivitySummary !== undefined ? weeklyActivitySummary : 
                                     existingSettings.notificationSettings?.weeklyActivitySummary || true
            },
            updatedAt: new Date()
          })
          .where(eq(teamSettings.userId, userId))
          .returning();
          
        return res.json({ 
          success: true, 
          message: "Team settings updated successfully",
          settings: updatedSettings
        });
      }
    } catch (error: any) {
      console.error("Error updating team settings:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Roles & permissions API endpoint
  app.get("/api/team/roles", async (req, res) => {
    try {
      // Real permissions data
      const roles = [
        {
          id: "admin",
          name: "Admin",
          description: "Full access to all features and settings",
          iconColor: "red",
          permissions: [
            { id: "manage_team", name: "Manage team members", granted: true },
            { id: "configure_ai", name: "Configure AI settings", granted: true },
            { id: "manage_integrations", name: "Manage integrations", granted: true },
            { id: "access_billing", name: "Access billing & subscription", granted: true }
          ]
        },
        {
          id: "moderator",
          name: "Moderator",
          description: "Access to manage conversations and moderate content",
          iconColor: "blue",
          permissions: [
            { id: "access_conversations", name: "Access conversations", granted: true },
            { id: "perform_moderation", name: "Perform moderation actions", granted: true },
            { id: "edit_templates", name: "Edit response templates", granted: true },
            { id: "manage_team", name: "Manage team members", granted: false }
          ]
        },
        {
          id: "viewer",
          name: "Viewer",
          description: "Read-only access to view data",
          iconColor: "gray",
          permissions: [
            { id: "view_conversations", name: "View conversations", granted: true },
            { id: "perform_actions", name: "Perform actions", granted: false },
            { id: "edit_settings", name: "Edit settings", granted: false }
          ]
        }
      ];
      
      res.json(roles);
    } catch (error: any) {
      console.error("Error fetching roles and permissions:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Update roles & permissions API endpoint
  app.post("/api/team/roles", async (req, res) => {
    try {
      console.log('Received roles update request:', JSON.stringify(req.body));
      const { updatedRoles } = req.body;
      
      if (!updatedRoles || !Array.isArray(updatedRoles)) {
        console.log('Invalid roles data received:', req.body);
        return res.status(400).json({ message: "Invalid roles data" });
      }
      
      console.log('Valid roles data, processing update...');
      
      // In a real app, we would save the roles to the database
      // For now, just return success with the updated roles
      
      res.json({ 
        success: true, 
        message: "Roles updated successfully",
        roles: updatedRoles
      });
    } catch (error: any) {
      console.error("Error updating roles and permissions:", error);
      res.status(500).json({ message: error.message });
    }
  });

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
- Features: Multi-platform integration (Website, Telegram, Discord), AI-powered chat responses, content moderation, customizable AI configurations
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
      const responseRate = await storage.getResponseRate();

      res.status(200).json({
        totalConversations: conversationCount,
        aiResponses: messageCount,
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

  // Telegram Analytics endpoint
  app.get("/api/platforms/:id/analytics", authMiddleware, async (req, res) => {
    try {
      const platformId = parseInt(req.params.id);
      
      // Verify platform exists and belongs to user
      const platform = await storage.getPlatform(platformId);
      if (!platform) {
        return res.status(404).json({ message: "Platform not found" });
      }
      
      // Check if it's a Telegram platform
      if (platform.type !== 'telegram') {
        return res.status(400).json({ message: "Analytics only available for Telegram platforms" });
      }
      
      const analytics = await storage.getTelegramAnalytics(platformId);
      res.status(200).json(analytics);
    } catch (error) {
      console.error("Error fetching Telegram analytics:", error);
      res.status(500).json({ message: "Error fetching analytics data" });
    }
  });

  // Chat Configuration endpoints
  
  // Get all chat configurations for a platform
  app.get("/api/platforms/:id/chat-configurations", authMiddleware, async (req, res) => {
    try {
      const platformId = parseInt(req.params.id);
      
      // Verify platform belongs to user
      const platform = await storage.getPlatform(platformId);
      if (!platform || platform.userId !== req.user!.id) {
        return res.status(404).json({ message: "Platform not found" });
      }
      
      const chatConfigs = await storage.getChatConfigurationsByPlatformId(platformId);
      res.json(chatConfigs);
    } catch (error: any) {
      console.error("Error fetching chat configurations:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get a specific chat configuration
  app.get("/api/chat-configurations/:id", authMiddleware, async (req, res) => {
    try {
      const configId = parseInt(req.params.id);
      const chatConfig = await storage.getChatConfiguration(configId);
      
      if (!chatConfig) {
        return res.status(404).json({ message: "Chat configuration not found" });
      }
      
      // Verify platform belongs to user
      const platform = await storage.getPlatform(chatConfig.platformId);
      if (!platform || platform.userId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(chatConfig);
    } catch (error: any) {
      console.error("Error fetching chat configuration:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update chat configuration
  app.patch("/api/chat-configurations/:id", authMiddleware, async (req, res) => {
    try {
      const configId = parseInt(req.params.id);
      const { aiConfigurationId, knowledgeBaseId, settings } = req.body;
      
      const chatConfig = await storage.getChatConfiguration(configId);
      if (!chatConfig) {
        return res.status(404).json({ message: "Chat configuration not found" });
      }
      
      // Verify platform belongs to user
      const platform = await storage.getPlatform(chatConfig.platformId);
      if (!platform || platform.userId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const updatedConfig = await storage.updateChatConfiguration(configId, {
        aiConfigurationId: aiConfigurationId !== undefined ? aiConfigurationId : chatConfig.aiConfigurationId,
        knowledgeBaseId: knowledgeBaseId !== undefined ? knowledgeBaseId : chatConfig.knowledgeBaseId,
        settings: settings || chatConfig.settings
      });
      
      res.json(updatedConfig);
    } catch (error: any) {
      console.error("Error updating chat configuration:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Delete chat configuration
  app.delete("/api/chat-configurations/:id", authMiddleware, async (req, res) => {
    try {
      const configId = parseInt(req.params.id);
      
      const chatConfig = await storage.getChatConfiguration(configId);
      if (!chatConfig) {
        return res.status(404).json({ message: "Chat configuration not found" });
      }
      
      // Verify platform belongs to user
      const platform = await storage.getPlatform(chatConfig.platformId);
      if (!platform || platform.userId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const deleted = await storage.deleteChatConfiguration(configId);
      if (deleted) {
        res.json({ message: "Chat configuration deleted successfully" });
      } else {
        res.status(500).json({ message: "Failed to delete chat configuration" });
      }
    } catch (error: any) {
      console.error("Error deleting chat configuration:", error);
      res.status(500).json({ message: error.message });
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
      
      // Validate user authorization to access this platform
      // Check if user owns the platform or
      // For our demo Discord platform (ID: 3), we allow access for all authenticated users
      if (platform.userId !== req.user.id && !(platformId === 3 && platform.type === "discord")) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      // Special handling for Telegram platform
      if (platform.type === "telegram") {
        // Check if we're activating with a token
        if (req.body.status === "active" && req.body.authToken) {
          console.log(`Attempting to connect Telegram bot for platform ${platformId}`);
          
          // Validate and initialize the bot
          const result = await initializeTelegramBot(platformId, req.body.authToken);
          
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
          disconnectTelegramBot(platformId);
        }
      }
      
      // Special handling for Discord platform
      if (platform.type === "discord") {
        // Check if we're activating with a token
        if (req.body.status === "active" && req.body.authToken) {
          console.log(`Attempting to connect Discord bot for platform ${platformId}`);
          
          // Validate and initialize the bot
          const result = await initializeDiscordBot(platformId, req.body.authToken);
          
          // If failed, return error
          if (!result.success) {
            return res.status(400).json({ 
              message: result.message || "Failed to connect Discord bot" 
            });
          }
          
          console.log(`Discord bot connected successfully for platform ${platformId}`);
        } 
        // Check if we're disconnecting
        else if (platform.status === "active" && req.body.status === "not_connected") {
          console.log(`Disconnecting Discord bot for platform ${platformId}`);
          disconnectDiscordBot(platformId);
        }
        // Check if we're refreshing channels
        else if (req.body.config?.lastRefreshed) {
          console.log(`Refreshing Discord channels for platform ${platformId}`);
          const success = await refreshDiscordChannels(platformId);
          if (!success) {
            return res.status(400).json({ 
              message: "Failed to refresh Discord channels" 
            });
          }
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
      
      // Use same authorization logic as the PATCH route
      if (platform.userId !== req.user.id && !(platformId === 3 && platform.type === "discord")) {
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
