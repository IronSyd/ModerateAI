import OpenAI from "openai";
import { storage } from "../storage";
import type { ChatHistory } from "@shared/schema";
import { recordOpsEvent } from "./ops-monitor";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
let openaiClient: OpenAI | null = null;

const OPENAI_REQUEST_TIMEOUT_MS = parsePositiveInt(process.env.OPENAI_REQUEST_TIMEOUT_MS, 15_000);
const OPENAI_MAX_CONCURRENCY = parsePositiveInt(process.env.OPENAI_MAX_CONCURRENCY, 8);
const OPENAI_MAX_QUEUE = parsePositiveInt(process.env.OPENAI_MAX_QUEUE, 120);
const OPENAI_QUEUE_TIMEOUT_MS = parsePositiveInt(process.env.OPENAI_QUEUE_TIMEOUT_MS, 5_000);

let openAiInFlight = 0;
const openAiQueue: Array<{
  resolve: () => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout> | null;
}> = [];

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function createOpenAiError(message: string, code: string): Error & { code: string } {
  const error = new Error(message) as Error & { code: string };
  error.name = code;
  error.code = code;
  return error;
}

function getOpenAiClient(): OpenAI {
  if (openaiClient) return openaiClient;

  const apiKey = String(process.env.OPENAI_API_KEY ?? "").trim();
  if (!apiKey) {
    throw createOpenAiError(
      "OPENAI_API_KEY is required to run AI generation and moderation requests.",
      "OPENAI_MISSING_API_KEY",
    );
  }

  openaiClient = new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true,
  });

  return openaiClient;
}

async function acquireOpenAiSlot(): Promise<void> {
  if (openAiInFlight < OPENAI_MAX_CONCURRENCY) {
    openAiInFlight += 1;
    return;
  }

  if (openAiQueue.length >= OPENAI_MAX_QUEUE) {
    throw createOpenAiError("AI service is overloaded", "OPENAI_OVERLOADED");
  }

  await new Promise<void>((resolve, reject) => {
    const entry = {
      resolve: () => {
        if (entry.timer) clearTimeout(entry.timer);
        resolve();
      },
      reject: (error: Error) => {
        if (entry.timer) clearTimeout(entry.timer);
        reject(error);
      },
      timer: null as ReturnType<typeof setTimeout> | null,
    };

    entry.timer = setTimeout(() => {
      const index = openAiQueue.indexOf(entry);
      if (index >= 0) {
        openAiQueue.splice(index, 1);
      }
      entry.reject(createOpenAiError("AI queue timeout", "OPENAI_QUEUE_TIMEOUT"));
    }, OPENAI_QUEUE_TIMEOUT_MS);

    openAiQueue.push(entry);
  });

  openAiInFlight += 1;
}

function releaseOpenAiSlot(): void {
  openAiInFlight = Math.max(0, openAiInFlight - 1);

  const next = openAiQueue.shift();
  if (!next) return;

  if (next.timer) clearTimeout(next.timer);
  next.resolve();
}

