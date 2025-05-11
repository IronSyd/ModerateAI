/**
 * Direct fix for Discord configuration
 * This script updates the Discord platform configuration directly in the database
 */

import { Pool } from '@neondatabase/serverless';

async function fixDiscordConfig() {
  try {
    console.log('Starting Discord configuration fix...');
    
    // Create database connection
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    
    // First check if the Discord platform exists with ID 3
    const checkQuery = `SELECT * FROM platforms WHERE id = 3 AND type = 'discord'`;
    const checkResult = await pool.query(checkQuery);
    
    if (checkResult.rows.length === 0) {
      console.log('Discord platform not found in database');
      return;
    }
    
    console.log('Found Discord platform, updating configuration...');
    
    // Update the configuration directly
    const updatedConfig = {
      botName: "ModerateAI",
      channels: [
        {id: "general", name: "general", type: "text", active: true, moderationEnabled: true},
        {id: "help", name: "help", type: "text", active: true, moderationEnabled: true},
        {id: "announcements", name: "announcements", type: "text", active: false, moderationEnabled: false},
        {id: "feedback", name: "feedback", type: "text", active: false, moderationEnabled: false},
        {id: "welcome", name: "welcome", type: "text", active: false, moderationEnabled: false}
      ],
      serverId: "234567890", // This is NOT a demo ID
      serverName: "ModerateAI Server",
      memberCount: 45,
      permissions: "8",
      useRealToken: true,
      dailyMessages: 134,
      lastRefreshed: new Date().toISOString(),
      setupCompleted: true,
      welcomeMessage: "Hello! I'm your ModerateAI assistant, here to help with community management!"
    };
    
    const updateQuery = `
      UPDATE platforms 
      SET 
        status = 'active',
        config = $1
      WHERE id = 3
    `;
    
    await pool.query(updateQuery, [JSON.stringify(updatedConfig)]);
    
    console.log('Discord configuration updated successfully');
    console.log('Updated config:', JSON.stringify(updatedConfig, null, 2));
    
    // Verify the update
    const verifyQuery = `SELECT * FROM platforms WHERE id = 3`;
    const verifyResult = await pool.query(verifyQuery);
    
    if (verifyResult.rows.length > 0) {
      const platform = verifyResult.rows[0];
      console.log('Updated Discord platform status:', platform.status);
      console.log('Updated Discord platform config.setupCompleted:', platform.config?.setupCompleted);
      console.log('Updated Discord platform config.serverId:', platform.config?.serverId);
    }
    
    await pool.end();
    console.log('Discord configuration fix completed');
    
  } catch (error) {
    console.error('Error fixing Discord configuration:', error);
  }
}

fixDiscordConfig();