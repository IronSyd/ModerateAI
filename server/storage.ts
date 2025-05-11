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
  users, platforms, conversations, messages, aiConfigurations, knowledgeBases, knowledgeDocuments, moderationActions, conversationTrainings, teamInvitations, teamSettings, TeamSettings, InsertTeamSettings
} from "@shared/schema";
import { db } from "./db";
import { eq, and, ne, asc, desc, count, sql, InferModel } from "drizzle-orm";

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

export class DatabaseStorage implements IStorage {
  constructor() {}

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  // Platform operations
  async getPlatform(id: number): Promise<Platform | undefined> {
    const [platform] = await db.select().from(platforms).where(eq(platforms.id, id));
    return platform || undefined;
  }

  async getPlatformsByUserId(userId: number): Promise<Platform[]> {
    return db.select().from(platforms).where(eq(platforms.userId, userId));
  }

  async getPlatformsByType(type: string): Promise<Platform[]> {
    return db.select().from(platforms).where(eq(platforms.type, type));
  }

  async createPlatform(platform: InsertPlatform): Promise<Platform> {
    const [newPlatform] = await db.insert(platforms).values(platform).returning();
    return newPlatform;
  }

  async updatePlatform(id: number, platform: Partial<Platform>): Promise<Platform | undefined> {
    const [updatedPlatform] = await db
      .update(platforms)
      .set(platform)
      .where(eq(platforms.id, id))
      .returning();
    return updatedPlatform || undefined;
  }

