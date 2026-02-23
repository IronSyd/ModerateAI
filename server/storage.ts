import { 
  User, InsertUser, 
  Platform, InsertPlatform, 
  Conversation, InsertConversation, 
  Message, InsertMessage, 
  AiConfiguration, InsertAiConfiguration, 
  KnowledgeBase, InsertKnowledgeBase,
  KnowledgeDocument, InsertKnowledgeDocument,
  ConversationTraining, InsertConversationTraining,
  TeamInvitation, InsertTeamInvitation,
  TeamSettings, InsertTeamSettings,
  WorkspaceSettings, InsertWorkspaceSettings,
  ChatConfiguration, InsertChatConfiguration,
  DestinationLock, InsertDestinationLock,
  DestinationModerationHit, InsertDestinationModerationHit,
  IntegrationClaimCode, InsertIntegrationClaimCode,
  EmailWhitelist, InsertEmailWhitelist,
  ChatHistory, InsertChatHistory,
  TrainingInsights, InsertTrainingInsights,
  users, platforms, conversations, messages, aiConfigurations, knowledgeBases, knowledgeDocuments, conversationTrainings, teamInvitations, integrationClaimCodes, teamSettings, workspaceSettings, chatConfigurations, destinationLocks, destinationModerationHits, emailWhitelist, chatHistory, trainingInsights
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, ne, asc, desc, count, sql, ilike, inArray, gt, isNull } from "drizzle-orm";
import type { QueryResult } from 'pg';
import { getModerationActionCountsForPlatform } from "./lib/moderation-actions";

