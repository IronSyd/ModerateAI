#!/usr/bin/env tsx

/**
 * Simple test for the checkMessageRelevance function
 */

import { checkMessageRelevance } from './server/lib/openai';

async function testRelevanceFunction() {
  console.log('🧪 Testing Message Relevance Detection...\n');

  // Test user ID (using demo user which is ID 3)
  const testUserId = 3;
  const testKnowledgeBaseId = null; // Let it find the user's active KB

  const testMessages = [
    { text: 'How much does your service cost?', expectedRelevant: true },
    { text: 'What are your pricing plans?', expectedRelevant: true },
    { text: 'Can you tell me about your features?', expectedRelevant: true },
    { text: 'Do you have a free trial?', expectedRelevant: true },
    { text: 'What time is it?', expectedRelevant: false },
    { text: 'Hello everyone!', expectedRelevant: false },
    { text: 'Random message about cats', expectedRelevant: false },
    { text: 'How do I get started?', expectedRelevant: true },
    { text: 'Tell me about your product', expectedRelevant: true }
  ];

  let passCount = 0;
  let totalTests = testMessages.length;

  for (const test of testMessages) {
    console.log(`Testing: "${test.text}"`);
    
    try {
      const result = await checkMessageRelevance(test.text, testUserId, testKnowledgeBaseId);
      
      const isCorrect = result.isRelevant === test.expectedRelevant;
      const status = isCorrect ? '✅ PASS' : '❌ FAIL';
      
      if (isCorrect) passCount++;
      
      console.log(`  ${status} - Expected: ${test.expectedRelevant}, Got: ${result.isRelevant}`);
      console.log(`  Score: ${result.relevanceScore.toFixed(3)}, Reason: ${result.reason}`);
      console.log('');
      
    } catch (error) {
      console.log(`  ❌ ERROR: ${error.message}`);
      console.log('');
    }
  }

  console.log(`\n📊 Results: ${passCount}/${totalTests} tests passed (${Math.round(passCount/totalTests*100)}%)`);
  
  if (passCount === totalTests) {
    console.log('🎉 All tests passed! Relevance detection is working perfectly.');
  } else if (passCount >= totalTests * 0.8) {
    console.log('✅ Most tests passed. Relevance detection is working well.');
  } else {
    console.log('⚠️  Some tests failed. Relevance detection may need adjustment.');
  }
}

testRelevanceFunction()
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });