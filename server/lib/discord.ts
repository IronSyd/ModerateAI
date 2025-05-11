import { 
  Client, 
  IntentsBitField, 
  TextChannel, 
  Message, 
  Events, 
  GatewayIntentBits,
  ChannelType,
  Partials,
  Collection,
  DMChannel
} from 'discord.js';
import { storage } from '../storage';
import { moderateContent, generateAIResponse } from './openai';

// Map of platform IDs to Discord clients
const discordClients = new Map<number, Client>();

// Is this a demo token?
const isDemoToken = (token: string) => {
  // Skip the length check, as real tokens can be any length
  return token === 'discord-token-partial' || token.startsWith('demo-');
};

// Check if token is from environment variables (real token)
const isEnvironmentToken = (token: string) => {
  // Get environment token to compare
  const envToken = process.env.DISCORD_BOT_TOKEN;
  // Add debug logging
  console.log('isEnvironmentToken check:');
  console.log('- Environment token exists:', !!envToken);
  console.log('- Token starts with:', token.substring(0, 5) + '...');
  console.log('- Env token starts with:', envToken?.substring(0, 5) + '...');
  console.log('- Tokens match:', envToken === token);
  
  return envToken && token === envToken;
};

/**
 * Initialize Discord bot with token
 */
export async function initializeBot(platformId: number, token: string): Promise<{ success: boolean; message: string }> {
  try {
    // Check if there's already a bot for this platform
    if (discordClients.has(platformId)) {
      await disconnectBot(platformId);
    }

    console.log(`Initializing Discord bot for platform ${platformId}...`);
    console.log(`Token starts with: ${token.substring(0, 5)}...`);
    console.log(`Using environment token? ${isEnvironmentToken(token)}`);
    
    // Get the platform
    const platform = await storage.getPlatform(platformId);
    if (!platform) {
      return {
        success: false,
        message: `Platform ${platformId} not found.`
      };
    }
    
    // Always use real Discord connection when environment token is available
    if (isEnvironmentToken(token)) {
      console.log(`Using environment token for Discord platform ${platformId}`);
      // Continue with real Discord connection
    }
    // Use demo mode only for demo tokens that aren't environment tokens
    else if (isDemoToken(token)) {
      console.log(`Using demo mode for Discord platform ${platformId}`);
      
      // For demo mode, we'll create simulated channels and update the platform
      // without actually connecting to Discord
      const demoChannels = [
        { id: "12345", name: "general", type: "text", moderationEnabled: true, active: true },
        { id: "23456", name: "welcome", type: "text", moderationEnabled: true, active: true },
        { id: "34567", name: "announcements", type: "text", moderationEnabled: true, active: true },
        { id: "45678", name: "off-topic", type: "text", moderationEnabled: false, active: true },
        { id: "56789", name: "voice-chat", type: "voice", moderationEnabled: false, active: true }
      ];
      
      // Update platform with demo info
      await storage.updatePlatform(platformId, {
        status: "active",
        config: {
          ...(platform.config || {}),
          serverId: "123456789",
          serverName: "ModerateAI Demo Server",
          memberCount: 127,
          channels: demoChannels,
          lastRefreshed: new Date().toISOString(),
          dailyMessages: 134,
          moderationCount: 12
        }
      });
      
      console.log(`Updated Discord platform ${platformId} with demo info`);
      
      return { 
        success: true, 
        message: "Discord bot connected successfully (demo mode)" 
      };
    }
    
    // If not a demo, proceed with real Discord connection
    // Create a new Discord client
    const client = new Client({ 
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
      ],
      partials: [Partials.Channel, Partials.Message]
    });

    // Set up event listeners
    client.on(Events.ClientReady, async () => {
      console.log(`Discord bot logged in as ${client.user?.tag}!`);
      
      // Update platform info in database
      const serverCount = client.guilds.cache.size;
      const firstGuild = client.guilds.cache.first();
      
      if (firstGuild) {
        // Get channel list
        const channelList = await fetchChannels(client, firstGuild.id);
        
        // Update platform with guild/server info
        await storage.updatePlatform(platformId, {
          status: "active",
          config: {
            ...(platform.config || {}),
            serverId: firstGuild.id,
            serverName: firstGuild.name,
            memberCount: firstGuild.memberCount,
            channels: channelList,
            lastRefreshed: new Date().toISOString()
          }
        });
        
        console.log(`Updated Discord platform ${platformId} with server info`);
      } else {
        console.log(`Discord bot has no servers, please invite it to your server`);
        
        // Update just the basic bot info
        await storage.updatePlatform(platformId, {
          status: "active",
          config: {
            ...(platform.config || {}),
            botName: client.user?.username || "ModerateAI Bot",
            lastRefreshed: new Date().toISOString()
          }
        });
      }
    });

    // Handle messages for moderation and chat responses
    client.on(Events.MessageCreate, async (message: Message) => {
      try {
        // Ignore bot messages
        if (message.author.bot) return;
        
        // Get updated platform info for settings
        const updatedPlatform = await storage.getPlatform(platformId);
        if (!updatedPlatform || !updatedPlatform.config?.channels) return;
        
        // Find the channel in our config
        const channelConfig = updatedPlatform.config.channels.find(
          (c: any) => c.id === message.channel.id
        );
        
        // Get platform settings
        const respondToMentions = updatedPlatform.config?.respondToMentions !== false; // Default to true
        const respondToCommands = updatedPlatform.config?.respondToCommands !== false; // Default to true
        const privateResponses = updatedPlatform.config?.privateResponses === true; // Default to false
        
        // Check if the bot was mentioned or this is a direct message
        const isBotMentioned = message.mentions.has(client.user?.id || '');
        const isDM = message.channel.type === ChannelType.DM;
        const isCommand = message.content.startsWith('!') || message.content.startsWith('/');
        
        // Handle AI chat responses (for mentions, DMs, or commands)
        if ((respondToMentions && isBotMentioned) || isDM || (respondToCommands && isCommand)) {
          const channelName = isDM ? 'DM' : ('name' in message.channel ? message.channel.name : 'unknown channel');
          console.log(`Bot interaction in ${isDM ? 'DM' : 'channel ' + channelName}`);
          
          try {
            // Get active AI configuration for this platform's user
            const platform = await storage.getPlatform(platformId);
            const userId = platform?.userId;
            
            if (!userId) {
              console.error(`No user ID associated with platform ${platformId}`);
              return;
            }
            
            // Get the active AI configuration
            const aiConfig = await storage.getActiveAiConfiguration(userId);
            
            // Create or get conversation
            let conversation = await storage.getConversationByExternalId(message.channel.id);
            if (!conversation) {
              conversation = await storage.createConversation({
                platformId,
                externalId: message.channel.id,
                title: isDM ? `DM with ${message.author.username}` : `Channel: ${channelName}`,
                status: 'active'
              });
            }
            
            // Save user message
            await storage.createMessage({
              conversationId: conversation.id,
              content: message.content,
              sender: 'user',
              metadata: {
                username: message.author.username,
                userId: message.author.id
              }
            });
            
            // Get conversation history
            const messages = await storage.getMessagesByConversationId(conversation.id);
            
            // Convert to AI format (take last 10 for context)
            const conversationHistory = messages.slice(-10).map(msg => ({
              role: msg.sender === "user" ? "user" : "assistant",
              content: msg.content
            }));
            
            // Default system prompt if none is configured
            const systemPrompt = aiConfig?.systemPrompt || 'You are a helpful assistant for Discord. Provide concise and accurate responses.';
            
            // Generate AI response
            const aiResponse = await generateAIResponse(
              message.content,
              conversationHistory,
              systemPrompt,
              aiConfig?.responseStyle || 50,
              aiConfig?.responseLength || 50
            );
            
            // Save AI response
            await storage.createMessage({
              conversationId: conversation.id,
              content: aiResponse,
              sender: 'ai',
              metadata: null
            });
            
            // Send the response (either as a reply or DM based on settings)
            if (privateResponses && !isDM) {
              await message.author.send(aiResponse);
              await message.react('✅');
            } else {
              await message.reply(aiResponse);
            }
            
            const channelName = isDM ? 'DM' : ('name' in message.channel ? message.channel.name : 'unknown channel');
            console.log(`Sent AI response for Discord message in ${isDM ? 'DM' : 'channel ' + channelName}`);
          } catch (error) {
            console.error('Error generating AI response for Discord:', error);
            await message.reply("I'm sorry, I encountered an error while processing your request.");
          }
        }
        
        // Check if we should moderate this channel
        if (channelConfig && channelConfig.moderationEnabled) {
          const channelName = isDM ? 'DM' : ('name' in message.channel ? message.channel.name : 'unknown channel');
          console.log(`Moderating message in channel ${channelName}`);
          
          // Moderate the content
          const moderationResult = await moderateContent(message.content);
          
          if (moderationResult.flagged) {
            // Create moderation entry
            await storage.createModerationAction({
              platformId,
              action: "flag",
              reason: moderationResult.categories.join(", "),
              automatic: true,
              conversationId: null,
              messageId: null
            });
            
            // Optionally, respond to the message
            await message.reply("This message has been flagged by our moderation system.");
            
            console.log(`Flagged message in channel ${channelName}`);
          }
        }
      } catch (error) {
        console.error('Error processing Discord message:', error);
      }
    });

    // Log in to Discord
    await client.login(token);
    
    // Store the client
    discordClients.set(platformId, client);
    
    return { 
      success: true, 
      message: "Discord bot connected successfully" 
    };
  } catch (error: any) {
    console.error('Error initializing Discord bot:', error);
    
    // If token is invalid but it's the demo token, switch to demo mode
    if (error.code === 'TokenInvalid' && isDemoToken(token)) {
      console.log('Invalid token detected, falling back to demo mode');
      return initializeBot(platformId, 'demo-token');
    }
    
    return { 
      success: false, 
      message: error.message || "Failed to connect Discord bot" 
    };
  }
}

