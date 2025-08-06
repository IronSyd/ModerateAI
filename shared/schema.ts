import { pgTable, text, serial, integer, boolean, timestamp, jsonb, date, uuid, json, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(), // Deprecated - use passwordHash/passwordSalt
  passwordHash: text("password_hash"),
  passwordSalt: text("password_salt"),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull().default("user"),
  isActive: boolean("is_active").notNull().default(true),
  requireTwoFactor: boolean("require_two_factor").notNull().default(false),
  twoFactorCode: text("two_factor_code"),
  twoFactorCodeExpiry: timestamp("two_factor_code_expiry"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  fullName: true,
  role: true,
});

// Platforms table
export const platforms = pgTable("platforms", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // "website", "telegram", "discord"
  name: text("name").notNull(),
  status: text("status").notNull(), // "active", "inactive", "setup_required", "not_connected"
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  config: jsonb("config"), // Platform-specific configuration
  authToken: text("auth_token"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPlatformSchema = createInsertSchema(platforms).pick({
  type: true,
  name: true,
  status: true,
  userId: true,
  config: true,
  authToken: true,
});

// Conversations table
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  platformId: integer("platform_id").notNull().references(() => platforms.id, { onDelete: "cascade" }),
  externalUserId: text("external_user_id").notNull(), // User ID from the external platform
  externalUsername: text("external_username"), // Username from the external platform
  externalId: text("external_id"), // External ID (like channel ID for Discord)
  status: text("status").notNull().default("active"), // "active", "closed", "archived"
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertConversationSchema = createInsertSchema(conversations).pick({
  platformId: true,
  externalUserId: true,
  externalUsername: true,
  externalId: true,
  status: true,
});

// Messages table
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  sender: text("sender").notNull(), // "user", "ai", "system"
  createdAt: timestamp("created_at").notNull().defaultNow(),
  metadata: jsonb("metadata"), // Additional message metadata
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  conversationId: true,
  content: true,
  sender: true,
  metadata: true,
});

