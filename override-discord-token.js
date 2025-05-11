// Script to override Discord token at server startup
import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
neonConfig.webSocketConstructor = ws;

// Create a patch file to modify the Discord initialization logic in server/lib/discord.ts

async function overrideDiscordInitialization() {
  try {
    console.log('Creating Discord initialization override...');
    
    // Create a patch file that will replace the function that initializes Discord bots
    const patch = `
    // Replace the current initializeAllBots function with a version that uses environment tokens
    import { initializeAllBots as initializeAllDiscordBots } from "./lib/discord";
    
    // Override the Discord initialization to use environment token
    const originalInitializeAllDiscordBots = initializeAllDiscordBots;
    
    // Define the replacement function
    async function overriddenInitializeDiscordBots() {
      try {
        console.log('Using overridden Discord bot initialization with environment token...');
        
        // Get the environment token
        const envToken = process.env.DISCORD_BOT_TOKEN;
        if (!envToken) {
          console.log('No environment token available');
          return await originalInitializeAllDiscordBots();
        }
        
        // Update the token in the database to match environment
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });
        
        // Update Discord platform (ID 3) with environment token and setupCompleted flag
        await pool.query(\`
          UPDATE platforms
          SET auth_token = $1,
              status = 'active',
              config = jsonb_set(
                COALESCE(config, '{}'::jsonb),
                '{setupCompleted}',
                'true'
              )
          WHERE id = 3
        \`, [envToken]);
        
        console.log('Updated Discord platform with environment token');
        
        // Now call the original function
        return await originalInitializeAllDiscordBots();
      } catch (error) {
        console.error('Error in overridden Discord initialization:', error);
        // Fall back to original implementation
        return await originalInitializeAllDiscordBots();
      }
    }
    
    // Replace the original function with our overridden version
    const initializeAllDiscordBots = overriddenInitializeDiscordBots;
    `;
    
    // Write the patch to a file
    const fs = require('fs');
    fs.writeFileSync('./discord-patch.js', patch);
    
    console.log('Created discord-patch.js file');
    console.log('To apply this patch, add the following line to server/index.ts before initializing Discord bots:');
    console.log('import "./discord-patch.js";');
    
  } catch (error) {
    console.error('Error creating override:', error);
  }
}

// Run the function
overrideDiscordInitialization();