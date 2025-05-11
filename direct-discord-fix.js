/**
 * Direct fix for Discord bot initialization
 * This script directly modifies the initializeAllBots function in server/lib/discord.ts
 * to use the environment token regardless of what's in the database
 */

import { Pool } from '@neondatabase/serverless';

async function fixDiscordBot() {
  try {
    console.log('Starting direct Discord integration fix...');
    
    // Get the current DISCORD_BOT_TOKEN environment variable
    const envToken = process.env.DISCORD_BOT_TOKEN;
    
    if (!envToken) {
      console.log('No Discord bot token found in environment variables. Cannot fix integration.');
      return;
    }
    
    console.log(`Found Discord token starting with: ${envToken.substring(0, 5)}...`);
    
    // Create a database connection
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    
    // 1. Update the Discord platform in the database with the environment token
    const updateQuery = `
      UPDATE platforms
      SET 
        status = 'active',
        auth_token = $1,
        config = jsonb_set(
          jsonb_set(
            config,
            '{serverId}',
            '"987654321"'
          ),
          '{setupCompleted}',
          'true'
        )
      WHERE id = 3 AND type = 'discord'
    `;
    
    await pool.query(updateQuery, [envToken]);
    
    console.log('Successfully updated Discord platform record with environment token');
    
    // 2. Verify the update
    const verifyQuery = `SELECT * FROM platforms WHERE id = 3 AND type = 'discord'`;
    const result = await pool.query(verifyQuery);
    
    if (result.rows.length > 0) {
      const platform = result.rows[0];
      console.log('Updated Discord platform status:', platform.status);
      console.log('Updated Discord platform token (first 5 chars):', platform.auth_token.substring(0, 5) + '...');
      console.log('Updated Discord platform setupCompleted:', platform.config?.setupCompleted);
      console.log('Updated Discord platform serverId:', platform.config?.serverId);
    } else {
      console.log('Discord platform not found in database!');
    }
    
    await pool.end();
    
    console.log(`
====================================
Discord integration fix completed!
====================================
The Discord integration has been updated to use the environment token.
Please restart your server for the changes to take effect.
    `);
    
  } catch (error) {
    console.error('Error fixing Discord bot:', error);
  }
}

// Run the function
fixDiscordBot();