/**
 * Disconnect Discord bot
 */
export async function disconnectBot(platformId: number): Promise<boolean> {
  try {
    const client = discordClients.get(platformId);
    if (client) {
      // Destroy the client
      await client.destroy();
      discordClients.delete(platformId);
      console.log(`Discord bot for platform ${platformId} disconnected`);
      
      // Update platform status
      await storage.updatePlatform(platformId, {
        status: "not_connected"
      });
      
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error disconnecting Discord bot:', error);
    return false;
  }
}

/**
 * Fetch channels for a Discord guild/server
 */
export async function fetchChannels(client: Client, guildId: string): Promise<any[]> {
  try {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      throw new Error(`Guild ${guildId} not found`);
    }
    
    const channels = guild.channels.cache.filter(
      channel => channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildVoice
    );
    
    return channels.map(channel => ({
      id: channel.id,
      name: channel.name,
      type: channel.type === ChannelType.GuildText ? 'text' : 'voice',
      moderationEnabled: channel.type === ChannelType.GuildText, // Default moderation for text channels
      active: true
    }));
  } catch (error) {
    console.error('Error fetching Discord channels:', error);
    return [];
  }
}

/**
 * Refresh channels for a Discord platform
 */
export async function refreshChannels(platformId: number): Promise<boolean> {
  try {
    const platform = await storage.getPlatform(platformId);
    if (!platform) {
      return false;
    }
    
    // Check if we're in demo mode (no real client connection)
    // or if this is a real Discord connection
    const isDemoMode = !discordClients.has(platformId) || 
                      (platform.authToken && isDemoToken(platform.authToken));
    
    if (isDemoMode) {
      console.log(`Refreshing channels in demo mode for Discord platform ${platformId}`);
      
      // For demo mode, we update the demo channels with random counts
      const existingChannels = platform.config?.channels || [];
      
      // If no channels exist yet, create demo ones
      let updatedChannels;
      if (existingChannels.length === 0) {
        updatedChannels = [
          { id: "12345", name: "general", type: "text", moderationEnabled: true, active: true },
          { id: "23456", name: "welcome", type: "text", moderationEnabled: true, active: true },
          { id: "34567", name: "announcements", type: "text", moderationEnabled: true, active: true },
          { id: "45678", name: "off-topic", type: "text", moderationEnabled: false, active: true },
          { id: "56789", name: "voice-chat", type: "voice", moderationEnabled: false, active: true }
        ];
      } else {
        // Keep existing channels but update stats
        updatedChannels = existingChannels;
      }
      
      // Update platform with refreshed demo info
      await storage.updatePlatform(platformId, {
        status: "active",
        config: {
          ...platform.config,
          serverId: platform.config?.serverId || "123456789",
          serverName: platform.config?.serverName || "ModerateAI Demo Server",
          memberCount: platform.config?.memberCount || 127,
          channels: updatedChannels,
          lastRefreshed: new Date().toISOString(),
          // Update random stats
          dailyMessages: Math.floor(Math.random() * 50) + 120,
          moderationCount: Math.floor(Math.random() * 10) + 5,
          userCount: Math.floor(Math.random() * 30) + 100
        }
      });
      
      return true;
    } 
    else if (!platform.config?.serverId) {
      // No server ID for real connection
      return false;
    }
    else {
      // Real Discord connection
      const client = discordClients.get(platformId);
      if (!client) {
        return false;
      }
      
      // Fetch updated channels
      const channels = await fetchChannels(client, platform.config.serverId);
      
      // Preserve moderation settings from existing channels
      const existingChannels = platform.config.channels || [];
      const updatedChannels = channels.map(newChannel => {
        const existingChannel = existingChannels.find((c: any) => c.id === newChannel.id);
        return existingChannel 
          ? { ...newChannel, moderationEnabled: existingChannel.moderationEnabled } 
          : newChannel;
      });
      
      // Update platform
      await storage.updatePlatform(platformId, {
        config: {
          ...platform.config,
          channels: updatedChannels,
          lastRefreshed: new Date().toISOString()
        }
      });
      
      return true;
    }
  } catch (error) {
    console.error('Error refreshing Discord channels:', error);
    return false;
  }
}

/**
 * Initialize all Discord bots from database
 */
export async function initializeAllBots(): Promise<void> {
  try {
    // Get all platforms with type 'discord' and status 'active'
    const discordPlatforms = await storage.getPlatformsByType('discord');
    const activePlatforms = discordPlatforms.filter(p => p.status === 'active' && p.authToken);
    
    console.log(`Initializing ${activePlatforms.length} Discord bots...`);
    
    // Initialize each active bot
    for (const platform of activePlatforms) {
      if (platform.authToken) {
        const result = await initializeBot(platform.id, platform.authToken);
        console.log(`Discord bot for platform ${platform.id}: ${result.message}`);
      }
    }
  } catch (error) {
    console.error('Error initializing Discord bots:', error);
  }
}