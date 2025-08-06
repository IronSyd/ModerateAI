import TelegramBot from 'node-telegram-bot-api';
import { storage } from '../storage';
import { generateAIResponse } from './openai';

// Helper functions for content moderation
async function checkForInappropriateContent(text: string): Promise<boolean> {
  // Simple content filtering - in production this would use AI or external services
  const inappropriateWords = ['spam', 'scam', 'hack', 'virus'];
  const lowercaseText = text.toLowerCase();
  return inappropriateWords.some(word => lowercaseText.includes(word));
}

async function checkForSpam(text: string): Promise<boolean> {
  // Simple spam detection - repeated characters, excessive caps, etc.
  const hasExcessiveCaps = text.length > 5 && (text.match(/[A-Z]/g) || []).length / text.length > 0.7;
  const hasRepeatedChars = /(.)\1{4,}/.test(text);
  const isAllCaps = text.length > 10 && text === text.toUpperCase();
  
  return hasExcessiveCaps || hasRepeatedChars || isAllCaps;
}

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
    activatedBot.on('message', async (msg: any) => {
      try {
        console.log(`Telegram message received from ${msg.from?.username || 'unknown user'}: ${msg.text}`);
        
        // Get or create chat-specific configuration
        const chatId = msg.chat.id.toString();
        const chatType = msg.chat.type === 'group' || msg.chat.type === 'supergroup' ? 'group' : msg.chat.type;
        const chatName = msg.chat.title || msg.chat.first_name || `${chatType} ${chatId}`;
        
        let chatConfig = await storage.getChatConfigurationByPlatformAndExternalId(platformId, chatId);
        
        // Create default chat configuration if it doesn't exist
        if (!chatConfig) {
          console.log(`Creating new chat configuration for ${chatType}: ${chatName}`);
          chatConfig = await storage.createChatConfiguration({
            platformId,
            externalId: chatId,
            chatType,
            chatName,
            aiConfigurationId: null, // Will use default
            knowledgeBaseId: null, // Will use default
            settings: {
              groupMode: true,
              privateChatMode: true,
              mentionOnly: chatType === 'group',
              contentFilteringEnabled: true,
              spamProtectionEnabled: true,
              welcomeMessage: null
            },
            isActive: true
          });
        }
        
        const config = chatConfig.settings as any || {};
        
        // Check if bot should respond based on configuration
        const isGroupChat = msg.chat.type === 'group' || msg.chat.type === 'supergroup';
        const isPrivateChat = msg.chat.type === 'private';
        const botUsername = (await activatedBot.getMe()).username;
        const isBotMentioned = msg.text && botUsername && msg.text.toLowerCase().includes(`@${botUsername.toLowerCase()}`);
        
        // Apply response logic based on settings
        if (isGroupChat && !config.groupMode) {
          console.log('Skipping group message - Group Mode is disabled');
          return;
        }
        
        if (isPrivateChat && config.privateChatMode === false) {
          console.log('Skipping private message - Private Chat Mode is disabled');
          return;
        }
        
        if (isGroupChat && config.mentionOnly && !isBotMentioned) {
          console.log('Skipping group message - Mention Only mode enabled but bot not mentioned');
          return;
        }
        
        // Find or create conversation first before any processing
        const externalUserId = msg.from?.id.toString() || 'unknown';
        const externalUsername = msg.from?.username || msg.from?.first_name || 'unknown';
        
        // Get existing or create new conversation for this chat
        let conversation = (await storage.getConversationsByPlatformId(platformId))
          .find(c => c.externalUserId === externalUserId && c.externalId === chatId);
        
        if (!conversation) {
          conversation = await storage.createConversation({
            platformId,
            externalUserId,
            externalUsername,
            externalId: chatId,
            status: 'active'
          });
          
          // Send welcome message if configured
          if (config.welcomeMessage) {
            activatedBot.sendMessage(msg.chat.id, config.welcomeMessage);
            
            await storage.createMessage({
              conversationId: conversation.id,
              content: config.welcomeMessage,
              sender: 'ai',
              metadata: null
            });
          }
        }
        
        // Content filtering and spam protection checks
        if (msg.text && config.contentFilteringEnabled) {
          const hasInappropriateContent = await checkForInappropriateContent(msg.text);
          if (hasInappropriateContent) {
            console.log('Message blocked by content filter');
            
            // Store moderation action for analytics
            await storage.createMessage({
              conversationId: conversation.id,
              content: msg.text,
              sender: 'user',
              metadata: {
                timestamp: msg.date,
                chatId: msg.chat.id,
                messageId: msg.message_id,
                blocked: 'content',
                action: 'content_filtered'
              }
            });
            
            if (isGroupChat) {
              await activatedBot.deleteMessage(msg.chat.id, msg.message_id);
              await activatedBot.sendMessage(msg.chat.id, 
                '⚠️ Message removed due to inappropriate content.', 
                { reply_to_message_id: msg.message_id }
              );
            }
            return;
          }
        }
        
        if (msg.text && config.spamProtectionEnabled) {
          const isSpam = await checkForSpam(msg.text);
          if (isSpam) {
            console.log('Message blocked by spam protection');
            
            // Store moderation action for analytics
            await storage.createMessage({
              conversationId: conversation.id,
              content: msg.text,
              sender: 'user',
              metadata: {
                timestamp: msg.date,
                chatId: msg.chat.id,
                messageId: msg.message_id,
                blocked: 'spam',
                action: 'spam_blocked'
              }
            });
            
            if (isGroupChat) {
              await activatedBot.deleteMessage(msg.chat.id, msg.message_id);
              await activatedBot.sendMessage(msg.chat.id, 
                '🚫 Message removed as spam.', 
                { reply_to_message_id: msg.message_id }
              );
            }
            return;
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
          // Get chat-specific or default AI configuration
          let activeConfig;
          if (chatConfig.aiConfigurationId) {
            activeConfig = await storage.getAiConfiguration(chatConfig.aiConfigurationId);
          } else {
            // Fallback to platform owner's default AI configuration
            const platform = await storage.getPlatform(platformId);
            activeConfig = await storage.getActiveAiConfiguration(platform?.userId || 1);
          }
          
          // Get chat-specific or default knowledge base
          let knowledgeBase;
          if (chatConfig.knowledgeBaseId) {
            knowledgeBase = await storage.getKnowledgeBase(chatConfig.knowledgeBaseId);
          } else {
            // Fallback to platform owner's default knowledge base
            const platform = await storage.getPlatform(platformId);
            knowledgeBase = await storage.getActiveKnowledgeBase(platform?.userId || 1);
          }
          
          // Get conversation history
          const messages = await storage.getMessagesByConversationId(conversation.id);
          
          // Convert the messages to the format expected by the AI
          const conversationHistory = messages.slice(-10).map(msg => ({
            role: msg.sender === "user" ? "user" : "assistant",
            content: msg.content
          }));
          
          // Default system prompt if none is configured
          const systemPrompt = activeConfig?.systemPrompt || 'You are a helpful assistant.';
          
          // Generate AI response with proper parameters - use knowledge-based response if knowledge base is available
          let aiResponse;
          if (knowledgeBase) {
            const { generateKnowledgeBasedResponse } = await import("../lib/openai");
            aiResponse = await generateKnowledgeBasedResponse(
              msg.text,
              conversationHistory,
              systemPrompt,
              activeConfig?.responseStyle || 50,
              activeConfig?.responseLength || 50
            );
          } else {
            const { generateAIResponse } = await import("../lib/openai");
            aiResponse = await generateAIResponse(
              msg.text,
              conversationHistory,
              systemPrompt,
              activeConfig?.responseStyle || 50,
              activeConfig?.responseLength || 50
            );
          }
          
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
          console.error(`Error generating AI response:`, error);
          
          // Create a more detailed error message for debugging
          let errorMessage = "I'm sorry, I'm having trouble processing your message right now.";
          
          if (process.env.NODE_ENV === 'development') {
            // Only show detailed errors in development
            errorMessage += " Error: " + (error instanceof Error ? error.message : String(error));
          }
          
          // Send a fallback response with more details in development
          await activatedBot.sendMessage(msg.chat.id, errorMessage);
          return;
        }
        
      } catch (error) {
        console.error('Error handling Telegram message:', error);
        activatedBot.sendMessage(msg.chat.id, 'Sorry, I encountered an error processing your message. Please try again later.');
      }
    });
    
    // Handle commands
    activatedBot.onText(/\/help/, (msg: any) => {
      activatedBot.sendMessage(msg.chat.id, 
        'I am an AI assistant powered by ModerateAI. I can help answer questions and provide information.\n\n' +
        'Available commands:\n' +
        '/help - Show this help message\n' +
        '/about - Information about this bot'
      );
    });
    
    activatedBot.onText(/\/about/, (msg: any) => {
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