export type WorkspaceSettingsPatch = {
  moderationPreset?: string;
  moderationRules?: unknown;
};

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: number, user: Partial<User>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;

  // Platform operations
  getPlatform(id: number): Promise<Platform | undefined>;
  getPlatformByToken(token: string): Promise<Platform | undefined>;
  getPlatformsByUserId(userId: number): Promise<Platform[]>;
  getPlatformsByType(type: string): Promise<Platform[]>;
  createPlatform(platform: InsertPlatform): Promise<Platform>;
  updatePlatform(id: number, platform: Partial<Platform>): Promise<Platform | undefined>;
  deletePlatform(id: number): Promise<boolean>;
  getActiveIntegrationClaimCodeForPlatform(platformId: number): Promise<IntegrationClaimCode | undefined>;
  getIntegrationClaimCodeByCode(code: string): Promise<IntegrationClaimCode | undefined>;
  createIntegrationClaimCode(claimCode: InsertIntegrationClaimCode): Promise<IntegrationClaimCode>;
  revokeLatestActiveIntegrationClaimCode(platformId: number): Promise<IntegrationClaimCode | undefined>;
  markIntegrationClaimCodeUsed(
    claimCodeId: number,
    used: { usedAt: Date; usedExternalId: string; usedByPlatformUserId: string },
  ): Promise<IntegrationClaimCode | undefined>;
  consumeIntegrationClaimCodeIfActive(
    claimCodeId: number,
    used: { usedAt: Date; usedExternalId: string; usedByPlatformUserId: string },
  ): Promise<IntegrationClaimCode | undefined>;
  getDestinationLock(id: number): Promise<DestinationLock | undefined>;
  getActiveDestinationLockByChatConfiguration(chatConfigurationId: number): Promise<DestinationLock | undefined>;
  getActiveDestinationLockByPlatformAndExternalId(
    platformId: number,
    destinationExternalId: string,
  ): Promise<DestinationLock | undefined>;
  getActiveDestinationLocksByPlatform(platformId: number): Promise<DestinationLock[]>;
  getActiveDestinationLocksByChatConfigurationIds(chatConfigurationIds: number[]): Promise<DestinationLock[]>;
  getDueActiveDestinationLocks(before: Date, limit?: number): Promise<DestinationLock[]>;
  createDestinationLock(lock: InsertDestinationLock): Promise<DestinationLock>;
  updateDestinationLock(id: number, lock: Partial<DestinationLock>): Promise<DestinationLock | undefined>;
  createDestinationModerationHit(hit: InsertDestinationModerationHit): Promise<DestinationModerationHit>;
  countDestinationModerationHitsSince(chatConfigurationId: number, since: Date): Promise<number>;

  // Conversation operations
  getConversation(id: number): Promise<Conversation | undefined>;
  getConversationByExternalId(externalId: string): Promise<Conversation | undefined>;
  getConversationByPlatformAndExternalId(
    platformId: number,
    externalId: string,
  ): Promise<Conversation | undefined>;
  getConversationByPlatformExternalAndUser(
    platformId: number,
    externalId: string,
    externalUserId: string,
  ): Promise<Conversation | undefined>;
  getConversationsByPlatformId(platformId: number): Promise<Conversation[]>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversation(id: number, conversation: Partial<Conversation>): Promise<Conversation | undefined>;
  closeConversation(id: number): Promise<Conversation | undefined>;

  // Message operations
  getMessage(id: number): Promise<Message | undefined>;
  getMessagesByConversationId(conversationId: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;

  // AI Configuration operations
  getAiConfiguration(id: number): Promise<AiConfiguration | undefined>;
  getAiConfigurationsByUserId(userId: number): Promise<AiConfiguration[]>;
  getActiveAiConfiguration(userId: number): Promise<AiConfiguration | undefined>;
  createAiConfiguration(aiConfiguration: InsertAiConfiguration): Promise<AiConfiguration>;
  updateAiConfiguration(id: number, aiConfiguration: Partial<AiConfiguration>): Promise<AiConfiguration | undefined>;
  
  // Knowledge Base operations
  getKnowledgeBase(id: number): Promise<KnowledgeBase | undefined>;
  getKnowledgeBasesByUserId(userId: number): Promise<KnowledgeBase[]>;
  getActiveKnowledgeBase(userId: number): Promise<KnowledgeBase | undefined>;
  createKnowledgeBase(knowledgeBase: InsertKnowledgeBase): Promise<KnowledgeBase>;
  updateKnowledgeBase(id: number, knowledgeBase: Partial<KnowledgeBase>): Promise<KnowledgeBase | undefined>;

  // Knowledge Document operations
  getKnowledgeDocument(id: number): Promise<KnowledgeDocument | undefined>;
  getKnowledgeDocumentsByKnowledgeBaseId(knowledgeBaseId: number): Promise<KnowledgeDocument[]>;
  searchKnowledgeDocuments(query: string): Promise<KnowledgeDocument[]>;
  createKnowledgeDocument(document: InsertKnowledgeDocument): Promise<KnowledgeDocument>;
  updateKnowledgeDocument(id: number, document: Partial<KnowledgeDocument>): Promise<KnowledgeDocument | undefined>;
  deleteKnowledgeDocument(id: number): Promise<boolean>;



  // Conversation Training operations
  getConversationTraining(id: number): Promise<ConversationTraining | undefined>;
  getConversationTrainingsByUserId(userId: number): Promise<ConversationTraining[]>;
  getConversationTrainingsByPlatformId(platformId: number): Promise<ConversationTraining[]>;
  getLatestConversationTraining(userId: number, platformId: number): Promise<ConversationTraining | undefined>;
  createConversationTraining(training: InsertConversationTraining): Promise<ConversationTraining>;
  updateConversationTraining(id: number, training: Partial<ConversationTraining>): Promise<ConversationTraining | undefined>;
  
  // Team Invitation operations
  getTeamInvitation(id: number): Promise<TeamInvitation | undefined>;
  getTeamInvitationByToken(token: string): Promise<TeamInvitation | undefined>;
  getTeamInvitationsByEmail(email: string): Promise<TeamInvitation[]>;
  getTeamInvitationsByInviter(inviterId: number): Promise<TeamInvitation[]>;
  getPendingTeamInvitations(): Promise<TeamInvitation[]>;
  createTeamInvitation(invitation: InsertTeamInvitation): Promise<TeamInvitation>;
  updateTeamInvitation(id: number, invitation: Partial<TeamInvitation>): Promise<TeamInvitation | undefined>;
  deleteTeamInvitation(id: number): Promise<boolean>;
  
  // Chat Configuration operations
  getChatConfiguration(id: number): Promise<ChatConfiguration | undefined>;
  getChatConfigurationByPlatformAndExternalId(platformId: number, externalId: string): Promise<ChatConfiguration | undefined>;
  getChatConfigurationsByPlatformId(platformId: number): Promise<ChatConfiguration[]>;
  createChatConfiguration(chatConfig: InsertChatConfiguration): Promise<ChatConfiguration>;
  updateChatConfiguration(id: number, chatConfig: Partial<ChatConfiguration>): Promise<ChatConfiguration | undefined>;
  deleteChatConfiguration(id: number): Promise<boolean>;
  
  
  // Analytics operations
  getConversationCount(): Promise<number>;
  getMessageCount(): Promise<number>;
  getTelegramAnalytics(platformId: number): Promise<{
    totalMessages: number;
    aiResponses: number;
    conversations: number;
    responseRate: number;
    messagesByDay: { date: string; messages: number }[];
    chatTypes: { private: number; group: number };
    moderationActions: { contentFiltered: number; spamBlocked: number };
  }>;
  getDiscordAnalytics(platformId: number): Promise<{
    totalMessages: number;
    aiResponses: number;
    activeServers: number;
    totalChannels: number;
    responseRate: number;
    messagesByDay: { date: string; messages: number }[];
    moderationActions: { contentFiltered: number; warningsIssued: number };
  }>;
  getResponseRate(): Promise<number>;
  getRecentActivity(limit: number, userId?: number): Promise<{
    user: string;
    action: string;
    platform: string;
    time: Date;
  }[]>;

  // Email Whitelist operations
  isEmailWhitelisted(email: string): Promise<boolean>;
  addEmailToWhitelist(email: string, addedBy?: number): Promise<EmailWhitelist>;
  removeEmailFromWhitelist(email: string): Promise<boolean>;
  getWhitelistedEmails(): Promise<EmailWhitelist[]>;

  // Chat History operations
  getChatHistory(id: number): Promise<ChatHistory | undefined>;
  getChatHistoryByChatConfiguration(chatConfigId: number, limit?: number): Promise<ChatHistory[]>;
  getChatHistoryByPlatform(platformId: number, limit?: number): Promise<ChatHistory[]>;
  getAdminChatHistory(chatConfigId: number, limit?: number): Promise<ChatHistory[]>;
  createChatHistory(chatHistory: InsertChatHistory): Promise<ChatHistory>;
  updateChatHistory(id: number, chatHistory: Partial<ChatHistory>): Promise<ChatHistory | undefined>;
  deleteChatHistory(id: number): Promise<boolean>;
  markChatHistoryForTraining(ids: number[]): Promise<boolean>;

  // Training Insights operations
  getTrainingInsight(id: number): Promise<TrainingInsights | undefined>;
  getTrainingInsightsByUser(userId: number): Promise<TrainingInsights[]>;
  getTrainingInsightsByChatConfiguration(chatConfigId: number): Promise<TrainingInsights[]>;
  getActiveTrainingInsights(userId: number, insightType?: string): Promise<TrainingInsights[]>;
  createTrainingInsight(insight: InsertTrainingInsights): Promise<TrainingInsights>;
  updateTrainingInsight(id: number, insight: Partial<TrainingInsights>): Promise<TrainingInsights | undefined>;
  deleteTrainingInsight(id: number): Promise<boolean>;
  getEmailsWhitelistedBy(userId: number): Promise<EmailWhitelist[]>;

  // Workspace Settings operations
  getWorkspaceSettings(ownerUserId: number): Promise<WorkspaceSettings | undefined>;
  upsertWorkspaceSettings(ownerUserId: number, patch: WorkspaceSettingsPatch): Promise<WorkspaceSettings>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private platforms: Map<number, Platform>;
  private conversations: Map<number, Conversation>;
  private messages: Map<number, Message>;
  private aiConfigurations: Map<number, AiConfiguration>;
  private knowledgeBases: Map<number, KnowledgeBase>;
  private knowledgeDocuments: Map<number, KnowledgeDocument>;

  private conversationTrainings: Map<number, ConversationTraining>;
  private teamInvitations: Map<number, TeamInvitation>;
  private integrationClaimCodes: Map<number, IntegrationClaimCode>;
  private destinationLocks: Map<number, DestinationLock>;
  private destinationModerationHits: Map<number, DestinationModerationHit>;
  private workspaceSettings: Map<number, WorkspaceSettings>;

  private userIdCounter: number;
  private platformIdCounter: number;
  private conversationIdCounter: number;
  private messageIdCounter: number;
  private aiConfigurationIdCounter: number;
  private knowledgeBaseIdCounter: number;
  private knowledgeDocumentIdCounter: number;

  private conversationTrainingIdCounter: number;
  private teamInvitationIdCounter: number;
  private integrationClaimCodeIdCounter: number;
  private destinationLockIdCounter: number;
  private destinationModerationHitIdCounter: number;
  private workspaceSettingsIdCounter: number;

  constructor() {
    this.users = new Map();
    this.platforms = new Map();
    this.conversations = new Map();
    this.messages = new Map();
    this.aiConfigurations = new Map();
    this.knowledgeBases = new Map();
    this.knowledgeDocuments = new Map();

    this.conversationTrainings = new Map();
    this.teamInvitations = new Map();
    this.integrationClaimCodes = new Map();
    this.destinationLocks = new Map();
    this.destinationModerationHits = new Map();
    this.workspaceSettings = new Map();

    this.userIdCounter = 1;
    this.platformIdCounter = 1;
    this.conversationIdCounter = 1;
    this.messageIdCounter = 1;
    this.aiConfigurationIdCounter = 1;
    this.knowledgeBaseIdCounter = 1;
    this.knowledgeDocumentIdCounter = 1;

    this.conversationTrainingIdCounter = 1;
    this.teamInvitationIdCounter = 1;
    this.integrationClaimCodeIdCounter = 1;
    this.destinationLockIdCounter = 1;
    this.destinationModerationHitIdCounter = 1;
    this.workspaceSettingsIdCounter = 1;

  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }



  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async createUser(user: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const now = new Date();
    const newUser: User = {
      id,
      email: user.email,
      password: user.password ?? null,
      fullName: user.fullName,
      mustChangePassword: false,
      temporaryPasswordIssuedAt: null,
      temporaryPasswordExpiresAt: null,
      temporaryPasswordIssuedBy: null,
      plan: "free",
      planStatus: "active",
      trialStartedAt: null,
      trialEndsAt: null,
      planSelectedAt: null,
      planUpdatedAt: now,
      paidThroughAt: null,
      billingSuspendedAt: null,
      billingSuspendedReason: null,
      billingSuspendedBy: null,
      role: user.role ?? "user",
      workspaceOwnerId: null,
      workspaceRole: "admin",
      isActive: true,
      isBanned: false,
      bannedAt: null,
      banReason: null,
      requireTwoFactor: false,
      twoFactorCode: null,
      twoFactorCodeExpiry: null,
      createdAt: now,
    };
    this.users.set(id, newUser);
    return newUser;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async updateUser(id: number, user: Partial<User>): Promise<User | undefined> {
    const existingUser = this.users.get(id);
    if (!existingUser) return undefined;
    
    const updatedUser = { ...existingUser, ...user };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async deleteUser(id: number): Promise<boolean> {
    return this.users.delete(id);
  }

  // Platform operations
  async getPlatform(id: number): Promise<Platform | undefined> {
    return this.platforms.get(id);
  }

  async getPlatformByToken(token: string): Promise<Platform | undefined> {
    return Array.from(this.platforms.values()).find(platform => platform.authToken === token);
  }

  async getPlatformsByUserId(userId: number): Promise<Platform[]> {
    return Array.from(this.platforms.values()).filter(platform => platform.userId === userId);
  }

  async getPlatformsByType(type: string): Promise<Platform[]> {
    return Array.from(this.platforms.values()).filter(platform => platform.type === type);
  }

  async createPlatform(platform: InsertPlatform): Promise<Platform> {
    const id = this.platformIdCounter++;
    const now = new Date();
    const newPlatform: Platform = {
      id,
      type: platform.type,
      name: platform.name,
      status: platform.status,
      botOwnershipMode: platform.botOwnershipMode ?? "app_owned",
      userId: platform.userId,
      config: platform.config ?? null,
      authToken: platform.authToken ?? null,
      createdAt: now,
    };
    this.platforms.set(id, newPlatform);
    return newPlatform;
  }

  async updatePlatform(id: number, platform: Partial<Platform>): Promise<Platform | undefined> {
    const existingPlatform = this.platforms.get(id);
    if (!existingPlatform) return undefined;
    
    const updatedPlatform = { ...existingPlatform, ...platform };
    this.platforms.set(id, updatedPlatform);
    return updatedPlatform;
  }

  async deletePlatform(id: number): Promise<boolean> {
    return this.platforms.delete(id);
  }

  async getActiveIntegrationClaimCodeForPlatform(platformId: number): Promise<IntegrationClaimCode | undefined> {
    const now = Date.now();
    const active = Array.from(this.integrationClaimCodes.values())
      .filter((claim) => {
        return (
          claim.platformId === platformId &&
          !claim.usedAt &&
          !claim.revokedAt &&
          new Date(claim.expiresAt).getTime() > now
        );
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return active[0];
  }

  async getIntegrationClaimCodeByCode(code: string): Promise<IntegrationClaimCode | undefined> {
    const normalized = String(code ?? "").trim();
    return Array.from(this.integrationClaimCodes.values()).find((claim) => claim.code === normalized);
  }

  async createIntegrationClaimCode(claimCode: InsertIntegrationClaimCode): Promise<IntegrationClaimCode> {
    const id = this.integrationClaimCodeIdCounter++;
    const now = new Date();
    const created: IntegrationClaimCode = {
      id,
      platformId: claimCode.platformId,
      workspaceOwnerId: claimCode.workspaceOwnerId,
      platformType: claimCode.platformType,
      code: claimCode.code,
      createdByUserId: claimCode.createdByUserId,
      expiresAt: claimCode.expiresAt,
      usedAt: claimCode.usedAt ?? null,
      usedExternalId: claimCode.usedExternalId ?? null,
      usedByPlatformUserId: claimCode.usedByPlatformUserId ?? null,
      revokedAt: claimCode.revokedAt ?? null,
      createdAt: now,
    };
    this.integrationClaimCodes.set(id, created);
    return created;
  }

  async revokeLatestActiveIntegrationClaimCode(platformId: number): Promise<IntegrationClaimCode | undefined> {
    const active = await this.getActiveIntegrationClaimCodeForPlatform(platformId);
    if (!active) return undefined;
    const updated = {
      ...active,
      revokedAt: new Date(),
    };
    this.integrationClaimCodes.set(active.id, updated);
    return updated;
  }

  async markIntegrationClaimCodeUsed(
    claimCodeId: number,
    used: { usedAt: Date; usedExternalId: string; usedByPlatformUserId: string },
  ): Promise<IntegrationClaimCode | undefined> {
    const existing = this.integrationClaimCodes.get(claimCodeId);
    if (!existing) return undefined;
    const updated = {
      ...existing,
      usedAt: used.usedAt,
      usedExternalId: used.usedExternalId,
      usedByPlatformUserId: used.usedByPlatformUserId,
    };
    this.integrationClaimCodes.set(claimCodeId, updated);
    return updated;
  }

  async consumeIntegrationClaimCodeIfActive(
    claimCodeId: number,
    used: { usedAt: Date; usedExternalId: string; usedByPlatformUserId: string },
  ): Promise<IntegrationClaimCode | undefined> {
    const existing = this.integrationClaimCodes.get(claimCodeId);
    if (!existing) return undefined;
    const nowMs = used.usedAt.getTime();
    const isExpired = new Date(existing.expiresAt).getTime() <= nowMs;
    if (existing.usedAt || existing.revokedAt || isExpired) {
      return undefined;
    }
    const updated = {
      ...existing,
      usedAt: used.usedAt,
      usedExternalId: used.usedExternalId,
      usedByPlatformUserId: used.usedByPlatformUserId,
    };
    this.integrationClaimCodes.set(claimCodeId, updated);
    return updated;
  }

  async getDestinationLock(id: number): Promise<DestinationLock | undefined> {
    return this.destinationLocks.get(id);
  }

  async getActiveDestinationLockByChatConfiguration(chatConfigurationId: number): Promise<DestinationLock | undefined> {
    return Array.from(this.destinationLocks.values()).find(
      (lock) => lock.chatConfigurationId === chatConfigurationId && lock.status === "active",
    );
  }

  async getActiveDestinationLockByPlatformAndExternalId(
    platformId: number,
    destinationExternalId: string,
  ): Promise<DestinationLock | undefined> {
    return Array.from(this.destinationLocks.values()).find(
      (lock) =>
        lock.platformId === platformId &&
        lock.destinationExternalId === destinationExternalId &&
        lock.status === "active",
    );
  }

  async getActiveDestinationLocksByPlatform(platformId: number): Promise<DestinationLock[]> {
    return Array.from(this.destinationLocks.values()).filter(
      (lock) => lock.platformId === platformId && lock.status === "active",
    );
  }

  async getActiveDestinationLocksByChatConfigurationIds(chatConfigurationIds: number[]): Promise<DestinationLock[]> {
    const ids = new Set(chatConfigurationIds);
    return Array.from(this.destinationLocks.values()).filter(
      (lock) => lock.status === "active" && ids.has(lock.chatConfigurationId),
    );
  }

  async getDueActiveDestinationLocks(before: Date, limit: number = 200): Promise<DestinationLock[]> {
    return Array.from(this.destinationLocks.values())
      .filter((lock) => lock.status === "active" && new Date(lock.endsAt).getTime() <= before.getTime())
      .sort((a, b) => new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime())
      .slice(0, limit);
  }

  async createDestinationLock(lock: InsertDestinationLock): Promise<DestinationLock> {
    const id = this.destinationLockIdCounter++;
    const now = new Date();
    const created: DestinationLock = {
      id,
      chatConfigurationId: lock.chatConfigurationId,
      platformId: lock.platformId,
      platformType: lock.platformType,
      destinationExternalId: lock.destinationExternalId,
      status: lock.status ?? "active",
      source: lock.source,
      reason: lock.reason ?? null,
      requestedByUserId: lock.requestedByUserId ?? null,
      requestedByPlatformUserId: lock.requestedByPlatformUserId ?? null,
      requestedByPlatformUsername: lock.requestedByPlatformUsername ?? null,
      startedAt: lock.startedAt,
      endsAt: lock.endsAt,
      releasedAt: lock.releasedAt ?? null,
      releaseReason: lock.releaseReason ?? null,
      permissionSnapshot: lock.permissionSnapshot ?? {},
      noticeChannelExternalId: lock.noticeChannelExternalId ?? null,
      metadata: lock.metadata ?? {},
      createdAt: now,
      updatedAt: now,
    };
    this.destinationLocks.set(id, created);
    return created;
  }

  async updateDestinationLock(id: number, lock: Partial<DestinationLock>): Promise<DestinationLock | undefined> {
    const existing = this.destinationLocks.get(id);
    if (!existing) return undefined;
    const updated: DestinationLock = {
      ...existing,
      ...lock,
      updatedAt: new Date(),
    };
    this.destinationLocks.set(id, updated);
    return updated;
  }

  async createDestinationModerationHit(hit: InsertDestinationModerationHit): Promise<DestinationModerationHit> {
    const id = this.destinationModerationHitIdCounter++;
    const created: DestinationModerationHit = {
      id,
      chatConfigurationId: hit.chatConfigurationId,
      platformId: hit.platformId,
      platformType: hit.platformType,
      destinationExternalId: hit.destinationExternalId,
      metadata: hit.metadata ?? {},
      createdAt: new Date(),
    };
    this.destinationModerationHits.set(id, created);
    return created;
  }

  async countDestinationModerationHitsSince(chatConfigurationId: number, since: Date): Promise<number> {
    return Array.from(this.destinationModerationHits.values()).filter(
      (hit) => hit.chatConfigurationId === chatConfigurationId && new Date(hit.createdAt).getTime() >= since.getTime(),
    ).length;
  }

  // ... rest of the implementation
  
  // Add stubs for the remaining methods to satisfy the interface
  async getConversation(id: number): Promise<Conversation | undefined> {
    return this.conversations.get(id);
  }

  async getConversationByExternalId(externalId: string): Promise<Conversation | undefined> {
    return Array.from(this.conversations.values()).find(conv => (conv as any).externalId === externalId);
  }

  async getConversationByPlatformAndExternalId(
    platformId: number,
    externalId: string,
  ): Promise<Conversation | undefined> {
    return Array.from(this.conversations.values()).find(
      (conv) => conv.platformId === platformId && conv.externalId === externalId,
    );
  }

  async getConversationByPlatformExternalAndUser(
    platformId: number,
    externalId: string,
    externalUserId: string,
  ): Promise<Conversation | undefined> {
    return Array.from(this.conversations.values()).find(
      (conv) =>
        conv.platformId === platformId &&
        conv.externalId === externalId &&
        conv.externalUserId === externalUserId,
    );
  }

  async getConversationsByPlatformId(platformId: number): Promise<Conversation[]> {
    return Array.from(this.conversations.values()).filter(conv => conv.platformId === platformId);
  }

  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    const id = this.conversationIdCounter++;
    const now = new Date();
    const newConversation: Conversation = { 
      id,
      platformId: conversation.platformId,
      externalUserId: conversation.externalUserId,
      externalUsername: conversation.externalUsername ?? null,
      externalId: conversation.externalId ?? null,
      status: conversation.status ?? "active",
      createdAt: now,
      updatedAt: now,
    };
    this.conversations.set(id, newConversation);
    return newConversation;
  }

  async updateConversation(id: number, update: Partial<Conversation>): Promise<Conversation | undefined> {
    const existingConversation = this.conversations.get(id);
    if (!existingConversation) return undefined;
    
    const updatedConversation = { 
      ...existingConversation, 
      ...update,
      updatedAt: new Date() 
    };
    this.conversations.set(id, updatedConversation);
    return updatedConversation;
  }

  async closeConversation(id: number): Promise<Conversation | undefined> {
    return this.updateConversation(id, { status: "closed" });
  }

  async getMessage(id: number): Promise<Message | undefined> {
    return this.messages.get(id);
  }

  async getMessagesByConversationId(conversationId: number): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(message => message.conversationId === conversationId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const id = this.messageIdCounter++;
    const now = new Date();
    const newMessage: Message = {
      id,
      conversationId: message.conversationId,
      content: message.content,
      sender: message.sender,
      createdAt: now,
      metadata: message.metadata ?? null,
    };
    this.messages.set(id, newMessage);

    // Update the conversation's updatedAt
    const conversation = this.conversations.get(message.conversationId);
    if (conversation) {
      this.conversations.set(conversation.id, {
        ...conversation,
        updatedAt: now
      });
    }

    return newMessage;
  }

  // Stub methods to satisfy the interface - just placeholders for now
  async getAiConfiguration(id: number): Promise<AiConfiguration | undefined> {
    return this.aiConfigurations.get(id);
  }

  async getAiConfigurationsByUserId(userId: number): Promise<AiConfiguration[]> {
    return Array.from(this.aiConfigurations.values())
      .filter(config => config.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getActiveAiConfiguration(userId: number): Promise<AiConfiguration | undefined> {
    return Array.from(this.aiConfigurations.values())
      .filter(config => config.userId === userId && config.isActive)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  }

  async createAiConfiguration(aiConfiguration: InsertAiConfiguration): Promise<AiConfiguration> {
    const id = this.aiConfigurationIdCounter++;
    const now = new Date();
    const newConfig: AiConfiguration = {
      id,
      userId: aiConfiguration.userId,
      name: aiConfiguration.name,
      responseStyle: aiConfiguration.responseStyle ?? 75,
      responseLength: aiConfiguration.responseLength ?? 40,
      isActive: aiConfiguration.isActive ?? true,
      model: aiConfiguration.model ?? "gpt-4o",
      systemPrompt: aiConfiguration.systemPrompt ?? null,
      enableProactiveResponses: aiConfiguration.enableProactiveResponses ?? false,
      enableConversationMemory: aiConfiguration.enableConversationMemory ?? true,
      enableSentimentAnalysis: aiConfiguration.enableSentimentAnalysis ?? true,
      enableConversationTraining: aiConfiguration.enableConversationTraining ?? false,
      createdAt: now,
      updatedAt: now,
    };
    this.aiConfigurations.set(id, newConfig);
    return newConfig;
  }

  async updateAiConfiguration(id: number, aiConfiguration: Partial<AiConfiguration>): Promise<AiConfiguration | undefined> {
    const existing = this.aiConfigurations.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...aiConfiguration, updatedAt: new Date() };
    this.aiConfigurations.set(id, updated);
    return updated;
  }

  async getKnowledgeBase(id: number): Promise<KnowledgeBase | undefined> {
    return this.knowledgeBases.get(id);
  }

  async getKnowledgeBasesByUserId(userId: number): Promise<KnowledgeBase[]> {
    return Array.from(this.knowledgeBases.values())
      .filter(kb => kb.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getActiveKnowledgeBase(userId: number): Promise<KnowledgeBase | undefined> {
    return Array.from(this.knowledgeBases.values())
      .filter(kb => kb.userId === userId && kb.isActive)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  }

  async createKnowledgeBase(knowledgeBase: InsertKnowledgeBase): Promise<KnowledgeBase> {
    const id = this.knowledgeBaseIdCounter++;
    const now = new Date();
    const newKnowledgeBase: KnowledgeBase = {
      id,
      userId: knowledgeBase.userId,
      name: knowledgeBase.name,
      description: knowledgeBase.description ?? null,
      documentCount: knowledgeBase.documentCount ?? 0,
      isActive: knowledgeBase.isActive ?? true,
      createdAt: now,
    };
    this.knowledgeBases.set(id, newKnowledgeBase);
    return newKnowledgeBase;
  }

  async updateKnowledgeBase(id: number, knowledgeBase: Partial<KnowledgeBase>): Promise<KnowledgeBase | undefined> {
    const existing = this.knowledgeBases.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...knowledgeBase };
    this.knowledgeBases.set(id, updated);
    return updated;
  }

  async getKnowledgeDocument(id: number): Promise<KnowledgeDocument | undefined> {
    return this.knowledgeDocuments.get(id);
  }

  async getKnowledgeDocumentsByKnowledgeBaseId(knowledgeBaseId: number): Promise<KnowledgeDocument[]> {
    const documents = Array.from(this.knowledgeDocuments.values())
      .filter(doc => doc.knowledgeBaseId === knowledgeBaseId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return documents;
  }

  async searchKnowledgeDocuments(query: string): Promise<KnowledgeDocument[]> {
    return [];
  }

  async createKnowledgeDocument(document: InsertKnowledgeDocument): Promise<KnowledgeDocument> {
    const newId = Math.max(0, ...Array.from(this.knowledgeDocuments.keys())) + 1;
    const newDoc: KnowledgeDocument = {
      id: newId,
      knowledgeBaseId: document.knowledgeBaseId,
      title: document.title,
      content: document.content,
      metadata: document.metadata || {},
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.knowledgeDocuments.set(newId, newDoc);
    
    // Update document count in knowledge base
    const kb = this.knowledgeBases.get(document.knowledgeBaseId);
    if (kb) {
      kb.documentCount++;
      this.knowledgeBases.set(document.knowledgeBaseId, kb);
    }
    
    return newDoc;
  }

  async updateKnowledgeDocument(id: number, document: Partial<KnowledgeDocument>): Promise<KnowledgeDocument | undefined> {
    const existing = this.knowledgeDocuments.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...document, updatedAt: new Date() };
    this.knowledgeDocuments.set(id, updated);
    return updated;
  }

  async deleteKnowledgeDocument(id: number): Promise<boolean> {
    const deleted = this.knowledgeDocuments.delete(id);
    
    if (deleted) {
      // Update document count in knowledge base
      const doc = this.knowledgeDocuments.get(id);
      if (doc) {
        const kb = this.knowledgeBases.get(doc.knowledgeBaseId);
        if (kb && kb.documentCount > 0) {
          kb.documentCount--;
          this.knowledgeBases.set(kb.id, kb);
        }
      }
    }
    
    return deleted;
  }



  async getConversationTraining(id: number): Promise<ConversationTraining | undefined> {
    return undefined;
  }

  async getConversationTrainingsByUserId(userId: number): Promise<ConversationTraining[]> {
    return [];
  }

  async getConversationTrainingsByPlatformId(platformId: number): Promise<ConversationTraining[]> {
    return [];
  }

  async getLatestConversationTraining(userId: number, platformId: number): Promise<ConversationTraining | undefined> {
    return undefined;
  }

  async createConversationTraining(training: InsertConversationTraining): Promise<ConversationTraining> {
    return { id: 1, createdAt: new Date(), status: "pending", userId: 1, platformId: 1, updatedAt: new Date(), totalConversations: 0, processedConversations: 0, startedAt: null, completedAt: null, lastTrainedConversationId: null, errorMessage: null } as ConversationTraining;
  }

  async updateConversationTraining(id: number, training: Partial<ConversationTraining>): Promise<ConversationTraining | undefined> {
    return undefined;
  }

  async getTeamInvitation(id: number): Promise<TeamInvitation | undefined> {
    return undefined;
  }

  async getTeamInvitationByToken(token: string): Promise<TeamInvitation | undefined> {
    return undefined;
  }

  async getTeamInvitationsByEmail(email: string): Promise<TeamInvitation[]> {
    return [];
  }

  async getTeamInvitationsByInviter(inviterId: number): Promise<TeamInvitation[]> {
    return [];
  }

  async getPendingTeamInvitations(): Promise<TeamInvitation[]> {
    return [];
  }

  async createTeamInvitation(invitation: InsertTeamInvitation): Promise<TeamInvitation> {
    return {
      id: 1,
      token: "",
      email: invitation.email,
      role: invitation.role,
      invitedBy: invitation.invitedBy,
      workspaceOwnerId: invitation.workspaceOwnerId ?? null,
      status: "pending",
      createdAt: new Date(),
      expiresAt: invitation.expiresAt,
      acceptedAt: null,
    } as TeamInvitation;
  }

  async updateTeamInvitation(id: number, invitation: Partial<TeamInvitation>): Promise<TeamInvitation | undefined> {
    return undefined;
  }

  async deleteTeamInvitation(id: number): Promise<boolean> {
    return false;
  }

  async getConversationCount(): Promise<number> {
    return this.conversations.size;
  }

  async getMessageCount(): Promise<number> {
    return this.messages.size;
  }

  async getTelegramAnalytics(platformId: number): Promise<{
    totalMessages: number;
    aiResponses: number;
    conversations: number;
    responseRate: number;
    messagesByDay: { date: string; messages: number }[];
    chatTypes: { private: number; group: number };
    moderationActions: { contentFiltered: number; spamBlocked: number };
  }> {
    return {
      totalMessages: 0,
      aiResponses: 0,
      conversations: 0,
      responseRate: 0,
      messagesByDay: [],
      chatTypes: { private: 0, group: 0 },
      moderationActions: { contentFiltered: 0, spamBlocked: 0 },
    };
  }

  async getDiscordAnalytics(platformId: number): Promise<{
    totalMessages: number;
    aiResponses: number;
    activeServers: number;
    totalChannels: number;
    responseRate: number;
    messagesByDay: { date: string; messages: number }[];
    moderationActions: { contentFiltered: number; warningsIssued: number };
  }> {
    return {
      totalMessages: 0,
      aiResponses: 0,
      activeServers: 0,
      totalChannels: 0,
      responseRate: 0,
      messagesByDay: [],
      moderationActions: { contentFiltered: 0, warningsIssued: 0 },
    };
  }



  async getResponseRate(): Promise<number> {
    return 0.95;
  }

  async getRecentActivity(limit: number, userId?: number): Promise<{ user: string; action: string; platform: string; time: Date; }[]> {
    return [
      { user: "Chelsea Hagon", action: "message", platform: "telegram", time: new Date() },
      { user: "ai", action: "message", platform: "discord", time: new Date() }
    ];
  }


  // Email Whitelist operations
  async isEmailWhitelisted(email: string): Promise<boolean> {
    return false; // No whitelisted emails in memory storage
  }

  async addEmailToWhitelist(email: string, addedBy?: number): Promise<EmailWhitelist> {
    return { 
      id: 1, 
      email, 
      addedBy: addedBy || null, 
      isActive: true, 
      createdAt: new Date() 
    } as EmailWhitelist;
  }

  async removeEmailFromWhitelist(email: string): Promise<boolean> {
    return true;
  }

  async getWhitelistedEmails(): Promise<EmailWhitelist[]> {
    return [];
  }

  async getEmailsWhitelistedBy(userId: number): Promise<EmailWhitelist[]> {
    return [];
  }

  // Chat Configuration operations
  async getChatConfiguration(id: number): Promise<ChatConfiguration | undefined> {
    return undefined;
  }

  async getChatConfigurationByPlatformAndExternalId(platformId: number, externalId: string): Promise<ChatConfiguration | undefined> {
    return undefined;
  }

  async getChatConfigurationsByPlatformId(platformId: number): Promise<ChatConfiguration[]> {
    return [];
  }

  async createChatConfiguration(chatConfig: InsertChatConfiguration): Promise<ChatConfiguration> {
    return {
      id: 1,
      platformId: chatConfig.platformId,
      externalId: chatConfig.externalId,
      chatType: chatConfig.chatType,
      chatName: chatConfig.chatName || null,
      aiConfigurationId: chatConfig.aiConfigurationId || null,
      knowledgeBaseId: chatConfig.knowledgeBaseId || null,
      settings: chatConfig.settings || {},
      isActive: chatConfig.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date()
    } as ChatConfiguration;
  }

  async updateChatConfiguration(id: number, chatConfig: Partial<ChatConfiguration>): Promise<ChatConfiguration | undefined> {
    return undefined;
  }

  async deleteChatConfiguration(id: number): Promise<boolean> {
    return false;
  }

  // Chat History operations
  async getChatHistory(id: number): Promise<ChatHistory | undefined> {
    return undefined;
  }

  async getChatHistoryByChatConfiguration(chatConfigId: number, limit?: number): Promise<ChatHistory[]> {
    return [];
  }

  async getChatHistoryByPlatform(platformId: number, limit?: number): Promise<ChatHistory[]> {
    return [];
  }

  async getAdminChatHistory(chatConfigId: number, limit?: number): Promise<ChatHistory[]> {
    return [];
  }

  async createChatHistory(chatHistory: InsertChatHistory): Promise<ChatHistory> {
    return {
      id: 1,
      chatConfigurationId: chatHistory.chatConfigurationId,
      platformId: chatHistory.platformId,
      sourceMessageId: chatHistory.sourceMessageId ?? null,
      externalUserId: chatHistory.externalUserId,
      externalUsername: chatHistory.externalUsername || null,
      messageId: chatHistory.messageId || null,
      content: chatHistory.content,
      messageType: chatHistory.messageType,
      isAdmin: chatHistory.isAdmin || false,
      replyToMessageId: chatHistory.replyToMessageId || null,
      threadContext: chatHistory.threadContext || null,
      metadata: chatHistory.metadata || null,
      sentAt: chatHistory.sentAt,
      isUsedForTraining: chatHistory.isUsedForTraining || false,
      createdAt: new Date()
    } as ChatHistory;
  }

  async updateChatHistory(id: number, chatHistory: Partial<ChatHistory>): Promise<ChatHistory | undefined> {
    return undefined;
  }

  async deleteChatHistory(id: number): Promise<boolean> {
    return false;
  }

  async markChatHistoryForTraining(ids: number[]): Promise<boolean> {
    return true;
  }

  // Training Insights operations
  async getTrainingInsight(id: number): Promise<TrainingInsights | undefined> {
    return undefined;
  }

  async getTrainingInsightsByUser(userId: number): Promise<TrainingInsights[]> {
    return [];
  }

  async getTrainingInsightsByChatConfiguration(chatConfigId: number): Promise<TrainingInsights[]> {
    return [];
  }

  async getActiveTrainingInsights(userId: number, insightType?: string): Promise<TrainingInsights[]> {
    return [];
  }

  async createTrainingInsight(insight: InsertTrainingInsights): Promise<TrainingInsights> {
    return {
      id: 1,
      userId: insight.userId,
      chatConfigurationId: insight.chatConfigurationId || null,
      insightType: insight.insightType,
      pattern: insight.pattern,
      context: insight.context || null,
      confidence: insight.confidence || 50,
      usageCount: insight.usageCount || 0,
      successRate: insight.successRate || 0,
      isActive: insight.isActive ?? true,
      learnedFrom: insight.learnedFrom || null,
      createdAt: new Date(),
      updatedAt: new Date()
    } as TrainingInsights;
  }

  async updateTrainingInsight(id: number, insight: Partial<TrainingInsights>): Promise<TrainingInsights | undefined> {
    return undefined;
  }

  async deleteTrainingInsight(id: number): Promise<boolean> {
    return false;
  }

  async getWorkspaceSettings(ownerUserId: number): Promise<WorkspaceSettings | undefined> {
    return Array.from(this.workspaceSettings.values()).find((s) => s.ownerUserId === ownerUserId);
  }

  async upsertWorkspaceSettings(ownerUserId: number, patch: WorkspaceSettingsPatch): Promise<WorkspaceSettings> {
    const existing = await this.getWorkspaceSettings(ownerUserId);
    const now = new Date();

    if (existing) {
      const updated: WorkspaceSettings = {
        ...existing,
        moderationPreset: patch.moderationPreset ?? existing.moderationPreset,
        moderationRules: patch.moderationRules ?? existing.moderationRules,
        updatedAt: now,
      };
      this.workspaceSettings.set(updated.id, updated);
      return updated;
    }

    const created: WorkspaceSettings = {
      id: this.workspaceSettingsIdCounter++,
      ownerUserId,
      moderationPreset: patch.moderationPreset ?? "basic",
      moderationRules: patch.moderationRules ?? {
        blockedKeywords: [],
        allowedKeywords: [],
        spamSensitivity: 50,
        strictness: 50,
      },
      createdAt: now,
      updatedAt: now,
    };

    this.workspaceSettings.set(created.id, created);
    return created;
  }
}

/**
 * DatabaseStorage implementation using PostgreSQL database
 */
export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }



  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const insertedUsers = await db.insert(users).values(user).returning();
    const createdUser = Array.isArray(insertedUsers) ? insertedUsers[0] : (insertedUsers as any)?.rows?.[0];
    if (!createdUser) {
      throw new Error("Failed to create user");
    }
    return createdUser as any;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async updateUser(id: number, user: Partial<User>): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set(user)
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return true;
  }

  async getPlatform(id: number): Promise<Platform | undefined> {
    const [platform] = await db.select().from(platforms).where(eq(platforms.id, id));
    return platform;
  }

  async getPlatformByToken(token: string): Promise<Platform | undefined> {
    const [platform] = await db.select().from(platforms).where(eq(platforms.authToken, token));
    return platform;
  }

  async getPlatformsByUserId(userId: number): Promise<Platform[]> {
    return await db.select().from(platforms).where(eq(platforms.userId, userId));
  }

  async getPlatformsByType(type: string): Promise<Platform[]> {
    return await db.select().from(platforms).where(eq(platforms.type, type));
  }

  async createPlatform(platform: InsertPlatform): Promise<Platform> {
    const [createdPlatform] = await db.insert(platforms).values(platform).returning();
    return createdPlatform;
  }

  async updatePlatform(id: number, platformUpdate: Partial<Platform>): Promise<Platform | undefined> {
    const [updatedPlatform] = await db
      .update(platforms)
      .set(platformUpdate)
      .where(eq(platforms.id, id))
      .returning();
    return updatedPlatform;
  }

  async deletePlatform(id: number): Promise<boolean> {
    const result = await db.delete(platforms).where(eq(platforms.id, id));
    return true;
  }

  async getActiveIntegrationClaimCodeForPlatform(platformId: number): Promise<IntegrationClaimCode | undefined> {
    const now = new Date();
    const [claimCode] = await db
      .select()
      .from(integrationClaimCodes)
      .where(
        and(
          eq(integrationClaimCodes.platformId, platformId),
          isNull(integrationClaimCodes.usedAt),
          isNull(integrationClaimCodes.revokedAt),
          gt(integrationClaimCodes.expiresAt, now),
        ),
      )
      .orderBy(desc(integrationClaimCodes.createdAt))
      .limit(1);
    return claimCode;
  }

  async getIntegrationClaimCodeByCode(code: string): Promise<IntegrationClaimCode | undefined> {
    const [claimCode] = await db
      .select()
      .from(integrationClaimCodes)
      .where(eq(integrationClaimCodes.code, String(code ?? "").trim()))
      .limit(1);
    return claimCode;
  }

  async createIntegrationClaimCode(claimCode: InsertIntegrationClaimCode): Promise<IntegrationClaimCode> {
    const [created] = await db.insert(integrationClaimCodes).values(claimCode).returning();
    return created;
  }

  async revokeLatestActiveIntegrationClaimCode(platformId: number): Promise<IntegrationClaimCode | undefined> {
    const active = await this.getActiveIntegrationClaimCodeForPlatform(platformId);
    if (!active) return undefined;
    const [updated] = await db
      .update(integrationClaimCodes)
      .set({ revokedAt: new Date() })
      .where(eq(integrationClaimCodes.id, active.id))
      .returning();
    return updated;
  }

  async consumeIntegrationClaimCodeIfActive(
    claimCodeId: number,
    used: { usedAt: Date; usedExternalId: string; usedByPlatformUserId: string },
  ): Promise<IntegrationClaimCode | undefined> {
    const [updated] = await db
      .update(integrationClaimCodes)
      .set({
        usedAt: used.usedAt,
        usedExternalId: used.usedExternalId,
        usedByPlatformUserId: used.usedByPlatformUserId,
      })
      .where(
        and(
          eq(integrationClaimCodes.id, claimCodeId),
          isNull(integrationClaimCodes.usedAt),
          isNull(integrationClaimCodes.revokedAt),
          gt(integrationClaimCodes.expiresAt, used.usedAt),
        ),
      )
      .returning();
    return updated;
  }

  async markIntegrationClaimCodeUsed(
    claimCodeId: number,
    used: { usedAt: Date; usedExternalId: string; usedByPlatformUserId: string },
  ): Promise<IntegrationClaimCode | undefined> {
    const [updated] = await db
      .update(integrationClaimCodes)
      .set({
        usedAt: used.usedAt,
        usedExternalId: used.usedExternalId,
        usedByPlatformUserId: used.usedByPlatformUserId,
      })
      .where(eq(integrationClaimCodes.id, claimCodeId))
      .returning();
    return updated;
  }

  async getDestinationLock(id: number): Promise<DestinationLock | undefined> {
    const [lock] = await db.select().from(destinationLocks).where(eq(destinationLocks.id, id)).limit(1);
    return lock;
  }

  async getActiveDestinationLockByChatConfiguration(chatConfigurationId: number): Promise<DestinationLock | undefined> {
    const [lock] = await db
      .select()
      .from(destinationLocks)
      .where(
        and(
          eq(destinationLocks.chatConfigurationId, chatConfigurationId),
          eq(destinationLocks.status, "active"),
        ),
      )
      .orderBy(desc(destinationLocks.createdAt))
      .limit(1);
    return lock;
  }

  async getActiveDestinationLockByPlatformAndExternalId(
    platformId: number,
    destinationExternalId: string,
  ): Promise<DestinationLock | undefined> {
    const [lock] = await db
      .select()
      .from(destinationLocks)
      .where(
        and(
          eq(destinationLocks.platformId, platformId),
          eq(destinationLocks.destinationExternalId, destinationExternalId),
          eq(destinationLocks.status, "active"),
        ),
      )
      .orderBy(desc(destinationLocks.createdAt))
      .limit(1);
    return lock;
  }

  async getActiveDestinationLocksByPlatform(platformId: number): Promise<DestinationLock[]> {
    return db
      .select()
      .from(destinationLocks)
      .where(and(eq(destinationLocks.platformId, platformId), eq(destinationLocks.status, "active")))
      .orderBy(asc(destinationLocks.endsAt));
  }

  async getActiveDestinationLocksByChatConfigurationIds(chatConfigurationIds: number[]): Promise<DestinationLock[]> {
    if (chatConfigurationIds.length === 0) return [];
    return db
      .select()
      .from(destinationLocks)
      .where(
        and(
          inArray(destinationLocks.chatConfigurationId, chatConfigurationIds),
          eq(destinationLocks.status, "active"),
        ),
      )
      .orderBy(asc(destinationLocks.endsAt));
  }

  async getDueActiveDestinationLocks(before: Date, limit: number = 200): Promise<DestinationLock[]> {
    return db
      .select()
      .from(destinationLocks)
      .where(and(eq(destinationLocks.status, "active"), sql`${destinationLocks.endsAt} <= ${before}`))
      .orderBy(asc(destinationLocks.endsAt))
      .limit(Math.max(1, Math.min(1000, limit)));
  }

  async createDestinationLock(lock: InsertDestinationLock): Promise<DestinationLock> {
    const [created] = await db.insert(destinationLocks).values(lock).returning();
    return created;
  }

  async updateDestinationLock(id: number, lock: Partial<DestinationLock>): Promise<DestinationLock | undefined> {
    const [updated] = await db
      .update(destinationLocks)
      .set({ ...lock, updatedAt: new Date() })
      .where(eq(destinationLocks.id, id))
      .returning();
    return updated;
  }

  async createDestinationModerationHit(hit: InsertDestinationModerationHit): Promise<DestinationModerationHit> {
    const [created] = await db.insert(destinationModerationHits).values(hit).returning();
    return created;
  }

  async countDestinationModerationHitsSince(chatConfigurationId: number, since: Date): Promise<number> {
    const [row] = await db
      .select({ count: count() })
      .from(destinationModerationHits)
      .where(
        and(
          eq(destinationModerationHits.chatConfigurationId, chatConfigurationId),
          sql`${destinationModerationHits.createdAt} >= ${since}`,
        ),
      );
    return Number(row?.count ?? 0);
  }

  async getConversation(id: number): Promise<Conversation | undefined> {
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
    return conversation;
  }
  
  async getConversationByExternalId(externalId: string): Promise<Conversation | undefined> {
    const [conversation] = await db.select().from(conversations).where(eq(conversations.externalId, externalId));
    return conversation;
  }

  async getConversationByPlatformAndExternalId(
    platformId: number,
    externalId: string,
  ): Promise<Conversation | undefined> {
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.platformId, platformId), eq(conversations.externalId, externalId)))
      .limit(1);
    return conversation;
  }

  async getConversationByPlatformExternalAndUser(
    platformId: number,
    externalId: string,
    externalUserId: string,
  ): Promise<Conversation | undefined> {
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.platformId, platformId),
          eq(conversations.externalId, externalId),
          eq(conversations.externalUserId, externalUserId),
        ),
      )
      .limit(1);
    return conversation;
  }

  async getConversationTraining(id: number): Promise<ConversationTraining | undefined> {
    const [training] = await db
      .select()
      .from(conversationTrainings)
      .where(eq(conversationTrainings.id, id));
    return training;
  }

  async getConversationsByPlatformId(platformId: number): Promise<Conversation[]> {
    return await db.select().from(conversations).where(eq(conversations.platformId, platformId));
  }

  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    const [createdConversation] = await db.insert(conversations).values(conversation).returning();
    return createdConversation;
  }

  async updateConversation(id: number, conversationUpdate: Partial<Conversation>): Promise<Conversation | undefined> {
    const [updatedConversation] = await db
      .update(conversations)
      .set(conversationUpdate)
      .where(eq(conversations.id, id))
      .returning();
    return updatedConversation;
  }

  async closeConversation(id: number): Promise<Conversation | undefined> {
    const [updatedConversation] = await db
      .update(conversations)
      .set({ status: "closed" })
      .where(eq(conversations.id, id))
      .returning();
    return updatedConversation;
  }

  async getMessage(id: number): Promise<Message | undefined> {
    const [message] = await db.select().from(messages).where(eq(messages.id, id));
    return message;
  }

  async getMessagesByConversationId(conversationId: number): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.createdAt));
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const [createdMessage] = await db.insert(messages).values(message).returning();
    return createdMessage;
  }

  async getAiConfiguration(id: number): Promise<AiConfiguration | undefined> {
    const [config] = await db.select().from(aiConfigurations).where(eq(aiConfigurations.id, id));
    return config;
  }

  async getAiConfigurationsByUserId(userId: number): Promise<AiConfiguration[]> {
    return await db.select().from(aiConfigurations).where(eq(aiConfigurations.userId, userId));
  }

  async getActiveAiConfiguration(userId: number): Promise<AiConfiguration | undefined> {
    const [config] = await db
      .select()
      .from(aiConfigurations)
      .where(and(
        eq(aiConfigurations.userId, userId),
        eq(aiConfigurations.isActive, true)
      ));
    return config;
  }

  // Implement the dashboard stats methods
  async getConversationCount(): Promise<number> {
    const result = await db.select({ count: count() }).from(conversations);
    return result[0].count;
  }

  async getMessageCount(): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(messages)
      .where(eq(messages.sender, "ai"));
    return result[0].count;
  }



  async getResponseRate(): Promise<number> {
    // Calculate the response rate based on user messages that received an AI response
    // This query is an approximation and might need refinement based on your exact requirements
    const totalUserMessages = await db
      .select({ count: count() })
      .from(messages)
      .where(eq(messages.sender, "user"));
    
    const totalAiResponses = await db
      .select({ count: count() })
      .from(messages)
      .where(eq(messages.sender, "ai"));
    
    if (totalUserMessages[0].count === 0) {
      return 0;
    }
    
    // Calculate the percentage with 2 decimal places
    return Math.min(100, (totalAiResponses[0].count / totalUserMessages[0].count) * 100);
  }

  async getTelegramAnalytics(platformId: number): Promise<{
    totalMessages: number;
    aiResponses: number;
    conversations: number;
    responseRate: number;
    messagesByDay: { date: string; messages: number }[];
    chatTypes: { private: number; group: number };
    moderationActions: { contentFiltered: number; spamBlocked: number };
  }> {
    // Get all conversations for this Telegram platform
    const telegramConversations = await db
      .select()
      .from(conversations)
      .where(eq(conversations.platformId, platformId));

    const conversationIds = telegramConversations.map(c => c.id);

    // Get all messages for this platform
    const allMessages = conversationIds.length > 0 ? await db
      .select()
      .from(messages)
      .where(inArray(messages.conversationId, conversationIds)) : [];

    const userMessages = allMessages.filter(m => m.sender === 'user');
    const aiMessages = allMessages.filter(m => m.sender === 'ai');

    // Calculate response rate
    const responseRate = userMessages.length > 0 ? (aiMessages.length / userMessages.length) * 100 : 0;

    // Messages by day (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentMessages = allMessages.filter(m => m.createdAt >= sevenDaysAgo);
    const messagesByDay = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateString = date.toISOString().split('T')[0];
      
      const dayMessages = recentMessages.filter(m => {
        const msgDate = m.createdAt.toISOString().split('T')[0];
        return msgDate === dateString;
      }).length;
      
      messagesByDay.push({ date: dateString, messages: dayMessages });
    }

    // Chat types (estimate from metadata or external IDs)
    let privateChats = 0;
    let groupChats = 0;
    
    telegramConversations.forEach(conv => {
      // If externalId starts with negative number, it's likely a group
      if (conv.externalId && conv.externalId.startsWith('-')) {
        groupChats++;
      } else {
        privateChats++;
      }
    });

    // Moderation actions are sourced from the dedicated moderation_actions table.
    const moderationCounts = await getModerationActionCountsForPlatform(platformId);
    const contentFiltered = moderationCounts.content_filtered ?? 0;
    const spamBlocked = moderationCounts.spam_blocked ?? 0;

    return {
      totalMessages: allMessages.length,
      aiResponses: aiMessages.length,
      conversations: telegramConversations.length,
      responseRate: Math.round(responseRate),
      messagesByDay,
      chatTypes: { private: privateChats, group: groupChats },
      moderationActions: { contentFiltered, spamBlocked }
    };
  }

  async getDiscordAnalytics(platformId: number): Promise<{
    totalMessages: number;
    aiResponses: number;
    activeServers: number;
    totalChannels: number;
    responseRate: number;
    messagesByDay: { date: string; messages: number }[];
    moderationActions: { contentFiltered: number; warningsIssued: number };
  }> {
    // Get all conversations for this Discord platform
    const discordConversations = await db
      .select()
      .from(conversations)
      .where(eq(conversations.platformId, platformId));

    const conversationIds = discordConversations.map(c => c.id);

    // Get all messages for this platform
    const allMessages = conversationIds.length > 0 ? await db
      .select()
      .from(messages)
      .where(inArray(messages.conversationId, conversationIds)) : [];

    const userMessages = allMessages.filter(m => m.sender === 'user');
    const aiMessages = allMessages.filter(m => m.sender === 'ai');

    // Calculate response rate
    const responseRate = userMessages.length > 0 ? (aiMessages.length / userMessages.length) * 100 : 0;

    // Messages by day (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentMessages = allMessages.filter(m => m.createdAt >= sevenDaysAgo);
    const messagesByDay = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateString = date.toISOString().split('T')[0];
      
      const dayMessages = recentMessages.filter(m => {
        const msgDate = m.createdAt.toISOString().split('T')[0];
        return msgDate === dateString;
      }).length;
      
      messagesByDay.push({ date: dateString, messages: dayMessages });
    }

    // Get platform data to count servers and channels
    const platform = await db
      .select()
      .from(platforms)
      .where(eq(platforms.id, platformId))
      .limit(1);

    let activeServers = 0;
    let totalChannels = 0;

    if (platform.length > 0 && platform[0].config) {
      const config = platform[0].config as any;
      if (config.servers) {
        activeServers = config.servers.length;
      }
      if (config.channels) {
        totalChannels = config.channels.length;
      }
    }

    // Moderation actions are sourced from the dedicated moderation_actions table.
    const moderationCounts = await getModerationActionCountsForPlatform(platformId);
    const contentFiltered = moderationCounts.content_filtered ?? 0;
    const warningsIssued = moderationCounts.warning_issued ?? 0;

    return {
      totalMessages: allMessages.length,
      aiResponses: aiMessages.length,
      activeServers,
      totalChannels,
      responseRate: Math.round(responseRate),
      messagesByDay,
      moderationActions: { contentFiltered, warningsIssued }
    };
  }

  async getRecentActivity(limit: number, userId?: number): Promise<{ user: string; action: string; platform: string; time: Date; }[]> {
    const baseQuery = db
      .select({
        sender: messages.sender,
        createdAt: messages.createdAt,
        metadata: messages.metadata,
        platformType: platforms.type,
      })
      .from(messages)
      .innerJoin(conversations, eq(conversations.id, messages.conversationId))
      .innerJoin(platforms, eq(platforms.id, conversations.platformId));

    const recentMessages = await (userId
      ? baseQuery.where(eq(platforms.userId, userId)).orderBy(desc(messages.createdAt)).limit(limit)
      : baseQuery.orderBy(desc(messages.createdAt)).limit(limit));

    return recentMessages.map((message) => {
      const username = (
        typeof message.metadata === "object" &&
        message.metadata !== null &&
        "username" in message.metadata
      )
        ? String((message.metadata as any).username)
        : message.sender;

      return {
        user: username,
        action: "message",
        platform: message.platformType,
        time: message.createdAt,
      };
    });
  }

  // Implement remaining methods as stubs for now, to be completed as needed
  async createAiConfiguration(config: InsertAiConfiguration): Promise<AiConfiguration> {
    const [createdConfig] = await db.insert(aiConfigurations).values(config).returning();
    return createdConfig;
  }

  async updateAiConfiguration(id: number, config: Partial<AiConfiguration>): Promise<AiConfiguration | undefined> {
    const [updatedConfig] = await db
      .update(aiConfigurations)
      .set(config)
      .where(eq(aiConfigurations.id, id))
      .returning();
    return updatedConfig;
  }



  // The following methods can be implemented as needed
  async getKnowledgeBase(id: number): Promise<KnowledgeBase | undefined> {
    const [kb] = await db.select().from(knowledgeBases).where(eq(knowledgeBases.id, id));
    return kb;
  }

  async createKnowledgeBase(knowledgeBase: InsertKnowledgeBase): Promise<KnowledgeBase> {
    const [created] = await db.insert(knowledgeBases).values(knowledgeBase).returning();
    return created;
  }

  async updateKnowledgeBase(id: number, knowledgeBase: Partial<KnowledgeBase>): Promise<KnowledgeBase | undefined> {
    const [updated] = await db
      .update(knowledgeBases)
      .set(knowledgeBase)
      .where(eq(knowledgeBases.id, id))
      .returning();
    return updated;
  }

  async getKnowledgeBasesByUserId(userId: number): Promise<KnowledgeBase[]> {
    return await db
      .select()
      .from(knowledgeBases)
      .where(eq(knowledgeBases.userId, userId))
      .orderBy(desc(knowledgeBases.createdAt));
  }

  async getActiveKnowledgeBase(userId: number): Promise<KnowledgeBase | undefined> {
    const [kb] = await db
      .select()
      .from(knowledgeBases)
      .where(and(
        eq(knowledgeBases.userId, userId),
        eq(knowledgeBases.isActive, true)
      ));
    return kb;
  }

  async getKnowledgeDocument(id: number): Promise<KnowledgeDocument | undefined> {
    const [doc] = await db.select().from(knowledgeDocuments).where(eq(knowledgeDocuments.id, id));
    return doc;
  }

  async getKnowledgeDocumentsByKnowledgeBaseId(knowledgeBaseId: number): Promise<KnowledgeDocument[]> {
    return await db
      .select()
      .from(knowledgeDocuments)
      .where(eq(knowledgeDocuments.knowledgeBaseId, knowledgeBaseId))
      .orderBy(desc(knowledgeDocuments.createdAt));
  }

  async searchKnowledgeDocuments(query: string): Promise<KnowledgeDocument[]> {
    return await db
      .select()
      .from(knowledgeDocuments)
      .where(or(
        ilike(knowledgeDocuments.title, `%${query}%`),
        ilike(knowledgeDocuments.content, `%${query}%`)
      ))
      .orderBy(desc(knowledgeDocuments.createdAt));
  }

  async createKnowledgeDocument(document: InsertKnowledgeDocument): Promise<KnowledgeDocument> {
    const [created] = await db.insert(knowledgeDocuments).values(document).returning();
    
    // Update document count in knowledge base
    await db
      .update(knowledgeBases)
      .set({ 
        documentCount: sql`${knowledgeBases.documentCount} + 1`
      })
      .where(eq(knowledgeBases.id, document.knowledgeBaseId));
    
    return created;
  }

  async updateKnowledgeDocument(id: number, document: Partial<KnowledgeDocument>): Promise<KnowledgeDocument | undefined> {
    // Only update specific fields to avoid conflicts
    const updateData: any = {
      updatedAt: new Date()
    };
    
    if (document.title !== undefined) updateData.title = document.title;
    if (document.content !== undefined) updateData.content = document.content;
    if (document.metadata !== undefined) updateData.metadata = document.metadata;
    
    const [updated] = await db
      .update(knowledgeDocuments)
      .set(updateData)
      .where(eq(knowledgeDocuments.id, id))
      .returning();
    return updated;
  }

  async deleteKnowledgeDocument(id: number): Promise<boolean> {
    const doc = await this.getKnowledgeDocument(id);
    if (!doc) return false;
    
    await db.delete(knowledgeDocuments).where(eq(knowledgeDocuments.id, id));
    
    // Update document count in knowledge base
    await db
      .update(knowledgeBases)
      .set({ 
        documentCount: sql`${knowledgeBases.documentCount} - 1`
      })
      .where(eq(knowledgeBases.id, doc.knowledgeBaseId));
    
    return true;
  }

  // Conversation training operations
  async getConversationTrainingsByUserId(userId: number): Promise<ConversationTraining[]> {
    return await db
      .select()
      .from(conversationTrainings)
      .where(eq(conversationTrainings.userId, userId))
      .orderBy(desc(conversationTrainings.createdAt));
  }

  async getConversationTrainingsByPlatformId(platformId: number): Promise<ConversationTraining[]> {
    return await db
      .select()
      .from(conversationTrainings)
      .where(eq(conversationTrainings.platformId, platformId))
      .orderBy(desc(conversationTrainings.createdAt));
  }

  async getLatestConversationTraining(userId: number, platformId: number): Promise<ConversationTraining | undefined> {
    const [training] = await db
      .select()
      .from(conversationTrainings)
      .where(and(
        eq(conversationTrainings.userId, userId),
        eq(conversationTrainings.platformId, platformId),
      ))
      .orderBy(desc(conversationTrainings.createdAt))
      .limit(1);
    return training;
  }

  async createConversationTraining(training: InsertConversationTraining): Promise<ConversationTraining> {
    const [createdTraining] = await db.insert(conversationTrainings).values(training).returning();
    return createdTraining;
  }

  async updateConversationTraining(id: number, training: Partial<ConversationTraining>): Promise<ConversationTraining | undefined> {
    const [updatedTraining] = await db
      .update(conversationTrainings)
      .set({ ...training, updatedAt: new Date() })
      .where(eq(conversationTrainings.id, id))
      .returning();
    return updatedTraining;
  }

  async getTeamInvitation(id: number): Promise<TeamInvitation | undefined> {
    const [invitation] = await db
      .select()
      .from(teamInvitations)
      .where(eq(teamInvitations.id, id))
      .limit(1);
    return invitation;
  }

  async getTeamInvitationByToken(token: string): Promise<TeamInvitation | undefined> {
    const [invitation] = await db
      .select()
      .from(teamInvitations)
      .where(eq(teamInvitations.token, token))
      .limit(1);
    return invitation;
  }

  async getTeamInvitationsByEmail(email: string): Promise<TeamInvitation[]> {
    return await db
      .select()
      .from(teamInvitations)
      .where(eq(teamInvitations.email, email.toLowerCase()))
      .orderBy(desc(teamInvitations.createdAt));
  }

  async getTeamInvitationsByInviter(inviterId: number): Promise<TeamInvitation[]> {
    return await db
      .select()
      .from(teamInvitations)
      .where(eq(teamInvitations.invitedBy, inviterId))
      .orderBy(desc(teamInvitations.createdAt));
  }

  async getPendingTeamInvitations(): Promise<TeamInvitation[]> {
    return await db
      .select()
      .from(teamInvitations)
      .where(eq(teamInvitations.status, "pending"))
      .orderBy(desc(teamInvitations.createdAt));
  }

  async createTeamInvitation(invitation: InsertTeamInvitation): Promise<TeamInvitation> {
    const [createdInvitation] = await db.insert(teamInvitations).values(invitation).returning();
    return createdInvitation;
  }

  async updateTeamInvitation(id: number, invitation: Partial<TeamInvitation>): Promise<TeamInvitation | undefined> {
    const [updatedInvitation] = await db
      .update(teamInvitations)
      .set(invitation)
      .where(eq(teamInvitations.id, id))
      .returning();
    return updatedInvitation;
  }

  async deleteTeamInvitation(id: number): Promise<boolean> {
    const result = await db.delete(teamInvitations).where(eq(teamInvitations.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  private async getDashboardCountsForUser(userId: number): Promise<{
    totalConversations: number;
    aiMessages: number;
    userMessages: number;
  }> {
    const [row] = await db
      .select({
        totalConversations: sql<number>`count(distinct ${conversations.id})`,
        aiMessages: sql<number>`coalesce(sum(case when ${messages.sender} = 'ai' then 1 else 0 end), 0)`,
        userMessages: sql<number>`coalesce(sum(case when ${messages.sender} = 'user' then 1 else 0 end), 0)`,
      })
      .from(platforms)
      .leftJoin(conversations, eq(conversations.platformId, platforms.id))
      .leftJoin(messages, eq(messages.conversationId, conversations.id))
      .where(eq(platforms.userId, userId));

    return {
      totalConversations: Number(row?.totalConversations ?? 0),
      aiMessages: Number(row?.aiMessages ?? 0),
      userMessages: Number(row?.userMessages ?? 0),
    };
  }

  /**
   * Get conversation count for a specific user (only conversations with messages)
   */
  async getConversationCountForUser(userId: number): Promise<number> {
    const counts = await this.getDashboardCountsForUser(userId);
    return counts.totalConversations;
  }

  /**
   * Get message count for a specific user
   */
  async getMessageCountForUser(userId: number): Promise<number> {
    const counts = await this.getDashboardCountsForUser(userId);
    return counts.aiMessages;
  }



  /**
   * Calculate response rate for a specific user
   */
  async getResponseRateForUser(userId: number): Promise<number> {
    const counts = await this.getDashboardCountsForUser(userId);
    const userMessages = counts.userMessages;
    const aiMessages = counts.aiMessages;

    return userMessages > 0 ? (aiMessages / userMessages) * 100 : 0;
  }

  // Chat Configuration methods implementation
  async getChatConfiguration(id: number): Promise<ChatConfiguration | undefined> {
    const [config] = await db.select().from(chatConfigurations).where(eq(chatConfigurations.id, id));
    return config;
  }

  async getChatConfigurationByPlatformAndExternalId(platformId: number, externalId: string): Promise<ChatConfiguration | undefined> {
    const [config] = await db
      .select()
      .from(chatConfigurations)
      .where(and(
        eq(chatConfigurations.platformId, platformId),
        eq(chatConfigurations.externalId, externalId)
      ));
    return config;
  }

  async getChatConfigurationsByPlatformId(platformId: number): Promise<ChatConfiguration[]> {
    const results = await db
      .select({
        id: chatConfigurations.id,
        platformId: chatConfigurations.platformId,
        externalId: chatConfigurations.externalId,
        chatName: chatConfigurations.chatName,
        chatType: chatConfigurations.chatType,
        aiConfigurationId: chatConfigurations.aiConfigurationId,
        knowledgeBaseId: chatConfigurations.knowledgeBaseId,
        settings: chatConfigurations.settings,
        isActive: chatConfigurations.isActive,
        createdAt: chatConfigurations.createdAt,
        updatedAt: chatConfigurations.updatedAt,
        aiConfiguration: {
          name: aiConfigurations.name
        },
        knowledgeBase: {
          name: knowledgeBases.name
        }
      })
      .from(chatConfigurations)
      .leftJoin(aiConfigurations, eq(chatConfigurations.aiConfigurationId, aiConfigurations.id))
      .leftJoin(knowledgeBases, eq(chatConfigurations.knowledgeBaseId, knowledgeBases.id))
      .where(eq(chatConfigurations.platformId, platformId))
      .orderBy(asc(chatConfigurations.chatName));

    return results.map(result => ({
      ...result,
      aiConfiguration: result.aiConfiguration?.name ? result.aiConfiguration : undefined,
      knowledgeBase: result.knowledgeBase?.name ? result.knowledgeBase : undefined
    }));
  }

  async createChatConfiguration(chatConfig: InsertChatConfiguration): Promise<ChatConfiguration> {
    const [createdConfig] = await db.insert(chatConfigurations).values(chatConfig).returning();
    return createdConfig;
  }

  async updateChatConfiguration(id: number, chatConfig: Partial<ChatConfiguration>): Promise<ChatConfiguration | undefined> {
    const [updatedConfig] = await db
      .update(chatConfigurations)
      .set({ ...chatConfig, updatedAt: new Date() })
      .where(eq(chatConfigurations.id, id))
      .returning();
    return updatedConfig;
  }

  async deleteChatConfiguration(id: number): Promise<boolean> {
    const result = await db.delete(chatConfigurations).where(eq(chatConfigurations.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Chat history methods implementation
  async getChatHistory(id: number): Promise<ChatHistory | undefined> {
    const [history] = await db.select().from(chatHistory).where(eq(chatHistory.id, id));
    return history;
  }

  async getChatHistoryByChatConfiguration(chatConfigId: number, limit: number = 100): Promise<ChatHistory[]> {
    return await db
      .select()
      .from(chatHistory)
      .where(eq(chatHistory.chatConfigurationId, chatConfigId))
      .orderBy(desc(chatHistory.sentAt))
      .limit(limit);
  }

  async getChatHistoryByPlatform(platformId: number, limit: number = 100): Promise<ChatHistory[]> {
    return await db
      .select()
      .from(chatHistory)
      .where(eq(chatHistory.platformId, platformId))
      .orderBy(desc(chatHistory.sentAt))
      .limit(limit);
  }

  async getAdminChatHistory(chatConfigId: number, limit: number = 100): Promise<ChatHistory[]> {
    return await db
      .select()
      .from(chatHistory)
      .where(and(
        eq(chatHistory.chatConfigurationId, chatConfigId),
        eq(chatHistory.isAdmin, true),
      ))
      .orderBy(desc(chatHistory.sentAt))
      .limit(limit);
  }

  async createChatHistory(chatHistoryData: InsertChatHistory): Promise<ChatHistory> {
    const [created] = await db.insert(chatHistory).values(chatHistoryData).returning();
    return created;
  }

  async updateChatHistory(id: number, chatHistoryData: Partial<ChatHistory>): Promise<ChatHistory | undefined> {
    const [updated] = await db
      .update(chatHistory)
      .set(chatHistoryData)
      .where(eq(chatHistory.id, id))
      .returning();
    return updated;
  }

  async deleteChatHistory(id: number): Promise<boolean> {
    const result = await db.delete(chatHistory).where(eq(chatHistory.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async markChatHistoryForTraining(ids: number[]): Promise<boolean> {
    if (ids.length === 0) return true;
    const result = await db
      .update(chatHistory)
      .set({ isUsedForTraining: true })
      .where(inArray(chatHistory.id, ids))
      .returning({ id: chatHistory.id });
    return result.length > 0;
  }

  // Training insights methods implementation
  async getTrainingInsight(id: number): Promise<TrainingInsights | undefined> {
    const [insight] = await db.select().from(trainingInsights).where(eq(trainingInsights.id, id));
    return insight;
  }

  async getTrainingInsightsByUser(userId: number): Promise<TrainingInsights[]> {
    return await db
      .select()
      .from(trainingInsights)
      .where(eq(trainingInsights.userId, userId))
      .orderBy(desc(trainingInsights.updatedAt));
  }

  async getTrainingInsightsByChatConfiguration(chatConfigId: number): Promise<TrainingInsights[]> {
    return await db
      .select()
      .from(trainingInsights)
      .where(eq(trainingInsights.chatConfigurationId, chatConfigId))
      .orderBy(desc(trainingInsights.updatedAt));
  }

  async getActiveTrainingInsights(userId: number, insightType?: string): Promise<TrainingInsights[]> {
    const filters = [
      eq(trainingInsights.userId, userId),
      eq(trainingInsights.isActive, true),
    ];

    if (insightType) {
      filters.push(eq(trainingInsights.insightType, insightType));
    }

    return await db
      .select()
      .from(trainingInsights)
      .where(and(...filters))
      .orderBy(desc(trainingInsights.updatedAt));
  }

  async createTrainingInsight(insight: InsertTrainingInsights): Promise<TrainingInsights> {
    const [created] = await db.insert(trainingInsights).values(insight).returning();
    return created;
  }

  async updateTrainingInsight(id: number, insight: Partial<TrainingInsights>): Promise<TrainingInsights | undefined> {
    const [updated] = await db
      .update(trainingInsights)
      .set({ ...insight, updatedAt: new Date() })
      .where(eq(trainingInsights.id, id))
      .returning();
    return updated;
  }

  async deleteTrainingInsight(id: number): Promise<boolean> {
    const result = await db.delete(trainingInsights).where(eq(trainingInsights.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }


  // Email Whitelist methods implementation
  async isEmailWhitelisted(email: string): Promise<boolean> {
    const result = await db
      .select()
      .from(emailWhitelist)
      .where(and(eq(emailWhitelist.email, email.toLowerCase()), eq(emailWhitelist.isActive, true)))
      .limit(1);
    return result.length > 0;
  }

  async addEmailToWhitelist(email: string, addedBy?: number): Promise<EmailWhitelist> {
    const normalizedEmail = email.toLowerCase();
    const [whitelist] = await db
      .insert(emailWhitelist)
      .values({
        email: normalizedEmail,
        addedBy: addedBy ?? null,
        isActive: true,
      })
      // If the email was previously removed (is_active=false), re-activate it instead of throwing
      // on the unique(email) constraint.
      .onConflictDoUpdate({
        target: emailWhitelist.email,
        set: {
          addedBy: addedBy ?? null,
          isActive: true,
        },
      })
      .returning();
    return whitelist;
  }

  async removeEmailFromWhitelist(email: string): Promise<boolean> {
    const result = await db
      .update(emailWhitelist)
      .set({ isActive: false })
      .where(eq(emailWhitelist.email, email.toLowerCase()))
      .returning();
    return result.length > 0;
  }

  async getWhitelistedEmails(): Promise<EmailWhitelist[]> {
    return db
      .select()
      .from(emailWhitelist)
      .where(eq(emailWhitelist.isActive, true))
      .orderBy(emailWhitelist.createdAt);
  }

  async getEmailsWhitelistedBy(userId: number): Promise<EmailWhitelist[]> {
    return db
      .select()
      .from(emailWhitelist)
      .where(and(eq(emailWhitelist.addedBy, userId), eq(emailWhitelist.isActive, true)))
      .orderBy(emailWhitelist.createdAt);
  }

  async getWorkspaceSettings(ownerUserId: number): Promise<WorkspaceSettings | undefined> {
    const [settings] = await db
      .select()
      .from(workspaceSettings)
      .where(eq(workspaceSettings.ownerUserId, ownerUserId))
      .limit(1);
    return settings;
  }

  async upsertWorkspaceSettings(ownerUserId: number, patch: WorkspaceSettingsPatch): Promise<WorkspaceSettings> {
    const existing = await this.getWorkspaceSettings(ownerUserId);
    const now = new Date();

    if (!existing) {
      const [created] = await db
        .insert(workspaceSettings)
        .values({
          ownerUserId,
          moderationPreset: patch.moderationPreset ?? "basic",
          moderationRules: patch.moderationRules ?? {
            blockedKeywords: [],
            allowedKeywords: [],
            spamSensitivity: 50,
            strictness: 50,
          },
          createdAt: now,
          updatedAt: now,
        } as InsertWorkspaceSettings)
        .returning();

      if (!created) {
        throw new Error("Failed to create workspace settings");
      }
      return created;
    }

    const updatePayload: Partial<WorkspaceSettings> = {
      updatedAt: now,
    };
    if (patch.moderationPreset !== undefined) {
      updatePayload.moderationPreset = patch.moderationPreset;
    }
    if (patch.moderationRules !== undefined) {
      updatePayload.moderationRules = patch.moderationRules;
    }

    const [updated] = await db
      .update(workspaceSettings)
      .set(updatePayload)
      .where(eq(workspaceSettings.ownerUserId, ownerUserId))
      .returning();

    if (!updated) {
      throw new Error("Failed to update workspace settings");
    }
    return updated;
  }
}

// Use database storage for persistent data
export const storage = new DatabaseStorage();