  async deletePlatform(id: number): Promise<boolean> {
    const result = await db.delete(platforms).where(eq(platforms.id, id));
    return result.rowCount > 0;
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
      name: "Moderation AI Community",
      status: "active",
      userId: user.id,
      config: { 
        serverId: "123456789",
        botName: "ModerateAI",
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
    const newUser: User = { ...user, id, createdAt: now };
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
    const newPlatform: Platform = { ...platform, id, createdAt: now };
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

  // Conversation operations
  async getConversation(id: number): Promise<Conversation | undefined> {
    return this.conversations.get(id);
  }

  async getConversationsByPlatformId(platformId: number): Promise<Conversation[]> {
    return Array.from(this.conversations.values()).filter(conversation => conversation.platformId === platformId);
  }

  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    const id = this.conversationIdCounter++;
    const now = new Date();
    const newConversation: Conversation = { 
      ...conversation, 
      id, 
      createdAt: now, 
      updatedAt: now 
    };
    this.conversations.set(id, newConversation);
    return newConversation;
  }

  async updateConversation(id: number, conversation: Partial<Conversation>): Promise<Conversation | undefined> {
    const existingConversation = this.conversations.get(id);
    if (!existingConversation) return undefined;
    
    const updatedConversation = { 
      ...existingConversation, 
      ...conversation,
      updatedAt: new Date() 
    };
    this.conversations.set(id, updatedConversation);
    return updatedConversation;
  }

  async closeConversation(id: number): Promise<Conversation | undefined> {
    return this.updateConversation(id, { status: "closed", updatedAt: new Date() });
  }

  // Message operations
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
    const newMessage: Message = { ...message, id, createdAt: now };
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

  // AI Configuration operations
  async getAiConfiguration(id: number): Promise<AiConfiguration | undefined> {
    return this.aiConfigurations.get(id);
  }

  async getAiConfigurationsByUserId(userId: number): Promise<AiConfiguration[]> {
    return Array.from(this.aiConfigurations.values()).filter(config => config.userId === userId);
  }

  async getActiveAiConfiguration(userId: number): Promise<AiConfiguration | undefined> {
    return Array.from(this.aiConfigurations.values()).find(
      config => config.userId === userId && config.isActive
    );
  }

  async createAiConfiguration(aiConfiguration: InsertAiConfiguration): Promise<AiConfiguration> {
    const id = this.aiConfigurationIdCounter++;
    const now = new Date();
    const newAiConfiguration: AiConfiguration = { 
      ...aiConfiguration, 
      id, 
      createdAt: now, 
      updatedAt: now 
    };
    this.aiConfigurations.set(id, newAiConfiguration);
    return newAiConfiguration;
  }

  async updateAiConfiguration(id: number, aiConfiguration: Partial<AiConfiguration>): Promise<AiConfiguration | undefined> {
    const existingAiConfiguration = this.aiConfigurations.get(id);
    if (!existingAiConfiguration) return undefined;
    
    const updatedAiConfiguration = { 
      ...existingAiConfiguration, 
      ...aiConfiguration,
      updatedAt: new Date() 
    };
    this.aiConfigurations.set(id, updatedAiConfiguration);
    return updatedAiConfiguration;
  }

  // Knowledge Base operations
  async getKnowledgeBase(id: number): Promise<KnowledgeBase | undefined> {
    return this.knowledgeBases.get(id);
  }

  async getKnowledgeBasesByUserId(userId: number): Promise<KnowledgeBase[]> {
    return Array.from(this.knowledgeBases.values()).filter(kb => kb.userId === userId);
  }

  async getActiveKnowledgeBase(userId: number): Promise<KnowledgeBase | undefined> {
    return Array.from(this.knowledgeBases.values()).find(
      kb => kb.userId === userId && kb.isActive
    );
  }

  async createKnowledgeBase(knowledgeBase: InsertKnowledgeBase): Promise<KnowledgeBase> {
    const id = this.knowledgeBaseIdCounter++;
    const now = new Date();
    const newKnowledgeBase: KnowledgeBase = { 
      ...knowledgeBase, 
      id, 
      createdAt: now
    };
    this.knowledgeBases.set(id, newKnowledgeBase);
    return newKnowledgeBase;
  }

  async updateKnowledgeBase(id: number, knowledgeBase: Partial<KnowledgeBase>): Promise<KnowledgeBase | undefined> {
    const existingKnowledgeBase = this.knowledgeBases.get(id);
    if (!existingKnowledgeBase) return undefined;
    
    const updatedKnowledgeBase = { 
      ...existingKnowledgeBase, 
      ...knowledgeBase
    };
    this.knowledgeBases.set(id, updatedKnowledgeBase);
    return updatedKnowledgeBase;
  }

  // Knowledge Document operations
  async getKnowledgeDocument(id: number): Promise<KnowledgeDocument | undefined> {
    return this.knowledgeDocuments.get(id);
  }

  async getKnowledgeDocumentsByKnowledgeBaseId(knowledgeBaseId: number): Promise<KnowledgeDocument[]> {
    return Array.from(this.knowledgeDocuments.values())
      .filter(doc => doc.knowledgeBaseId === knowledgeBaseId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async searchKnowledgeDocuments(query: string): Promise<KnowledgeDocument[]> {
    // Simple search implementation that checks if the query exists in title or content
    const lowercaseQuery = query.toLowerCase();
    return Array.from(this.knowledgeDocuments.values())
      .filter(doc => 
        doc.title.toLowerCase().includes(lowercaseQuery) ||
        doc.content.toLowerCase().includes(lowercaseQuery)
      )
      .sort((a, b) => {
        // Sort by relevance (title matches first, then content matches)
        const aTitleMatch = a.title.toLowerCase().includes(lowercaseQuery);
        const bTitleMatch = b.title.toLowerCase().includes(lowercaseQuery);
        
        if (aTitleMatch && !bTitleMatch) return -1;
        if (!aTitleMatch && bTitleMatch) return 1;
        return 0;
      });
  }

  async createKnowledgeDocument(document: InsertKnowledgeDocument): Promise<KnowledgeDocument> {
    const id = this.knowledgeDocumentIdCounter++;
    const now = new Date();
    const newDocument: KnowledgeDocument = {
      ...document,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.knowledgeDocuments.set(id, newDocument);

    // Update the document count in the knowledge base
    const knowledgeBase = this.knowledgeBases.get(document.knowledgeBaseId);
    if (knowledgeBase) {
      this.knowledgeBases.set(knowledgeBase.id, {
        ...knowledgeBase,
        documentCount: knowledgeBase.documentCount + 1
      });
    }

    return newDocument;
  }

  async updateKnowledgeDocument(id: number, document: Partial<KnowledgeDocument>): Promise<KnowledgeDocument | undefined> {
    const existingDocument = this.knowledgeDocuments.get(id);
    if (!existingDocument) return undefined;
    
    const updatedDocument = {
      ...existingDocument,
      ...document,
      updatedAt: new Date()
    };
    this.knowledgeDocuments.set(id, updatedDocument);
    return updatedDocument;
  }

  async deleteKnowledgeDocument(id: number): Promise<boolean> {
    const document = this.knowledgeDocuments.get(id);
    if (!document) return false;
    
    // Update the document count in the knowledge base
    const knowledgeBase = this.knowledgeBases.get(document.knowledgeBaseId);
    if (knowledgeBase && knowledgeBase.documentCount > 0) {
      this.knowledgeBases.set(knowledgeBase.id, {
        ...knowledgeBase,
        documentCount: knowledgeBase.documentCount - 1
      });
    }
    
    return this.knowledgeDocuments.delete(id);
  }

  // Moderation Action operations
  async getModerationAction(id: number): Promise<ModerationAction | undefined> {
    return this.moderationActions.get(id);
  }

  async getModerationActionsByPlatformId(platformId: number): Promise<ModerationAction[]> {
    return Array.from(this.moderationActions.values())
      .filter(action => action.platformId === platformId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getModerationActionsByConversationId(conversationId: number): Promise<ModerationAction[]> {
    return Array.from(this.moderationActions.values())
      .filter(action => action.conversationId === conversationId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createModerationAction(moderationAction: InsertModerationAction): Promise<ModerationAction> {
    const id = this.moderationActionIdCounter++;
    const now = new Date();
    const newModerationAction: ModerationAction = { 
      ...moderationAction, 
      id, 
      createdAt: now 
    };
    this.moderationActions.set(id, newModerationAction);
    return newModerationAction;
  }
  
  // Conversation Training operations
  async getConversationTraining(id: number): Promise<ConversationTraining | undefined> {
    return this.conversationTrainings.get(id);
  }

  async getConversationTrainingsByUserId(userId: number): Promise<ConversationTraining[]> {
    return Array.from(this.conversationTrainings.values())
      .filter(training => training.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); // Most recent first
  }

  async getConversationTrainingsByPlatformId(platformId: number): Promise<ConversationTraining[]> {
    return Array.from(this.conversationTrainings.values())
      .filter(training => training.platformId === platformId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); // Most recent first
  }

  async getLatestConversationTraining(userId: number, platformId: number): Promise<ConversationTraining | undefined> {
    return Array.from(this.conversationTrainings.values())
      .filter(training => training.userId === userId && training.platformId === platformId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]; // Most recent first
  }

  async createConversationTraining(training: InsertConversationTraining): Promise<ConversationTraining> {
    const id = this.conversationTrainingIdCounter++;
    const now = new Date();
    const newTraining: ConversationTraining = {
      ...training,
      id,
      createdAt: now,
      updatedAt: now,
      processedConversations: 0,
      completedAt: null,
      lastTrainedConversationId: null,
      errorMessage: null
    };
    this.conversationTrainings.set(id, newTraining);
    return newTraining;
  }

  async updateConversationTraining(id: number, updates: Partial<ConversationTraining>): Promise<ConversationTraining | undefined> {
    const existingTraining = this.conversationTrainings.get(id);
    if (!existingTraining) return undefined;
    
    const updatedTraining = {
      ...existingTraining,
      ...updates,
      updatedAt: new Date()
    };
    this.conversationTrainings.set(id, updatedTraining);
    return updatedTraining;
  }

  // Analytics operations
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
    const allMessages = Array.from(this.messages.values());
    const userMessages = allMessages.filter(message => message.sender === "user").length;
    const aiMessages = allMessages.filter(message => message.sender === "ai").length;
    
    if (userMessages === 0) return 100;
    return (aiMessages / userMessages) * 100;
  }

  async getRecentActivity(limit: number): Promise<{ user: string; action: string; platform: string; time: Date; }[]> {
    // Get recent messages
    const recentMessages = Array.from(this.messages.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
    
    // Map messages to activity format
    const activities = await Promise.all(recentMessages.map(async message => {
      const conversation = this.conversations.get(message.conversationId);
      if (!conversation) return null;
      
      const platform = this.platforms.get(conversation.platformId);
      if (!platform) return null;
      
      return {
        user: conversation.externalUsername || 'Anonymous User',
        action: message.sender === 'user' ? message.content : 'Received AI response',
        platform: platform.type,
        time: message.createdAt
      };
    }));
    
    // Filter out null activities and limit to requested size
    return activities.filter(Boolean).slice(0, limit);
  }

  // Team Invitation operations
  async getTeamInvitation(id: number): Promise<TeamInvitation | undefined> {
    return this.teamInvitations.get(id);
  }

  async getTeamInvitationByToken(token: string): Promise<TeamInvitation | undefined> {
    return Array.from(this.teamInvitations.values()).find(invitation => invitation.token === token);
  }

  async getTeamInvitationsByEmail(email: string): Promise<TeamInvitation[]> {
    return Array.from(this.teamInvitations.values()).filter(invitation => invitation.email === email);
  }

  async getTeamInvitationsByInviter(inviterId: number): Promise<TeamInvitation[]> {
    return Array.from(this.teamInvitations.values()).filter(invitation => invitation.invitedBy === inviterId);
  }

  async getPendingTeamInvitations(): Promise<TeamInvitation[]> {
    const now = new Date();
    return Array.from(this.teamInvitations.values())
      .filter(invitation => invitation.status === "pending" && invitation.expiresAt > now);
  }

  async createTeamInvitation(invitation: InsertTeamInvitation): Promise<TeamInvitation> {
    const id = this.teamInvitationIdCounter++;
    const now = new Date();
    // Generate a random UUID-like token
    const token = `${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`;
    
    const newInvitation: TeamInvitation = {
      ...invitation,
      id,
      token,
      status: "pending",
      createdAt: now,
      acceptedAt: null
    };
    
    this.teamInvitations.set(id, newInvitation);
    return newInvitation;
  }

  async updateTeamInvitation(id: number, invitation: Partial<TeamInvitation>): Promise<TeamInvitation | undefined> {
    const existingInvitation = this.teamInvitations.get(id);
    if (!existingInvitation) return undefined;
    
    const updatedInvitation = { ...existingInvitation, ...invitation };
    this.teamInvitations.set(id, updatedInvitation);
    return updatedInvitation;
  }

  async deleteTeamInvitation(id: number): Promise<boolean> {
    return this.teamInvitations.delete(id);
  }
}

// Database storage implementation
export class DatabaseStorage implements IStorage {
  // Team Invitation operations
  async getTeamInvitation(id: number): Promise<TeamInvitation | undefined> {
    const result = await db.select().from(teamInvitations).where(eq(teamInvitations.id, id)).limit(1);
    return result[0];
  }

  async getTeamInvitationByToken(token: string): Promise<TeamInvitation | undefined> {
    const result = await db.select().from(teamInvitations).where(eq(teamInvitations.token, token)).limit(1);
    return result[0];
  }

  async getTeamInvitationsByEmail(email: string): Promise<TeamInvitation[]> {
    return db.select().from(teamInvitations).where(eq(teamInvitations.email, email));
  }

  async getTeamInvitationsByInviter(inviterId: number): Promise<TeamInvitation[]> {
    return db.select().from(teamInvitations).where(eq(teamInvitations.invitedBy, inviterId));
  }

  async getPendingTeamInvitations(): Promise<TeamInvitation[]> {
    return db.select()
      .from(teamInvitations)
      .where(eq(teamInvitations.status, "pending"))
      .where(sql`${teamInvitations.expiresAt} > NOW()`);
  }

  async createTeamInvitation(invitation: InsertTeamInvitation): Promise<TeamInvitation> {
    const result = await db.insert(teamInvitations).values(invitation).returning();
    return result[0];
  }

  async updateTeamInvitation(id: number, invitation: Partial<TeamInvitation>): Promise<TeamInvitation | undefined> {
    const result = await db.update(teamInvitations)
      .set(invitation)
      .where(eq(teamInvitations.id, id))
      .returning();
    return result[0];
  }

  async deleteTeamInvitation(id: number): Promise<boolean> {
    const result = await db.delete(teamInvitations).where(eq(teamInvitations.id, id)).returning();
    return result.length > 0;
  }
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  // Platform operations
  async getPlatform(id: number): Promise<Platform | undefined> {
    const [platform] = await db.select().from(platforms).where(eq(platforms.id, id));
    return platform;
  }

  async getPlatformsByUserId(userId: number): Promise<Platform[]> {
    return await db.select().from(platforms).where(eq(platforms.userId, userId));
  }

  async getPlatformsByType(type: string): Promise<Platform[]> {
    return await db.select().from(platforms).where(eq(platforms.type, type));
  }

  async createPlatform(platform: InsertPlatform): Promise<Platform> {
    const [newPlatform] = await db.insert(platforms).values(platform).returning();
    return newPlatform;
  }

  async updatePlatform(id: number, updates: Partial<Platform>): Promise<Platform | undefined> {
    const [updatedPlatform] = await db
      .update(platforms)
      .set(updates)
      .where(eq(platforms.id, id))
      .returning();
    return updatedPlatform;
  }

  async deletePlatform(id: number): Promise<boolean> {
    const result = await db.delete(platforms).where(eq(platforms.id, id));
    return result.count > 0;
  }

  // Conversation operations
  async getConversation(id: number): Promise<Conversation | undefined> {
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
    return conversation;
  }

  async getConversationsByPlatformId(platformId: number): Promise<Conversation[]> {
    return await db.select().from(conversations).where(eq(conversations.platformId, platformId));
  }

  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    const now = new Date();
    const [newConversation] = await db.insert(conversations)
      .values({
        ...conversation,
        updatedAt: now
      })
      .returning();
    return newConversation;
  }

  async updateConversation(id: number, updates: Partial<Conversation>): Promise<Conversation | undefined> {
    const [updatedConversation] = await db
      .update(conversations)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(conversations.id, id))
      .returning();
    return updatedConversation;
  }

  async closeConversation(id: number): Promise<Conversation | undefined> {
    return this.updateConversation(id, { status: "closed" });
  }

  // Message operations
  async getMessage(id: number): Promise<Message | undefined> {
    const [message] = await db.select().from(messages).where(eq(messages.id, id));
    return message;
  }

  async getMessagesByConversationId(conversationId: number): Promise<Message[]> {
    return await db.select().from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.createdAt));
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const [newMessage] = await db.insert(messages).values(message).returning();
    
    // Update the conversation's updatedAt timestamp
    await db.update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, message.conversationId));
      
    return newMessage;
  }

  // AI Configuration operations
  async getAiConfiguration(id: number): Promise<AiConfiguration | undefined> {
    const [config] = await db.select().from(aiConfigurations).where(eq(aiConfigurations.id, id));
    return config;
  }

  async getAiConfigurationsByUserId(userId: number): Promise<AiConfiguration[]> {
    return await db.select().from(aiConfigurations).where(eq(aiConfigurations.userId, userId));
  }

  async getActiveAiConfiguration(userId: number): Promise<AiConfiguration | undefined> {
    const [config] = await db.select().from(aiConfigurations)
      .where(and(
        eq(aiConfigurations.userId, userId),
        eq(aiConfigurations.isActive, true)
      ));
    return config;
  }

  async createAiConfiguration(config: InsertAiConfiguration): Promise<AiConfiguration> {
    // If this configuration is active, deactivate all other configurations for this user
    if (config.isActive) {
      await db.update(aiConfigurations)
        .set({ isActive: false })
        .where(eq(aiConfigurations.userId, config.userId));
    }
    
    const [newConfig] = await db.insert(aiConfigurations)
      .values({
        ...config,
        updatedAt: new Date()
      })
      .returning();
    return newConfig;
  }

  async updateAiConfiguration(id: number, updates: Partial<AiConfiguration>): Promise<AiConfiguration | undefined> {
    // If this configuration is being set to active, deactivate all other configurations for this user
    if (updates.isActive) {
      const [config] = await db.select().from(aiConfigurations).where(eq(aiConfigurations.id, id));
      if (config) {
        await db.update(aiConfigurations)
          .set({ isActive: false })
          .where(and(
            eq(aiConfigurations.userId, config.userId),
            ne(aiConfigurations.id, id)
          ));
      }
    }
    
    const [updatedConfig] = await db.update(aiConfigurations)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(aiConfigurations.id, id))
      .returning();
    return updatedConfig;
  }

  // Knowledge Base operations
  async getKnowledgeBase(id: number): Promise<KnowledgeBase | undefined> {
    const [kb] = await db.select().from(knowledgeBases).where(eq(knowledgeBases.id, id));
    return kb;
  }

  async getKnowledgeBasesByUserId(userId: number): Promise<KnowledgeBase[]> {
    return await db.select().from(knowledgeBases).where(eq(knowledgeBases.userId, userId));
  }

  async getActiveKnowledgeBase(userId: number): Promise<KnowledgeBase | undefined> {
    const [kb] = await db.select().from(knowledgeBases)
      .where(and(
        eq(knowledgeBases.userId, userId),
        eq(knowledgeBases.isActive, true)
      ));
    return kb;
  }

  async createKnowledgeBase(kb: InsertKnowledgeBase): Promise<KnowledgeBase> {
    // If this knowledge base is active, deactivate all other knowledge bases for this user
    if (kb.isActive) {
      await db.update(knowledgeBases)
        .set({ isActive: false })
        .where(eq(knowledgeBases.userId, kb.userId));
    }
    
    const [newKb] = await db.insert(knowledgeBases).values(kb).returning();
    return newKb;
  }

  async updateKnowledgeBase(id: number, updates: Partial<KnowledgeBase>): Promise<KnowledgeBase | undefined> {
    // If this knowledge base is being set to active, deactivate all other knowledge bases for this user
    if (updates.isActive) {
      const [kb] = await db.select().from(knowledgeBases).where(eq(knowledgeBases.id, id));
      if (kb) {
        await db.update(knowledgeBases)
          .set({ isActive: false })
          .where(and(
            eq(knowledgeBases.userId, kb.userId),
            ne(knowledgeBases.id, id)
          ));
      }
    }
    
    const [updatedKb] = await db.update(knowledgeBases)
      .set(updates)
      .where(eq(knowledgeBases.id, id))
      .returning();
    return updatedKb;
  }

  // Knowledge Document operations
  async getKnowledgeDocument(id: number): Promise<KnowledgeDocument | undefined> {
    const [doc] = await db.select().from(knowledgeDocuments).where(eq(knowledgeDocuments.id, id));
    return doc;
  }

  async getKnowledgeDocumentsByKnowledgeBaseId(knowledgeBaseId: number): Promise<KnowledgeDocument[]> {
    return await db.select().from(knowledgeDocuments)
      .where(eq(knowledgeDocuments.knowledgeBaseId, knowledgeBaseId))
      .orderBy(asc(knowledgeDocuments.createdAt));
  }

  async searchKnowledgeDocuments(query: string): Promise<KnowledgeDocument[]> {
    console.log(`[searchKnowledgeDocuments] Searching for: "${query}"`);
    
    // Extract keywords from the query
    const keywords = this.extractKeywords(query);
    console.log(`[searchKnowledgeDocuments] Extracted keywords: ${keywords.join(', ')}`);
    
    // Get all documents first (we'll have a small number initially)
    const allDocuments = await db.select().from(knowledgeDocuments);
    console.log(`[searchKnowledgeDocuments] Total documents available: ${allDocuments.length}`);
    
    if (allDocuments.length === 0) {
      return [];
    }
    
    // Score each document based on keyword matches
    const scoredDocuments = allDocuments.map(doc => {
      const titleScore = this.calculateMatchScore(doc.title, keywords);
      const contentScore = this.calculateMatchScore(doc.content, keywords);
      const totalScore = titleScore * 2 + contentScore; // Title matches weighted higher
      
      return {
        document: doc,
        score: totalScore
      };
    });
    
    // Sort by score (highest first) and return just the documents
    const sortedDocuments = scoredDocuments
      .sort((a, b) => b.score - a.score)
      .filter(item => item.score > 0) // Only return documents with at least some relevance
      .map(item => item.document);
    
    console.log(`[searchKnowledgeDocuments] Found ${sortedDocuments.length} relevant documents`);
    if (sortedDocuments.length > 0) {
      sortedDocuments.forEach((doc, i) => {
        if (i < 3) { // Log just the top 3
          console.log(`[searchKnowledgeDocuments] Relevant doc ${i+1}: "${doc.title}" (ID: ${doc.id})`);
        }
      });
    }
    
    return sortedDocuments;
  }
  
  // Helper method to extract keywords from a query
  private extractKeywords(query: string): string[] {
    // Remove common words and punctuation
    const stopWords = ["what", "which", "how", "when", "where", "why", "who", "is", "are", "the", "a", "an", "of", "for", "in", "on", "at", "to", "with", "by", "about", "like", "and", "or", "but", "if", "because", "as", "does", "do", "can", "could", "would", "should", "will", "i", "you", "he", "she", "it", "we", "they", "their", "your", "my", "his", "her", "its", "our"];
    
    // Convert to lowercase, remove punctuation and split into words
    const words = query.toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
      .split(/\s+/);
    
    // Filter out stop words and words shorter than 3 characters
    return words.filter(word => 
      !stopWords.includes(word) && 
      word.length >= 3
    );
  }
  
  // Helper method to calculate match score between text and keywords
  private calculateMatchScore(text: string, keywords: string[]): number {
    if (!text || !keywords.length) return 0;
    
    const lowerText = text.toLowerCase();
    let score = 0;
    
    keywords.forEach(keyword => {
      // Check for exact matches
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const exactMatches = (lowerText.match(regex) || []).length;
      score += exactMatches * 2; // Exact matches count more
      
      // Check for partial matches
      if (lowerText.includes(keyword)) {
        score += 1;
      }
    });
    
    return score;
  }

  async createKnowledgeDocument(document: InsertKnowledgeDocument): Promise<KnowledgeDocument> {
    const now = new Date();
    const [newDoc] = await db.insert(knowledgeDocuments)
      .values({
        ...document,
        updatedAt: now
      })
      .returning();
    
    // Update document count in knowledge base
    await db.update(knowledgeBases)
      .set({
        documentCount: sql`${knowledgeBases.documentCount} + 1`
      })
      .where(eq(knowledgeBases.id, document.knowledgeBaseId));
    
    return newDoc;
  }

  async updateKnowledgeDocument(id: number, updates: Partial<KnowledgeDocument>): Promise<KnowledgeDocument | undefined> {
    const [updatedDoc] = await db
      .update(knowledgeDocuments)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(knowledgeDocuments.id, id))
      .returning();
    return updatedDoc;
  }

