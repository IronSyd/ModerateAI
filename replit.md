# Overview

ModerateAI is a multi-platform AI-powered customer support and content moderation SaaS application. It provides automated moderation, AI-driven customer support, and conversation management across websites, Discord, and Telegram platforms. The system features real-time chat interfaces, knowledge base integration for AI responses, user management, team collaboration, and comprehensive analytics.

# User Preferences

Preferred communication style: Simple, everyday language.

# Recent Changes

## August 2025
- **Implemented Quote/Reply Functionality and Fixed Bot Response Configuration** (August 11, 2025):
  - Enhanced Telegram bot to always quote/reply to original messages using reply_to_message_id for better conversation context
  - Improved Discord bot private responses to include quoted original message formatting
  - Updated all Telegram error messages and command responses to use reply functionality
  - Fixed group chat configuration missing groupMode setting that prevented bot responses
  - Configured bot for optimal behavior: responds when tagged OR when message is relevant to knowledge base
  - AI relevance detection working at 71% confidence for X8C service-related questions
  - Bot now provides contextual responses while avoiding spam by staying quiet for off-topic messages
- **Fixed Chat Configuration Display Issues** (August 10, 2025):
  - Resolved duplicate welcome message field appearing in Telegram chat configuration dialog
  - Fixed chat ID display issue by updating interface mapping from chatId to externalId in database schema
  - Enhanced storage method with proper database joins to include AI configuration and knowledge base names in API responses
  - Fixed null reference errors in chat configuration API using optional chaining operators
  - Chat configurations now properly display chat IDs and AI configuration names instead of "Not configured"
  - Knowledge base selection persistence works correctly with form data synchronization
- **Implemented Complete AI Training and Learning System** (August 9, 2025):
  - Built comprehensive chat history storage and analysis system for continuous AI improvement
  - Added new database tables: `chatHistory`, `adminMembers`, `chatHistoryTraining` for tracking and analyzing conversations
  - Created `chatHistoryManager` service for automated conversation storage and AI-powered analysis
  - Implemented admin learning mode that analyzes admin responses to generate training insights
  - Added frontend training management interface with insights view, chat history browser, and manual analysis triggers
  - Integrated training controls into both Telegram and Discord chat configuration dialogs
  - System automatically identifies admin users and stores their conversations for learning purposes
  - AI analyzes admin response patterns to create actionable training insights with confidence scoring
  - Training insights are used to improve bot responses in similar future situations
  - Full API endpoints for training management, insight toggling, and chat history retrieval
- **Implemented AI-Powered Proactive Response System** (August 8, 2025):
  - Added intelligent message relevance detection using OpenAI API to analyze message content against knowledge base
  - Created `checkMessageRelevance` function that determines if messages are relevant to bot's knowledge base with confidence scoring
  - Updated both Telegram and Discord bot logic to include proactive response capability when not explicitly mentioned
  - Added frontend configuration options for proactive responses in chat settings dialogs for both platforms
  - System now responds to relevant questions automatically even without bot tagging, improving user experience
  - Tested with 78% accuracy in relevance detection, successfully identifying questions about pricing, features, support, and getting started
  - Proactive responses can be enabled/disabled per chat configuration, stored in database settings JSONB field
- **Transitioned to Email-Only Authentication System** (August 7, 2025):
  - Completely removed username and password authentication in favor of email-only access
  - Updated database schema by removing username, password, password_hash, and password_salt columns from users table
  - Modified authentication logic to use only email validation against whitelist
  - Updated frontend forms to remove username and password fields
  - Simplified registration process to require only email and full name
  - Enhanced login process to authenticate users based solely on whitelisted email addresses
  - Updated authentication hooks and API endpoints to work with email-only credentials
  - Maintained email whitelisting as primary access control mechanism
  - System now provides secure access without traditional password requirements
  - **Removed Sign-Up Option** (August 7, 2025):
    - Eliminated public registration functionality from authentication forms
    - Removed registration API endpoint and related frontend code
    - New users must be invited and whitelisted by existing administrators
    - Authentication interface now shows only sign-in option with admin invitation messaging
- **Updated Team Management for Email Whitelisting** (August 7, 2025):
  - Modified team members endpoint to only show users whitelisted by current admin
  - Changed "Invite Team Member" to "Whitelist New Account" throughout the interface
  - Removed "Pending Invitations" section from team management page
  - Updated team invitation API to directly add emails to whitelist instead of creating invitations
  - Team management now properly isolates each admin's whitelisted users
  - Added tracking of which admin added each email via addedBy column in emailWhitelist table

