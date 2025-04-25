import OpenAI from "openai";
import { storage } from "../storage";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Generate an AI response based on a message and conversation history
 */
export async function generateAIResponse(
  message: string,
  conversationHistory: Array<{ role: string; content: string }>,
  systemPrompt: string,
  responseStyle: number = 50,
  responseLength: number = 50,
): Promise<string> {
  try {
    console.log(`[generateAIResponse] Generating response for message: "${message.substring(0, 50)}..."`);
    
    // Convert conversation history to OpenAI format
    const formattedHistory = conversationHistory.map(msg => ({
      role: msg.role === "ai" ? "assistant" : "user",
      content: msg.content
    }));
    
    // Apply response style to system prompt
    const styledPrompt = applyResponseStyle(systemPrompt, responseStyle);
    
    // Create the messages array
    const messages = [
      { role: "system", content: styledPrompt },
      ...formattedHistory,
      { role: "user", content: message }
    ];
    
    // Get response from OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages as any,
      max_tokens: calculateMaxTokens(responseLength),
      temperature: calculateTemperature(responseStyle)
    });
    
    return response.choices[0].message.content || "I apologize, but I couldn't generate a response at this time.";
  } catch (error) {
    console.error("Error generating AI response:", error);
    throw error;
  }
}

/**
 * Generate an AI response with consideration of knowledge base documents
 */
export async function generateKnowledgeBasedResponse(
  message: string,
  conversationHistory: Array<{ role: string; content: string }>,
  systemPrompt: string,
  responseStyle: number = 50,
  responseLength: number = 50,
): Promise<string> {
  try {
    console.log(`[generateKnowledgeBasedResponse] Processing query: "${message.substring(0, 50)}..."`);
    
    // First, retrieve relevant documents from knowledge base using semantic search
    // This could be implemented with embeddings, but for simplicity we'll use keywords
    const keywords = extractKeywords(message);
    
    // For demo purposes, just use the default knowledge base if any
    const knowledgeBases = await storage.getAllKnowledgeBases();
    const knowledgeBase = knowledgeBases.find(kb => kb.isActive) || knowledgeBases[0];
    
    let relevantDocuments: Array<{ title: string; content: string }> = [];
    
    if (knowledgeBase) {
      // Get documents from the knowledge base
      const documents = await storage.getKnowledgeDocumentsByKnowledgeBaseId(knowledgeBase.id);
      
      // Search for relevant documents
      relevantDocuments = documents
        .map(doc => {
          // Simple relevance scoring
          const titleMatches = keywords.filter(kw => doc.title.toLowerCase().includes(kw.toLowerCase())).length;
          const contentMatches = keywords.filter(kw => doc.content.toLowerCase().includes(kw.toLowerCase())).length;
          const score = titleMatches * 2 + contentMatches;
          
          return { doc, score };
        })
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3) // Top 3 most relevant documents
        .map(item => ({ title: item.doc.title, content: item.doc.content }));
    }
    
    // Convert conversation history to OpenAI format
    const formattedHistory = conversationHistory.map(msg => ({
      role: msg.role === "ai" ? "assistant" : "user",
      content: msg.content
    }));
    
    // Apply response style to system prompt
    const styledPrompt = applyResponseStyle(systemPrompt, responseStyle);
    
    // Add knowledge context to system prompt if available
    let enhancedPrompt = styledPrompt;
    if (relevantDocuments.length > 0) {
      enhancedPrompt += "\n\nRelevant information from knowledge base:";
      relevantDocuments.forEach((doc, index) => {
        enhancedPrompt += `\n\nDocument ${index + 1} - ${doc.title}:\n${doc.content.substring(0, 500)}`;
      });
      enhancedPrompt += "\n\nPlease use this information when relevant to answer the user's question.";
    }
    
    // Create the messages array
    const messages = [
      { role: "system", content: enhancedPrompt },
      ...formattedHistory,
      { role: "user", content: message }
    ];
    
    // Get response from OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages as any,
      max_tokens: calculateMaxTokens(responseLength),
      temperature: calculateTemperature(responseStyle)
    });
    
    return response.choices[0].message.content || "I apologize, but I couldn't generate a response at this time.";
  } catch (error) {
    console.error("Error generating knowledge-based response:", error);
    throw error;
  }
}

/**
 * Moderate content and flag if it violates policies
 */