  async deleteKnowledgeDocument(id: number): Promise<boolean> {
    // First get the document to get its knowledgeBaseId
    const [doc] = await db.select().from(knowledgeDocuments).where(eq(knowledgeDocuments.id, id));
    if (!doc) return false;
    
    // Delete the document
    const result = await db.delete(knowledgeDocuments).where(eq(knowledgeDocuments.id, id));
    
    // Update the document count in the knowledge base
    await db.update(knowledgeBases)
      .set({
        documentCount: sql`GREATEST(${knowledgeBases.documentCount} - 1, 0)`
      })
      .where(eq(knowledgeBases.id, doc.knowledgeBaseId));
    
    return result.count > 0;
  }

  // Moderation Action operations
  async getModerationAction(id: number): Promise<ModerationAction | undefined> {
    const [action] = await db.select().from(moderationActions).where(eq(moderationActions.id, id));
    return action;
  }

  async getModerationActionsByPlatformId(platformId: number): Promise<ModerationAction[]> {
    return await db.select().from(moderationActions).where(eq(moderationActions.platformId, platformId));
  }

  async getModerationActionsByConversationId(conversationId: number): Promise<ModerationAction[]> {
    return await db.select().from(moderationActions).where(eq(moderationActions.conversationId, conversationId));
  }

