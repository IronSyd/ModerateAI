/**
 * Updates database setup for Discord integration
 */
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
neonConfig.webSocketConstructor = ws;

async function fixDiscordIntegration() {
  try {
    console.log('Starting Discord integration fix...');
    
    // Initialize the database connection
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    
    // 1. Get current Discord platform record
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
    console.log('Has token:', !!platform.auth_token);
    
    if (platform.config) {
      console.log('Server name:', platform.config.serverName || 'Not set');
      console.log('Server ID:', platform.config.serverId || 'Not set');
      console.log('Setup completed:', platform.config.setupCompleted || false);
    }
    
    // 2. Update the Discord platform with environment token and setupCompleted flag
    await pool.query(`
      UPDATE platforms
      SET auth_token = $1,
          status = 'active',
          config = jsonb_set(
            jsonb_set(
              COALESCE(config, '{}'::jsonb),
              '{setupCompleted}',
              'true'
            ),
            '{useRealToken}',
            'true'
          )
      WHERE id = 3
    `, [process.env.DISCORD_BOT_TOKEN]);
    
    console.log('Updated Discord platform token and set setupCompleted = true');
    
    // 3. Verify the update
    const verifyResult = await pool.query(`
      SELECT id, name, type, status, auth_token, config 
      FROM platforms
      WHERE id = 3
    `);
    
    if (verifyResult.rows.length > 0) {
      const updatedPlatform = verifyResult.rows[0];
      console.log('Updated Discord platform status:', updatedPlatform.status);
      console.log('Has token:', !!updatedPlatform.auth_token);
      console.log('Setup completed:', updatedPlatform.config.setupCompleted || false);
    }
    
    console.log('Discord fix completed! Please restart the application.');
    await pool.end();
    
  } catch (error) {
    console.error('Error fixing Discord integration:', error);
  }
}

// Run the function
fixDiscordIntegration();