async function withOpenAiTimeout<T>(request: Promise<T>, scope: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => {
      reject(createOpenAiError(`AI request timed out in ${scope}`, "OPENAI_TIMEOUT"));
    }, OPENAI_REQUEST_TIMEOUT_MS);
  });

  try {
    return await Promise.race([request, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function runOpenAiRequest<T>(scope: string, requestFactory: () => Promise<T>): Promise<T> {
  await acquireOpenAiSlot();
  const startedAt = Date.now();

  try {
    return await withOpenAiTimeout(requestFactory(), scope);
  } catch (error) {
    const err = error as any;
    recordOpsEvent(
      "OPENAI_REQUEST_FAILED",
      {
        scope,
        message: String(err?.message ?? "Unknown OpenAI error"),
        code: String(err?.code ?? err?.name ?? "UNKNOWN"),
        status: Number(err?.status ?? 0) || null,
        elapsedMs: Date.now() - startedAt,
        inFlight: openAiInFlight,
        queueDepth: openAiQueue.length,
      },
      { bucketKey: `OPENAI_REQUEST_FAILED:${scope}` },
    );
    throw error;
  } finally {
    releaseOpenAiSlot();
  }
}

function isOpenAiTransientCapacityError(error: unknown): boolean {
  const candidate = error as any;
  const code = String(candidate?.code ?? candidate?.name ?? "").toUpperCase();
  const status = Number(candidate?.status ?? candidate?.cause?.status ?? 0);

  if (status === 429 || status === 503 || status === 504) return true;
  return code === "OPENAI_TIMEOUT" || code === "OPENAI_OVERLOADED" || code === "OPENAI_QUEUE_TIMEOUT";
}

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
    console.log(`[generateAIResponse] System prompt: "${systemPrompt.substring(0, 50)}..."`);
    console.log(`[generateAIResponse] Conversation history length: ${conversationHistory.length}`);
    
    // Convert conversation history to OpenAI format
    const formattedHistory = conversationHistory.map(msg => ({
      role: msg.role === "ai" ? "assistant" : "user",
      content: msg.content
    }));
    
    // Apply response style to system prompt
    const styledPrompt = applyResponseStyle(systemPrompt || 'You are a helpful AI assistant.', responseStyle);
    
    // Create the messages array
    const messages = [
      { role: "system", content: styledPrompt },
      ...formattedHistory,
      { role: "user", content: message }
    ];
    
    console.log(`[generateAIResponse] Using model: gpt-4o, with ${messages.length} messages`);
    
    // Get response from OpenAI
    const response = await runOpenAiRequest("generate_ai_response", () =>
      getOpenAiClient().chat.completions.create({
        model: "gpt-4o",
        messages: messages as any,
        max_tokens: calculateMaxTokens(responseLength),
        temperature: calculateTemperature(responseStyle)
      }),
    );
    
    console.log(`[generateAIResponse] Response received successfully`);
    
    return response.choices[0].message.content || "I apologize, but I couldn't generate a response at this time.";
  } catch (error) {
    console.error("Error generating AI response:", error);
    if (error instanceof Error) {
      console.error(`Error details: ${error.message}`);
      if ('cause' in error) {
        console.error(`Error cause:`, error.cause);
      }
    }
    if (isOpenAiTransientCapacityError(error)) {
      return "We are handling high traffic right now. Please try again shortly.";
    }
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
  userId?: number,
  knowledgeBaseId?: number | null,
): Promise<string> {
  try {
    // First, retrieve relevant documents from knowledge base using semantic search
    // This could be implemented with embeddings, but for simplicity we'll use keywords
    const keywords = extractKeywords(message);
    
    // If a specific knowledge base is provided, use it directly without fallback.
    // Otherwise, retain legacy behavior (active/first KB for the user).
    let knowledgeBase: any | undefined;
    if (knowledgeBaseId !== undefined && knowledgeBaseId !== null) {
      const requestedKnowledgeBase = await storage.getKnowledgeBase(knowledgeBaseId);
      if (requestedKnowledgeBase && (!userId || requestedKnowledgeBase.userId === userId)) {
        knowledgeBase = requestedKnowledgeBase;
      }
    } else {
      const knowledgeBases: any[] = [];
      if (userId) {
        const userKnowledgeBases = await storage.getKnowledgeBasesByUserId(userId);
        knowledgeBases.push(...userKnowledgeBases);
      } else {
        // For demo purposes without user context, try to get any active knowledge base
        const allUsers = await storage.getAllUsers();
        for (const user of allUsers) {
          const userKbs = await storage.getKnowledgeBasesByUserId(user.id);
          knowledgeBases.push(...userKbs);
        }
      }
      knowledgeBase = knowledgeBases.find((kb) => kb.isActive) || knowledgeBases[0];
    }
    
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
      enhancedPrompt += "\n\nRELEVANT KNOWLEDGE BASE INFORMATION:";
      relevantDocuments.forEach((doc, index) => {
        enhancedPrompt += `\n\nDocument ${index + 1} - ${doc.title}:\n${doc.content.substring(0, 500)}`;
      });
      enhancedPrompt += "\n\nACCURACY REQUIREMENTS:\n- Prioritize knowledge base information as the primary source of truth\n- Use admin conversation insights as supplementary factual information when knowledge base is incomplete\n- Clearly indicate whether information comes from knowledge base or admin experience\n- When knowledge base and admin insights conflict, present both perspectives\n- Admin insights can fill gaps not yet documented in the knowledge base";
    }
    
    // Create the messages array
    const messages = [
      { role: "system", content: enhancedPrompt },
      ...formattedHistory,
      { role: "user", content: message }
    ];
    
    // Get response from OpenAI
    const response = await runOpenAiRequest("generate_knowledge_response", () =>
      getOpenAiClient().chat.completions.create({
        model: "gpt-4o",
        messages: messages as any,
        max_tokens: calculateMaxTokens(responseLength),
        temperature: calculateTemperature(responseStyle)
      }),
    );
    
    return response.choices[0].message.content || "I apologize, but I couldn't generate a response at this time.";
  } catch (error) {
    console.error("Error generating knowledge-based response:", error);
    if (isOpenAiTransientCapacityError(error)) {
      return "We're currently experiencing high demand. Please try your request again in a moment.";
    }
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
    const moderationResponse = await runOpenAiRequest("moderate_content", () =>
      getOpenAiClient().moderations.create({
        input: content
      }),
    );
    
    const result = moderationResponse.results[0];
    const categories = result.categories as unknown as Record<string, boolean>;
    const scores = result.category_scores as unknown as Record<string, number>;
    
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

/**
 * Format a conversation into a prompt for analysis
 */
export function formatConversationPrompt(
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
export async function processConversationForTraining(conversationData: {
  messages: Array<{ sender: string; content: string }>;
  platformType: string;
}) {
  try {
    const { messages, platformType } = conversationData;
    
    // Format the conversation into a prompt
    const prompt = formatConversationPrompt(messages, platformType);
    
    // Send to OpenAI for analysis
    const response = await runOpenAiRequest("process_conversation_training", () =>
      getOpenAiClient().chat.completions.create({
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
      }),
    );

    // Parse and return the analysis
    const analysisText = response.choices[0].message.content || "{}";
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
      error: error instanceof Error ? error.message : String(error)
    };
  }
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
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  return {
    processedCount,
    results
  };
}

/**
 * Analyze admin conversations to extract training insights
 */
export async function analyzeAdminConversations(
  adminHistory: ChatHistory[],
  conversationThreads: ChatHistory[][]
): Promise<{
  patterns: Array<{
    type: string;
    description: string;
    context: any;
    confidence: number;
  }>;
}> {
  try {
    // Create analysis prompt
    const adminMessages = adminHistory.map(msg => 
      `[${msg.sentAt}] ${msg.externalUsername || 'Admin'}: ${msg.content}`
    ).join('\n');

    const threadSummaries = conversationThreads.slice(0, 10).map((thread, idx) => {
      const threadMessages = thread.map(msg => 
        `${msg.isAdmin ? 'Admin' : 'User'}: ${msg.content}`
      ).join('\n');
      return `Thread ${idx + 1}:\n${threadMessages}`;
    }).join('\n\n');

    const prompt = `Analyze the following admin chat history and conversation threads to identify patterns that can improve AI responses:

ADMIN MESSAGE HISTORY:
${adminMessages}

CONVERSATION THREADS:
${threadSummaries}

Please identify:
1. Common response patterns admins use for specific types of questions
2. Tone and communication style preferences
3. Frequent topics and how admins handle them
4. Effective problem-solving approaches
5. Key phrases or terminology that resonate well

Return a JSON object with this structure:
{
  "patterns": [
    {
      "type": "response_pattern" | "tone_preference" | "topic_handling" | "terminology",
      "description": "Clear description of the pattern",
      "context": {"triggers": ["when this happens"], "examples": ["example responses"]},
      "confidence": 0-100
    }
  ]
}`;

    const response = await runOpenAiRequest("analyze_admin_conversations", () =>
      getOpenAiClient().chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert conversation analyst. Analyze admin chat patterns to extract insights for training AI assistants. Focus on actionable patterns that can improve AI responses."
          },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      }),
    );

    const analysisText = response.choices[0].message.content || '{"patterns": []}';
    const analysis = JSON.parse(analysisText);

    return analysis;
  } catch (error) {
    console.error("Error analyzing admin conversations:", error);
    return { patterns: [] };
  }
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
    const response = await runOpenAiRequest("generate_improved_system_prompt", () =>
      getOpenAiClient().chat.completions.create({
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
      }),
    );
    
    return {
      success: true,
      improvedPrompt: response.choices[0].message.content?.trim() || currentPrompt
    };
  } catch (error) {
    console.error("Error generating improved system prompt:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Check if a message is relevant to the knowledge base and should trigger a bot response
 */
export async function checkMessageRelevance(
  message: string,
  userId: number,
  knowledgeBaseId?: number | null
): Promise<{ isRelevant: boolean; relevanceScore: number; reason?: string }> {
  try {
    // Get knowledge bases for the user
    let knowledgeBase;
    if (knowledgeBaseId) {
      knowledgeBase = await storage.getKnowledgeBase(knowledgeBaseId);
    } else {
      const knowledgeBases = await storage.getKnowledgeBasesByUserId(userId);
      knowledgeBase = knowledgeBases.find((kb: any) => kb.isActive) || knowledgeBases[0];
    }

    if (!knowledgeBase) {
      return { isRelevant: false, relevanceScore: 0, reason: "No knowledge base available" };
    }

    // Get documents from the knowledge base
    const documents = await storage.getKnowledgeDocumentsByKnowledgeBaseId(knowledgeBase.id);
    
    if (documents.length === 0) {
      return { isRelevant: false, relevanceScore: 0, reason: "Knowledge base is empty" };
    }

    // Extract keywords from the message
    const keywords = extractKeywords(message);
    
    if (keywords.length === 0) {
      return { isRelevant: false, relevanceScore: 0, reason: "No meaningful keywords found" };
    }

    // Calculate relevance score based on keyword matches in documents
    let totalScore = 0;
    let maxDocumentScore = 0;
    let bestMatchDocument = "";

    for (const doc of documents) {
      const titleMatches = keywords.filter(kw => 
        doc.title.toLowerCase().includes(kw.toLowerCase())
      ).length;
      const contentMatches = keywords.filter(kw => 
        doc.content.toLowerCase().includes(kw.toLowerCase())
      ).length;
      
      // Weight title matches more heavily
      const documentScore = (titleMatches * 3) + contentMatches;
      totalScore += documentScore;
      
      if (documentScore > maxDocumentScore) {
        maxDocumentScore = documentScore;
        bestMatchDocument = doc.title;
      }
    }

    // Normalize score by number of keywords and documents
    const averageScore = totalScore / (keywords.length * documents.length);
    const relevanceScore = Math.min(1, averageScore);

    // Use AI to make a more sophisticated relevance determination
    const aiRelevanceCheck = await runOpenAiRequest("check_message_relevance", () =>
      getOpenAiClient().chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a relevance checker for a knowledge base chatbot. Your job is to determine if a user message is asking about topics that might be covered in the knowledge base.

The knowledge base contains these documents:
${documents.map(doc => `- ${doc.title}: ${doc.content.substring(0, 200)}...`).join('\n')}

Respond with a JSON object: {"relevant": boolean, "confidence": number (0-1), "reason": "brief explanation"}`
          },
          {
            role: "user",
            content: `Is this message relevant to the knowledge base? Message: "${message}"`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 150
      }),
    );

    const aiResult = JSON.parse(aiRelevanceCheck.choices[0].message.content || '{"relevant": false, "confidence": 0}');
    
    // Combine keyword-based score with AI assessment
    const finalScore = (relevanceScore * 0.4) + (aiResult.confidence * 0.6);
    const isRelevant = finalScore > 0.3 || (aiResult.relevant && aiResult.confidence > 0.5);

    return {
      isRelevant,
      relevanceScore: finalScore,
      reason: isRelevant ? 
        `Relevant to knowledge base (${Math.round(finalScore * 100)}% confidence). ${aiResult.reason || ''}` :
        `Not relevant enough (${Math.round(finalScore * 100)}% confidence). ${aiResult.reason || ''}`
    };
  } catch (error) {
    console.error("Error checking message relevance:", error);
    // Default to not relevant on error to avoid unwanted responses
    return { isRelevant: false, relevanceScore: 0, reason: "Error during relevance check" };
  }
}

export type LeadIntentType = "commercial" | "escalation" | "other";
export type LeadIntentScope = "commercial" | "commercial_and_escalation";

export type EvaluateLeadPromptEligibilityInput = {
  latestUserMessage: string;
  assistantReply: string;
  recentHistory?: Array<{ role: string; content: string }>;
  intentScope?: LeadIntentScope;
};

export type EvaluateLeadPromptEligibilityResult = {
  intentType: LeadIntentType;
  intentConfidence: number;
  answered: boolean;
  answeredConfidence: number;
  uncertain: boolean;
  acknowledgementSignal: boolean;
  reason: string;
};

function clamp01(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(1, value));
}

function hasAcknowledgementSignal(text: string): boolean {
  const normalized = text.toLowerCase();
  return /(thanks|thank you|got it|that helps|helpful|perfect|resolved|understood|appreciate)/.test(normalized);
}

function inferLeadIntentFromKeywords(message: string): { intentType: LeadIntentType; confidence: number; reason: string } {
  const normalized = message.toLowerCase();
  const commercial = [
    "pricing",
    "price",
    "cost",
    "quote",
    "trial",
    "demo",
    "buy",
    "purchase",
    "upgrade",
    "subscription",
    "plan",
    "invoice",
    "payment",
    "contact sales",
    "book a call",
  ];
  const escalation = [
    "human",
    "agent",
    "support team",
    "escalate",
    "urgent",
    "not resolved",
    "speak to someone",
    "callback",
    "call me",
    "issue persists",
  ];

  const commercialHits = commercial.filter((keyword) => normalized.includes(keyword)).length;
  const escalationHits = escalation.filter((keyword) => normalized.includes(keyword)).length;

  if (commercialHits > 0 && commercialHits >= escalationHits) {
    return {
      intentType: "commercial",
      confidence: clamp01(0.5 + commercialHits * 0.08, 0.5),
      reason: "keyword_inference_commercial",
    };
  }
  if (escalationHits > 0) {
    return {
      intentType: "escalation",
      confidence: clamp01(0.5 + escalationHits * 0.08, 0.5),
      reason: "keyword_inference_escalation",
    };
  }

  return {
    intentType: "other",
    confidence: 0.2,
    reason: "keyword_inference_other",
  };
}

function normalizeLeadIntentType(value: unknown, fallback: LeadIntentType): LeadIntentType {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "commercial") return "commercial";
  if (normalized === "escalation") return "escalation";
  return fallback;
}

export async function evaluateLeadPromptEligibility(
  input: EvaluateLeadPromptEligibilityInput,
): Promise<EvaluateLeadPromptEligibilityResult> {
  const acknowledgementSignal = hasAcknowledgementSignal(input.latestUserMessage);
  const keywordFallback = inferLeadIntentFromKeywords(`${input.latestUserMessage}\n${input.assistantReply}`);
  const historyPreview = (input.recentHistory ?? [])
    .slice(-6)
    .map((entry) => `${entry.role}: ${String(entry.content ?? "").slice(0, 220)}`)
    .join("\n");
  const scope = input.intentScope ?? "commercial_and_escalation";

  try {
    const response = await runOpenAiRequest("lead_prompt_eligibility", () =>
      getOpenAiClient().chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        max_tokens: 220,
        messages: [
          {
            role: "system",
            content:
              "Classify website chat lead eligibility. Return JSON only with keys: intentType (commercial|escalation|other), intentConfidence (0..1), answered (boolean), answeredConfidence (0..1), uncertain (boolean), reason (string). " +
              "Mark answered=true only if the assistant's latest reply materially addresses the user's inquiry or confirms clear next-step handoff. " +
              "Be conservative about certainty when context is weak.",
          },
          {
            role: "user",
            content:
              `Intent scope: ${scope}\n` +
              `Latest user message:\n${input.latestUserMessage}\n\n` +
              `Latest assistant reply:\n${input.assistantReply}\n\n` +
              `Recent history:\n${historyPreview || "(none)"}`,
          },
        ],
      }),
    );

    const parsed = JSON.parse(response.choices[0].message.content || "{}");
    const intentType = normalizeLeadIntentType(parsed.intentType, keywordFallback.intentType);
    const intentConfidence = clamp01(Number(parsed.intentConfidence), keywordFallback.confidence);
    let answered = Boolean(parsed.answered);
    let answeredConfidence = clamp01(Number(parsed.answeredConfidence), answered ? 0.65 : 0.35);

    if (acknowledgementSignal) {
      answered = true;
      answeredConfidence = Math.max(answeredConfidence, 0.92);
    }

    const uncertainByModel = typeof parsed.uncertain === "boolean" ? parsed.uncertain : false;
    const uncertain = uncertainByModel || intentConfidence < 0.45 || answeredConfidence < 0.45;

    return {
      intentType,
      intentConfidence,
      answered,
      answeredConfidence,
      uncertain,
      acknowledgementSignal,
      reason: String(parsed.reason ?? "model_evaluation"),
    };
  } catch (error) {
    console.error("Error evaluating lead prompt eligibility:", error);
    return {
      intentType: keywordFallback.intentType,
      intentConfidence: keywordFallback.confidence,
      answered: acknowledgementSignal,
      answeredConfidence: acknowledgementSignal ? 0.92 : 0.35,
      uncertain: true,
      acknowledgementSignal,
      reason: `${keywordFallback.reason}:model_error`,
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

