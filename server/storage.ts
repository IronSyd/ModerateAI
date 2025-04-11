import { 
  User, InsertUser, 
  Platform, InsertPlatform, 
  Conversation, InsertConversation, 
  Message, InsertMessage, 
  AiConfiguration, InsertAiConfiguration, 
  KnowledgeBase, InsertKnowledgeBase, 
  ModerationAction, InsertModerationAction,
  users, platforms, conversations, messages, aiConfigurations, knowledgeBases, moderationActions
} from "@shared/schema";

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

  // Moderation Action operations
  getModerationAction(id: number): Promise<ModerationAction | undefined>;
  getModerationActionsByPlatformId(platformId: number): Promise<ModerationAction[]>;
  getModerationActionsByConversationId(conversationId: number): Promise<ModerationAction[]>;
  createModerationAction(moderationAction: InsertModerationAction): Promise<ModerationAction>;

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
  private moderationActions: Map<number, ModerationAction>;

  private userIdCounter: number;
  private platformIdCounter: number;
  private conversationIdCounter: number;
  private messageIdCounter: number;
  private aiConfigurationIdCounter: number;
  private knowledgeBaseIdCounter: number;
  private moderationActionIdCounter: number;

  constructor() {
    this.users = new Map();
    this.platforms = new Map();
    this.conversations = new Map();
    this.messages = new Map();
    this.aiConfigurations = new Map();
    this.knowledgeBases = new Map();
    this.moderationActions = new Map();

    this.userIdCounter = 1;
    this.platformIdCounter = 1;
    this.conversationIdCounter = 1;
    this.messageIdCounter = 1;
    this.aiConfigurationIdCounter = 1;
    this.knowledgeBaseIdCounter = 1;
    this.moderationActionIdCounter = 1;

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
      systemPrompt: "You are a helpful customer support assistant for ModerateAI. ModerateAI is a SaaS platform that provides AI-powered chat support and community moderation across websites, Telegram, and Discord. Be friendly, helpful, and professional when answering questions."
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
      status: "setup_required",
      userId: user.id,
      config: { serverId: "123456789", channelId: "987654321" },
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
}

export const storage = new MemStorage();