export async function moderateContent(
  content: string, 
  strictnessLevel: number = 50
): Promise<{
  flagged: boolean;
  reason: string | null;
  categories: Record<string, boolean>;
  scores: Record<string, number>;
}> {
  try {
    console.log(`[moderateContent] Moderating content with strictness level ${strictnessLevel}`);
    
    // Use OpenAI's moderation endpoint
    const moderationResponse = await openai.moderations.create({
      input: content
    });
    
    const result = moderationResponse.results[0];
    const categories = result.categories;
    const scores = result.category_scores;
    
    // Adjust flagging threshold based on strictness level (0-100)
    // Lower strictness level = higher threshold (more permissive)
    // Higher strictness level = lower threshold (more strict)
    const baseThreshold = 0.8; // Default threshold for moderate strictness (50)
    const adjustedThreshold = baseThreshold - (strictnessLevel - 50) / 100;
    
    // Find the highest score and its category
    let highestCategory = "";
    let highestScore = 0;
    
    Object.entries(scores).forEach(([category, score]) => {
      if (score > highestScore) {
        highestScore = score;
        highestCategory = category;
      }
    });
    
    // Check if content should be flagged based on adjusted threshold
    const shouldFlag = result.flagged || highestScore > adjustedThreshold;
    
    // Format the reason
    let reason = null;
    if (shouldFlag) {
      reason = `Content flagged for ${highestCategory.replace('/', ' ')} with score ${highestScore.toFixed(2)}`;
    }
    
    return {
      flagged: shouldFlag,
      reason,
      categories,
      scores
    };
  } catch (error) {
    console.error("Error moderating content:", error);
    // Default to flagging in case of error
    return {
      flagged: true,
      reason: "Error occurred during moderation",
      categories: {},
      scores: {}
    };
  }
}

