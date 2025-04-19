import { Router } from "express";
import { generateKnowledgeBasedResponse } from "../lib/openai";
import { storage } from "../storage";

// Debug flag - set to true to enable more verbose logging
const DEBUG = true;

const openaiDemoRouter = Router();

openaiDemoRouter.post("/openai-demo", async (req, res) => {
  try {
    const { message } = req.body;
    
    if (DEBUG) {
      console.log(`[openai-demo] Received query: "${message}"`);
    }
    
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }
    
    // Test knowledge search directly for debugging
    if (DEBUG) {
      try {
        console.log(`[openai-demo] Testing knowledge search directly`);
        const relevantDocs = await storage.searchKnowledgeDocuments(message);
        console.log(`[openai-demo] Direct search found ${relevantDocs.length} relevant documents`);
        
        if (relevantDocs.length > 0) {
          relevantDocs.forEach((doc, i) => {
            if (i < 2) { // Just log the top 2 to avoid cluttering logs
              console.log(`[openai-demo] Doc ${i+1}: "${doc.title}" (ID: ${doc.id})`);
            }
          });
        }
      } catch (err) {
        console.error(`[openai-demo] Error testing knowledge search:`, err);
      }
    }
    
    // Create a system prompt
    const systemPrompt = 
      "You are the AI assistant for ModerateAI, a SaaS platform that provides customer support " + 
      "and community moderation across multiple platforms including Websites, Telegram, and Discord. " + 
      "Answer user questions in a helpful, friendly, and concise manner. " +
      "You have access to a knowledge base containing accurate information about ModerateAI's features, pricing, and platform integrations. " + 
      "When the user asks about any aspect of ModerateAI, strictly use ONLY the knowledge base information provided to you. " +
      "If the knowledge base doesn't contain information to answer a specific question, acknowledge this limitation " +
      "rather than making up information. Keep responses under 150 words.";
    
    if (DEBUG) {
      console.log(`[openai-demo] Calling generateKnowledgeBasedResponse for query: "${message}"`);
      
      // Test knowledge search directly for comparison
      try {
        const docs = await storage.searchKnowledgeDocuments(message);
        console.log(`[openai-demo] DIRECT SEARCH: Found ${docs.length} matching documents directly through storage.searchKnowledgeDocuments`);
        if (docs.length > 0) {
          console.log(`[openai-demo] DIRECT SEARCH: First doc: "${docs[0].title}" (first 50 chars: ${docs[0].content.substring(0, 50)}...)`);
        }
      } catch (err) {
        console.error(`[openai-demo] Error in direct search test:`, err);
      }
    }
    
    // Call OpenAI API with knowledge-based response generation
    const aiResponse = await generateKnowledgeBasedResponse(
      message,
      [], // No conversation history
      systemPrompt,
      75, // Friendly tone
      50  // Moderate length
    );
    
    if (DEBUG) {
      console.log(`[openai-demo] Generated response: "${aiResponse.substring(0, 50)}..."`);
    }
    
    return res.json({ content: aiResponse });
  } catch (error: any) {
    console.error("Error in OpenAI demo endpoint:", error);
    
    // Handle rate limiting errors specifically
    if (error.status === 429) {
      return res.status(429).json({
        error: "OpenAI API rate limit exceeded",
        message: "Our AI assistant is experiencing high demand. Please try again in a moment."
      });
    }
    
    // Return a user-friendly error message
    return res.status(500).json({ 
      error: "Failed to generate AI response",
      message: "I'm having trouble connecting to my knowledge base right now. Please try again in a moment."
    });
  }
});

export default openaiDemoRouter;