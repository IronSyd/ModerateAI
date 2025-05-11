// Script to fix Discord integration
const { drizzle } = require('drizzle-orm/pg-pool');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Updates database setup
 */
async function fixDiscordIntegration() {
  console.log('Fixing Discord integration...');
  
  try {
    // Connect to the database
    const db = drizzle(pool);
    
    // Get current configuration
    const [platform] = await db.query.platforms.findMany({
      where: (platforms, { eq }) => eq(platforms.id, 3)
    });
    
    if (!platform) {
      console.log('Discord platform not found');
      return;
    }
    
    console.log('Current status:', platform.status);
    console.log('Current auth token:', platform.auth_token ? 'Present (hidden)' : 'None');
    
    // Update with proper token
    await db.update(platforms)
      .set({
        status: 'active',
        auth_token: process.env.DISCORD_BOT_TOKEN,
        config: {
          ...platform.config,
          setupCompleted: true
        }
      })
      .where(eq(platforms.id, 3));
    
    console.log('Discord platform updated successfully.');
    console.log('Please restart the application to apply changes.');
    
  } catch (error) {
    console.error('Error fixing Discord integration:', error);
  } finally {
    await pool.end();
  }
}

fixDiscordIntegration();