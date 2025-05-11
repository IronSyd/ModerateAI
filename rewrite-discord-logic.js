// Direct fix for Discord integration issue
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import { Client, GatewayIntentBits } from 'discord.js';

neonConfig.webSocketConstructor = ws;

// Direct fix for the Discord initialization issue
async function fixDiscordConnection() {
  try {
    console.log('Starting direct Discord fix...');
    
    // Create a new Discord client with required permissions
    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
      ],
    });
    
    console.log('Connecting to database...');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    
    // Check environment token
    const envToken = process.env.DISCORD_BOT_TOKEN;
    console.log(`Environment token starts with: ${envToken.substring(0, 10)}...`);
    
    // Try to connect to Discord with env token
    console.log('Attempting to login with environment token...');
    try {
      await client.login(envToken);
      console.log(`Successfully logged in as ${client.user.tag}`);
      
      // Get server info
      const serverCount = client.guilds.cache.size;
      console.log(`Connected to ${serverCount} servers`);
      
      if (serverCount > 0) {
        const server = client.guilds.cache.first();
        console.log(`Server: ${server.name} (${server.id}) with ${server.memberCount} members`);
        
        // Get channels
        const textChannels = server.channels.cache
          .filter(channel => channel.type === 0) // TextChannel
          .map(channel => ({
            id: channel.id,
            name: channel.name,
            type: 'text',
            moderationEnabled: true,
            active: true
          }));
        
        console.log(`Found ${textChannels.length} text channels`);
        
        // Update the database with real server info
        await pool.query(`
          UPDATE platforms 
          SET auth_token = $1,
              status = 'active',
              config = jsonb_build_object(
                'setupCompleted', true,
                'serverId', $2,
                'serverName', $3,
                'memberCount', $4,
                'channels', $5::jsonb,
                'lastRefreshed', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
              )
          WHERE id = 3
        `, [
          envToken,
          server.id,
          server.name,
          server.memberCount,
          JSON.stringify(textChannels)
        ]);
        
        console.log('Successfully updated platform with real server data');
      } else {
        console.log('No servers found. Please invite the bot to your server.');
      }
      
      await client.destroy();
    } catch (err) {
      console.error('Error logging in to Discord:', err);
    }
    
    // Verify database update
    const result = await pool.query(`
      SELECT id, name, type, status, auth_token, config->>'serverId' as server_id,
             config->>'serverName' as server_name, config->>'setupCompleted' as setup_completed
      FROM platforms
      WHERE id = 3
    `);
    
    if (result.rows.length > 0) {
      const platform = result.rows[0];
      console.log('Updated platform information:');
      console.log('- Status:', platform.status);
      console.log('- Server ID:', platform.server_id);
      console.log('- Server Name:', platform.server_name);
      console.log('- Setup Completed:', platform.setup_completed);
    }
    
    console.log('Discord fix complete. Please restart the application.');
    await pool.end();
    
  } catch (error) {
    console.error('Error fixing Discord:', error);
  }
}

// Run the function
fixDiscordConnection();