import { pgTable, text, varchar, serial, integer, boolean, timestamp, jsonb, date, uuid, json, index, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Sessions table (connect-pg-simple) - managed by the session store, but kept here so
// `drizzle-kit push` doesn't treat it as an extraneous table and attempt to drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: json("sess").notNull(),
    expire: timestamp("expire", { precision: 6 }).notNull(),
  },
  (table) => ({
    expireIdx: index("IDX_session_expire").on(table.expire),
  }),
);

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password"),
  fullName: text("full_name").notNull(),
  // Password recovery flags (no-email, admin-issued temporary password flow)
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  temporaryPasswordIssuedAt: timestamp("temporary_password_issued_at"),
  temporaryPasswordExpiresAt: timestamp("temporary_password_expires_at"),
  temporaryPasswordIssuedBy: integer("temporary_password_issued_by"),
  // Subscription fields (manual billing for now)
  plan: text("plan").notNull().default("free"), // free | standard | pro
  planStatus: text("plan_status").notNull().default("active"), // active | trialing | past_due | canceled
  // When the user first started a free trial (only allowed once per account).
  trialStartedAt: timestamp("trial_started_at"),
  trialEndsAt: timestamp("trial_ends_at"),
  // Set once the user has explicitly picked a tier in onboarding.
  planSelectedAt: timestamp("plan_selected_at"),
  planUpdatedAt: timestamp("plan_updated_at").notNull().defaultNow(),
  // Manual billing control (no Stripe yet)
  // If set, the subscription is considered paid/valid through this timestamp.
  paidThroughAt: timestamp("paid_through_at"),
  // Distinct from `isActive`/`isBanned`: used to suspend access due to billing only.
  billingSuspendedAt: timestamp("billing_suspended_at"),
  billingSuspendedReason: text("billing_suspended_reason"),
  // User ID of the admin/owner who suspended or reinstated billing (nullable; system actions may leave this null).
  billingSuspendedBy: integer("billing_suspended_by"),
  role: text("role").notNull().default("user"),
  // Workspace membership:
  // - workspace owners have `workspaceOwnerId = null` and implicitly act as workspace admins
  // - team members have `workspaceOwnerId = <owner user id>` and `workspaceRole` controls permissions
  workspaceOwnerId: integer("workspace_owner_id"),
  workspaceRole: text("workspace_role").notNull().default("admin"), // viewer | moderator | admin
  isActive: boolean("is_active").notNull().default(true),
  isBanned: boolean("is_banned").notNull().default(false),
  bannedAt: timestamp("banned_at"),
  banReason: text("ban_reason"),
  requireTwoFactor: boolean("require_two_factor").notNull().default(false),
  twoFactorCode: text("two_factor_code"),
  twoFactorCodeExpiry: timestamp("two_factor_code_expiry"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
  fullName: true,
  role: true,
});

