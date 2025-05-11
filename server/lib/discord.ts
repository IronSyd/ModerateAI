import { 
  Client, 
  IntentsBitField, 
  TextChannel, 
  Message, 
  Events, 
  GatewayIntentBits,
  ChannelType,
  Partials
} from 'discord.js';
import { storage } from '../storage';
import { moderateContent } from './openai';

// Map of platform IDs to Discord clients
const discordClients = new Map<number, Client>();

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
      
      // Get the platform
      const platform = await storage.getPlatform(platformId);
      if (!platform) {
        console.error(`Platform ${platformId} not found.`);
        return;
      }
      
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
            ...platform.config,
            serverId: firstGuild.id,
            serverName: firstGuild.name,
            memberCount: firstGuild.memberCount,
            channels: channelList,
            lastRefreshed: new Date().toISOString()
          }
        });
        
        console.log(`Updated Discord platform ${platformId} with server info`);
      }
    });

    // Handle messages for moderation
    client.on(Events.MessageCreate, async (message: Message) => {
      try {
        // Ignore bot messages
        if (message.author.bot) return;
        
        // Get platform info for moderation settings
        const platform = await storage.getPlatform(platformId);
        if (!platform || !platform.config?.channels) return;
        
        // Find the channel in our config
        const channelConfig = platform.config.channels.find(
          (c: any) => c.id === message.channel.id
        );
        
        // Check if we should moderate this channel
        if (channelConfig && channelConfig.moderationEnabled) {
          console.log(`Moderating message in channel ${message.channel.name}`);
          
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
            
            console.log(`Flagged message in channel ${message.channel.name}`);
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
    if (!platform || !platform.config?.serverId) {
      return false;
    }
    
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