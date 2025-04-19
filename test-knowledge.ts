import { storage } from "./server/storage";

async function testKnowledgeSearch(query: string) {
  console.log(`Testing query: "${query}"`);
  
  try {
    const documents = await storage.searchKnowledgeDocuments(query);
    
    console.log(`Found ${documents.length} documents`);
    
    if (documents.length > 0) {
      console.log("\nMatching documents:");
      documents.forEach((doc, i) => {
        console.log(`\n[Document ${i+1}] ${doc.title} (ID: ${doc.id})`);
        // Print just the first 100 chars of content to keep output manageable
        const previewContent = doc.content.length > 100 
          ? doc.content.substring(0, 100) + "..." 
          : doc.content;
        console.log(`Preview: ${previewContent}`);
      });
    } else {
      console.log("No matching documents found");
    }
    
    console.log("\n-----------------------------------\n");
  } catch (error) {
    console.error("Error searching for documents:", error);
  }
}

async function runTests() {
  const queries = [
    "What features does ModerateAI offer?",
    "How much does the Professional plan cost?",
    "Pricing plans",
    "Platform integration",
    "Website chat widget",
    "pricing",
    "features"
  ];
  
  for (const query of queries) {
    await testKnowledgeSearch(query);
  }
}

runTests()
  .then(() => {
    console.log("All tests completed");
    process.exit(0);
  })
  .catch(error => {
    console.error("Error running tests:", error);
    process.exit(1);
  });