  async createModerationAction(action: InsertModerationAction): Promise<ModerationAction> {
    const [newAction] = await db.insert(moderationActions).values(action).returning();
    return newAction;
  }

  // Conversation Training operations
  async getConversationTraining(id: number): Promise<ConversationTraining | undefined> {
    const [training] = await db.select().from(conversationTrainings).where(eq(conversationTrainings.id, id));
    return training;
  }

  async getConversationTrainingsByUserId(userId: number): Promise<ConversationTraining[]> {
    return await db.select().from(conversationTrainings)
      .where(eq(conversationTrainings.userId, userId))
      .orderBy(desc(conversationTrainings.createdAt));
  }

  async getConversationTrainingsByPlatformId(platformId: number): Promise<ConversationTraining[]> {
    return await db.select().from(conversationTrainings)
      .where(eq(conversationTrainings.platformId, platformId))
      .orderBy(desc(conversationTrainings.createdAt));
  }

  async getLatestConversationTraining(userId: number, platformId: number): Promise<ConversationTraining | undefined> {
    const [training] = await db.select().from(conversationTrainings)
      .where(and(
        eq(conversationTrainings.userId, userId),
        eq(conversationTrainings.platformId, platformId)
      ))
      .orderBy(desc(conversationTrainings.createdAt))
      .limit(1);
    return training;
  }

