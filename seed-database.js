/**
 * This script seeds the database with initial data
 * Run with: tsx seed-database.js
 */
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import { users, platforms, conversations, messages, aiConfigurations, moderationActions } from './shared/schema';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configure neon to use websockets
neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set. Did you forget to provision a database?');
}

// Create the database connection pool
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool, schema: { users, platforms, conversations, messages, aiConfigurations, moderationActions } });

async function seedDatabase() {
  try {
    console.log('Seeding database...');

    // Check if we already have users
    const existingUsers = await db.select().from(users);
    if (existingUsers.length > 0) {
      console.log(`Database already has ${existingUsers.length} users. Skipping seed.`);
      return;
    }

    // Add a demo user
    const [demoUser] = await db.insert(users).values({
      username: 'demo',
      password: '$2b$10$RLl2NE8XTgTleg3PLX3KK.hnwIVbFm.KfBwCwR0xHB1TCJvyBg8Uq', // hashed 'password123'
      email: 'demo@example.com',
      fullName: 'Demo User',
      role: 'admin',
    }).returning();
    console.log('Created demo user:', demoUser.id);

    // Create AI configuration
    const [aiConfig] = await db.insert(aiConfigurations).values({
      name: 'Default Configuration',
      userId: demoUser.id,
      isActive: true,
      responseStyle: 3, // 1-5 scale
      responseLength: 3, // 1-5 scale
      moderationStrictness: 3, // 1-5 scale
      model: 'gpt-4o',
      systemPrompt: 'You are a helpful AI assistant that answers questions professionally and concisely.',
      enableConversationTraining: true,
      maxHistoryLength: 10,
    }).returning();
    console.log('Created AI configuration:', aiConfig.id);

    // Create platforms
    const [websitePlatform] = await db.insert(platforms).values({
      type: 'website',
      name: 'Website Chat',
      status: 'active',
      userId: demoUser.id,
      config: {},
    }).returning();
    console.log('Created website platform:', websitePlatform.id);

    const [telegramPlatform] = await db.insert(platforms).values({
      type: 'telegram',
      name: 'Telegram Bot',
      status: 'active',
      userId: demoUser.id,
      config: {
        botUsername: 'ModAI_test_bot'
      },
      authToken: process.env.TELEGRAM_BOT_TOKEN || 'demo-token',
    }).returning();
    console.log('Created Telegram platform:', telegramPlatform.id);

    const [discordPlatform] = await db.insert(platforms).values({
      type: 'discord',
      name: 'Discord Bot',
      status: 'not_connected',
      userId: demoUser.id,
      config: {
        botUsername: 'ModerateAI',
        channels: ['general'],
        serverId: '123456789',
        serverName: 'Demo Server',
        memberCount: 100,
        respondToMentions: true,
        respondToCommands: true,
        privateResponses: false,
      },
      authToken: process.env.DISCORD_BOT_TOKEN || 'demo-token',
    }).returning();
    console.log('Created Discord platform:', discordPlatform.id);

    // Create sample conversations
    const [conversation1] = await db.insert(conversations).values({
      platformId: websitePlatform.id,
      externalUserId: 'user1',
      externalUsername: 'Chelsea Hagon',
      status: 'active',
    }).returning();
    console.log('Created conversation 1:', conversation1.id);

    // Add messages to the conversation
    await db.insert(messages).values([
      {
        conversationId: conversation1.id,
        content: 'Hello! I need help with my account.',
        sender: 'user',
        metadata: { username: 'Chelsea Hagon' },
      },
      {
        conversationId: conversation1.id,
        content: 'Hi Chelsea, I\'d be happy to help with your account. What specific issue are you experiencing?',
        sender: 'ai',
      },
      {
        conversationId: conversation1.id,
        content: 'I can\'t reset my password.',
        sender: 'user',
        metadata: { username: 'Chelsea Hagon' },
      },
      {
        conversationId: conversation1.id,
        content: 'I understand that\'s frustrating. To reset your password, please click on the "Forgot Password" link on the login page and follow the instructions sent to your email.',
        sender: 'ai',
      },
    ]);
    console.log('Added messages to conversation 1');

    // Create a moderation action
    await db.insert(moderationActions).values({
      platformId: websitePlatform.id,
      conversationId: conversation1.id,
      action: 'flag',
      reason: 'Potential sensitive information shared',
      automatic: true,
    });
    console.log('Created moderation action');

    // Create some additional conversations for better statistics
    for (let i = 0; i < 8; i++) {
      const [conversation] = await db.insert(conversations).values({
        platformId: i % 2 === 0 ? websitePlatform.id : telegramPlatform.id,
        externalUserId: `user${i + 2}`,
        externalUsername: `User ${i + 2}`,
        status: i < 6 ? 'active' : 'closed',
      }).returning();
      
      // Add 3-5 messages per conversation
      const messageCount = 3 + Math.floor(Math.random() * 3);
      for (let j = 0; j < messageCount; j++) {
        await db.insert(messages).values({
          conversationId: conversation.id,
          content: `Sample message ${j + 1} for conversation ${i + 2}`,
          sender: j % 2 === 0 ? 'user' : 'ai',
          metadata: j % 2 === 0 ? { username: `User ${i + 2}` } : {},
        });
      }
      
      // Add moderation actions for some conversations
      if (i % 3 === 0) {
        await db.insert(moderationActions).values({
          platformId: i % 2 === 0 ? websitePlatform.id : telegramPlatform.id,
          conversationId: conversation.id,
          action: ['flag', 'warn', 'mute'][Math.floor(Math.random() * 3)],
          reason: 'Sample moderation reason',
          automatic: i % 2 === 0,
        });
      }
    }
    console.log('Created additional sample data');

    console.log('Database seeded successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await pool.end();
  }
}

seedDatabase();