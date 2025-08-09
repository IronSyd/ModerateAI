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
  ChatConfiguration, InsertChatConfiguration,
  WebsiteConfiguration, InsertWebsiteConfiguration,
  EmailWhitelist, InsertEmailWhitelist,
  ChatHistory, InsertChatHistory,
  TrainingInsights, InsertTrainingInsights,
  users, platforms, conversations, messages, aiConfigurations, knowledgeBases, knowledgeDocuments, conversationTrainings, teamInvitations, teamSettings, chatConfigurations, websiteConfigurations, emailWhitelist, chatHistory, trainingInsights
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, ne, asc, desc, count, sql, ilike } from "drizzle-orm";
import type { QueryResult } from 'pg';

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
  
  // Website Configuration operations
  getWebsiteConfiguration(id: number): Promise<WebsiteConfiguration | undefined>;
  getWebsiteConfigurationByToken(token: string): Promise<WebsiteConfiguration | undefined>;
  getWebsiteConfigurationsByUserId(userId: number): Promise<WebsiteConfiguration[]>;
  createWebsiteConfiguration(websiteConfig: InsertWebsiteConfiguration): Promise<WebsiteConfiguration>;
  updateWebsiteConfiguration(id: number, websiteConfig: Partial<WebsiteConfiguration>): Promise<WebsiteConfiguration | undefined>;
  deleteWebsiteConfiguration(id: number): Promise<boolean>;
  
  // Analytics operations
  getConversationCount(): Promise<number>;
  getMessageCount(): Promise<number>;

  getResponseRate(): Promise<number>;
  getRecentActivity(limit: number): Promise<{
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

  private userIdCounter: number;
  private platformIdCounter: number;
  private conversationIdCounter: number;
  private messageIdCounter: number;
  private aiConfigurationIdCounter: number;
  private knowledgeBaseIdCounter: number;
  private knowledgeDocumentIdCounter: number;

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

    this.conversationTrainings = new Map();
    this.teamInvitations = new Map();

    this.userIdCounter = 1;
    this.platformIdCounter = 1;
    this.conversationIdCounter = 1;
    this.messageIdCounter = 1;
    this.aiConfigurationIdCounter = 1;
    this.knowledgeBaseIdCounter = 1;
    this.knowledgeDocumentIdCounter = 1;

    this.conversationTrainingIdCounter = 1;
    this.teamInvitationIdCounter = 1;

    // Initialize with demo data
    this.initializeDemoData().catch(error => {
      console.error("Error initializing demo data:", error);
    });
  }

  private async initializeDemoData() {
    // Create demo user
    const demoUser: InsertUser = {
      email: "demo@example.com",
      fullName: "Demo User",
      role: "admin"
    };
    const user = await this.createUser(demoUser);

    // Create example AI configuration
    const aiConfig: InsertAiConfiguration = {
      userId: user.id,
      name: "Default Configuration",
      responseStyle: 75, // Friendly
      responseLength: 40, // Concise

      isActive: true,
      model: "gpt-4o",
      systemPrompt: "You are a helpful customer support assistant for ModerateAI. ModerateAI is a SaaS platform that provides AI-powered chat support and community moderation across websites, Telegram, and Discord. Be friendly, helpful, and professional when answering questions.",
      enableProactiveResponses: false,
      enableConversationMemory: true,
      enableSentimentAnalysis: true,
      enableConversationTraining: false,
    };
    await this.createAiConfiguration(aiConfig);

    // Create knowledge base
    const knowledgeBase: InsertKnowledgeBase = {
      userId: user.id,
      name: "Product Documentation",
      description: "Knowledge base containing product documentation",
      documentCount: 42,
      isActive: true
    };
    await this.createKnowledgeBase(knowledgeBase);

    // Create platforms
    const websitePlatform: InsertPlatform = {
      type: "website",
      name: "Website Chat Widget",
      status: "active",
      userId: user.id,
      config: { widgetColor: "#3B82F6", welcomeMessage: "Hi there! How can I help you today?" },
      authToken: "website-token-12345"
    };
    const website = await this.createPlatform(websitePlatform);

    const telegramPlatform: InsertPlatform = {
      type: "telegram",
      name: "Telegram Bot",
      status: "not_connected",
      userId: user.id,
      config: null,
      authToken: null
    };
    await this.createPlatform(telegramPlatform);

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
    await this.createPlatform(discordPlatform);

    // Create some conversations and messages
    const conversation1: InsertConversation = {
      platformId: website.id,
      externalUserId: "user1",
      externalUsername: "Chelsea Hagon",
      status: "active"
    };
    const conv1 = await this.createConversation(conversation1);

    const message1: InsertMessage = {
      conversationId: conv1.id,
      content: "Asked a question about product pricing",
      sender: "user",
      metadata: null
    };
    await this.createMessage(message1);

    const message2: InsertMessage = {
      conversationId: conv1.id,
      content: "Our pricing is flexible based on your needs. The Basic plan starts at $29/month, the Pro plan at $79/month, and we offer custom Enterprise solutions. Would you like specific details about any of these plans?",
      sender: "ai",
      metadata: null
    };
    await this.createMessage(message2);

    // Add moderation actions

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

  async getPlatformByToken(token: string): Promise<Platform | undefined> {
    for (const platform of this.platforms.values()) {
      if (platform.authToken === token) {
        return platform;
      }
    }
    return undefined;
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

  async getConversationByExternalId(externalId: string): Promise<Conversation | undefined> {
    return Array.from(this.conversations.values()).find(conv => (conv as any).externalId === externalId);
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
    const newConfig = { ...aiConfiguration, id, createdAt: now, updatedAt: now };
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
    const newKnowledgeBase = { ...knowledgeBase, id, createdAt: now };
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



  async getResponseRate(): Promise<number> {
    return 0.95;
  }

  async getRecentActivity(limit: number): Promise<{ user: string; action: string; platform: string; time: Date; }[]> {
    return [
      { user: "Chelsea Hagon", action: "message", platform: "website", time: new Date() },
      { user: "ai", action: "message", platform: "website", time: new Date() }
    ];
  }

  // Website Configuration operations (placeholder implementations)
  async getWebsiteConfiguration(id: number): Promise<WebsiteConfiguration | undefined> {
    return undefined;
  }

  async getWebsiteConfigurationByToken(token: string): Promise<WebsiteConfiguration | undefined> {
    return undefined;
  }

  async getWebsiteConfigurationsByUserId(userId: number): Promise<WebsiteConfiguration[]> {
    return [];
  }

  async createWebsiteConfiguration(websiteConfig: InsertWebsiteConfiguration): Promise<WebsiteConfiguration> {
    return { id: 1, userId: 1, name: "", authToken: "", isActive: true, createdAt: new Date(), updatedAt: new Date(), domain: null, aiConfigurationId: null, knowledgeBaseId: null, config: {} } as WebsiteConfiguration;
  }

  async updateWebsiteConfiguration(id: number, websiteConfig: Partial<WebsiteConfiguration>): Promise<WebsiteConfiguration | undefined> {
    return undefined;
  }

  async deleteWebsiteConfiguration(id: number): Promise<boolean> {
    return false;
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
    const [createdUser] = await db.insert(users).values(user).returning();
    return createdUser;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
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

  async getConversation(id: number): Promise<Conversation | undefined> {
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
    return conversation;
  }
  
  async getConversationByExternalId(externalId: string): Promise<Conversation | undefined> {
    const [conversation] = await db.select().from(conversations).where(eq(conversations.externalId, externalId));
    return conversation;
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

    // Moderation actions (check message metadata for blocked content)
    let contentFiltered = 0;
    let spamBlocked = 0;
    
    allMessages.forEach(msg => {
      if (msg.metadata && typeof msg.metadata === 'object' && msg.metadata !== null) {
        const metadata = msg.metadata as any;
        if (metadata.blocked === 'content') contentFiltered++;
        if (metadata.blocked === 'spam') spamBlocked++;
      }
    });

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

  async getRecentActivity(limit: number): Promise<{ user: string; action: string; platform: string; time: Date; }[]> {
    // Get the most recent messages from all conversations
    const recentMessages = await db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        sender: messages.sender,
        createdAt: messages.createdAt,
        metadata: messages.metadata
      })
      .from(messages)
      .orderBy(desc(messages.createdAt))
      .limit(limit);
    
    // Get the platform information for each conversation
    const messageActivities = await Promise.all(
      recentMessages.map(async (message) => {
        const [conversation] = await db
          .select({
            platformId: conversations.platformId
          })
          .from(conversations)
          .where(eq(conversations.id, message.conversationId));
          
        const [platform] = conversation ? await db
          .select({
            type: platforms.type
          })
          .from(platforms)
          .where(eq(platforms.id, conversation.platformId)) : [{ type: 'unknown' }];
          
        return {
          user: message.metadata?.username || message.sender,
          action: "message",
          platform: platform.type,
          time: message.createdAt
        };
      })
    );
    
    // Return only message activities, sorted by time and limited to the requested number
    return messageActivities
      .sort((a, b) => b.time.getTime() - a.time.getTime())
      .slice(0, limit);
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

  // Implement remaining methods as stubs
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
    const [createdTraining] = await db.insert(conversationTrainings).values(training).returning();
    return createdTraining;
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
    const [createdInvitation] = await db.insert(teamInvitations).values(invitation).returning();
    return createdInvitation;
  }

  async updateTeamInvitation(id: number, invitation: Partial<TeamInvitation>): Promise<TeamInvitation | undefined> {
    return undefined;
  }

  async deleteTeamInvitation(id: number): Promise<boolean> {
    return false;
  }

  /**
   * Get total conversation count from the database
   */
  async getConversationCount(): Promise<number> {
    const result = await db.select({ count: count() }).from(conversations);
    return result[0]?.count || 0;
  }

  /**
   * Get conversation count for a specific user (only conversations with messages)
   */
  async getConversationCountForUser(userId: number): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(conversations)
      .innerJoin(platforms, eq(conversations.platformId, platforms.id))
      .innerJoin(messages, eq(messages.conversationId, conversations.id))
      .where(eq(platforms.userId, userId));
    return result[0]?.count || 0;
  }

  /**
   * Get total message count from the database
   * This represents AI responses
   */
  async getMessageCount(): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(messages)
      .where(eq(messages.sender, 'ai'));
    return result[0]?.count || 0;
  }

  /**
   * Get message count for a specific user
   */
  async getMessageCountForUser(userId: number): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .innerJoin(platforms, eq(conversations.platformId, platforms.id))
      .where(and(eq(messages.sender, 'ai'), eq(platforms.userId, userId)));
    return result[0]?.count || 0;
  }



  /**
   * Calculate response rate based on the number of AI responses vs total messages
   */
  async getResponseRate(): Promise<number> {
    // Get total message count
    const totalResult = await db.select({ count: count() }).from(messages);
    const totalMessages = totalResult[0]?.count || 0;
    
    // Get AI message count
    const aiResult = await db
      .select({ count: count() })
      .from(messages)
      .where(eq(messages.sender, 'ai'));
    const aiMessages = aiResult[0]?.count || 0;
    
    // Calculate response rate as percentage
    return totalMessages > 0 ? (aiMessages / totalMessages) * 100 : 0;
  }

  /**
   * Calculate response rate for a specific user
   */
  async getResponseRateForUser(userId: number): Promise<number> {
    // Get user message count 
    const userResult = await db
      .select({ count: count() })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .innerJoin(platforms, eq(conversations.platformId, platforms.id))
      .where(and(eq(messages.sender, 'user'), eq(platforms.userId, userId)));
    const userMessages = userResult[0]?.count || 0;
    
    // Get AI message count for user
    const aiResult = await db
      .select({ count: count() })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .innerJoin(platforms, eq(conversations.platformId, platforms.id))
      .where(and(eq(messages.sender, 'ai'), eq(platforms.userId, userId)));
    const aiMessages = aiResult[0]?.count || 0;
    
    // Calculate response rate as percentage (AI responses / User messages)
    return userMessages > 0 ? (aiMessages / userMessages) * 100 : 0;
  }

  /**
   * Get recent activity from messages and moderation actions
   */
  async getRecentActivity(limit: number): Promise<{ user: string; action: string; platform: string; time: Date; }[]> {
    // Get the most recent messages
    const recentMessages = await db
      .select({
        id: messages.id,
        content: messages.content,
        sender: messages.sender,
        conversationId: messages.conversationId,
        createdAt: messages.createdAt,
        metadata: messages.metadata
      })
      .from(messages)
      .orderBy(desc(messages.createdAt))
      .limit(Math.floor(limit / 2));
      
    // Get the conversation and platform information for each message
    const messageActivities = await Promise.all(
      recentMessages.map(async (message) => {
        const [conversation] = message.conversationId ? await db
          .select()
          .from(conversations)
          .where(eq(conversations.id, message.conversationId)) : [];
        
        const [platform] = conversation ? await db
          .select({
            type: platforms.type
          })
          .from(platforms)
          .where(eq(platforms.id, conversation.platformId)) : [{ type: 'unknown' }];
          
        return {
          user: typeof message.metadata === 'object' && message.metadata !== null && 'username' in message.metadata 
            ? message.metadata.username as string 
            : message.sender,
          action: "message",
          platform: platform.type,
          time: message.createdAt
        };
      })
    );
    
    // Return only message activities, sorted by time and limited to the requested number
    return messageActivities
      .sort((a, b) => b.time.getTime() - a.time.getTime())
      .slice(0, limit);
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
    return await db
      .select()
      .from(chatConfigurations)
      .where(eq(chatConfigurations.platformId, platformId))
      .orderBy(asc(chatConfigurations.chatName));
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

  // Website Configuration operations
  async getWebsiteConfiguration(id: number): Promise<WebsiteConfiguration | undefined> {
    const [config] = await db.select().from(websiteConfigurations).where(eq(websiteConfigurations.id, id));
    return config;
  }

  async getWebsiteConfigurationByToken(token: string): Promise<WebsiteConfiguration | undefined> {
    const [config] = await db.select().from(websiteConfigurations).where(eq(websiteConfigurations.authToken, token));
    return config;
  }

  async getWebsiteConfigurationsByUserId(userId: number): Promise<WebsiteConfiguration[]> {
    return await db
      .select()
      .from(websiteConfigurations)
      .where(eq(websiteConfigurations.userId, userId))
      .orderBy(asc(websiteConfigurations.name));
  }

  async createWebsiteConfiguration(websiteConfig: InsertWebsiteConfiguration): Promise<WebsiteConfiguration> {
    const [createdConfig] = await db.insert(websiteConfigurations).values(websiteConfig).returning();
    return createdConfig;
  }

  async updateWebsiteConfiguration(id: number, websiteConfig: Partial<WebsiteConfiguration>): Promise<WebsiteConfiguration | undefined> {
    const [updatedConfig] = await db
      .update(websiteConfigurations)
      .set({ ...websiteConfig, updatedAt: new Date() })
      .where(eq(websiteConfigurations.id, id))
      .returning();
    return updatedConfig;
  }

  async deleteWebsiteConfiguration(id: number): Promise<boolean> {
    const result = await db.delete(websiteConfigurations).where(eq(websiteConfigurations.id, id));
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
    const [whitelist] = await db
      .insert(emailWhitelist)
      .values({
        email: email.toLowerCase(),
        addedBy,
        isActive: true
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
}

// Use database storage for persistent data
export const storage = new DatabaseStorage();