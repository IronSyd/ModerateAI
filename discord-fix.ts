// Script to directly fix Discord integration
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { Client, GatewayIntentBits } from 'discord.js';
import * as schema from '@shared/schema';
import { eq } from 'drizzle-orm';
import ws from 'ws';

// Configure neon to use websockets
neonConfig.webSocketConstructor = ws;

// Database connection
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool, schema });

// Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ]
});

async function fixDiscordBot() {
  try {
    console.log('Starting Discord bot fix...');
    
    // First get platform record
    const [platform] = await db.select().from(platforms).where(eq(platforms.id, 3));
    
    if (!platform) {
      console.log('Discord platform not found in database');
      return;
    }
    
    console.log('Found Discord platform:', {
      id: platform.id,
      status: platform.status,
      hasToken: !!platform.auth_token
    });
    
    // Update platform with environment token
    await db.update(platforms)
      .set({ 
        auth_token: process.env.DISCORD_BOT_TOKEN,
        status: 'active'
      })
      .where(eq(platforms.id, 3));
    
    console.log('Updated Discord platform with environment token');
    
    // Login to Discord
    await client.login(process.env.DISCORD_BOT_TOKEN);
    console.log(`Logged in as ${client.user?.tag}`);
    
    // Get server information
    const servers = [...client.guilds.cache.values()];
    console.log(`Connected to ${servers.length} servers:`);
    
    if (servers.length === 0) {
      console.log('No servers found. Please add the bot to a server:');
      console.log(`https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&permissions=8&scope=bot%20applications.commands`);
      await client.destroy();
      await pool.end();
      return;
    }
    
    // Log server info
    servers.forEach(server => {
      console.log(`- ${server.name} (${server.id}) with ${server.memberCount} members`);
    });
    
    // Get first server
    const server = servers[0];
    
    // Get channels
    const channels = server.channels.cache
      .filter(channel => channel.type === 0) // 0 is text channel
      .map(channel => ({
        id: channel.id,
        name: channel.name,
        type: 'text',
        moderationEnabled: true,
        active: true
      }));
    
    console.log(`Found ${channels.length} text channels in server ${server.name}`);
    
    // Update platform with real server info
    const config = {
      ...(platform.config as any || {}),
      serverId: server.id,
      serverName: server.name,
      memberCount: server.memberCount,
      channels: channels,
      lastRefreshed: new Date().toISOString(),
      setupCompleted: true
    };
    
    await db.update(platforms)
      .set({ config: config as any })
      .where(eq(platforms.id, 3));
    
    console.log('Updated platform with real server information');
    console.log('Discord bot fix complete!');
    
    // Cleanup
    await client.destroy();
    await pool.end();
    
  } catch (error) {
    console.error('Error fixing Discord bot:', error);
    try {
      await client.destroy();
      await pool.end();
    } catch (err) {
      // Ignore cleanup errors
    }
  }
}

fixDiscordBot();