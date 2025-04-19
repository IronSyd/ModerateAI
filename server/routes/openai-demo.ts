import { Router } from "express";
import { generateKnowledgeBasedResponse } from "../lib/openai";
import { storage } from "../storage";

const openaiDemoRouter = Router();

openaiDemoRouter.post("/openai-demo", async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }
    
    // Create a system prompt
    const systemPrompt = 
      "You are an AI assistant for ModerateAI, a SaaS platform that provides customer support " + 
      "and community moderation across multiple platforms (Website, Telegram, Discord). " + 
      "Answer user questions in a helpful, friendly, and concise manner. " +
      "Focus on information about ModerateAI's features, pricing, and integrations. " +
      "Keep responses under 150 words.";
    
    // Call OpenAI API with knowledge-based response generation
    const aiResponse = await generateKnowledgeBasedResponse(
      message,
      [], // No conversation history
      systemPrompt,
      75, // Friendly tone
      50  // Moderate length
    );
    
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