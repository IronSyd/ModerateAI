import OpenAI from "openai";
import { storage } from "../storage";
import { KnowledgeDocument } from "@shared/schema";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "sk-demo-key" });

// Generate AI response to user message
export async function generateAIResponse(
  userMessage: string,
  conversationHistory: { role: string, content: string }[],
  systemPrompt: string,
  responseStyle: number,
  responseLength: number
): Promise<string> {
  try {
    // Build system prompt based on configuration
    let fullSystemPrompt = systemPrompt || "You are a helpful customer support assistant.";
    
    // Adjust tone based on response style (0-100)
    if (responseStyle <= 25) {
      fullSystemPrompt += " Your tone is formal and professional.";
    } else if (responseStyle <= 50) {
      fullSystemPrompt += " Your tone is professional yet approachable.";
    } else if (responseStyle <= 75) {
      fullSystemPrompt += " Your tone is friendly and helpful.";
    } else {
      fullSystemPrompt += " Your tone is very friendly, casual and conversational.";
    }
    
    // Adjust length based on responseLength (0-100)
    if (responseLength <= 25) {
      fullSystemPrompt += " Keep your responses extremely concise and to the point.";
    } else if (responseLength <= 50) {
      fullSystemPrompt += " Keep your responses concise.";
    } else if (responseLength <= 75) {
      fullSystemPrompt += " Provide moderately detailed responses.";
    } else {
      fullSystemPrompt += " Provide comprehensive, detailed responses.";
    }
    
    // Create complete message history
    const messages = [
      { role: "system", content: fullSystemPrompt },
      ...conversationHistory,
      { role: "user", content: userMessage }
    ];
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages as any,
      max_tokens: 500
    });
    
    return response.choices[0].message.content || "I'm sorry, I couldn't generate a response.";
  } catch (error: any) {
    console.error("Error generating AI response:", error);
    
    // More specific error message for rate limit issues
    if (error.status === 429) {
      throw error; // Re-throw to let the calling code handle it with appropriate status
    }
    
    return "I'm sorry, there was an error processing your request. Please try again later.";
  }
}

