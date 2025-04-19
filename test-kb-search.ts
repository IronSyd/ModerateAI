import { storage } from './server/storage';

async function testKnowledgeSearch(query: string) {
  console.log(`Testing search with query: "${query}"`);
  try {
    const docs = await storage.searchKnowledgeDocuments(query);
    console.log(`Found ${docs.length} matching documents:`);
    
    docs.forEach((doc, i) => {
      console.log(`\n[${i+1}] ${doc.title} (ID: ${doc.id})`);
      console.log(`Excerpt: ${doc.content.substring(0, 100)}...`);
    });
    
    if (docs.length === 0) {
      console.log("No documents found! Check if knowledge base exists and has documents.");
    }
  } catch (error) {
    console.error("Error searching knowledge base:", error);
  }
}

async function testKnowledgeBase() {
  // Test simple queries
  await testKnowledgeSearch("pricing");
  await testKnowledgeSearch("what are the pricing plans");
  await testKnowledgeSearch("Pro Plan cost");
  
  // Test feature queries
  await testKnowledgeSearch("Discord features");
  await testKnowledgeSearch("Telegram");
}

testKnowledgeBase();