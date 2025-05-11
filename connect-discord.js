// Script to connect Discord bot
const { Pool } = require('pg');
const { Client, GatewayIntentBits, Events } = require('discord.js');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ]
});

async function connectDiscordBot() {
  try {
    console.log('Connecting Discord bot...');
    
    // Login to Discord
    await client.login(process.env.DISCORD_BOT_TOKEN);
    
    // Set up event for when client is ready
    client.on(Events.ClientReady, async () => {
      console.log(`Discord bot logged in as ${client.user.tag}!`);
      
      const serverCount = client.guilds.cache.size;
      console.log(`Bot is connected to ${serverCount} servers`);
      
      if (serverCount === 0) {
        console.log('Bot is not connected to any servers. Please add it to a server first.');
        console.log(`Invite URL: https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&permissions=8&scope=bot%20applications.commands`);
        process.exit(1);
      }
      
      // Get the first guild
      const guild = client.guilds.cache.first();
      console.log(`Found server: ${guild.name} (${guild.id}) with ${guild.memberCount} members`);
      
      // Get text channels
      const channels = guild.channels.cache
        .filter(channel => channel.type === 0) // 0 is TextChannel
        .map(channel => ({
          id: channel.id,
          name: channel.name,
          type: 'text',
          moderationEnabled: true,
          active: true
        }));
      
      console.log(`Found ${channels.length} text channels`);
      
      // Update the platform in database
      const query = `
        UPDATE platforms 
        SET config = jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                config, 
                '{serverId}', 
                '"${guild.id}"'
              ),
              '{serverName}', 
              '"${guild.name.replace(/"/g, '\\"')}"'
            ),
            '{memberCount}', 
            '${guild.memberCount}'
          ),
          '{channels}', 
          '${JSON.stringify(channels).replace(/'/g, "''")}'
        ),
        status = 'active'
        WHERE id = 3;
      `;
      
      await pool.query(query);
      console.log('Updated platform with server information');
      
      // Disconnect and exit
      client.destroy();
      console.log('Discord bot disconnected');
      process.exit(0);
    });
    
  } catch (error) {
    console.error('Error connecting Discord bot:', error);
    process.exit(1);
  }
}

// Run the function
connectDiscordBot();