  async createConversationTraining(training: InsertConversationTraining): Promise<ConversationTraining> {
    const now = new Date();
    const [newTraining] = await db.insert(conversationTrainings)
      .values({
        ...training,
        processedConversations: 0,
        updatedAt: now
      })
      .returning();
    return newTraining;
  }

  async updateConversationTraining(id: number, updates: Partial<ConversationTraining>): Promise<ConversationTraining | undefined> {
    const [updatedTraining] = await db.update(conversationTrainings)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(conversationTrainings.id, id))
      .returning();
    return updatedTraining;
  }

  // Analytics operations
  async getConversationCount(): Promise<number> {
    const result = await db.select({ count: count() }).from(conversations);
    return result[0].count;
  }

  async getMessageCount(): Promise<number> {
    const result = await db.select({ count: count() }).from(messages);
    return result[0].count;
  }

  async getModerationActionCount(): Promise<number> {
    const result = await db.select({ count: count() }).from(moderationActions);
    return result[0].count;
  }

  async getResponseRate(): Promise<number> {
    const totalMessagesResult = await db.select({ count: count() }).from(messages);
    const totalMessages = totalMessagesResult[0].count;
    
    const aiMessagesResult = await db.select({ count: count() })
      .from(messages)
      .where(eq(messages.sender, "ai"));
    const aiMessages = aiMessagesResult[0].count;
    
    return totalMessages > 0 ? (aiMessages / totalMessages) * 100 : 0;
  }

  async getRecentActivity(limit: number): Promise<{ user: string; action: string; platform: string; time: Date; }[]> {
    // Get the most recent messages 
    const recentMessages = await db.select({
      user: messages.sender,
      action: sql<string>`'message'`,
      platform: platforms.type,
      time: messages.createdAt,
    })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .innerJoin(platforms, eq(conversations.platformId, platforms.id))
    .orderBy(desc(messages.createdAt))
    .limit(limit);

    return recentMessages;
  }
}

export const storage = new DatabaseStorage();