// AI Configurations table
export const aiConfigurations = pgTable("ai_configurations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  responseStyle: integer("response_style").notNull().default(75), // 0-100 scale
  responseLength: integer("response_length").notNull().default(40), // 0-100 scale

  isActive: boolean("is_active").notNull().default(true),
  model: text("model").notNull().default("gpt-4o"),
  systemPrompt: text("system_prompt"),
  enableProactiveResponses: boolean("enable_proactive_responses").default(false),
  enableConversationMemory: boolean("enable_conversation_memory").default(true),
  enableSentimentAnalysis: boolean("enable_sentiment_analysis").default(true),
  enableConversationTraining: boolean("enable_conversation_training").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAiConfigurationSchema = createInsertSchema(aiConfigurations).pick({
  userId: true,
  name: true,
  responseStyle: true,
  responseLength: true,

  isActive: true,
  model: true,
  systemPrompt: true,
  enableProactiveResponses: true,
  enableConversationMemory: true,
  enableSentimentAnalysis: true,
  enableConversationTraining: true,
});

// Knowledge Base table
export const knowledgeBases = pgTable("knowledge_bases", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  documentCount: integer("document_count").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertKnowledgeBaseSchema = createInsertSchema(knowledgeBases).pick({
  userId: true,
  name: true,
  description: true,
  documentCount: true,
  isActive: true,
});

// Knowledge Documents table - stores content for AI to reference
export const knowledgeDocuments = pgTable("knowledge_documents", {
  id: serial("id").primaryKey(),
  knowledgeBaseId: integer("knowledge_base_id").notNull().references(() => knowledgeBases.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  metadata: jsonb("metadata"), // Additional document metadata (source URL, type, tags, etc.)
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertKnowledgeDocumentSchema = createInsertSchema(knowledgeDocuments).pick({
  knowledgeBaseId: true,
  title: true,
  content: true,
  metadata: true,
});



// Conversation Training table - tracks AI training on conversation data
export const conversationTrainings = pgTable("conversation_trainings", {
  id: serial("id").primaryKey(),
  platformId: integer("platform_id").notNull().references(() => platforms.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"), // pending, in_progress, completed, failed
  totalConversations: integer("total_conversations").notNull().default(0),
  processedConversations: integer("processed_conversations").notNull().default(0),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  lastTrainedConversationId: integer("last_trained_conversation_id"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertConversationTrainingSchema = createInsertSchema(conversationTrainings).pick({
  platformId: true,
  userId: true,
  status: true,
  totalConversations: true,
  startedAt: true,
});

// Team Invitations table
export const teamInvitations = pgTable("team_invitations", {
  id: serial("id").primaryKey(),
  token: uuid("token").notNull().defaultRandom(),
  email: text("email").notNull(),
  role: text("role").notNull(),
  invitedBy: integer("invited_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"), // pending, accepted, expired, canceled
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
});

export const insertTeamInvitationSchema = createInsertSchema(teamInvitations).pick({
  email: true,
  role: true,
  invitedBy: true,
  expiresAt: true,
});

// Define relations
export const usersRelations = relations(users, ({ many, one }) => ({
  platforms: many(platforms),
  aiConfigurations: many(aiConfigurations),
  knowledgeBases: many(knowledgeBases),
  conversationTrainings: many(conversationTrainings),
  sentInvitations: many(teamInvitations, { relationName: "sent_invitations" }),
  teamSettings: many(teamSettings)
}));

export const platformsRelations = relations(platforms, ({ one, many }) => ({
  user: one(users, {
    fields: [platforms.userId],
    references: [users.id]
  }),
  conversations: many(conversations),
  conversationTrainings: many(conversationTrainings),
  chatConfigurations: many(chatConfigurations)
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  platform: one(platforms, {
    fields: [conversations.platformId],
    references: [platforms.id]
  }),
  messages: many(messages),

}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id]
  }),

}));

export const aiConfigurationsRelations = relations(aiConfigurations, ({ one }) => ({
  user: one(users, {
    fields: [aiConfigurations.userId],
    references: [users.id]
  })
}));

export const knowledgeBasesRelations = relations(knowledgeBases, ({ one, many }) => ({
  user: one(users, {
    fields: [knowledgeBases.userId],
    references: [users.id]
  }),
  documents: many(knowledgeDocuments)
}));

export const knowledgeDocumentsRelations = relations(knowledgeDocuments, ({ one }) => ({
  knowledgeBase: one(knowledgeBases, {
    fields: [knowledgeDocuments.knowledgeBaseId],
    references: [knowledgeBases.id]
  })
}));



export const conversationTrainingsRelations = relations(conversationTrainings, ({ one }) => ({
  platform: one(platforms, {
    fields: [conversationTrainings.platformId],
    references: [platforms.id]
  }),
  user: one(users, {
    fields: [conversationTrainings.userId],
    references: [users.id]
  })
}));

export const teamInvitationsRelations = relations(teamInvitations, ({ one }) => ({
  inviter: one(users, {
    fields: [teamInvitations.invitedBy],
    references: [users.id],
    relationName: "sent_invitations"
  })
}));

// Chat Configurations table - for group/chat specific settings
export const chatConfigurations = pgTable("chat_configurations", {
  id: serial("id").primaryKey(),
  platformId: integer("platform_id").notNull().references(() => platforms.id, { onDelete: "cascade" }),
  externalId: text("external_id").notNull(), // Telegram chat ID or Discord channel ID
  chatType: text("chat_type").notNull(), // "group", "private", "channel"
  chatName: text("chat_name"), // Group/channel name for display
  aiConfigurationId: integer("ai_configuration_id").references(() => aiConfigurations.id, { onDelete: "set null" }),
  knowledgeBaseId: integer("knowledge_base_id").references(() => knowledgeBases.id, { onDelete: "set null" }),
  settings: jsonb("settings").notNull().default({
    groupMode: true,
    privateChatMode: true,
    mentionOnly: false,
    contentFilteringEnabled: true,
    spamProtectionEnabled: true,
    welcomeMessage: null
  }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Remove the separate index table since we can define it directly in the main table

export const insertChatConfigurationSchema = createInsertSchema(chatConfigurations).pick({
  platformId: true,
  externalId: true,
  chatType: true,
  chatName: true,
  aiConfigurationId: true,
  knowledgeBaseId: true,
  settings: true,
  isActive: true,
});

// Website Configurations table - for managing multiple website instances
export const websiteConfigurations = pgTable("website_configurations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // Display name for this website instance
  domain: text("domain"), // Website domain (optional)
  authToken: text("auth_token").notNull().unique(), // Unique token for this website instance
  aiConfigurationId: integer("ai_configuration_id").references(() => aiConfigurations.id, { onDelete: "set null" }),
  knowledgeBaseId: integer("knowledge_base_id").references(() => knowledgeBases.id, { onDelete: "set null" }),
  config: jsonb("config").notNull().default({
    widgetTitle: "Chat with us",
    welcomeMessage: "Hi there! How can I help you today?",
    primaryColor: "#3B82F6",
    position: "bottom-right",
    allowFileUploads: false,
    collectVisitorInfo: true,
    showTypingIndicator: true,
    autoOpenDelay: 3000
  }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertWebsiteConfigurationSchema = createInsertSchema(websiteConfigurations).pick({
  userId: true,
  name: true,
  domain: true,
  authToken: true,
  aiConfigurationId: true,
  knowledgeBaseId: true,
  config: true,
  isActive: true,
});

// Team Settings table
export const teamSettings = pgTable("team_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull().default("ModerateAI Team"),
  securitySettings: jsonb("security_settings").notNull().default({
    twoFactorRequired: false,
    sessionTimeoutMinutes: 60
  }),
  notificationSettings: jsonb("notification_settings").notNull().default({
    newMemberNotifications: true,
    criticalAlertNotifications: true,
    weeklyActivitySummary: true
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTeamSettingsSchema = createInsertSchema(teamSettings).pick({
  userId: true,
  name: true,
  securitySettings: true,
  notificationSettings: true,
});

export const chatConfigurationsRelations = relations(chatConfigurations, ({ one }) => ({
  platform: one(platforms, {
    fields: [chatConfigurations.platformId],
    references: [platforms.id]
  }),
  aiConfiguration: one(aiConfigurations, {
    fields: [chatConfigurations.aiConfigurationId],
    references: [aiConfigurations.id]
  }),
  knowledgeBase: one(knowledgeBases, {
    fields: [chatConfigurations.knowledgeBaseId],
    references: [knowledgeBases.id]
  })
}));

export const teamSettingsRelations = relations(teamSettings, ({ one }) => ({
  user: one(users, {
    fields: [teamSettings.userId],
    references: [users.id],
  })
}));

export const websiteConfigurationsRelations = relations(websiteConfigurations, ({ one }) => ({
  user: one(users, {
    fields: [websiteConfigurations.userId],
    references: [users.id]
  }),
  aiConfiguration: one(aiConfigurations, {
    fields: [websiteConfigurations.aiConfigurationId],
    references: [aiConfigurations.id]
  }),
  knowledgeBase: one(knowledgeBases, {
    fields: [websiteConfigurations.knowledgeBaseId],
    references: [knowledgeBases.id]
  })
}));

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Platform = typeof platforms.$inferSelect;
export type InsertPlatform = z.infer<typeof insertPlatformSchema>;

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type AiConfiguration = typeof aiConfigurations.$inferSelect;
export type InsertAiConfiguration = z.infer<typeof insertAiConfigurationSchema>;

export type KnowledgeBase = typeof knowledgeBases.$inferSelect;
export type InsertKnowledgeBase = z.infer<typeof insertKnowledgeBaseSchema>;

// ModerationAction types removed - table not defined yet

export type KnowledgeDocument = typeof knowledgeDocuments.$inferSelect;
export type InsertKnowledgeDocument = z.infer<typeof insertKnowledgeDocumentSchema>;

export type ConversationTraining = typeof conversationTrainings.$inferSelect;
export type InsertConversationTraining = z.infer<typeof insertConversationTrainingSchema>;

export type TeamInvitation = typeof teamInvitations.$inferSelect;
export type InsertTeamInvitation = z.infer<typeof insertTeamInvitationSchema>;

export type TeamSettings = typeof teamSettings.$inferSelect;
export type InsertTeamSettings = z.infer<typeof insertTeamSettingsSchema>;

export type ChatConfiguration = typeof chatConfigurations.$inferSelect;
export type InsertChatConfiguration = z.infer<typeof insertChatConfigurationSchema>;

export type WebsiteConfiguration = typeof websiteConfigurations.$inferSelect;
export type InsertWebsiteConfiguration = z.infer<typeof insertWebsiteConfigurationSchema>;
