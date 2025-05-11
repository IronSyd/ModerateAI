import { 
  User, InsertUser, 
  Platform, InsertPlatform, 
  Conversation, InsertConversation, 
  Message, InsertMessage, 
  AiConfiguration, InsertAiConfiguration, 
  KnowledgeBase, InsertKnowledgeBase,
  KnowledgeDocument, InsertKnowledgeDocument,
  ModerationAction, InsertModerationAction,
  ConversationTraining, InsertConversationTraining,
  TeamInvitation, InsertTeamInvitation,
  TeamSettings, InsertTeamSettings,
  users, platforms, conversations, messages, aiConfigurations, knowledgeBases, knowledgeDocuments, moderationActions, conversationTrainings, teamInvitations, teamSettings
} from "@shared/schema";
import { db } from "./db";
import { eq, and, ne, asc, desc, count, sql } from "drizzle-orm";
import type { QueryResult } from 'pg';

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;

  // Platform operations
  getPlatform(id: number): Promise<Platform | undefined>;
  getPlatformsByUserId(userId: number): Promise<Platform[]>;
  getPlatformsByType(type: string): Promise<Platform[]>;
  createPlatform(platform: InsertPlatform): Promise<Platform>;
  updatePlatform(id: number, platform: Partial<Platform>): Promise<Platform | undefined>;
  deletePlatform(id: number): Promise<boolean>;

  // Conversation operations
  getConversation(id: number): Promise<Conversation | undefined>;
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

  // Moderation Action operations
  getModerationAction(id: number): Promise<ModerationAction | undefined>;
  getModerationActionsByPlatformId(platformId: number): Promise<ModerationAction[]>;
  getModerationActionsByConversationId(conversationId: number): Promise<ModerationAction[]>;
  createModerationAction(moderationAction: InsertModerationAction): Promise<ModerationAction>;

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
  
  // Analytics operations
  getConversationCount(): Promise<number>;
  getMessageCount(): Promise<number>;
  getModerationActionCount(): Promise<number>;
  getResponseRate(): Promise<number>;
  getRecentActivity(limit: number): Promise<{
    user: string;
    action: string;
    platform: string;
    time: Date;
  }[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private platforms: Map<number, Platform>;
  private conversations: Map<number, Conversation>;
  private messages: Map<number, Message>;
  private aiConfigurations: Map<number, AiConfiguration>;
  private knowledgeBases: Map<number, KnowledgeBase>;
  private knowledgeDocuments: Map<number, KnowledgeDocument>;
  private moderationActions: Map<number, ModerationAction>;
  private conversationTrainings: Map<number, ConversationTraining>;
  private teamInvitations: Map<number, TeamInvitation>;

  private userIdCounter: number;
  private platformIdCounter: number;
  private conversationIdCounter: number;
  private messageIdCounter: number;
  private aiConfigurationIdCounter: number;
  private knowledgeBaseIdCounter: number;
  private knowledgeDocumentIdCounter: number;
  private moderationActionIdCounter: number;
  private conversationTrainingIdCounter: number;
  private teamInvitationIdCounter: number;

  constructor() {
    this.users = new Map();
    this.platforms = new Map();
    this.conversations = new Map();
    this.messages = new Map();
    this.aiConfigurations = new Map();
    this.knowledgeBases = new Map();
    this.knowledgeDocuments = new Map();
    this.moderationActions = new Map();
    this.conversationTrainings = new Map();
    this.teamInvitations = new Map();

    this.userIdCounter = 1;
    this.platformIdCounter = 1;
    this.conversationIdCounter = 1;
    this.messageIdCounter = 1;
    this.aiConfigurationIdCounter = 1;
    this.knowledgeBaseIdCounter = 1;
    this.knowledgeDocumentIdCounter = 1;
    this.moderationActionIdCounter = 1;
    this.conversationTrainingIdCounter = 1;
    this.teamInvitationIdCounter = 1;

    // Initialize with demo data
    this.initializeDemoData();
  }

  private initializeDemoData() {
    // Create demo user
    const demoUser: InsertUser = {
      username: "demo",
      password: "password123", // This would be hashed in a real app
      email: "demo@example.com",
      fullName: "Demo User",
      role: "admin"
    };
    const user = this.createUser(demoUser);

    // Create example AI configuration
    const aiConfig: InsertAiConfiguration = {
      userId: user.id,
      name: "Default Configuration",
      responseStyle: 75, // Friendly
      responseLength: 40, // Concise
      moderationStrictness: 50, // Balanced
      isActive: true,
      model: "gpt-4o",
      systemPrompt: "You are a helpful customer support assistant for ModerateAI. ModerateAI is a SaaS platform that provides AI-powered chat support and community moderation across websites, Telegram, and Discord. Be friendly, helpful, and professional when answering questions.",
      enableProactiveResponses: false,
      enableConversationMemory: true,
      enableSentimentAnalysis: true,
      enableConversationTraining: false,
    };
    this.createAiConfiguration(aiConfig);

    // Create knowledge base
    const knowledgeBase: InsertKnowledgeBase = {
      userId: user.id,
      name: "Product Documentation",
      description: "Knowledge base containing product documentation",
      documentCount: 42,
      isActive: true
    };
    this.createKnowledgeBase(knowledgeBase);

    // Create platforms
    const websitePlatform: InsertPlatform = {
      type: "website",
      name: "Website Chat Widget",
      status: "active",
      userId: user.id,
      config: { widgetColor: "#3B82F6", welcomeMessage: "Hi there! How can I help you today?" },
      authToken: "website-token-12345"
    };
    const website = this.createPlatform(websitePlatform);

    const telegramPlatform: InsertPlatform = {
      type: "telegram",
      name: "Telegram Bot",
      status: "not_connected",
      userId: user.id,
      config: null,
      authToken: null
    };
    this.createPlatform(telegramPlatform);

    const discordPlatform: InsertPlatform = {
      type: "discord",
      name: "Discord Bot",
      status: "active",
      userId: user.id,
      config: { 
        serverId: "123456789",
        botName: "ModerateAI",
        serverName: "Moderation AI Community",
        memberCount: 127,
        channels: [
          { id: "1", name: "general", type: "text", moderationEnabled: true, active: true },
          { id: "2", name: "help", type: "text", moderationEnabled: true, active: true }
        ],
        dailyMessages: 134,
        moderationCount: 12,
        welcomeMessage: "Hello! I'm your AI assistant. How can I help you today?",
        permissions: "8",
        setupCompleted: true,
      },
      authToken: "discord-token-partial"
    };
    this.createPlatform(discordPlatform);

    // Create some conversations and messages
    const conversation1: InsertConversation = {
      platformId: website.id,
      externalUserId: "user1",
      externalUsername: "Chelsea Hagon",
      status: "active"
    };
    const conv1 = this.createConversation(conversation1);

    const message1: InsertMessage = {
      conversationId: conv1.id,
      content: "Asked a question about product pricing",
      sender: "user",
      metadata: null
    };
    this.createMessage(message1);

    const message2: InsertMessage = {
      conversationId: conv1.id,
      content: "Our pricing is flexible based on your needs. The Basic plan starts at $29/month, the Pro plan at $79/month, and we offer custom Enterprise solutions. Would you like specific details about any of these plans?",
      sender: "ai",
      metadata: null
    };
    this.createMessage(message2);

    // Add moderation actions
    const modAction: InsertModerationAction = {
      platformId: website.id,
      conversationId: conv1.id,
      messageId: null,
      action: "flag",
      reason: "Potential sensitive information",
      automatic: true
    };
    this.createModerationAction(modAction);
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async createUser(user: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const now = new Date();
    const newUser = { ...user, id, createdAt: now };
    this.users.set(id, newUser);
    return newUser;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  // Platform operations
  async getPlatform(id: number): Promise<Platform | undefined> {
    return this.platforms.get(id);
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
    const newPlatform = { ...platform, id, createdAt: now };
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

  // ... rest of the implementation
  
  // Add stubs for the remaining methods to satisfy the interface
  async getConversation(id: number): Promise<Conversation | undefined> {
    return this.conversations.get(id);
  }

  async getConversationsByPlatformId(platformId: number): Promise<Conversation[]> {
    return Array.from(this.conversations.values()).filter(conv => conv.platformId === platformId);
  }

  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    const id = this.conversationIdCounter++;
    const now = new Date();
    const newConversation = { 
      ...conversation, 
      id, 
      createdAt: now, 
      updatedAt: now 
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
    const newMessage = { ...message, id, createdAt: now };
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
    return [];
  }

  async getActiveAiConfiguration(userId: number): Promise<AiConfiguration | undefined> {
    return undefined;
  }

  async createAiConfiguration(aiConfiguration: InsertAiConfiguration): Promise<AiConfiguration> {
    const id = this.aiConfigurationIdCounter++;
    const now = new Date();
    const newConfig = { ...aiConfiguration, id, createdAt: now, updatedAt: now };
    this.aiConfigurations.set(id, newConfig);
    return newConfig;
  }

  async updateAiConfiguration(id: number, aiConfiguration: Partial<AiConfiguration>): Promise<AiConfiguration | undefined> {
    return undefined;
  }

  async getKnowledgeBase(id: number): Promise<KnowledgeBase | undefined> {
    return undefined;
  }

  async getKnowledgeBasesByUserId(userId: number): Promise<KnowledgeBase[]> {
    return [];
  }

  async getActiveKnowledgeBase(userId: number): Promise<KnowledgeBase | undefined> {
    return undefined;
  }

  async createKnowledgeBase(knowledgeBase: InsertKnowledgeBase): Promise<KnowledgeBase> {
    const id = this.knowledgeBaseIdCounter++;
    const now = new Date();
    const newKnowledgeBase = { ...knowledgeBase, id, createdAt: now };
    this.knowledgeBases.set(id, newKnowledgeBase);
    return newKnowledgeBase;
  }

  async updateKnowledgeBase(id: number, knowledgeBase: Partial<KnowledgeBase>): Promise<KnowledgeBase | undefined> {
    return undefined;
  }

  async getKnowledgeDocument(id: number): Promise<KnowledgeDocument | undefined> {
    return undefined;
  }

  async getKnowledgeDocumentsByKnowledgeBaseId(knowledgeBaseId: number): Promise<KnowledgeDocument[]> {
    return [];
  }

  async searchKnowledgeDocuments(query: string): Promise<KnowledgeDocument[]> {
    return [];
  }

  async createKnowledgeDocument(document: InsertKnowledgeDocument): Promise<KnowledgeDocument> {
    return { id: 1, createdAt: new Date(), updatedAt: new Date(), title: "", content: "", knowledgeBaseId: 1, metadata: {} } as KnowledgeDocument;
  }

  async updateKnowledgeDocument(id: number, document: Partial<KnowledgeDocument>): Promise<KnowledgeDocument | undefined> {
    return undefined;
  }

  async deleteKnowledgeDocument(id: number): Promise<boolean> {
    return false;
  }

  async getModerationAction(id: number): Promise<ModerationAction | undefined> {
    return undefined;
  }

  async getModerationActionsByPlatformId(platformId: number): Promise<ModerationAction[]> {
    return [];
  }

  async getModerationActionsByConversationId(conversationId: number): Promise<ModerationAction[]> {
    return [];
  }

  async createModerationAction(moderationAction: InsertModerationAction): Promise<ModerationAction> {
    const id = this.moderationActionIdCounter++;
    const now = new Date();
    const newAction = { ...moderationAction, id, createdAt: now };
    this.moderationActions.set(id, newAction);
    return newAction;
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
    return { id: 1, email: "", role: "user", createdAt: new Date(), status: "pending", token: "", invitedBy: 1, expiresAt: new Date(), acceptedAt: null } as TeamInvitation;
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

  async getModerationActionCount(): Promise<number> {
    return this.moderationActions.size;
  }

  async getResponseRate(): Promise<number> {
    return 0.95;
  }

  async getRecentActivity(limit: number): Promise<{ user: string; action: string; platform: string; time: Date; }[]> {
    return [
      { user: "Chelsea Hagon", action: "message", platform: "website", time: new Date() },
      { user: "ai", action: "message", platform: "website", time: new Date() }
    ];
  }
}

// For now, continue using the in-memory storage
export const storage = new MemStorage();