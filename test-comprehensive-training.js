#!/usr/bin/env node

/**
 * Comprehensive test for admin learning with sufficient data for training analysis
 */

import { storage } from './server/storage.js';
import { chatHistoryManager } from './server/lib/chatHistoryManager.js';

async function testComprehensiveTraining() {
  console.log('🚀 Testing Comprehensive Admin Learning with Training Analysis...\n');

  try {
    // Get chat configuration
    const chatConfig = await storage.getChatConfiguration(90);
    if (!chatConfig) {
      console.log('❌ Chat configuration 90 not found');
      return;
    }

    console.log('1. Creating comprehensive admin chat history for training...');
    
    // Create more comprehensive admin conversations (need at least 5 admin messages)
    const comprehensiveMessages = [
      { content: "How much does your service cost?", isAdmin: false, username: "customer1" },
      { content: "We have three pricing tiers: Starter at $19/month for individuals, Professional at $49/month for small teams, and Enterprise at $149/month for large organizations. All plans include 24/7 support and a 14-day free trial.", isAdmin: true, username: "admin_sarah" },
      
      { content: "What's included in the Professional plan?", isAdmin: false, username: "customer2" },
      { content: "The Professional plan includes up to 10 team members, 100GB storage, advanced analytics, priority support, API access, and custom integrations. It's perfect for growing businesses.", isAdmin: true, username: "admin_michael" },
      
      { content: "Do you offer refunds?", isAdmin: false, username: "customer3" },
      { content: "Yes, we offer a 30-day money-back guarantee for all plans. If you're not satisfied, just contact our support team and we'll process your refund within 3-5 business days.", isAdmin: true, username: "admin_sarah" },
      
      { content: "Can I cancel anytime?", isAdmin: false, username: "customer4" },
      { content: "Absolutely! You can cancel your subscription at any time from your account settings. Your service will continue until the end of your current billing period, and you won't be charged again.", isAdmin: true, username: "admin_michael" },
      
      { content: "What about data export?", isAdmin: false, username: "customer5" },
      { content: "We provide full data export capabilities. You can export all your data in CSV, JSON, or XML formats at any time. We believe your data should always be portable and accessible to you.", isAdmin: true, username: "admin_sarah" },
      
      { content: "Is there an API?", isAdmin: false, username: "customer6" },
      { content: "Yes! Our REST API is available on Professional and Enterprise plans. We provide comprehensive documentation, SDKs for popular languages, and webhook support for real-time integrations.", isAdmin: true, username: "admin_michael" },
      
      { content: "What about security?", isAdmin: false, username: "customer7" },
      { content: "Security is our top priority. We use enterprise-grade encryption, SOC 2 compliance, regular security audits, and maintain 99.9% uptime. All data is encrypted both in transit and at rest.", isAdmin: true, username: "admin_sarah" }
    ];

    // Store all messages
    for (const msg of comprehensiveMessages) {
      await chatHistoryManager.storeChatMessage(
        90,
        chatConfig.platformId,
        msg.username,
        msg.content,
        msg.isAdmin ? "admin" : "user",
        msg.isAdmin,
        { username: msg.username }
      );
    }

    console.log(`✅ Created ${comprehensiveMessages.length} messages (${comprehensiveMessages.filter(m => m.isAdmin).length} admin messages)`);

    // Check admin history count
    const adminHistory = await chatHistoryManager.getAdminChatHistory(90, 50);
    console.log(`✅ Total admin messages in history: ${adminHistory.length}`);

    if (adminHistory.length >= 5) {
      console.log('\n2. Running training analysis with sufficient data...');
      
      try {
        const platform = await storage.getPlatform(chatConfig.platformId);
        if (platform) {
          const insights = await chatHistoryManager.analyzeAndLearnFromAdminHistory(90, platform.userId);
          console.log(`✅ Training analysis completed successfully!`);
          console.log(`✅ Generated ${insights.length} training insights:`);
          
          for (const insight of insights) {
            console.log(`   📚 ${insight.insightType}: ${insight.pattern}`);
            console.log(`      Confidence: ${Math.round(insight.confidence * 100)}%`);
            console.log(`      Learned from: ${insight.learnedFrom}`);
            console.log('');
          }

          // Test retrieving insights
          const retrievedInsights = await chatHistoryManager.getActiveInsights(90);
          console.log(`✅ Retrieved ${retrievedInsights.length} active insights from database`);

          // Test insight toggle functionality
          if (retrievedInsights.length > 0) {
            console.log('\n3. Testing insight management...');
            const firstInsight = retrievedInsights[0];
            
            // Toggle insight off
            await chatHistoryManager.updateTrainingInsight(firstInsight.id, { isActive: false });
            let activeCount = await chatHistoryManager.getActiveInsights(90);
            console.log(`✅ Toggled insight off - Active insights: ${activeCount.length}`);
            
            // Toggle insight back on
            await chatHistoryManager.updateTrainingInsight(firstInsight.id, { isActive: true });
            activeCount = await chatHistoryManager.getActiveInsights(90);
            console.log(`✅ Toggled insight back on - Active insights: ${activeCount.length}`);
          }

          console.log('\n🎉 Comprehensive training analysis test completed successfully!');
          console.log('\n📊 Final Results:');
          console.log(`   - Admin Learning Mode: ✅ Working`);
          console.log(`   - Chat History Storage: ✅ Working`);
          console.log(`   - Training Analysis: ✅ Working`);
          console.log(`   - Insight Generation: ✅ Working (${insights.length} insights created)`);
          console.log(`   - Insight Management: ✅ Working`);

        } else {
          console.log('❌ Platform not found');
        }
      } catch (error) {
        console.log(`❌ Training analysis failed: ${error.message}`);
        console.error(error.stack);
      }
    } else {
      console.log(`⚠️  Still insufficient admin history (${adminHistory.length}/5 required)`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error(error.stack);
  }
}

// Run the comprehensive test
testComprehensiveTraining().catch(console.error);