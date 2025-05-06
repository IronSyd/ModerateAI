import TelegramBot from 'node-telegram-bot-api';
import { storage } from '../storage';
import { generateAIResponse } from './openai';

// Global map to store all active bot instances
const activeBots = new Map<number, TelegramBot>();

/**
 * Initialize a Telegram bot with the given token 
 */
export async function initializeBot(platformId: number, token: string): Promise<{ success: boolean; message: string }> {
  try {
    // Validate token by creating a bot instance and getting bot info
    const bot = new TelegramBot(token, { polling: false });
    
    // Try to get bot info to verify the token is valid
    const botInfo = await bot.getMe();
    
    if (!botInfo || !botInfo.id) {
      return { 
        success: false, 
        message: 'Invalid bot token. Please check your token and try again.' 
      };
    }
    
    // Properly configure the bot for long polling
    const activatedBot = new TelegramBot(token, { 
      polling: true,
      filepath: false // Don't save downloaded files
    });
    
    // Register message handler
    activatedBot.on('message', async (msg) => {
      try {
        console.log(`Telegram message received from ${msg.from?.username || 'unknown user'}: ${msg.text}`);
        
        // Find or create conversation
        const externalUserId = msg.from?.id.toString() || 'unknown';
        const externalUsername = msg.from?.username || msg.from?.first_name || 'unknown';
        
        // Get existing or create new conversation
        let conversation = (await storage.getConversationsByPlatformId(platformId))
          .find(c => c.externalUserId === externalUserId);
        
        if (!conversation) {
          conversation = await storage.createConversation({
            platformId,
            externalUserId,
            externalUsername,
            status: 'active'
          });
          
          // Send welcome message if this is a new conversation
          const platform = await storage.getPlatform(platformId);
          if (platform?.config?.welcomeMessage) {
            activatedBot.sendMessage(msg.chat.id, platform.config.welcomeMessage);
            
            // Save the welcome message
            await storage.createMessage({
              conversationId: conversation.id,
              content: platform.config.welcomeMessage,
              sender: 'ai',
              metadata: null
            });
          }
        }
        
        // Skip empty messages
        if (!msg.text) return;
        
        // Store user message
        await storage.createMessage({
          conversationId: conversation.id,
          content: msg.text,
          sender: 'user',
          metadata: {
            timestamp: msg.date,
            chatId: msg.chat.id,
            messageId: msg.message_id
          }
        });
        
        // Show typing indicator
        activatedBot.sendChatAction(msg.chat.id, 'typing');
        
        try {
          // Get AI response - wrap in try/catch to handle any DB issues
          const activeConfig = await storage.getActiveAiConfiguration(1); // Using demo user ID for now
          const knowledgeBase = await storage.getActiveKnowledgeBase(1); // Using demo user ID for now
          
          // Get conversation history
          const messages = await storage.getMessagesByConversationId(conversation.id);
          
          // Convert the messages to the format expected by the AI
          const conversationHistory = messages.slice(-10).map(msg => ({
            role: msg.sender === "user" ? "user" : "assistant",
            content: msg.content
          }));
          
          // Default system prompt if none is configured
          const systemPrompt = activeConfig?.systemPrompt || 'You are a helpful assistant.';
          
          // Generate AI response with proper parameters
          const aiResponse = await generateAIResponse(
            msg.text,
            conversationHistory,
            systemPrompt,
            activeConfig?.responseStyle || 50,
            activeConfig?.responseLength || 50
          );
          
          // Send response
          await activatedBot.sendMessage(msg.chat.id, aiResponse);
          
          // Store AI response in database
          await storage.createMessage({
            conversationId: conversation.id,
            content: aiResponse,
            sender: 'ai',
            metadata: null
          });
        } catch (error) {
          console.error(`Error generating AI response: ${error}`);
          // Send a fallback response if AI generation failed
          await activatedBot.sendMessage(msg.chat.id, 
            "I'm sorry, I'm having trouble processing your message right now. Please try again later.");
          return;
        }
        
      } catch (error) {
        console.error('Error handling Telegram message:', error);
        activatedBot.sendMessage(msg.chat.id, 'Sorry, I encountered an error processing your message. Please try again later.');
      }
    });
    
    // Handle commands
    activatedBot.onText(/\/help/, (msg) => {
      activatedBot.sendMessage(msg.chat.id, 
        'I am an AI assistant powered by ModerateAI. I can help answer questions and provide information.\n\n' +
        'Available commands:\n' +
        '/help - Show this help message\n' +
        '/about - Information about this bot'
      );
    });
    
    activatedBot.onText(/\/about/, (msg) => {
      activatedBot.sendMessage(msg.chat.id, 
        'I am an AI assistant powered by ModerateAI - an AI-powered customer support and community moderation platform.\n\n' +
        'I can answer questions, provide information, and help moderate conversations.'
      );
    });
    
    // Store the bot instance
    activeBots.set(platformId, activatedBot);
    
    return { 
      success: true, 
      message: `Bot @${botInfo.username} connected successfully!` 
    };
  } catch (error: any) {
    console.error('Error initializing Telegram bot:', error);
    return { 
      success: false, 
      message: `Failed to initialize bot: ${error.message}` 
    };
  }
}

/**
 * Stop and remove a Telegram bot
 */
export function disconnectBot(platformId: number): { success: boolean; message: string } {
  try {
    // Get the bot instance
    const bot = activeBots.get(platformId);
    
    if (!bot) {
      return { 
        success: false, 
        message: 'Bot not found or already disconnected.' 
      };
    }
    
    // Stop polling and remove all listeners
    bot.stopPolling();
    bot.removeAllListeners();
    
    // Remove from active bots
    activeBots.delete(platformId);
    
    return { 
      success: true, 
      message: 'Bot disconnected successfully.' 
    };
  } catch (error: any) {
    console.error('Error disconnecting Telegram bot:', error);
    return { 
      success: false, 
      message: `Failed to disconnect bot: ${error.message}` 
    };
  }
}

/**
 * Get all active bots
 */
export function getActiveBots(): Map<number, TelegramBot> {
  return activeBots;
}

/**
 * Initialize all active bots from database
 */
export async function initializeAllBots(): Promise<void> {
  try {
    // Get all platforms with type 'telegram' and status 'active'
    const telegramPlatforms = await storage.getPlatformsByType('telegram');
    const activePlatforms = telegramPlatforms.filter(p => p.status === 'active' && p.authToken);
    
    console.log(`Initializing ${activePlatforms.length} Telegram bots...`);
    
    // Initialize each active bot
    for (const platform of activePlatforms) {
      if (platform.authToken) {
        const result = await initializeBot(platform.id, platform.authToken);
        console.log(`Bot for platform ${platform.id}: ${result.message}`);
      }
    }
  } catch (error) {
    console.error('Error initializing Telegram bots:', error);
  }
}