// Generate AI response to user message with knowledge base support
export async function generateKnowledgeBasedResponse(
  userMessage: string, 
  conversationHistory: { role: string, content: string }[], 
  systemPrompt: string,
  responseStyle: number, 
  responseLength: number
): Promise<string> {
  try {
    console.log(`[generateKnowledgeBasedResponse] Processing query: "${userMessage}"`);
    
    // Extract keywords from the query for better retrieval
    const keywords = userMessage.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => 
        word.length > 3 && 
        !['what', 'when', 'where', 'which', 'there', 'their', 'about', 'would'].includes(word)
      );
      
    console.log(`[generateKnowledgeBasedResponse] Extracted keywords: ${keywords.join(', ')}`);
    
    // Search for relevant knowledge documents
    let relevantDocs = await storage.searchKnowledgeDocuments(userMessage);
    
    // Try searching with just keywords if no results
    if (relevantDocs.length === 0 && keywords.length > 0) {
      console.log(`[generateKnowledgeBasedResponse] No results with full query, trying keywords...`);
      relevantDocs = await storage.searchKnowledgeDocuments(keywords.join(' '));
    }
    
    // Log for debugging
    console.log(`[generateKnowledgeBasedResponse] Found ${relevantDocs.length} relevant documents`);
    if (relevantDocs.length > 0) {
      console.log(`[generateKnowledgeBasedResponse] Most relevant document: "${relevantDocs[0].title}"`);
    }
    
    // Build context information from knowledge documents
    let knowledgeContext = "";
    if (relevantDocs.length > 0) {
      knowledgeContext = "### KNOWLEDGE BASE INFORMATION ###\n";
      knowledgeContext += "INSTRUCTION: Base your answers ONLY on the following information from our knowledge base.\n";
      knowledgeContext += "If the information doesn't contain the answer, say you don't have that specific information rather than making up an answer.\n\n";
      
      // Use up to 3 most relevant documents to keep context manageable
      for (let i = 0; i < Math.min(3, relevantDocs.length); i++) {
        const doc = relevantDocs[i];
        knowledgeContext += `### DOCUMENT ${i+1}: ${doc.title} ###\n${doc.content}\n\n`;
        console.log(`[generateKnowledgeBasedResponse] Using document: "${doc.title}"`);
      }
      
      knowledgeContext += "### END OF KNOWLEDGE BASE INFORMATION ###\n\n";
    }
    
    // Build system prompt based on configuration
    let fullSystemPrompt = systemPrompt || "You are a helpful customer support assistant.";
    
    // Add knowledge context if available
    if (knowledgeContext) {
      console.log(`[generateKnowledgeBasedResponse] Adding knowledge context with length: ${knowledgeContext.length}`);
      
      // Make knowledge context more prominent by putting it at the beginning
      fullSystemPrompt = knowledgeContext + "\n\n" + fullSystemPrompt;
      
      // Add explicit instruction to use knowledge
      fullSystemPrompt += "\n\nIMPORTANT: Base your answers ONLY on the knowledge base documents provided above. If you can't find an answer in the documents, say 'I don't have specific information about that in my knowledge base' rather than making up an answer.";
    } else {
      console.log(`[generateKnowledgeBasedResponse] No knowledge context available`);
    }
    
    // Adjust tone based on response style (0-100)
    if (responseStyle <= 25) {
      fullSystemPrompt += " Your tone is formal and professional.";
    } else if (responseStyle <= 50) {
      fullSystemPrompt += " Your tone is professional yet approachable.";
    } else if (responseStyle <= 75) {
      fullSystemPrompt += " Your tone is friendly and helpful.";
    } else {
      fullSystemPrompt += " Your tone is very friendly, casual and conversational.";
    }
    
    // Adjust length based on responseLength (0-100)
    if (responseLength <= 25) {
      fullSystemPrompt += " Keep your responses extremely concise and to the point.";
    } else if (responseLength <= 50) {
      fullSystemPrompt += " Keep your responses concise.";
    } else if (responseLength <= 75) {
      fullSystemPrompt += " Provide moderately detailed responses.";
    } else {
      fullSystemPrompt += " Provide comprehensive, detailed responses.";
    }
    
    // We've already added instructions for using knowledge at the end of the context setup
    // No need for additional instructions here
    
    // Create complete message history
    const messages = [
      { role: "system", content: fullSystemPrompt },
      ...conversationHistory,
      { role: "user", content: userMessage }
    ];
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages as any,
      max_tokens: 500
    });
    
    return response.choices[0].message.content || "I'm sorry, I couldn't generate a response.";
  } catch (error: any) {
    console.error("Error generating knowledge-based AI response:", error);
    
    // More specific error message for rate limit issues
    if (error.status === 429) {
      throw error; // Re-throw to let the calling code handle it with appropriate status
    }
    
    // If there's an error accessing knowledge base, fall back to regular response
    return generateAIResponse(userMessage, conversationHistory, systemPrompt, responseStyle, responseLength);
  }
}

// Moderate content
export async function moderateContent(
  content: string,
  strictnessLevel: number
): Promise<{ flagged: boolean; categories: any; reason?: string }> {
  try {
    const response = await openai.moderations.create({
      input: content
    });
    
    const result = response.results[0];
    
    // Make moderation more or less strict based on strictnessLevel
    // Lower threshold means more content gets flagged (stricter)
    const threshold = 1 - (strictnessLevel / 100);
    
    // Check if any category exceeds our threshold
    const flagged = Object.values(result.category_scores).some(score => score > threshold);
    
    // Find reason if flagged
    let reason = undefined;
    if (flagged) {
      const highestCategory = Object.entries(result.category_scores)
        .sort((a, b) => b[1] - a[1])[0];
      
      reason = `Content potentially violates ${highestCategory[0].replace(/_/g, ' ')} policy`;
    }
    
    return {
      flagged: flagged,
      categories: result.categories as any,
      reason
    };
  } catch (error) {
    console.error("Error moderating content:", error);
    // Default to not flagging if there's an error
    return { flagged: false, categories: {} };
  }
}
