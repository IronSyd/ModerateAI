import fetch from 'node-fetch';

async function testChatbot(question) {
  try {
    console.log(`Question: ${question}`);
    console.log('---------------------');
    
    const response = await fetch('http://localhost:5000/api/openai-demo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: question }),
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log(`Response: ${data.content}`);
    } else {
      console.error(`Error: ${data.error} - ${data.message}`);
    }
    console.log('\n');
  } catch (error) {
    console.error('Failed to test chatbot:', error);
  }
}

async function runTests() {
  // Test with questions that should use the knowledge base
  const questions = [
    "What features does ModerateAI offer?",
    "How much does the Professional plan cost?",
    "Can I connect ModerateAI to my Discord server?",
    "How can I customize the AI responses?",
    "What platforms does ModerateAI support?",
    "Tell me about pricing options"
  ];
  
  for (const question of questions) {
    await testChatbot(question);
    // Add a small delay between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

runTests();