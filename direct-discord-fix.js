// Script to directly initialize Discord bot with environment token
import { drizzle } from 'drizzle-orm/pg-pool';
import pg from 'pg';
import { Client, GatewayIntentBits } from 'discord.js';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Create Discord client
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
    
    // First, use SQL to update the auth_token for platform id 3
    await pool.query(`
      UPDATE platforms 
      SET auth_token = $1, 
          status = 'active'
      WHERE id = 3
    `, [process.env.DISCORD_BOT_TOKEN]);
    
    console.log('Updated platform record with environment token');
    
    // Then login with the token
    await client.login(process.env.DISCORD_BOT_TOKEN);
    
    console.log(`Logged in as ${client.user.tag}`);
    
    // Get server info
    const servers = client.guilds.cache;
    console.log(`Connected to ${servers.size} servers:`);
    
    if (servers.size === 0) {
      console.log('No servers found. Please add the bot to a server.');
      console.log(`Invite URL: https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&permissions=8&scope=bot%20applications.commands`);
      await client.destroy();
      process.exit(1);
    }
    
    servers.forEach(server => {
      console.log(`- ${server.name} (${server.id}) with ${server.memberCount} members`);
    });
    
    // Get the first server
    const server = servers.first();
    
    // Get channels
    const channels = server.channels.cache
      .filter(channel => channel.type === 0) // 0 is TextChannel
      .map(channel => ({
        id: channel.id,
        name: channel.name,
        type: 'text',
        moderationEnabled: true,
        active: true
      }));
    
    console.log(`Found ${channels.length} text channels`);
    
    // Update database with real server info
    await pool.query(`
      UPDATE platforms
      SET config = jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              config,
              '{serverId}', 
              '"${server.id}"'
            ),
            '{serverName}', 
            '"${server.name.replace(/"/g, '\\"')}"'
          ),
          '{memberCount}', 
          '${server.memberCount}'
        ),
        '{channels}', 
        '${JSON.stringify(channels).replace(/'/g, "''")}'
      )
      WHERE id = 3
    `);
    
    console.log('Updated platform with real server info');
    console.log('Discord bot should now display real server data. Please restart the application.');
    
    // Cleanup
    await client.destroy();
    await pool.end();
    
  } catch (error) {
    console.error('Error fixing Discord bot:', error);
    try {
      await client.destroy();
      await pool.end();
    } catch (e) {
      // Ignore cleanup errors
    }
    process.exit(1);
  }
}

fixDiscordBot();