// Function to process a batch of messages for training
export async function processConversationForTraining(conversationData: {
  messages: Array<{ sender: string; content: string }>;
  platformType: string;
}) {
  try {
    const { messages, platformType } = conversationData;
    
    // Format the conversation into a prompt
    const prompt = formatConversationPrompt(messages, platformType);
    
    // Send to OpenAI for analysis
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: 
            "You are an AI assistant that analyzes conversation data to extract patterns and learning. " +
            "Your task is to identify key conversational patterns, helpful responses, and user intents. " +
            "The result will be used to improve AI responses in future similar conversations. " +
            "Format your analysis as JSON with the following structure: { 'patterns': [], 'intents': [], 'effectiveResponses': [], 'suggestions': [] }"
        },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }
    });

    // Parse and return the analysis
    const analysisText = response.choices[0].message.content;
    const analysis = JSON.parse(analysisText);

    return {
      success: true,
      analysis,
      usage: response.usage
    };
  } catch (error) {
    console.error("Error analyzing conversation for training:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Format the conversation into a prompt for the AI
function formatConversationPrompt(
  messages: Array<{ sender: string; content: string }>,
  platformType: string
): string {
  const formattedMessages = messages.map(msg => {
    const role = msg.sender === 'ai' ? 'AI Assistant' : 'User';
    return `${role}: ${msg.content}`;
  }).join('\n\n');

  return `Analyze this conversation from a ${platformType} platform and extract insights for training:

${formattedMessages}

Focus on identifying:
1. Common patterns in user requests
2. User intents that were successfully addressed
3. Effective AI responses that could be reused or adapted in future conversations
4. Specific suggestions for improving responses to similar queries
`;
}

/**
 * Processes multiple conversations for training purposes
 * Used to analyze conversations and generate insights for improving AI responses
 */
export async function trainOnConversations(
  conversations: Array<{
    id: number;
    messages: Array<{ sender: string; content: string }>;
    platformType: string;
  }>
) {
  const results = [];
  let processedCount = 0;
  
  for (const conversation of conversations) {
    try {
      const result = await processConversationForTraining({
        messages: conversation.messages,
        platformType: conversation.platformType
      });
      
      results.push({
        conversationId: conversation.id,
        success: result.success,
        analysis: result.success ? result.analysis : null,
        error: !result.success ? result.error : null
      });
      
      processedCount++;
      
      // Sleep briefly to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Error processing conversation ${conversation.id}:`, error);
      results.push({
        conversationId: conversation.id,
        success: false,
        error: error.message
      });
    }
  }
  
  return {
    processedCount,
    results
  };
}

export async function generateImprovedSystemPrompt(
  currentPrompt: string,
  trainingAnalyses: Array<any>
) {
  try {
    // Extract and compile insights from training analyses
    const patterns = trainingAnalyses.flatMap(analysis => analysis.patterns || []);
    const intents = trainingAnalyses.flatMap(analysis => analysis.intents || []);
    const effectiveResponses = trainingAnalyses.flatMap(analysis => analysis.effectiveResponses || []);
    const suggestions = trainingAnalyses.flatMap(analysis => analysis.suggestions || []);
    
    // Create a summary of insights for the AI
    const insightsSummary = JSON.stringify({
      patterns,
      intents,
      effectiveResponses,
      suggestions
    }, null, 2);
    
    // Generate improved prompt
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert AI prompt engineer who can improve system prompts based on conversation analysis."
        },
        {
          role: "user",
          content: `Here is the current system prompt for our AI assistant:

"${currentPrompt}"

Based on analysis of conversations, here are the insights we've gathered:
${insightsSummary}

Please generate an improved system prompt that incorporates these insights. The prompt should:
1. Maintain the original purpose and tone
2. Add specific guidance based on the patterns and intents identified
3. Include examples of effective responses
4. Address the suggestions for improvement
5. Be clear, concise, and focused

Return only the improved prompt text, without quotes or additional commentary.`
        }
      ]
    });
    
    return {
      success: true,
      improvedPrompt: response.choices[0].message.content.trim()
    };
  } catch (error) {
    console.error("Error generating improved system prompt:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Helper function to extract keywords from a message
 */
function extractKeywords(text: string): string[] {
  // Remove special characters and split into words
  const words = text.toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
    .split(/\s+/);
  
  // A very basic list of English stop words
  const stopWords = ['a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
    'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were', 'will', 'with'];
  
  // Filter out stop words and words shorter than 3 characters
  return words.filter(word => 
    !stopWords.includes(word) && 
    word.length >= 3
  );
}

/**
 * Adjust the system prompt based on the desired response style
 */
function applyResponseStyle(prompt: string, styleValue: number): string {
  // styleValue: 0-33 (formal), 34-66 (balanced), 67-100 (friendly)
  let styleSuffix = "";
  
  if (styleValue <= 33) {
    styleSuffix = "\n\nMaintain a formal, professional tone in your responses. Prioritize accuracy and precision over conversational language.";
  } else if (styleValue <= 66) {
    styleSuffix = "\n\nUse a balanced, neutral tone in your responses that is both professional and approachable.";
  } else {
    styleSuffix = "\n\nUse a friendly, conversational tone in your responses. Be warm and approachable while still being helpful and informative.";
  }
  
  return prompt + styleSuffix;
}

/**
 * Calculate the max tokens parameter based on response length preference
 */
function calculateMaxTokens(lengthValue: number): number {
  // lengthValue: 0-33 (concise), 34-66 (balanced), 67-100 (detailed)
  if (lengthValue <= 33) {
    return 150; // Very concise responses
  } else if (lengthValue <= 66) {
    return 400; // Moderate length responses
  } else {
    return 800; // Detailed responses
  }
}

/**
 * Calculate temperature based on style parameter
 */
function calculateTemperature(styleValue: number): number {
  // Convert from 0-100 scale to 0-1 scale with adjustment
  // Lower values (more formal) should have lower temperature
  // Higher values (more friendly) should have higher temperature
  const baseTemperature = 0.7; // Default balanced temperature
  const adjustmentFactor = (styleValue - 50) / 100; // Will be between -0.5 and 0.5
  
  // Calculate the adjusted temperature within bounds of 0.5 to 0.9
  return Math.max(0.5, Math.min(0.9, baseTemperature + adjustmentFactor));
}

/**
 * Format a conversation into a prompt for analysis
 */
function formatConversationPrompt(
  messages: Array<{ sender: string; content: string }>,
  platformType: string
): string {
  const formattedMessages = messages.map(msg => {
    const role = msg.sender === 'ai' ? 'AI Assistant' : 'User';
    return `${role}: ${msg.content}`;
  }).join('\n\n');

  return `Analyze this conversation from a ${platformType} platform and extract insights for training:

${formattedMessages}

Focus on identifying:
1. Common patterns in user requests
2. User intents that were successfully addressed
3. Effective AI responses that could be reused or adapted in future conversations
4. Specific suggestions for improving responses to similar queries
`;
}

/**
 * Process a conversation for training purposes
 */
async function processConversationForTraining(conversationData: {
  messages: Array<{ sender: string; content: string }>;
  platformType: string;
}) {
  try {
    const { messages, platformType } = conversationData;
    
    // Format the conversation into a prompt
    const prompt = formatConversationPrompt(messages, platformType);
    
    // Send to OpenAI for analysis
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: 
            "You are an AI assistant that analyzes conversation data to extract patterns and learning. " +
            "Your task is to identify key conversational patterns, helpful responses, and user intents. " +
            "The result will be used to improve AI responses in future similar conversations. " +
            "Format your analysis as JSON with the following structure: { 'patterns': [], 'intents': [], 'effectiveResponses': [], 'suggestions': [] }"
        },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }
    });

    // Parse and return the analysis
    const analysisText = response.choices[0].message.content;
    const analysis = JSON.parse(analysisText);

    return {
      success: true,
      analysis,
      usage: response.usage
    };
  } catch (error) {
    console.error("Error analyzing conversation for training:", error);
    return {
      success: false,
      error: error.message
    };
  }
}