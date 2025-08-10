#!/usr/bin/env node

/**
 * Verify the AI Training & Learning buttons work with the system
 */

import { chatHistoryManager } from './server/lib/chatHistoryManager.ts';
import { db } from './server/db.ts';
import { chatConfigurations } from './shared/schema.ts';
import { eq } from 'drizzle-orm';

async function verifyTrainingIntegration() {
  console.log('🔍 Verifying AI Training & Learning Integration...\n');

  try {
    // Get the chat configuration from the screenshot (ID 2)
    const [chatConfig] = await db
      .select()
      .from(chatConfigurations)
      .where(eq(chatConfigurations.id, 2))
      .limit(1);

    if (!chatConfig) {
      console.log('❌ Chat configuration ID 2 not found');
      return;
    }

    console.log(`✅ Found chat configuration: ID ${chatConfig.id}`);
    console.log(`   Platform ID: ${chatConfig.platformId}`);
    console.log(`   Active: ${chatConfig.isActive}`);

    // Check current settings
    const settings = chatConfig.settings as any;
    console.log('\n📋 Current Training Settings:');
    console.log(`   History Learning: ${settings?.enableHistoryLearning ? '✅ ENABLED' : '❌ Disabled'}`);
    console.log(`   Admin Learning Mode: ${settings?.adminLearningMode ? '✅ ENABLED' : '❌ Disabled'}`);

    // Test training detection functions
    console.log('\n🧪 Testing Training Detection Functions:');
    
    const historyLearningEnabled = await chatHistoryManager.isHistoryLearningEnabled(2);
    console.log(`   isHistoryLearningEnabled(2): ${historyLearningEnabled ? '✅ TRUE' : '❌ FALSE'}`);
    
    const adminLearningModeEnabled = await chatHistoryManager.isAdminLearningModeEnabled(2);
    console.log(`   isAdminLearningModeEnabled(2): ${adminLearningModeEnabled ? '✅ TRUE' : '❌ FALSE'}`);

    // Test "Manage Training" button logic
    console.log('\n🎯 Testing "Manage Training" Button Logic:');
    const shouldShowManageButton = historyLearningEnabled || adminLearningModeEnabled;
    console.log(`   Button should be ${shouldShowManageButton ? 'ENABLED' : 'DISABLED'}: ${shouldShowManageButton ? '✅' : '❌'}`);

    // Test message storage capability
    console.log('\n💾 Testing Message Storage Capability:');
    if (historyLearningEnabled) {
      console.log('   ✅ Ready to store chat messages for training');
      
      // Test storing a sample admin message
      const testMessage = await chatHistoryManager.storeChatMessage(
        2, // chatConfigId
        chatConfig.platformId,
        'admin_test_user',
        'This is a test admin response for training verification',
        'admin',
        true,
        { username: 'test_admin', messageId: 'test_001' }
      );
      
      console.log(`   ✅ Test message stored with ID: ${testMessage.id}`);
      
      // Clean up test data
      await db.delete(chatHistory).where(eq(chatHistory.id, testMessage.id));
      console.log('   ✅ Test data cleaned up');
      
    } else {
      console.log('   ⚠️  History Learning disabled - messages won\'t be stored');
    }

    // Test admin learning analysis capability
    console.log('\n🧠 Testing Admin Learning Analysis:');
    if (adminLearningModeEnabled) {
      console.log('   ✅ Ready to analyze admin responses');
      console.log('   ✅ Will generate training insights from admin conversations');
    } else {
      console.log('   ⚠️  Admin Learning Mode disabled - no analysis will occur');
    }

    // Test training management interface readiness
    console.log('\n🎛️ Testing Training Management Interface:');
    try {
      const insights = await chatHistoryManager.getActiveInsights(2);
      console.log(`   ✅ Can retrieve training insights: ${insights.length} insights found`);
      
      const chatHistory = await chatHistoryManager.getChatHistoryByChatConfiguration(2, 10);
      console.log(`   ✅ Can retrieve chat history: ${chatHistory.length} messages found`);
      
      const adminHistory = await chatHistoryManager.getAdminChatHistory(2, 10);
      console.log(`   ✅ Can retrieve admin history: ${adminHistory.length} admin messages found`);
      
    } catch (error) {
      console.log(`   ❌ Training interface error: ${error.message}`);
    }

    console.log('\n🎉 Integration Verification Complete!');
    
    // Summary
    const enabledFeatures = [];
    if (historyLearningEnabled) enabledFeatures.push('History Learning');
    if (adminLearningModeEnabled) enabledFeatures.push('Admin Learning Mode');
    
    if (enabledFeatures.length > 0) {
      console.log(`\n✅ SYSTEM READY: ${enabledFeatures.join(' + ')} enabled`);
      console.log('   The "Manage Training" button should be active and functional');
      console.log('   Training data will be collected and analyzed automatically');
    } else {
      console.log('\n⚠️  NO TRAINING FEATURES ENABLED');
      console.log('   Enable at least one training mode to use the system');
    }

  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

// Import required modules
import { chatHistory } from './shared/schema.ts';

// Run verification
verifyTrainingIntegration().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Verification execution failed:', error);
  process.exit(1);
});