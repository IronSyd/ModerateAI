import { db } from './server/db';
import { knowledgeDocuments, knowledgeBases } from './shared/schema';

async function listKnowledgeDocuments() {
  console.log('Listing knowledge bases...');
  const bases = await db.select().from(knowledgeBases);
  
  console.log(`Found ${bases.length} knowledge bases:`);
  for (const kb of bases) {
    console.log(`- ID: ${kb.id}, Name: ${kb.name}`);
  }
  
  console.log('\nListing knowledge documents...');
  const docs = await db.select().from(knowledgeDocuments);
  
  console.log(`Found ${docs.length} knowledge documents:`);
  for (const doc of docs) {
    console.log(`\nID: ${doc.id}, KB ID: ${doc.knowledgeBaseId}`);
    console.log(`Title: ${doc.title}`);
    console.log(`Content (first 100 chars): ${doc.content.substring(0, 100).trim()}...`);
  }
}

listKnowledgeDocuments().catch(err => {
  console.error('Error listing knowledge documents:', err);
});