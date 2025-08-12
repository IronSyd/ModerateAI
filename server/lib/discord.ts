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
  return token === 'discord-token-partial' || token.startsWith('demo-') || token === 'demo-discord-token';
};

/**
 * Exchange Discord authorization code for access token and bot information
 */
export async function exchangeDiscordAuthCode(authCode: string): Promise<{ success: boolean; botToken?: string; error?: string }> {
  try {
    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    const redirectUri = process.env.DISCORD_REDIRECT_URI || 'http://localhost:5000/auth/discord/callback';
    
    if (!clientId || !clientSecret) {
      console.log('Discord OAuth credentials not configured');
      return { 
        success: false, 
        error: 'Discord OAuth credentials not configured. Please set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET environment variables.' 
      };
    }
    
    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code: authCode,
        redirect_uri: redirectUri,
        scope: 'bot applications.commands'
      })
    });
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Discord token exchange failed:', errorText);
      return { success: false, error: 'Failed to exchange authorization code' };
    }
    
    const tokenData = await tokenResponse.json();
    
    // Get bot information from the API using the access token
    const botInfoResponse = await fetch('https://discord.com/api/applications/@me', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    });
    
    if (!botInfoResponse.ok) {
      console.error('Failed to get bot information');
      return { success: false, error: 'Failed to get bot information' };
    }
    
    const botInfo = await botInfoResponse.json();
    
    // For Discord bots, we need the actual bot token which is separate from OAuth
    // The authorization code allows us to install the bot, but we still need the bot token
    // This should be provided separately or retrieved from your Discord application
    
    console.log('Discord OAuth successful, but bot token needed');
    console.log('Bot application info:', { id: botInfo.id, name: botInfo.name });
    
    return {
      success: false,
      error: 'OAuth successful, but bot token required. Please provide your Discord bot token directly.'
    };
  } catch (error) {
    console.error('Error exchanging Discord auth code:', error);
    return { success: false, error: 'Internal error during authorization' };
  }
}

