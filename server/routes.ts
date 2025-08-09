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
import trainingRoutes from "./routes/training";
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
  
  // Register training routes
  app.use("/api/training", trainingRoutes);
  
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
  
  // TEMPORARY: Fix existing chat configurations to match platform settings
  app.post("/api/fix-chat-configs", authMiddleware, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // Get user's platforms
      const platforms = await storage.getPlatformsByUserId(userId);
      
      let updatedCount = 0;
      
      for (const platform of platforms) {
        const platformConfig = (platform.config as any) || {};
        
        // Get all chat configurations for this platform
        const chatConfigs = await storage.getChatConfigurationsByPlatformId(platform.id);
        
        for (const chatConfig of chatConfigs) {
          const currentSettings = (chatConfig.settings as any) || {};
          
          // Update settings to match platform configuration
          const updatedSettings = {
            ...currentSettings,
            groupMode: platformConfig.groupMode !== undefined ? platformConfig.groupMode : currentSettings.groupMode,
            privateChatMode: platformConfig.privateChatMode !== undefined ? platformConfig.privateChatMode : currentSettings.privateChatMode,
            mentionOnly: platformConfig.mentionOnly !== undefined ? platformConfig.mentionOnly : currentSettings.mentionOnly,
            contentFilteringEnabled: platformConfig.contentFilteringEnabled !== undefined ? platformConfig.contentFilteringEnabled : currentSettings.contentFilteringEnabled,
            spamProtectionEnabled: platformConfig.spamProtectionEnabled !== undefined ? platformConfig.spamProtectionEnabled : currentSettings.spamProtectionEnabled
          };
          
          // Update the chat configuration
          await storage.updateChatConfiguration(chatConfig.id, {
            settings: updatedSettings
          });
          
          updatedCount++;
        }
      }
      
      res.json({ 
        success: true, 
        message: `Updated ${updatedCount} chat configurations to match platform settings`,
        updatedCount 
      });
    } catch (error: any) {
      console.error("Error fixing chat configurations:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });
  
  // Team members API endpoint
  app.get("/api/team/members", authMiddleware, async (req, res) => {
    try {
      const currentUserId = req.user?.id;
      if (!currentUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Get emails whitelisted by the current user
      const whitelistedEmails = await storage.getEmailsWhitelistedBy(currentUserId);
      const emailList = whitelistedEmails.map(w => w.email);
      
      // Include the current user in the team (they can see themselves)
      emailList.push(req.user.email);
      
      // Get users whose emails were whitelisted by this admin
      const allUsers = await storage.getAllUsers();
      const teamMembers = allUsers.filter(user => emailList.includes(user.email));
      
      // Map users to team members format
      const formattedMembers = teamMembers.map(user => ({
        id: user.id,
        name: user.fullName,
        email: user.email,
        role: user.role,
        status: "active",
        lastActive: user.id === currentUserId ? "Just now" : "Recently"
      }));
      
      res.json(formattedMembers);
    } catch (error: any) {
      console.error("Error fetching team members:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Whitelist team member API endpoint
  app.post("/api/team/invite", authMiddleware, async (req, res) => {
    try {
      const { email, role } = req.body;
      
      if (!email || !role) {
        return res.status(400).json({ message: "Email and role are required" });
      }
      
      const currentUserId = req.user!.id;
      
      // Check if email is already whitelisted
      const isAlreadyWhitelisted = await storage.isEmailWhitelisted(email);
      if (isAlreadyWhitelisted) {
        return res.status(400).json({ message: "This email is already whitelisted" });
      }
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User with this email already exists" });
      }
      
      // Add email to whitelist
      const whitelistEntry = await storage.addEmailToWhitelist(email, currentUserId);
      
      console.log(`Email ${email} whitelisted by user ${currentUserId}`);
      
      // Return success
      return res.status(201).json({ 
        message: "Email successfully added to whitelist. The user can now access the system.",
        whitelistEntry,
        status: "success"
      });
    } catch (error: any) {
      console.error("Error whitelisting email:", error);
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
  
  // Remove user from whitelist API endpoint
  app.delete("/api/team/members/:id", authMiddleware, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const currentUserId = req.user!.id;
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      // Prevent admin from removing themselves
      if (userId === currentUserId) {
        return res.status(400).json({ message: "You cannot remove yourself from the team" });
      }
      
      // Get user to find their email
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Check if current user has whitelisted this email
      const whitelistedEmails = await storage.getEmailsWhitelistedBy(currentUserId);
      const hasWhitelisted = whitelistedEmails.some(w => w.email === user.email);
      
      if (!hasWhitelisted) {
        return res.status(403).json({ message: "You can only remove users you have whitelisted" });
      }
      
      // Remove email from whitelist
      const removed = await storage.removeEmailFromWhitelist(user.email);
      
      if (!removed) {
        return res.status(500).json({ message: "Failed to remove user from whitelist" });
      }
      
      res.json({ message: "User removed from whitelist successfully" });
    } catch (error: any) {
      console.error("Error removing user from whitelist:", error);
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
      const demoUser = demoUsers.find(user => user.email === "michael@x8c.io") || demoUsers.find(user => user.email === "demo@example.com") || demoUsers[0];
      
      
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
        // Use knowledge-based response generation
        const response = await generateKnowledgeBasedResponse(
          message,
          [], // No conversation history 
          aiConfig?.systemPrompt || systemPrompt,
          aiConfig?.responseStyle || 75, // Friendly tone
          aiConfig?.responseLength || 50,  // Moderate length
          demoUser.id // Pass demo user ID for knowledge base access
        );
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
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const conversationCount = await storage.getConversationCountForUser(userId);
      const messageCount = await storage.getMessageCountForUser(userId);
      const responseRate = await storage.getResponseRateForUser(userId);

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
      
      // Debug: Log what we're sending to frontend
      console.log('=== GET PLATFORM RESPONSE ===');
      console.log('Platform config being sent:', platform.config);
      console.log('Bot name in config:', platform.config?.botName);
      console.log('Bot username in config:', platform.config?.botUsername);
      console.log('=== END GET PLATFORM RESPONSE ===');
      
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
          
          // Store bot information in platform config by merging with the request body
          if (result.botInfo) {
            const currentConfig = platform.config || {};
            const updatedConfig = {
              ...currentConfig,
              ...(req.body.config || {}),
              botName: result.botInfo.botName,
              botUsername: result.botInfo.botUsername,
              botId: result.botInfo.botId
            };
            
            // Update the request body to include the bot information
            req.body.config = updatedConfig;
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
      
      // Debug: Log what we're returning
      console.log('=== PLATFORM UPDATE RESPONSE ===');
      console.log('Updated platform config:', updatedPlatform.config);
      console.log('Bot name in config:', updatedPlatform.config?.botName);
      console.log('Bot username in config:', updatedPlatform.config?.botUsername);
      console.log('=== END PLATFORM UPDATE RESPONSE ===');
      
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

  // Create knowledge base
  app.post("/api/knowledge-bases", authMiddleware, async (req, res) => {
    try {
      const { name, description, isActive } = req.body;
      
      if (!name || name.trim() === "") {
        return res.status(400).json({ message: "Knowledge base name is required" });
      }
      
      const knowledgeBase = await storage.createKnowledgeBase({
        userId: req.user.id,
        name: name.trim(),
        description: description?.trim() || null,
        isActive: isActive !== undefined ? isActive : true,
        documentCount: 0
      });
      
      res.status(201).json(knowledgeBase);
    } catch (error) {
      console.error("Error creating knowledge base:", error);
      res.status(500).json({ message: "Failed to create knowledge base" });
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

  // Update knowledge document
  app.put("/api/knowledge-documents/:id", authMiddleware, async (req, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const document = await storage.getKnowledgeDocument(documentId);
      
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      // Check if user owns the knowledge base that contains this document
      const knowledgeBase = await storage.getKnowledgeBase(document.knowledgeBaseId);
      if (!knowledgeBase || knowledgeBase.userId !== req.user.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      const { title, content } = req.body;
      
      if (!title || !content) {
        return res.status(400).json({ message: "Title and content are required" });
      }
      
      const updatedDocument = await storage.updateKnowledgeDocument(documentId, {
        title,
        content
      });
      
      res.status(200).json(updatedDocument);
    } catch (error) {
      console.error("Error updating knowledge document:", error);
      res.status(500).json({ message: "Error updating knowledge document" });
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

  // Website Chat API endpoints
  app.post("/api/website-chat/init", async (req, res) => {
    try {
      const { token, sessionId, visitorInfo } = req.body;
      
      if (!token) {
        return res.status(400).json({ message: "Token is required" });
      }

      // Find website configuration by auth token
      const websiteConfig = await storage.getWebsiteConfigurationByToken(token);
      if (!websiteConfig || !websiteConfig.isActive) {
        return res.status(401).json({ message: "Invalid token or website configuration disabled" });
      }

      // Create a virtual platform for this website instance if it doesn't exist
      let platform = await storage.getPlatformByToken(token);
      if (!platform) {
        platform = await storage.createPlatform({
          type: "website",
          name: websiteConfig.name,
          status: "active",
          userId: websiteConfig.userId,
          authToken: token,
          config: websiteConfig.config
        });
      }

      // Create or get existing conversation for this session
      let conversation = await storage.getConversationByExternalId(sessionId);
      if (!conversation) {
        conversation = await storage.createConversation({
          platformId: platform.id,
          externalUserId: sessionId,
          externalUsername: visitorInfo?.name || "Website Visitor",
          externalId: sessionId,
          status: "active"
        });
      }

      // Return conversation info and website config
      res.json({
        conversationId: conversation.id,
        config: websiteConfig.config
      });
    } catch (error) {
      console.error("Error initializing website chat:", error);
      res.status(500).json({ message: "Error initializing chat" });
    }
  });

  app.post("/api/website-chat/message", async (req, res) => {
    try {
      const { token, sessionId, message, conversationId } = req.body;

      if (!token || !sessionId || !message) {
        return res.status(400).json({ message: "Token, sessionId, and message are required" });
      }

      // Find website configuration by auth token
      const websiteConfig = await storage.getWebsiteConfigurationByToken(token);
      if (!websiteConfig || !websiteConfig.isActive) {
        return res.status(401).json({ message: "Invalid token or website configuration disabled" });
      }

      // Find platform by auth token
      const platform = await storage.getPlatformByToken(token);
      if (!platform || platform.type !== "website") {
        return res.status(401).json({ message: "Invalid token" });
      }

      // Get conversation
      const conversation = await storage.getConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      // Verify conversation belongs to this platform
      if (conversation.platformId !== platform.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      // Use website-specific AI configuration if available, otherwise use user's active AI config
      let aiConfig = null;
      if (websiteConfig.aiConfigurationId) {
        aiConfig = await storage.getAiConfiguration(websiteConfig.aiConfigurationId);
      } else {
        aiConfig = await storage.getActiveAiConfiguration(websiteConfig.userId);
      }

      if (!aiConfig) {
        return res.status(404).json({ message: "No AI configuration found" });
      }

      // Create user message
      const userMessage = await storage.createMessage({
        conversationId: conversation.id,
        content: message,
        sender: "user",
        metadata: { sessionId, timestamp: new Date().toISOString() }
      });

      // Get conversation history
      const previousMessages = await storage.getMessagesByConversationId(conversation.id);
      const conversationHistory = previousMessages
        .filter(msg => msg.id !== userMessage.id) // Exclude the current message
        .map(msg => ({
          role: msg.sender === "user" ? "user" : "assistant",
          content: msg.content
        }));

      // Generate AI response using knowledge base if available
      let aiResponse: string;
      try {
        // Try knowledge-based response first - use website-specific knowledge base if available
        let knowledgeBase = null;
        if (websiteConfig.knowledgeBaseId) {
          knowledgeBase = await storage.getKnowledgeBase(websiteConfig.knowledgeBaseId);
        } else {
          knowledgeBase = await storage.getActiveKnowledgeBase(websiteConfig.userId);
        }
        
        if (knowledgeBase) {
          aiResponse = await generateKnowledgeBasedResponse(
            message,
            conversationHistory,
            aiConfig.systemPrompt || "You are a helpful customer support assistant.",
            aiConfig.responseStyle,
            aiConfig.responseLength,
            websiteConfig.userId
          );
        } else {
          // Fall back to regular AI response
          aiResponse = await generateAIResponse(
            message,
            conversationHistory,
            aiConfig.systemPrompt || "You are a helpful customer support assistant.",
            aiConfig.responseStyle,
            aiConfig.responseLength
          );
        }
      } catch (error) {
        console.error("Error generating AI response:", error);
        aiResponse = "I apologize, but I'm having trouble processing your request right now. Please try again in a moment.";
      }

      // Save AI response
      const aiMessage = await storage.createMessage({
        conversationId: conversation.id,
        content: aiResponse,
        sender: "ai",
        metadata: { timestamp: new Date().toISOString() }
      });

      res.json({
        message: {
          id: aiMessage.id,
          content: aiMessage.content,
          sender: aiMessage.sender,
          timestamp: aiMessage.createdAt
        }
      });
    } catch (error) {
      console.error("Error processing website chat message:", error);
      res.status(500).json({ message: "Error processing message" });
    }
  });

  // Website Configuration Management API endpoints
  app.get("/api/website-configurations", authMiddleware, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const configurations = await storage.getWebsiteConfigurationsByUserId(userId);
      res.json({ configurations });
    } catch (error) {
      console.error("Error fetching website configurations:", error);
      res.status(500).json({ message: "Error fetching configurations" });
    }
  });

  app.post("/api/website-configurations", authMiddleware, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { name, domain, aiConfigurationId, knowledgeBaseId, config } = req.body;
      
      // Generate unique auth token
      const authToken = `website-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      
      const websiteConfig = await storage.createWebsiteConfiguration({
        userId,
        name: name || "New Website",
        domain,
        authToken,
        aiConfigurationId: aiConfigurationId || null,
        knowledgeBaseId: knowledgeBaseId || null,
        config: config || {
          widgetTitle: "Chat with us",
          welcomeMessage: "Hi there! How can I help you today?",
          primaryColor: "#3B82F6",
          position: "bottom-right",
          allowFileUploads: false,
          collectVisitorInfo: true,
          showTypingIndicator: true,
          autoOpenDelay: 3000
        },
        isActive: true
      });

      res.json({ configuration: websiteConfig });
    } catch (error) {
      console.error("Error creating website configuration:", error);
      res.status(500).json({ message: "Error creating configuration" });
    }
  });

  app.patch("/api/website-configurations/:id", authMiddleware, async (req, res) => {
    try {
      const userId = req.user?.id;
      const configId = parseInt(req.params.id);
      
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Verify ownership
      const existingConfig = await storage.getWebsiteConfiguration(configId);
      if (!existingConfig || existingConfig.userId !== userId) {
        return res.status(404).json({ message: "Configuration not found" });
      }

      const updatedConfig = await storage.updateWebsiteConfiguration(configId, req.body);
      res.json({ configuration: updatedConfig });
    } catch (error) {
      console.error("Error updating website configuration:", error);
      res.status(500).json({ message: "Error updating configuration" });
    }
  });

  app.delete("/api/website-configurations/:id", authMiddleware, async (req, res) => {
    try {
      const userId = req.user?.id;
      const configId = parseInt(req.params.id);
      
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Verify ownership
      const existingConfig = await storage.getWebsiteConfiguration(configId);
      if (!existingConfig || existingConfig.userId !== userId) {
        return res.status(404).json({ message: "Configuration not found" });
      }

      await storage.deleteWebsiteConfiguration(configId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting website configuration:", error);
      res.status(500).json({ message: "Error deleting configuration" });
    }
  });

  app.get("/api/website-chat/history/:conversationId", async (req, res) => {
    try {
      const { token } = req.query;
      const conversationId = parseInt(req.params.conversationId);

      if (!token) {
        return res.status(400).json({ message: "Token is required" });
      }

      // Find platform by auth token
      const platform = await storage.getPlatformByToken(token);
      if (!platform || platform.type !== "website") {
        return res.status(401).json({ message: "Invalid token" });
      }

      // Get conversation and verify it belongs to this platform
      const conversation = await storage.getConversation(conversationId);
      if (!conversation || conversation.platformId !== platform.id) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      // Get messages
      const messages = await storage.getMessagesByConversationId(conversationId);
      
      res.json({
        messages: messages.map(msg => ({
          id: msg.id,
          content: msg.content,
          sender: msg.sender,
          timestamp: msg.createdAt
        }))
      });
    } catch (error) {
      console.error("Error fetching website chat history:", error);
      res.status(500).json({ message: "Error fetching chat history" });
    }
  });

  // Email Whitelist Management API endpoints
  app.get("/api/email-whitelist", authMiddleware, async (req, res) => {
    try {
      const whitelistedEmails = await storage.getWhitelistedEmails();
      res.json(whitelistedEmails);
    } catch (error) {
      console.error("Error fetching email whitelist:", error);
      res.status(500).json({ message: "Error fetching email whitelist" });
    }
  });

  app.post("/api/email-whitelist", authMiddleware, async (req, res) => {
    try {
      const { email } = req.body;
      const userId = req.user?.id;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // Check if email is already whitelisted
      const isAlreadyWhitelisted = await storage.isEmailWhitelisted(email);
      if (isAlreadyWhitelisted) {
        return res.status(400).json({ message: "Email is already whitelisted" });
      }

      const whitelistEntry = await storage.addEmailToWhitelist(email, userId);
      res.status(201).json(whitelistEntry);
    } catch (error) {
      console.error("Error adding email to whitelist:", error);
      res.status(500).json({ message: "Error adding email to whitelist" });
    }
  });

  app.delete("/api/email-whitelist/:email", authMiddleware, async (req, res) => {
    try {
      const email = decodeURIComponent(req.params.email);
      const success = await storage.removeEmailFromWhitelist(email);
      
      if (!success) {
        return res.status(404).json({ message: "Email not found in whitelist" });
      }

      res.json({ message: "Email removed from whitelist successfully" });
    } catch (error) {
      console.error("Error removing email from whitelist:", error);
      res.status(500).json({ message: "Error removing email from whitelist" });
    }
  });

  // URL Content Extraction API endpoint
  app.post("/api/extract-url-content", authMiddleware, async (req, res) => {
    try {
      const { url } = req.body;
      
      if (!url) {
        return res.status(400).json({ message: "URL is required" });
      }

      // Validate URL format
      let validUrl;
      try {
        validUrl = new URL(url);
        if (!['http:', 'https:'].includes(validUrl.protocol)) {
          return res.status(400).json({ message: "Only HTTP and HTTPS URLs are supported" });
        }
      } catch (error) {
        return res.status(400).json({ message: "Invalid URL format" });
      }

      console.log(`Extracting content from URL: ${url}`);
      
      // Fetch the webpage content
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'ModerateAI-Bot/1.0 (+https://moderateai.com)'
        },
        redirect: 'follow',
        timeout: 10000
      });

      if (!response.ok) {
        return res.status(400).json({ 
          message: `Failed to fetch content: ${response.status} ${response.statusText}` 
        });
      }

      const html = await response.text();
      
      // Use node-html-parser to extract content
      const { parse } = await import('node-html-parser');
      const root = parse(html);
      
      // Extract title
      let title = root.querySelector('title')?.text?.trim() || '';
      if (!title) {
        const h1 = root.querySelector('h1')?.text?.trim();
        title = h1 || `Content from ${validUrl.hostname}`;
      }
      
      // Remove script and style tags
      root.querySelectorAll('script, style, nav, footer, header').forEach(el => el.remove());
      
      // Extract main content with better formatting
      let content = '';
      
      // Try to find main content areas first
      const mainSelectors = ['main', 'article', '[role="main"]', '.content', '#content', '.post', '.article'];
      let mainContent = null;
      
      for (const selector of mainSelectors) {
        mainContent = root.querySelector(selector);
        if (mainContent) break;
      }
      
      // If no main content area found, use body but exclude common non-content areas
      if (!mainContent) {
        const bodyContent = root.querySelector('body');
        if (bodyContent) {
          // Remove additional noise elements
          bodyContent.querySelectorAll('header, nav, aside, footer, .nav, .navbar, .menu, .sidebar, .advertisement, .ads').forEach(el => el.remove());
          mainContent = bodyContent;
        } else {
          mainContent = root;
        }
      }
      
      // Extract content with better structure preservation
      if (mainContent) {
        // Get all text-containing elements
        const contentElements = mainContent.querySelectorAll('h1, h2, h3, h4, h5, h6, p, div, li, td, th, blockquote, article, section');
        
        const textParts: string[] = [];
        const processedTexts = new Set<string>();
        
        contentElements.forEach(el => {
          let text = el.text.trim();
          if (text && text.length > 10 && !processedTexts.has(text)) {
            // Check if this text is not already included in a parent element's text
            const isSubtext = textParts.some(existingText => existingText.includes(text));
            if (!isSubtext) {
              processedTexts.add(text);
              textParts.push(text);
            }
          }
        });
        
        // Join with double line breaks for better readability
        content = textParts.join('\n\n');
        
        // Fallback if no structured content found
        if (!content || content.length < 50) {
          content = mainContent.text;
        }
      }
      
      // Clean up the content
      content = content
        .replace(/\s+/g, ' ')  // Replace multiple whitespace with single space
        .replace(/\n\s+/g, '\n')  // Clean up line breaks
        .replace(/\n{3,}/g, '\n\n')  // Limit multiple line breaks to double
        .replace(/([.!?])\s*([A-Z])/g, '$1\n\n$2')  // Add line breaks after sentences that start new topics
        .trim();
      
      // Increase content length limit for more comprehensive extraction
      if (content.length > 20000) {
        content = content.substring(0, 20000) + '\n\n[Content truncated due to length - extracted first 20,000 characters]';
      }
      
      if (!content || content.length < 20) {
        return res.status(400).json({ 
          message: "Could not extract meaningful content from the webpage. The page might be heavily JavaScript-dependent or have restricted access." 
        });
      }
      
      console.log(`Successfully extracted ${content.length} characters from ${url}`);
      
      res.json({ 
        title: title,
        content: content,
        sourceUrl: url,
        extractedAt: new Date().toISOString()
      });
      
    } catch (error: any) {
      console.error("Error extracting URL content:", error);
      
      if (error.name === 'AbortError' || error.code === 'ENOTFOUND') {
        return res.status(400).json({ 
          message: "Could not connect to the website. Please check the URL and try again." 
        });
      }
      
      res.status(500).json({ 
        message: "Failed to extract content from URL",
        error: error.message
      });
    }
  });

  // Test endpoint for relevance detection system
  app.post("/api/test-relevance", authMiddleware, async (req, res) => {
    try {
      const { message, knowledgeBaseId } = req.body;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      if (!message) {
        return res.status(400).json({ message: "Message is required" });
      }

      const { checkMessageRelevance } = await import("./lib/openai");
      const relevanceResult = await checkMessageRelevance(message, userId, knowledgeBaseId);
      
      res.json({
        message,
        userId,
        knowledgeBaseId,
        ...relevanceResult
      });
    } catch (error) {
      console.error("Error testing relevance detection:", error);
      res.status(500).json({ message: "Error testing relevance detection" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
