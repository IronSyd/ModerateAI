import { Router } from "express";
import { generateAIResponse } from "../lib/openai";

const openaiDemoRouter = Router();

openaiDemoRouter.post("/openai-demo", async (req, res) => {
  try {
    const { message, history } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }
    
    // Get conversation history from the request or default to empty array
    const conversationHistory = Array.isArray(history) ? history : [];
    console.log("OpenAI demo endpoint received history:", JSON.stringify(conversationHistory));
    
    // Create a detailed system prompt
    const systemPrompt = 
      "You are an AI assistant for ModerateAI, a SaaS platform that provides customer support " + 
      "and community moderation across multiple platforms (Website, Telegram, Discord). " + 
      "Answer user questions in a helpful, friendly, and concise manner. " +
      "Focus on information about ModerateAI's features, pricing, and integrations. " +
      "ModerateAI offers three pricing plans: Basic ($29/month), Pro ($79/month), and Enterprise (custom pricing). " +
      "Basic includes 1 platform, Pro includes 3 platforms, and Enterprise includes unlimited platforms. " +
      "ModerateAI integrates with websites via chat widget, Telegram via bot, and Discord via bot. " +
      "Key features include AI-powered responses, content moderation, customizable AI configurations, and analytics. " +
      "Keep responses under 150 words and maintain conversation context.";
    
    // Call OpenAI API with conversation history
    const aiResponse = await generateAIResponse(
      message,
      conversationHistory, // Use conversation history from request
      systemPrompt,
      75, // Friendly tone
      50  // Moderate length
    );
    
    return res.json({ content: aiResponse });
  } catch (error: any) {
    console.error("Error in OpenAI demo endpoint:", error);
    return res.status(500).json({ 
      error: "Failed to generate AI response",
      message: error.message 
    });
  }
});

export default openaiDemoRouter;