// Check if token is from environment variables (real token)
const isEnvironmentToken = (token: string) => {
  // Get environment token 
  const envToken = process.env.DISCORD_BOT_TOKEN;

  // Add debug logging
  console.log('isEnvironmentToken check:');
  console.log('- Environment token exists:', !!envToken);
  console.log('- Token starts with:', token.substring(0, 5) + '...');
  
  if (envToken) {
    console.log('- Env token starts with:', envToken.substring(0, 5) + '...');
  }
  
  // For diagnostic purposes
  return false; // Always return false to ensure we use demo mode
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
    
    // Get the platform
    const platform = await storage.getPlatform(platformId);
    if (!platform) {
      return {
        success: false,
        message: `Platform ${platformId} not found.`
      };
    }
    
    // Check if this is a demo token, if so enable demo mode
    if (isDemoToken(token)) {
      console.log('Using demo mode for Discord bot');
      
      // Update platform with demo information
      await storage.updatePlatform(platformId, {
        status: "active",
        config: {
          ...(platform.config || {}),
          serverId: 'demo-server-123',
          serverName: 'Demo Discord Server',
          memberCount: 150,
          botName: 'ModerateAI Demo Bot',
          botUsername: 'moderateai_demo',
          channels: [
            { id: 'demo-channel-1', name: 'general', type: 'text' },
            { id: 'demo-channel-2', name: 'announcements', type: 'text' },
            { id: 'demo-channel-3', name: 'support', type: 'text' }
          ],
          lastRefreshed: new Date().toISOString()
        }
      });
      
      console.log(`Discord demo mode activated for platform ${platformId}`);
      return { 
        success: true, 
        message: "Discord bot connected successfully (demo mode)" 
      };
    }
    
    // Initialize Discord client with real token
    const client = new Client({ 
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
      ],
      partials: [Partials.Channel, Partials.Message]
    });

    // Connect to Discord
    await client.login(token);
    discordClients.set(platformId, client);

    // Set up event listeners
    client.on(Events.ClientReady, async () => {
      console.log(`Discord bot logged in as ${client.user?.tag}!`);
      
      // Get all servers/guilds the bot is in
      const guilds = client.guilds.cache.map(guild => ({
        id: guild.id,
        name: guild.name,
        memberCount: guild.memberCount
      }));
      
      // Calculate total stats
      const totalMembers = guilds.reduce((sum, guild) => sum + guild.memberCount, 0);
      const today = new Date().toDateString();
      
      // Get all channels from all servers with guild association
      let allChannels: any[] = [];
      const guildArray = Array.from(client.guilds.cache.values());
      for (const guild of guildArray) {
        const channelList = await fetchChannels(client, guild.id);
        // Add guild ID to each channel for proper association
        const channelsWithGuild = channelList.map(channel => ({
          ...channel,
          guildId: guild.id,
          guildName: guild.name
        }));
        allChannels = allChannels.concat(channelsWithGuild);
      }
      
      // Generate daily message count (placeholder - in real app this would come from analytics)
      const dailyMessages = Math.floor(Math.random() * 50) + 15;
      
      // Update platform with comprehensive information
      await storage.updatePlatform(platformId, {
        status: "active",
        config: {
          ...(platform.config || {}),
          // Bot information
          botName: client.user?.username || 'ModerateAI Bot',
          botUsername: client.user?.tag || 'Unknown Bot',
          botId: client.user?.id,
          
          // Server information
          servers: guilds,
          totalServers: guilds.length,
          totalMembers,
          
          // Display format for server name
          serverName: guilds.length === 1 ? guilds[0]?.name : `${guilds.length} servers`,
          serverId: guilds[0]?.id, // Keep for backwards compatibility
          memberCount: totalMembers,
          
          // All channels
          channels: allChannels,
          
          // Analytics
          dailyMessages,
          lastMessageDate: today,
          lastRefreshed: new Date().toISOString()
        }
      });
      
      console.log(`Updated Discord platform ${platformId}: Bot "${client.user?.username}" in ${guilds.length} servers (${totalMembers} total members)`);
      
      // Create server-level configurations for all Discord servers
      await createDiscordServerConfigurations(platformId, guilds, allChannels);
    });

    // Handle messages for moderation and chat responses
    client.on(Events.MessageCreate, async (message: Message) => {
      try {
        // Ignore bot messages
        if (message.author.bot) return;
        
        // Get updated platform info for settings
        const updatedPlatform = await storage.getPlatform(platformId);
        if (!updatedPlatform || !updatedPlatform.config) return;
        
        // Get server-level configuration (not channel-level)
        const guildId = message.guildId;
        if (!guildId) return; // Skip DM messages for now
        
        let chatConfig = await storage.getChatConfigurationByPlatformAndExternalId(platformId, guildId);
        
        if (!chatConfig) {
          // Auto-create server configuration if it doesn't exist
          const guildName = message.guild?.name || 'Unknown Server';
          console.log(`Creating new Discord server configuration for: ${guildName}`);
          
          chatConfig = await storage.createChatConfiguration({
            platformId,
            externalId: guildId,
            chatType: 'server',
            chatName: guildName,
            aiConfigurationId: null,
            knowledgeBaseId: null,
            settings: {
              respondToMentions: true,
              respondToCommands: true,
              privateResponses: false,
              contentFilteringEnabled: true,
              proactiveResponses: true,
              enabledChannels: { [message.channel.id]: true }, // Enable this channel
              totalChannels: 1
            },
            isActive: true
          });
        }
        
        // Check if this specific channel is enabled for bot responses
        const settings = chatConfig.settings as any || {};
        const enabledChannels = settings.enabledChannels || {};
        const isChannelEnabled = enabledChannels[message.channel.id] !== false;
        
        // Skip if server or channel is disabled
        if (!chatConfig.isActive || !isChannelEnabled) {
          return;
        }
        
        // Safely access channels from config
        const channels = (updatedPlatform.config as any)?.channels || [];
        
        // Find the channel in our config
        const channelConfig = channels.find(
          (c: any) => c.id === message.channel.id
        );
        
        // Check if this is a direct message
        const isDM = message.channel.type === ChannelType.DM;
        const isBotMentioned = message.mentions.has(client.user?.id || '');
        
        // Skip direct messages entirely - bot should not respond to private messages
        if (isDM) {
          return;
        }
        
        // Determine if bot should respond based on settings
        const mentionOnlyMode = settings.mentionOnlyMode !== false; // Default to true
        let shouldRespond = (mentionOnlyMode && isBotMentioned);
        
        // If not explicitly triggered, check if message is relevant to knowledge base for proactive response
        if (!shouldRespond) {
          const proactiveEnabled = settings.proactiveResponses !== false; // Default to enabled if not set
          
          if (proactiveEnabled) {
            console.log('Checking message relevance for proactive Discord response...');
            const platform = await storage.getPlatform(platformId);
            const userId = platform?.userId;
            
            if (userId) {
              const { checkMessageRelevance } = await import("../lib/openai");
              const relevanceCheck = await checkMessageRelevance(
                message.content,
                userId,
                chatConfig?.knowledgeBaseId || null // Use chat-specific knowledge base
              );
              
              console.log(`Discord relevance check result: ${relevanceCheck.isRelevant} (score: ${relevanceCheck.relevanceScore}, reason: ${relevanceCheck.reason})`);
              
              if (relevanceCheck.isRelevant) {
                shouldRespond = true;
                console.log('Proceeding with proactive Discord response - message is relevant to knowledge base');
              }
            }
          }
        }

        // Handle AI chat responses (for mentions or relevant messages)
        if (shouldRespond) {
          const channelName = 'name' in message.channel ? message.channel.name : 'unknown channel';
          console.log(`Bot interaction in channel ${channelName}`);
          
          try {
            // Get active AI configuration for this platform's user
            const platform = await storage.getPlatform(platformId);
            const userId = platform?.userId;
            
            if (!userId) {
              console.error(`No user ID associated with platform ${platformId}`);
              return;
            }
            
            // Get the active AI configuration and knowledge base
            const aiConfig = await storage.getActiveAiConfiguration(userId);
            const knowledgeBase = await storage.getActiveKnowledgeBase(userId);
            
            // Create or get conversation
            // Get channel name for logging
            // Look for existing conversation or create a new one
            let conversation = await storage.getConversationByExternalId(message.channel.id);
            if (!conversation) {
              conversation = await storage.createConversation({
                platformId,
                externalId: message.channel.id,
                externalUserId: message.author.id,
                externalUsername: message.author.username,
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
            
            // Generate AI response with knowledge base if available
            let aiResponse;
            if (knowledgeBase) {
              const { generateKnowledgeBasedResponse } = await import("../lib/openai");
              aiResponse = await generateKnowledgeBasedResponse(
                message.content,
                conversationHistory,
                systemPrompt,
                aiConfig?.responseStyle || 50,
                aiConfig?.responseLength || 50,
                userId
              );
            } else {
              const { generateAIResponse } = await import("../lib/openai");
              aiResponse = await generateAIResponse(
                message.content,
                conversationHistory,
                systemPrompt,
                aiConfig?.responseStyle || 50,
                aiConfig?.responseLength || 50
              );
            }
            
            // Save AI response
            await storage.createMessage({
              conversationId: conversation.id,
              content: aiResponse,
              sender: 'ai',
              metadata: null
            });
            
            // Send the response as a reply (Discord's reply method automatically quotes the original message)
            await message.reply(aiResponse);
            
            const responseChannelName = isDM ? 'DM' : ('name' in message.channel ? message.channel.name : 'unknown channel');
            console.log(`Sent AI response for Discord message in ${isDM ? 'DM' : 'channel ' + responseChannelName}`);
          } catch (error) {
            console.error('Error generating AI response for Discord:', error);
            await message.reply("I'm sorry, I encountered an error while processing your request.");
          }
        }
        
        // Check if we should moderate this channel
        if (channelConfig && channelConfig.moderationEnabled) {
          const moderationChannel = isDM ? 'DM' : ('name' in message.channel ? message.channel.name : 'unknown channel');
          console.log(`Moderating message in channel ${moderationChannel}`);
          
          // Moderate the content
          const moderationResult = await moderateContent(message.content);
          
          if (moderationResult.flagged) {
            // Create moderation entry (commenting out until schema is updated)
            // await storage.createModerationAction({
            //   platformId,
            //   action: "flag",
            //   reason: moderationResult.categories.join(", "),
            //   automatic: true,
            //   conversationId: null,
            //   messageId: null
            // });
            
            // Log flagged message instead of replying
            console.log(`Message flagged: ${message.content}`);
            
            console.log(`Flagged message in channel ${moderationChannel}`);
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
 * Create server-level chat configurations for Discord servers
 */
async function createDiscordServerConfigurations(platformId: number, guilds: any[], channels: any[]) {
  try {
    for (const guild of guilds) {
      // Get text channels for this guild
      const guildChannels = channels.filter(channel => 
        channel.guildId === guild.id && channel.type === 'text'
      );
      
      // Check if server configuration already exists
      const existingConfig = await storage.getChatConfigurationByPlatformAndExternalId(platformId, guild.id);
      
      if (!existingConfig) {
        console.log(`Creating Discord server configuration for: ${guild.name}`);
        
        // Create enabled channels object (all channels enabled by default)
        const enabledChannels: { [channelId: string]: boolean } = {};
        guildChannels.forEach(channel => {
          enabledChannels[channel.id] = true;
        });
        
        await storage.createChatConfiguration({
          platformId,
          externalId: guild.id, // Server ID only
          chatType: 'server',
          chatName: guild.name, // Server name only
          aiConfigurationId: null, // Will use default
          knowledgeBaseId: null, // Will use default
          settings: {
            respondToMentions: true,
            respondToCommands: true,
            privateResponses: false,
            contentFilteringEnabled: true,
            proactiveResponses: true,
            enabledChannels: enabledChannels, // Track which channels are enabled
            totalChannels: guildChannels.length
          },
          isActive: true
        });
      } else {
        // Update existing config with current channel list
        const currentSettings = existingConfig.settings as any || {};
        const enabledChannels = currentSettings.enabledChannels || {};
        
        // Add any new channels (enabled by default)
        guildChannels.forEach(channel => {
          if (!(channel.id in enabledChannels)) {
            enabledChannels[channel.id] = true;
          }
        });
        
        // Update the configuration
        await storage.updateChatConfiguration(existingConfig.id, {
          settings: {
            ...currentSettings,
            enabledChannels,
            totalChannels: guildChannels.length
          }
        });
      }
    }
  } catch (error) {
    console.error('Error creating Discord server configurations:', error);
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
      const config = platform.config as any;
      const existingChannels = config?.channels || [];
      
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
          ...config,
          serverId: config?.serverId || "123456789",
          serverName: config?.serverName || "ModerateAI Demo Server",
          memberCount: config?.memberCount || 127,
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
    else if (!(platform.config as any)?.serverId) {
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
      const config = platform.config as any;
      const channels = await fetchChannels(client, config.serverId);
      
      // Preserve moderation settings from existing channels
      const existingChannels = config.channels || [];
      const updatedChannels = channels.map(newChannel => {
        const existingChannel = existingChannels.find((c: any) => c.id === newChannel.id);
        return existingChannel 
          ? { ...newChannel, moderationEnabled: existingChannel.moderationEnabled } 
          : newChannel;
      });
      
      // Update platform
      await storage.updatePlatform(platformId, {
        config: {
          ...config,
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