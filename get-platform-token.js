// Script to get the current Discord token from the database
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
neonConfig.webSocketConstructor = ws;

async function getDiscordToken() {
  try {
    console.log('Getting Discord token information...');
    
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
    
    // Print token information without exposing full token
    const token = platform.auth_token;
    if (token) {
      console.log('Current token starts with:', token.substring(0, 10) + '...');
    } else {
      console.log('No token set.');
    }
    
    // Print environment token prefix
    const envToken = process.env.DISCORD_BOT_TOKEN;
    if (envToken) {
      console.log('Environment token starts with:', envToken.substring(0, 10) + '...');
    } else {
      console.log('No environment token available.');
    }
    
    // Print if tokens match
    console.log('Tokens match:', token === envToken);
    
    // Now let's update the token with the environment token
    console.log('\nUpdating Discord token in database...');
    await pool.query(`
      UPDATE platforms
      SET auth_token = $1
      WHERE id = 3
    `, [envToken]);
    
    console.log('Discord token updated! Please restart the application.');
    await pool.end();
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the function
getDiscordToken();