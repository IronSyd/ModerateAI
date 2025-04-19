import { db } from './server/db';
import { storage } from './server/storage';

async function testPricingKnowledge() {
  console.log('Testing pricing knowledge search...');
  
  // Test various queries related to pricing
  const queries = [
    'pricing',
    'price plans',
    'how much does it cost',
    'pricing plans',
    'pro plan price',
    'pro plan',
    '$49',
    'free plan'
  ];
  
  for (const query of queries) {
    console.log(`\nSearching for: "${query}"`);
    const results = await storage.searchKnowledgeDocuments(query);
    
    console.log(`Found ${results.length} documents`);
    for (const doc of results) {
      console.log(`- "${doc.title}" (ID: ${doc.id}, Score: Relevance match)`);
    }
  }
}

testPricingKnowledge().catch(err => {
  console.error('Error testing pricing knowledge:', err);
});