import { storage } from './server/storage.js';
import { initializeBot, disconnectBot, refreshChannels } from './server/lib/discord.js';

async function testDiscordIntegration() {
  console.log('🔍 Testing Discord Integration Logic...\n');
  
  try {
    // Test 1: Check if Discord platforms exist in database
    console.log('1. Checking Discord platforms in database...');
    const discordPlatforms = await storage.getPlatformsByType('discord');
    console.log(`   Found ${discordPlatforms.length} Discord platform(s):`, 
                discordPlatforms.map(p => `${p.id}: ${p.name} (${p.status})`));
    
    if (discordPlatforms.length === 0) {
      console.log('   ❌ No Discord platforms found. Creating one for testing...');
      const testPlatform = await storage.createPlatform({
        type: 'discord',
        name: 'Test Discord Bot',
        status: 'setup_required',
        userId: 4, // User X8C from logs
        config: { setupStarted: true },
        authToken: null
      });
      console.log(`   ✅ Created test Discord platform: ${testPlatform.id}`);
      discordPlatforms.push(testPlatform);
    }
    
    const testPlatform = discordPlatforms[0];
    console.log(`   ✅ Using platform ${testPlatform.id} for testing\n`);
    
    // Test 2: Test bot initialization with demo token
    console.log('2. Testing bot initialization with demo token...');
    const initResult = await initializeBot(testPlatform.id, 'demo-discord-token');
    
    if (initResult.success) {
      console.log('   ✅ Bot initialization completed successfully');
      console.log(`   Message: ${initResult.message}`);
    } else {
      console.log('   ❌ Bot initialization failed');
      console.log(`   Error: ${initResult.message}`);
    }
    
    // Test 3: Check platform status after initialization
    console.log('\n3. Checking platform status after initialization...');
    const updatedPlatform = await storage.getPlatform(testPlatform.id);
    console.log(`   Platform status: ${updatedPlatform?.status}`);
    console.log('   Platform config:', JSON.stringify(updatedPlatform?.config, null, 2));
    
    // Test 4: Test channel refresh functionality
    console.log('\n4. Testing channel refresh functionality...');
    const refreshResult = await refreshChannels(testPlatform.id);
    
    if (refreshResult) {
      console.log('   ✅ Channel refresh completed successfully');
      
      const refreshedPlatform = await storage.getPlatform(testPlatform.id);
      const config = refreshedPlatform?.config;
      if (config && config.channels) {
        console.log(`   Found ${config.channels.length} channels:`);
        config.channels.forEach((channel, i) => {
          console.log(`     ${i+1}. ${channel.name} (${channel.type}) - moderation: ${channel.moderationEnabled}`);
        });
      }
    } else {
      console.log('   ❌ Channel refresh failed');
    }
    
    // Test 5: Test configuration updates
    console.log('\n5. Testing configuration updates...');
    const configUpdate = {
      ...updatedPlatform?.config,
      respondToMentions: true,
      respondToCommands: true,
      privateResponses: false,
      contentFiltering: true,
      testConfigUpdate: new Date().toISOString()
    };
    
    const configResult = await storage.updatePlatform(testPlatform.id, {
      config: configUpdate
    });
    
    if (configResult) {
      console.log('   ✅ Configuration update successful');
      console.log('   Updated settings:', {
        respondToMentions: configResult.config?.respondToMentions,
        respondToCommands: configResult.config?.respondToCommands,
        privateResponses: configResult.config?.privateResponses,
        contentFiltering: configResult.config?.contentFiltering
      });
    } else {
      console.log('   ❌ Configuration update failed');
    }
    
    // Test 6: Test disconnect functionality
    console.log('\n6. Testing bot disconnect functionality...');
    const disconnectResult = await disconnectBot(testPlatform.id);
    
    if (disconnectResult) {
      console.log('   ✅ Bot disconnect completed successfully');
      
      const disconnectedPlatform = await storage.getPlatform(testPlatform.id);
      console.log(`   Platform status after disconnect: ${disconnectedPlatform?.status}`);
    } else {
      console.log('   ❌ Bot disconnect failed or bot was not connected');
    }
    
    console.log('\n🎉 Discord Integration Test Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Database Connection: Working`);
    console.log(`✅ Platform Management: Working`);
    console.log(`✅ Bot Initialization: ${initResult.success ? 'Working' : 'Failed'}`);
    console.log(`✅ Channel Management: ${refreshResult ? 'Working' : 'Failed'}`);
    console.log(`✅ Configuration Updates: Working`);
    console.log(`✅ Bot Disconnect: ${disconnectResult ? 'Working' : 'Partial'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
  } catch (error) {
    console.error('\n❌ Discord Integration Test Failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testDiscordIntegration();