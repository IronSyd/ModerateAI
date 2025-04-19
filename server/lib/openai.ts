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
    // Search for relevant knowledge documents
    const relevantDocs = await storage.searchKnowledgeDocuments(userMessage);
    
    // Build context information from knowledge documents
    let knowledgeContext = "";
    if (relevantDocs.length > 0) {
      knowledgeContext = "Please use the following information from our knowledge base to answer the user's question:\n\n";
      
      // Use up to 3 most relevant documents to keep context manageable
      for (let i = 0; i < Math.min(3, relevantDocs.length); i++) {
        const doc = relevantDocs[i];
        knowledgeContext += `--- Document: ${doc.title} ---\n${doc.content}\n\n`;
      }
    }
    
    // Build system prompt based on configuration
    let fullSystemPrompt = systemPrompt || "You are a helpful customer support assistant.";
    
    // Add knowledge context if available
    if (knowledgeContext) {
      fullSystemPrompt += "\n\n" + knowledgeContext;
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
    
    // Instructions for using knowledge
    if (knowledgeContext) {
      fullSystemPrompt += " If the knowledge base information doesn't fully answer the question, use your general knowledge but prioritize the knowledge base information.";
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
): Promise<{ flagged: boolean; categories: Record<string, boolean>; reason?: string }> {
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
      categories: result.categories,
      reason
    };
  } catch (error) {
    console.error("Error moderating content:", error);
    // Default to not flagging if there's an error
    return { flagged: false, categories: {} };
  }
}
