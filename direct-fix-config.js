// Direct fix for Discord integration configuration
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
neonConfig.webSocketConstructor = ws;

async function fixDiscordConfig() {
  try {
    console.log('Starting Discord config fix...');
    
    // Initialize the database connection
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    
    // Get current Discord platform record
    const result = await pool.query(`
      SELECT id, name, type, status, auth_token, config
      FROM platforms
      WHERE id = 3
    `);
    
    if (result.rows.length === 0) {
      console.log('Discord platform not found. Make sure platform ID 3 is Discord.');
      await pool.end();
      return;
    }
    
    const platform = result.rows[0];
    console.log('Current Discord platform status:', platform.status);
    console.log('Current config:', platform.config);
    
    // Get environment token prefix
    const envToken = process.env.DISCORD_BOT_TOKEN;
    
    // Create a better platform config with setupCompleted flag
    const updatedConfig = {
      ...(platform.config || {}),
      setupCompleted: true,
      useRealToken: true,
      serverId: platform.config?.serverId || "123456789",
      serverName: platform.config?.serverName || "Discord Server",
      memberCount: platform.config?.memberCount || 100,
      channels: platform.config?.channels || [],
      lastRefreshed: new Date().toISOString()
    };
    
    // Update the platform with the fixed config
    await pool.query(`
      UPDATE platforms
      SET config = $1::jsonb,
          auth_token = $2
      WHERE id = 3
    `, [JSON.stringify(updatedConfig), envToken]);
    
    console.log('Updated platform config and token.');
    
    // Verify the update
    const updatedResult = await pool.query(`
      SELECT id, name, type, status, auth_token, config
      FROM platforms
      WHERE id = 3
    `);
    
    if (updatedResult.rows.length > 0) {
      const updatedPlatform = updatedResult.rows[0];
      console.log('Updated config:', updatedPlatform.config);
    }
    
    console.log('Fix completed! Please restart the application.');
    await pool.end();
    
  } catch (error) {
    console.error('Error fixing Discord config:', error);
  }
}

// Run the function
fixDiscordConfig();