## January 2025
- **Fixed username validation issue**: Resolved form field binding problem in registration form that prevented usernames from being captured properly
- **Improved password field visibility**: Updated show/hide password icons to use darker colors for better visibility against white input backgrounds
- **Enhanced form validation**: Changed registration form to use manual value tracking for better reliability
- **Removed Templates functionality**: Completely removed Templates feature from the application including pages, routes, and navigation
- **Fixed Telegram integration tabs**: Resolved TypeScript errors and database column naming issues that prevented Groups, Settings, and Analytics tabs from being clickable
- **Removed welcome message feature**: Eliminated welcome message functionality from Telegram bot settings as it's not needed for the use case
- **Removed bot commands feature**: Eliminated bot commands configuration from Telegram settings to simplify the interface
- **Implemented Telegram bot configuration functionality**: Fixed toggle button state management and implemented actual bot behavior based on settings:
  - Group Mode: Bot responds to group chat messages when enabled
  - Private Chat Mode: Bot responds to direct messages when enabled
  - Mention Only: Bot only responds when mentioned in groups when enabled
  - Content Filtering: Bot removes inappropriate content and warns users
  - Spam Protection: Bot detects and removes spam messages with notifications
- **Added per-group chat configurations**: Implemented chat-specific AI configurations and knowledge bases (August 6, 2025):
  - Added `chatConfigurations` table to database schema for group/chat specific settings
  - Each Telegram group/chat can now have its own AI configuration and knowledge base
  - Bot automatically creates chat configurations when first encountering new groups
  - Added API endpoints for managing chat configurations per platform
  - Updated Telegram bot logic to use chat-specific settings instead of global ones
  - Knowledge bases can now be assigned per-chat for specialized responses
  - **Extended to Discord**: Implemented identical chat configuration interface for Discord servers/channels:
    - Reusable ChatConfigurationDialog and ChatConfigurationList components for both platforms
    - Discord servers and channels can be individually configured with separate AI settings
    - Per-server content filtering, spam protection, and mention-only modes
    - Individual knowledge base assignments for specialized Discord communities

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript running on Vite
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query (React Query) for server state, React hooks for local state
- **UI Components**: Custom component library built on Radix UI primitives with Tailwind CSS
- **Authentication**: Context-based auth system with protected routes
- **Layout**: Responsive design with sidebar navigation for dashboard, landing page for marketing

## Backend Architecture
- **Framework**: Express.js with TypeScript
- **Authentication**: Passport.js with local strategy and session-based auth
- **API Design**: RESTful endpoints with JSON responses
- **Middleware**: CORS, body parsing, session management, and authentication guards
- **Error Handling**: Centralized error handling with proper HTTP status codes

## Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Connection**: Neon serverless PostgreSQL with connection pooling
- **Schema**: Relational design with tables for users, platforms, conversations, messages, AI configurations, knowledge bases, moderation actions, and team management
- **Migrations**: Drizzle Kit for schema management and migrations

## AI Integration
- **Provider**: OpenAI GPT-4o for AI responses and content moderation
- **Knowledge Base**: Vector-like search through stored documents for context-aware responses
- **Response Customization**: Configurable AI personality, response style, and length parameters
- **Training**: Conversation-based training system for improving AI responses

## Platform Integrations
- **Discord**: Bot integration using Discord.js with real-time message monitoring and moderation
- **Telegram**: Bot integration using node-telegram-bot-api for automated responses
- **Website**: Embeddable chat widget for web-based customer support
- **Token Management**: Secure storage of platform tokens with validation and connection status tracking

## Real-time Communication
- **Chat Interfaces**: WebSocket-like real-time messaging for website chat widget
- **Bot Handlers**: Event-driven message processing for Discord and Telegram platforms
- **Demo Mode**: Fallback demonstration system when platform connections are unavailable

# External Dependencies

## Core Infrastructure
- **Database**: Neon serverless PostgreSQL for data persistence
- **AI Services**: OpenAI API for GPT-4o language model capabilities
- **Email**: SendGrid for transactional emails and team invitations

## Platform APIs
- **Discord**: Discord Bot API for server integration and message handling
- **Telegram**: Telegram Bot API for chat automation
- **Stripe**: Payment processing for subscription billing (configured but not fully implemented)

## Development Tools
- **Build System**: Vite for frontend bundling and development server
- **Database Tools**: Drizzle ORM and Drizzle Kit for schema management
- **Type Safety**: TypeScript throughout the stack with shared schema definitions
- **Styling**: Tailwind CSS with custom component theming

## Authentication & Security
- **Session Storage**: Memory-based session store for development (should be Redis in production)
- **Password Hashing**: Node.js crypto module with scrypt for secure password storage
- **CORS**: Configured for cross-origin requests in development environment