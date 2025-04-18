import OpenAI from "openai";

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
    console.log("Starting OpenAI request with API key:", process.env.OPENAI_API_KEY ? "API key is set" : "API key is NOT set");
    
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
    
    // Add instruction to address specific questions about the platform
    fullSystemPrompt += " When asked about the platform, provide specific information about ModerateAI features, capabilities, and pricing.";
    
    // Validate conversation history format for OpenAI API
    const formattedHistory = conversationHistory.map(msg => {
      // Make sure role is either 'user' or 'assistant'
      const role = msg.role === 'user' ? 'user' : 'assistant';
      return { role, content: msg.content };
    });
    
    console.log("Using conversation history:", JSON.stringify(formattedHistory));
    
    // Create complete message history
    const messages = [
      { role: "system", content: fullSystemPrompt },
      ...formattedHistory,
      { role: "user", content: userMessage }
    ];
    
    console.log("System prompt:", fullSystemPrompt);
    console.log("Sending message to OpenAI:", userMessage);
    console.log("Total messages in conversation:", messages.length);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages as any, // Type assertion needed for strict TypeScript
      max_tokens: 500
    });
    
    console.log("OpenAI response received:", response.choices[0].message.content);
    
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
      categories: result.categories as unknown as Record<string, boolean>,
      reason
    };
  } catch (error) {
    console.error("Error moderating content:", error);
    // Default to not flagging if there's an error
    return { flagged: false, categories: {} };
  }
}
