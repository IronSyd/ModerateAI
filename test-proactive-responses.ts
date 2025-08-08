#!/usr/bin/env tsx

/**
 * Comprehensive test for proactive response functionality
 * This script tests the complete workflow of the proactive response feature
 */

import { storage } from './server/storage';
import { checkMessageRelevance } from './server/lib/openai';

async function testProactiveResponseLogic() {
  console.log('🧪 Testing Proactive Response Logic...\n');

  try {
    // 1. Test with demo user
    console.log('1. Getting demo user...');
    const users = await storage.getUsers();
    const demoUser = users.find(u => u.email === 'demo@example.com');
    
    if (!demoUser) {
      console.log('❌ Demo user not found');
      return;
    }
    console.log(`✅ Found demo user: ${demoUser.email} (ID: ${demoUser.id})`);

    // 2. Check knowledge bases
    console.log('\n2. Checking knowledge bases...');
    const knowledgeBases = await storage.getKnowledgeBasesByUserId(demoUser.id);
    
    if (knowledgeBases.length === 0) {
      console.log('❌ No knowledge bases found for demo user');
      return;
    }
    
    const activeKB = knowledgeBases.find(kb => kb.isActive) || knowledgeBases[0];
    console.log(`✅ Found knowledge base: ${activeKB.name} (ID: ${activeKB.id})`);

    // 3. Check knowledge base documents
    console.log('\n3. Checking knowledge base documents...');
    const documents = await storage.getKnowledgeDocumentsByKnowledgeBaseId(activeKB.id);
    
    if (documents.length === 0) {
      console.log('❌ No documents found in knowledge base');
      return;
    }
    
    console.log(`✅ Found ${documents.length} documents:`);
    documents.forEach((doc, i) => {
      console.log(`   ${i + 1}. ${doc.title} (${doc.content.length} chars)`);
    });

    // 4. Test relevance detection with various messages
    console.log('\n4. Testing relevance detection...');
    
    const testMessages = [
      'How much does your service cost?',
      'What are your pricing plans?',
      'Can you tell me about your features?',
      'How do I get started?',
      'Hello everyone!',
      'What time is it?',
      'Random message that should not be relevant',
      'Tell me about your product',
      'Do you have a free trial?',
      'What about support?'
    ];

    for (const message of testMessages) {
      console.log(`\n   Testing: "${message}"`);
      
      try {
        const relevanceResult = await checkMessageRelevance(
          message,
          demoUser.id,
          activeKB.id
        );
        
        console.log(`   Result: ${relevanceResult.isRelevant ? '✅ RELEVANT' : '❌ NOT RELEVANT'}`);
        console.log(`   Score: ${relevanceResult.relevanceScore.toFixed(3)}`);
        console.log(`   Reason: ${relevanceResult.reason}`);
        
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
      }
    }

    // 5. Test chat configuration with proactive responses
    console.log('\n5. Testing chat configuration...');
    
    const platforms = await storage.getPlatformsByUserId(demoUser.id);
    const telegramPlatform = platforms.find(p => p.type === 'telegram');
    
    if (telegramPlatform) {
      console.log(`✅ Found Telegram platform: ${telegramPlatform.name} (ID: ${telegramPlatform.id})`);
      
      const chatConfigs = await storage.getChatConfigurationsByPlatformId(telegramPlatform.id);
      console.log(`✅ Found ${chatConfigs.length} chat configurations`);
      
      if (chatConfigs.length > 0) {
        const testConfig = chatConfigs[0];
        console.log(`   Testing with config: ${testConfig.chatName || testConfig.externalId}`);
        
        // Check if proactive responses setting exists
        const settings = testConfig.settings as any;
        const proactiveEnabled = settings?.proactiveResponses !== false;
        console.log(`   Proactive responses: ${proactiveEnabled ? '✅ ENABLED' : '❌ DISABLED'}`);
        
        // Simulate the logic from the bot
        console.log('\n   Simulating bot logic...');
        const testMessage = 'What are your pricing plans?';
        const mentionOnlyMode = settings?.mentionOnlyMode || false;
        const isGroupMessage = testConfig.chatType === 'group';
        const isBotMentioned = false; // Simulating no mention
        
        console.log(`   Message: "${testMessage}"`);
        console.log(`   Chat type: ${testConfig.chatType}`);
        console.log(`   Mention only mode: ${mentionOnlyMode}`);
        console.log(`   Bot mentioned: ${isBotMentioned}`);
        console.log(`   Proactive responses: ${proactiveEnabled}`);
        
        let shouldRespond = false;
        
        if (isGroupMessage && !isBotMentioned) {
          if (mentionOnlyMode && !proactiveEnabled) {
            console.log('   → Would skip: Mention only mode + no proactive responses');
          } else if (proactiveEnabled) {
            const relevanceCheck = await checkMessageRelevance(
              testMessage,
              demoUser.id,
              testConfig.knowledgeBaseId
            );
            
            if (relevanceCheck.isRelevant) {
              shouldRespond = true;
              console.log('   → ✅ Would respond: Message is relevant!');
            } else {
              console.log('   → ❌ Would skip: Message not relevant');
            }
          }
        } else {
          shouldRespond = true;
          console.log('   → ✅ Would respond: Direct message or bot mentioned');
        }
        
        console.log(`   FINAL DECISION: ${shouldRespond ? '🤖 RESPOND' : '🔇 IGNORE'}`);
      }
    }

    console.log('\n🎉 Proactive response logic test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error(error.stack);
  }
}

// Run the test
testProactiveResponseLogic()
  .then(() => {
    console.log('\n✅ Test script finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test script failed:', error);
    process.exit(1);
  });

export { testProactiveResponseLogic };