// Email whitelist table
export const emailWhitelist = pgTable("email_whitelist", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  addedBy: integer("added_by").references(() => users.id),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertEmailWhitelistSchema = createInsertSchema(emailWhitelist).pick({
  email: true,
  addedBy: true,
  isActive: true,
});

// Platforms table
export const platforms = pgTable("platforms", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // "website", "telegram", "discord"
  name: text("name").notNull(),
  status: text("status").notNull(), // "active", "inactive", "setup_required", "not_connected"
  botOwnershipMode: text("bot_ownership_mode").notNull().default("app_owned"), // app_owned | byob
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  config: jsonb("config"), // Platform-specific configuration
  authToken: text("auth_token"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPlatformSchema = createInsertSchema(platforms).pick({
  type: true,
  name: true,
  status: true,
  botOwnershipMode: true,
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

// Moderation Actions table - first-class moderation audit/analytics events
export const moderationActions = pgTable(
  "moderation_actions",
  {
    id: serial("id").primaryKey(),
    ownerUserId: integer("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    platformId: integer("platform_id").notNull().references(() => platforms.id, { onDelete: "cascade" }),
    conversationId: integer("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
    messageId: integer("message_id").references(() => messages.id, { onDelete: "set null" }),
    platformType: text("platform_type").notNull(), // telegram | discord | website
    action: text("action").notNull(), // content_filtered | spam_blocked | warning_issued | message_deleted
    ruleSource: text("rule_source").notNull(), // baseline_filter | custom_rule | ai_automation | spam_heuristic | manual
    reason: text("reason"),
    automatic: boolean("automatic").notNull().default(true),
    actorUserId: integer("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    ownerCreatedIdx: index("moderation_actions_owner_created_idx").on(table.ownerUserId, table.createdAt),
    platformCreatedIdx: index("moderation_actions_platform_created_idx").on(table.platformId, table.createdAt),
    actionIdx: index("moderation_actions_action_idx").on(table.action),
  }),
);

export const insertModerationActionSchema = createInsertSchema(moderationActions).pick({
  ownerUserId: true,
  platformId: true,
  conversationId: true,
  messageId: true,
  platformType: true,
  action: true,
  ruleSource: true,
  reason: true,
  automatic: true,
  actorUserId: true,
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

// Managed URL crawl/sync sources for knowledge bases
export const knowledgeUrlSources = pgTable(
  "knowledge_url_sources",
  {
    id: serial("id").primaryKey(),
    knowledgeBaseId: integer("knowledge_base_id")
      .notNull()
      .references(() => knowledgeBases.id, { onDelete: "cascade" }),
    workspaceOwnerId: integer("workspace_owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name"),
    seedUrl: text("seed_url").notNull(),
    host: text("host").notNull(),
    pathPrefix: text("path_prefix").notNull(),
    status: text("status").notNull().default("active"), // active | paused | error
    syncMode: text("sync_mode").notNull().default("manual"), // manual | scheduled
    scheduleRecurrence: text("schedule_recurrence"), // daily | weekly
    scheduleDaysOfWeek: integer("schedule_days_of_week").array(),
    scheduleTime: text("schedule_time"), // HH:mm
    scheduleTimezone: text("schedule_timezone"),
    lastRunAt: timestamp("last_run_at"),
    lastSuccessAt: timestamp("last_success_at"),
    lastRunStatus: text("last_run_status"), // success | partial | failed
    lastError: text("last_error"),
    createdByUserId: integer("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    updatedByUserId: integer("updated_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    kbStatusIdx: index("knowledge_url_sources_kb_status_idx").on(table.knowledgeBaseId, table.status),
    ownerStatusIdx: index("knowledge_url_sources_owner_status_idx").on(table.workspaceOwnerId, table.status),
    syncModeStatusIdx: index("knowledge_url_sources_sync_mode_status_idx").on(table.syncMode, table.status),
    kbHostPrefixUniqueIdx: uniqueIndex("knowledge_url_sources_kb_host_path_prefix_unique").on(
      table.knowledgeBaseId,
      table.host,
      table.pathPrefix,
    ),
  }),
);

export const insertKnowledgeUrlSourceSchema = createInsertSchema(knowledgeUrlSources).pick({
  knowledgeBaseId: true,
  workspaceOwnerId: true,
  name: true,
  seedUrl: true,
  host: true,
  pathPrefix: true,
  status: true,
  syncMode: true,
  scheduleRecurrence: true,
  scheduleDaysOfWeek: true,
  scheduleTime: true,
  scheduleTimezone: true,
  lastRunAt: true,
  lastSuccessAt: true,
  lastRunStatus: true,
  lastError: true,
  createdByUserId: true,
  updatedByUserId: true,
});

export const knowledgeUrlSyncRuns = pgTable(
  "knowledge_url_sync_runs",
  {
    id: serial("id").primaryKey(),
    sourceId: integer("source_id")
      .notNull()
      .references(() => knowledgeUrlSources.id, { onDelete: "cascade" }),
    knowledgeBaseId: integer("knowledge_base_id")
      .notNull()
      .references(() => knowledgeBases.id, { onDelete: "cascade" }),
    workspaceOwnerId: integer("workspace_owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    triggeredByUserId: integer("triggered_by_user_id").references(() => users.id, { onDelete: "set null" }),
    triggerType: text("trigger_type").notNull(), // manual | scheduled
    status: text("status").notNull().default("queued"), // queued | running | success | partial | failed
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    pagesDiscovered: integer("pages_discovered").notNull().default(0),
    pagesFetched: integer("pages_fetched").notNull().default(0),
    pagesCreated: integer("pages_created").notNull().default(0),
    pagesUpdated: integer("pages_updated").notNull().default(0),
    pagesUnchanged: integer("pages_unchanged").notNull().default(0),
    pagesMarkedStale: integer("pages_marked_stale").notNull().default(0),
    pagesSkipped: integer("pages_skipped").notNull().default(0),
    errorsCount: integer("errors_count").notNull().default(0),
    warningsCount: integer("warnings_count").notNull().default(0),
    summary: jsonb("summary"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    sourceCreatedIdx: index("knowledge_url_sync_runs_source_created_idx").on(table.sourceId, table.createdAt),
    ownerCreatedIdx: index("knowledge_url_sync_runs_owner_created_idx").on(table.workspaceOwnerId, table.createdAt),
    statusCreatedIdx: index("knowledge_url_sync_runs_status_created_idx").on(table.status, table.createdAt),
  }),
);

export const insertKnowledgeUrlSyncRunSchema = createInsertSchema(knowledgeUrlSyncRuns).pick({
  sourceId: true,
  knowledgeBaseId: true,
  workspaceOwnerId: true,
  triggeredByUserId: true,
  triggerType: true,
  status: true,
  startedAt: true,
  completedAt: true,
  pagesDiscovered: true,
  pagesFetched: true,
  pagesCreated: true,
  pagesUpdated: true,
  pagesUnchanged: true,
  pagesMarkedStale: true,
  pagesSkipped: true,
  errorsCount: true,
  warningsCount: true,
  summary: true,
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
  // Workspace this invitation belongs to (the inviter's workspace owner).
  workspaceOwnerId: integer("workspace_owner_id").references(() => users.id, { onDelete: "set null" }),
  status: text("status").notNull().default("pending"), // pending, accepted, expired, canceled
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
});

export const insertTeamInvitationSchema = createInsertSchema(teamInvitations).pick({
  email: true,
  role: true,
  invitedBy: true,
  workspaceOwnerId: true,
  expiresAt: true,
});

// One-time destination claim codes for app-owned platform integrations.
export const integrationClaimCodes = pgTable(
  "integration_claim_codes",
  {
    id: serial("id").primaryKey(),
    platformId: integer("platform_id").notNull().references(() => platforms.id, { onDelete: "cascade" }),
    workspaceOwnerId: integer("workspace_owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    platformType: text("platform_type").notNull(), // telegram | discord
    code: text("code").notNull().unique(),
    createdByUserId: integer("created_by_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    usedExternalId: text("used_external_id"),
    usedByPlatformUserId: text("used_by_platform_user_id"),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    platformActiveIdx: index("integration_claim_codes_platform_active_idx").on(
      table.platformId,
      table.usedAt,
      table.revokedAt,
      table.expiresAt,
    ),
    codeIdx: index("integration_claim_codes_code_idx").on(table.code),
  }),
);

export const insertIntegrationClaimCodeSchema = createInsertSchema(integrationClaimCodes).pick({
  platformId: true,
  workspaceOwnerId: true,
  platformType: true,
  code: true,
  createdByUserId: true,
  expiresAt: true,
  usedAt: true,
  usedExternalId: true,
  usedByPlatformUserId: true,
  revokedAt: true,
});

// Define relations
export const usersRelations = relations(users, ({ many, one }) => ({
  platforms: many(platforms),
  aiConfigurations: many(aiConfigurations),
  knowledgeBases: many(knowledgeBases),
  moderationActions: many(moderationActions),
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
  moderationActions: many(moderationActions),
  conversationTrainings: many(conversationTrainings),
  chatConfigurations: many(chatConfigurations),
  integrationClaimCodes: many(integrationClaimCodes),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  platform: one(platforms, {
    fields: [conversations.platformId],
    references: [platforms.id]
  }),
  messages: many(messages),
  moderationActions: many(moderationActions),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id]
  }),
  moderationActions: many(moderationActions),
}));

export const moderationActionsRelations = relations(moderationActions, ({ one }) => ({
  owner: one(users, {
    fields: [moderationActions.ownerUserId],
    references: [users.id],
  }),
  platform: one(platforms, {
    fields: [moderationActions.platformId],
    references: [platforms.id],
  }),
  conversation: one(conversations, {
    fields: [moderationActions.conversationId],
    references: [conversations.id],
  }),
  message: one(messages, {
    fields: [moderationActions.messageId],
    references: [messages.id],
  }),
  actor: one(users, {
    fields: [moderationActions.actorUserId],
    references: [users.id],
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
  documents: many(knowledgeDocuments),
  urlSources: many(knowledgeUrlSources),
}));

export const knowledgeDocumentsRelations = relations(knowledgeDocuments, ({ one }) => ({
  knowledgeBase: one(knowledgeBases, {
    fields: [knowledgeDocuments.knowledgeBaseId],
    references: [knowledgeBases.id]
  })
}));

export const knowledgeUrlSourcesRelations = relations(knowledgeUrlSources, ({ one, many }) => ({
  knowledgeBase: one(knowledgeBases, {
    fields: [knowledgeUrlSources.knowledgeBaseId],
    references: [knowledgeBases.id],
  }),
  workspaceOwner: one(users, {
    fields: [knowledgeUrlSources.workspaceOwnerId],
    references: [users.id],
  }),
  createdBy: one(users, {
    fields: [knowledgeUrlSources.createdByUserId],
    references: [users.id],
    relationName: "knowledge_url_source_created_by",
  }),
  updatedBy: one(users, {
    fields: [knowledgeUrlSources.updatedByUserId],
    references: [users.id],
    relationName: "knowledge_url_source_updated_by",
  }),
  runs: many(knowledgeUrlSyncRuns),
}));

export const knowledgeUrlSyncRunsRelations = relations(knowledgeUrlSyncRuns, ({ one }) => ({
  source: one(knowledgeUrlSources, {
    fields: [knowledgeUrlSyncRuns.sourceId],
    references: [knowledgeUrlSources.id],
  }),
  knowledgeBase: one(knowledgeBases, {
    fields: [knowledgeUrlSyncRuns.knowledgeBaseId],
    references: [knowledgeBases.id],
  }),
  workspaceOwner: one(users, {
    fields: [knowledgeUrlSyncRuns.workspaceOwnerId],
    references: [users.id],
  }),
  triggeredBy: one(users, {
    fields: [knowledgeUrlSyncRuns.triggeredByUserId],
    references: [users.id],
  }),
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

export const integrationClaimCodesRelations = relations(integrationClaimCodes, ({ one }) => ({
  platform: one(platforms, {
    fields: [integrationClaimCodes.platformId],
    references: [platforms.id],
  }),
  workspaceOwner: one(users, {
    fields: [integrationClaimCodes.workspaceOwnerId],
    references: [users.id],
  }),
  createdBy: one(users, {
    fields: [integrationClaimCodes.createdByUserId],
    references: [users.id],
  }),
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
    enableHistoryLearning: false,
    adminLearningMode: false
  }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Chat History table - for storing admin messages for training
export const chatHistory = pgTable("chat_history", {
  id: serial("id").primaryKey(),
  chatConfigurationId: integer("chat_configuration_id").notNull().references(() => chatConfigurations.id, { onDelete: "cascade" }),
  platformId: integer("platform_id").notNull().references(() => platforms.id, { onDelete: "cascade" }),
  sourceMessageId: integer("source_message_id").references(() => messages.id, { onDelete: "set null" }),
  externalUserId: text("external_user_id").notNull(), // User ID from platform
  externalUsername: text("external_username"), // Username from platform
  messageId: text("message_id"), // External message ID
  content: text("content").notNull(),
  messageType: text("message_type").notNull().default("user"), // "user", "admin", "bot", "system"
  isAdmin: boolean("is_admin").notNull().default(false),
  replyToMessageId: text("reply_to_message_id"), // If this is a reply
  threadContext: jsonb("thread_context"), // Store conversation thread for context
  metadata: jsonb("metadata"), // Additional platform-specific data
  sentAt: timestamp("sent_at").notNull(), // When message was sent on platform
  isUsedForTraining: boolean("is_used_for_training").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Training Insights table - for storing learned patterns
export const trainingInsights = pgTable("training_insights", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  chatConfigurationId: integer("chat_configuration_id").references(() => chatConfigurations.id, { onDelete: "cascade" }),
  insightType: text("insight_type").notNull(), // "response_pattern", "topic_preference", "conversation_style", "admin_behavior"
  pattern: text("pattern").notNull(), // The learned pattern or behavior
  context: jsonb("context"), // Contextual information about when this pattern applies
  confidence: integer("confidence").notNull().default(50), // 0-100 confidence score
  usageCount: integer("usage_count").notNull().default(0), // How many times this pattern has been applied
  successRate: integer("success_rate").notNull().default(0), // 0-100 success rate when applied
  isActive: boolean("is_active").notNull().default(true),
  learnedFrom: text("learned_from"), // "admin_history", "user_feedback", "conversation_analysis"
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

export const destinationLocks = pgTable(
  "destination_locks",
  {
    id: serial("id").primaryKey(),
    chatConfigurationId: integer("chat_configuration_id")
      .notNull()
      .references(() => chatConfigurations.id, { onDelete: "cascade" }),
    platformId: integer("platform_id")
      .notNull()
      .references(() => platforms.id, { onDelete: "cascade" }),
    platformType: text("platform_type").notNull(), // telegram | discord
    destinationExternalId: text("destination_external_id").notNull(),
    status: text("status").notNull().default("active"), // active | released | failed
    source: text("source").notNull(), // manual_app | manual_chat | auto
    reason: text("reason"),
    requestedByUserId: integer("requested_by_user_id").references(() => users.id, { onDelete: "set null" }),
    requestedByPlatformUserId: text("requested_by_platform_user_id"),
    requestedByPlatformUsername: text("requested_by_platform_username"),
    startedAt: timestamp("started_at").notNull(),
    endsAt: timestamp("ends_at").notNull(),
    releasedAt: timestamp("released_at"),
    releaseReason: text("release_reason"),
    permissionSnapshot: jsonb("permission_snapshot").notNull().default({}),
    noticeChannelExternalId: text("notice_channel_external_id"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    chatStatusIdx: index("destination_locks_chat_status_idx").on(table.chatConfigurationId, table.status),
    platformStatusEndsIdx: index("destination_locks_platform_status_ends_idx").on(
      table.platformId,
      table.status,
      table.endsAt,
    ),
    statusEndsIdx: index("destination_locks_status_ends_idx").on(table.status, table.endsAt),
  }),
);

export const insertDestinationLockSchema = createInsertSchema(destinationLocks).pick({
  chatConfigurationId: true,
  platformId: true,
  platformType: true,
  destinationExternalId: true,
  status: true,
  source: true,
  reason: true,
  requestedByUserId: true,
  requestedByPlatformUserId: true,
  requestedByPlatformUsername: true,
  startedAt: true,
  endsAt: true,
  releasedAt: true,
  releaseReason: true,
  permissionSnapshot: true,
  noticeChannelExternalId: true,
  metadata: true,
});

export const destinationModerationHits = pgTable(
  "destination_moderation_hits",
  {
    id: serial("id").primaryKey(),
    chatConfigurationId: integer("chat_configuration_id")
      .notNull()
      .references(() => chatConfigurations.id, { onDelete: "cascade" }),
    platformId: integer("platform_id")
      .notNull()
      .references(() => platforms.id, { onDelete: "cascade" }),
    platformType: text("platform_type").notNull(), // telegram | discord
    destinationExternalId: text("destination_external_id").notNull(),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    chatCreatedIdx: index("destination_moderation_hits_chat_created_idx").on(table.chatConfigurationId, table.createdAt),
    platformCreatedIdx: index("destination_moderation_hits_platform_created_idx").on(table.platformId, table.createdAt),
  }),
);

export const insertDestinationModerationHitSchema = createInsertSchema(destinationModerationHits).pick({
  chatConfigurationId: true,
  platformId: true,
  platformType: true,
  destinationExternalId: true,
  metadata: true,
});

export const insertChatHistorySchema = createInsertSchema(chatHistory).pick({
  chatConfigurationId: true,
  platformId: true,
  sourceMessageId: true,
  externalUserId: true,
  externalUsername: true,
  messageId: true,
  content: true,
  messageType: true,
  isAdmin: true,
  replyToMessageId: true,
  threadContext: true,
  metadata: true,
  sentAt: true,
  isUsedForTraining: true,
});

export const insertTrainingInsightsSchema = createInsertSchema(trainingInsights).pick({
  userId: true,
  chatConfigurationId: true,
  insightType: true,
  pattern: true,
  context: true,
  confidence: true,
  usageCount: true,
  successRate: true,
  isActive: true,
  learnedFrom: true,
});

// Internal corrections/overrides for immutable AI messages
export const messageCorrections = pgTable(
  "message_corrections",
  {
    id: serial("id").primaryKey(),
    messageId: integer("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" })
      .unique(),
    conversationId: integer("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    platformId: integer("platform_id")
      .notNull()
      .references(() => platforms.id, { onDelete: "cascade" }),
    workspaceOwnerId: integer("workspace_owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    correctedContent: text("corrected_content").notNull(),
    annotation: text("annotation"),
    status: text("status").notNull().default("draft"), // draft | approved
    approvedForLearningAt: timestamp("approved_for_learning_at"),
    approvedByUserId: integer("approved_by_user_id").references(() => users.id, { onDelete: "set null" }),
    trainingInsightId: integer("training_insight_id").references(() => trainingInsights.id, { onDelete: "set null" }),
    chatConfigurationId: integer("chat_configuration_id").references(() => chatConfigurations.id, { onDelete: "set null" }),
    sourceMetadata: jsonb("source_metadata"),
    createdByUserId: integer("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    updatedByUserId: integer("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    workspaceCreatedIdx: index("message_corrections_workspace_created_idx").on(table.workspaceOwnerId, table.createdAt),
    conversationIdx: index("message_corrections_conversation_idx").on(table.conversationId),
    statusApprovedIdx: index("message_corrections_status_approved_idx").on(table.status, table.approvedForLearningAt),
  }),
);

export const insertMessageCorrectionSchema = createInsertSchema(messageCorrections).pick({
  messageId: true,
  conversationId: true,
  platformId: true,
  workspaceOwnerId: true,
  correctedContent: true,
  annotation: true,
  status: true,
  approvedForLearningAt: true,
  approvedByUserId: true,
  trainingInsightId: true,
  chatConfigurationId: true,
  sourceMetadata: true,
  createdByUserId: true,
  updatedByUserId: true,
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

// Website Leads table - captured from embeddable website widget forms
export const websiteLeads = pgTable("website_leads", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  platformId: integer("platform_id").notNull().references(() => platforms.id, { onDelete: "cascade" }),
  sessionId: text("session_id"),
  fullName: text("full_name"),
  email: text("email"),
  phone: text("phone"),
  company: text("company"),
  notes: text("notes"),
  sourceUrl: text("source_url"),
  sourceTitle: text("source_title"),
  status: text("status").notNull().default("new"), // new | contacted | qualified | converted | disqualified | spam
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertWebsiteLeadSchema = createInsertSchema(websiteLeads).pick({
  userId: true,
  platformId: true,
  sessionId: true,
  fullName: true,
  email: true,
  phone: true,
  company: true,
  notes: true,
  sourceUrl: true,
  sourceTitle: true,
  status: true,
  metadata: true,
});

// Widget rate-limit counters (distributed across instances via Postgres)
export const widgetRateLimits = pgTable("widget_rate_limits", {
  key: text("key").primaryKey(),
  scope: text("scope").notNull(), // bootstrap | chat | lead
  count: integer("count").notNull().default(0),
  windowStart: timestamp("window_start").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Auth rate-limit counters for login/signup throttling.
export const authRateLimits = pgTable(
  "auth_rate_limits",
  {
    key: text("key").primaryKey(),
    scope: text("scope").notNull(), // login | signup
    count: integer("count").notNull().default(0),
    windowStart: timestamp("window_start").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    expiresIdx: index("idx_auth_rate_limits_expires_at").on(table.expiresAt),
  }),
);

// Workspace audit trail events (owner-scoped).
export const auditEvents = pgTable(
  "audit_events",
  {
    id: serial("id").primaryKey(),
    ownerUserId: integer("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    actorUserId: integer("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    details: jsonb("details").notNull().default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    ownerCreatedIdx: index("audit_events_owner_created_idx").on(table.ownerUserId, table.createdAt),
    actionIdx: index("audit_events_action_idx").on(table.action),
  }),
);

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

// Workspace-level settings used for moderation presets and related controls.
export const workspaceSettings = pgTable("workspace_settings", {
  id: serial("id").primaryKey(),
  ownerUserId: integer("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  moderationPreset: text("moderation_preset").notNull().default("basic"), // basic | custom | advanced
  moderationRules: jsonb("moderation_rules").notNull().default({
    blockedKeywords: [],
    allowedKeywords: [],
    spamSensitivity: 50,
    strictness: 50,
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

export const insertWorkspaceSettingsSchema = createInsertSchema(workspaceSettings).pick({
  ownerUserId: true,
  moderationPreset: true,
  moderationRules: true,
});

export const insertAuditEventSchema = createInsertSchema(auditEvents).pick({
  ownerUserId: true,
  actorUserId: true,
  action: true,
  targetType: true,
  targetId: true,
  details: true,
});

export const chatConfigurationsRelations = relations(chatConfigurations, ({ one, many }) => ({
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
  }),
  destinationLocks: many(destinationLocks),
  destinationModerationHits: many(destinationModerationHits),
  chatHistory: many(chatHistory),
  trainingInsights: many(trainingInsights)
}));

export const destinationLocksRelations = relations(destinationLocks, ({ one }) => ({
  chatConfiguration: one(chatConfigurations, {
    fields: [destinationLocks.chatConfigurationId],
    references: [chatConfigurations.id],
  }),
  platform: one(platforms, {
    fields: [destinationLocks.platformId],
    references: [platforms.id],
  }),
  requestedByUser: one(users, {
    fields: [destinationLocks.requestedByUserId],
    references: [users.id],
  }),
}));

export const destinationModerationHitsRelations = relations(destinationModerationHits, ({ one }) => ({
  chatConfiguration: one(chatConfigurations, {
    fields: [destinationModerationHits.chatConfigurationId],
    references: [chatConfigurations.id],
  }),
  platform: one(platforms, {
    fields: [destinationModerationHits.platformId],
    references: [platforms.id],
  }),
}));

export const chatHistoryRelations = relations(chatHistory, ({ one }) => ({
  chatConfiguration: one(chatConfigurations, {
    fields: [chatHistory.chatConfigurationId],
    references: [chatConfigurations.id]
  }),
  platform: one(platforms, {
    fields: [chatHistory.platformId],
    references: [platforms.id]
  })
}));

export const trainingInsightsRelations = relations(trainingInsights, ({ one }) => ({
  user: one(users, {
    fields: [trainingInsights.userId],
    references: [users.id]
  }),
  chatConfiguration: one(chatConfigurations, {
    fields: [trainingInsights.chatConfigurationId],
    references: [chatConfigurations.id]
  })
}));

export const teamSettingsRelations = relations(teamSettings, ({ one }) => ({
  user: one(users, {
    fields: [teamSettings.userId],
    references: [users.id],
  })
}));

export const messageCorrectionsRelations = relations(messageCorrections, ({ one }) => ({
  message: one(messages, {
    fields: [messageCorrections.messageId],
    references: [messages.id],
  }),
  conversation: one(conversations, {
    fields: [messageCorrections.conversationId],
    references: [conversations.id],
  }),
  platform: one(platforms, {
    fields: [messageCorrections.platformId],
    references: [platforms.id],
  }),
  chatConfiguration: one(chatConfigurations, {
    fields: [messageCorrections.chatConfigurationId],
    references: [chatConfigurations.id],
  }),
  trainingInsight: one(trainingInsights, {
    fields: [messageCorrections.trainingInsightId],
    references: [trainingInsights.id],
  }),
}));

export const workspaceSettingsRelations = relations(workspaceSettings, ({ one }) => ({
  owner: one(users, {
    fields: [workspaceSettings.ownerUserId],
    references: [users.id],
  }),
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

export const websiteLeadsRelations = relations(websiteLeads, ({ one }) => ({
  user: one(users, {
    fields: [websiteLeads.userId],
    references: [users.id],
  }),
  platform: one(platforms, {
    fields: [websiteLeads.platformId],
    references: [platforms.id],
  }),
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

export type MessageCorrection = typeof messageCorrections.$inferSelect;
export type InsertMessageCorrection = z.infer<typeof insertMessageCorrectionSchema>;

export type AiConfiguration = typeof aiConfigurations.$inferSelect;
export type InsertAiConfiguration = z.infer<typeof insertAiConfigurationSchema>;

export type KnowledgeBase = typeof knowledgeBases.$inferSelect;
export type InsertKnowledgeBase = z.infer<typeof insertKnowledgeBaseSchema>;

export type ModerationAction = typeof moderationActions.$inferSelect;
export type InsertModerationAction = z.infer<typeof insertModerationActionSchema>;

export type KnowledgeDocument = typeof knowledgeDocuments.$inferSelect;
export type InsertKnowledgeDocument = z.infer<typeof insertKnowledgeDocumentSchema>;
export type KnowledgeUrlSource = typeof knowledgeUrlSources.$inferSelect;
export type InsertKnowledgeUrlSource = z.infer<typeof insertKnowledgeUrlSourceSchema>;
export type KnowledgeUrlSyncRun = typeof knowledgeUrlSyncRuns.$inferSelect;
export type InsertKnowledgeUrlSyncRun = z.infer<typeof insertKnowledgeUrlSyncRunSchema>;

export type ConversationTraining = typeof conversationTrainings.$inferSelect;
export type InsertConversationTraining = z.infer<typeof insertConversationTrainingSchema>;

export type TeamInvitation = typeof teamInvitations.$inferSelect;
export type InsertTeamInvitation = z.infer<typeof insertTeamInvitationSchema>;

export type IntegrationClaimCode = typeof integrationClaimCodes.$inferSelect;
export type InsertIntegrationClaimCode = z.infer<typeof insertIntegrationClaimCodeSchema>;

export type TeamSettings = typeof teamSettings.$inferSelect;
export type InsertTeamSettings = z.infer<typeof insertTeamSettingsSchema>;

export type WorkspaceSettings = typeof workspaceSettings.$inferSelect;
export type InsertWorkspaceSettings = z.infer<typeof insertWorkspaceSettingsSchema>;

export type AuditEvent = typeof auditEvents.$inferSelect;
export type InsertAuditEvent = z.infer<typeof insertAuditEventSchema>;

export type ChatConfiguration = typeof chatConfigurations.$inferSelect;
export type InsertChatConfiguration = z.infer<typeof insertChatConfigurationSchema>;

export type DestinationLock = typeof destinationLocks.$inferSelect;
export type InsertDestinationLock = z.infer<typeof insertDestinationLockSchema>;

export type DestinationModerationHit = typeof destinationModerationHits.$inferSelect;
export type InsertDestinationModerationHit = z.infer<typeof insertDestinationModerationHitSchema>;

export type WebsiteConfiguration = typeof websiteConfigurations.$inferSelect;
export type InsertWebsiteConfiguration = z.infer<typeof insertWebsiteConfigurationSchema>;

export type WebsiteLead = typeof websiteLeads.$inferSelect;
export type InsertWebsiteLead = z.infer<typeof insertWebsiteLeadSchema>;

export type EmailWhitelist = typeof emailWhitelist.$inferSelect;
export type InsertEmailWhitelist = z.infer<typeof insertEmailWhitelistSchema>;

export type ChatHistory = typeof chatHistory.$inferSelect;
export type InsertChatHistory = z.infer<typeof insertChatHistorySchema>;

export type TrainingInsights = typeof trainingInsights.$inferSelect;
export type InsertTrainingInsights = z.infer<typeof insertTrainingInsightsSchema>;


