import { pgTable, text, serial, integer, boolean, timestamp, jsonb, date } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull().default("user"),
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
  status: text("status").notNull().default("active"), // "active", "closed", "archived"
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertConversationSchema = createInsertSchema(conversations).pick({
  platformId: true,
  externalUserId: true,
  externalUsername: true,
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
  moderationStrictness: integer("moderation_strictness").notNull().default(50), // 0-100 scale
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
  moderationStrictness: true,
  isActive: true,
  model: true,
  systemPrompt: true,
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

// Moderation Actions table
export const moderationActions = pgTable("moderation_actions", {
  id: serial("id").primaryKey(),
  platformId: integer("platform_id").notNull().references(() => platforms.id, { onDelete: "cascade" }),
  conversationId: integer("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
  messageId: integer("message_id").references(() => messages.id, { onDelete: "set null" }),
  action: text("action").notNull(), // "delete", "warn", "ban", "flag", etc.
  reason: text("reason"),
  automatic: boolean("automatic").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertModerationActionSchema = createInsertSchema(moderationActions).pick({
  platformId: true,
  conversationId: true,
  messageId: true,
  action: true,
  reason: true,
  automatic: true,
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

// Define relations
export const usersRelations = relations(users, ({ many }) => ({
  platforms: many(platforms),
  aiConfigurations: many(aiConfigurations),
  knowledgeBases: many(knowledgeBases),
  conversationTrainings: many(conversationTrainings)
}));

export const platformsRelations = relations(platforms, ({ one, many }) => ({
  user: one(users, {
    fields: [platforms.userId],
    references: [users.id]
  }),
  conversations: many(conversations),
  moderationActions: many(moderationActions),
  conversationTrainings: many(conversationTrainings)
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  platform: one(platforms, {
    fields: [conversations.platformId],
    references: [platforms.id]
  }),
  messages: many(messages),
  moderationActions: many(moderationActions)
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id]
  }),
  moderationActions: many(moderationActions, { relationName: "message_moderation" })
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

export const moderationActionsRelations = relations(moderationActions, ({ one }) => ({
  platform: one(platforms, {
    fields: [moderationActions.platformId],
    references: [platforms.id]
  }),
  conversation: one(conversations, {
    fields: [moderationActions.conversationId],
    references: [conversations.id]
  }),
  message: one(messages, {
    fields: [moderationActions.messageId],
    references: [messages.id],
    relationName: "message_moderation"
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

export type ModerationAction = typeof moderationActions.$inferSelect;
export type InsertModerationAction = z.infer<typeof insertModerationActionSchema>;

export type KnowledgeDocument = typeof knowledgeDocuments.$inferSelect;
export type InsertKnowledgeDocument = z.infer<typeof insertKnowledgeDocumentSchema>;
