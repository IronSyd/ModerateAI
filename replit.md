# Overview
ModerateAI is a multi-platform AI-powered customer support and content moderation SaaS application. It provides automated moderation, AI-driven customer support, and conversation management across websites, Discord, and Telegram platforms. The system features real-time chat interfaces, knowledge base integration for AI responses, user management, team collaboration, and comprehensive analytics.

# User Preferences
Preferred communication style: Simple, everyday language.

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
- **Authentication**: Passport.js with email-only validation and session-based auth
- **API Design**: RESTful endpoints with JSON responses
- **Middleware**: CORS, body parsing, session management, and authentication guards
- **Error Handling**: Centralized error handling with proper HTTP status codes

## Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Connection**: Neon serverless PostgreSQL with connection pooling
- **Schema**: Relational design with tables for users, platforms, conversations, messages, AI configurations, knowledge bases, moderation actions, chat history, and team management.
- **Migrations**: Drizzle Kit for schema management and migrations

## AI Integration
- **Provider**: OpenAI GPT-4o for AI responses and content moderation
- **Knowledge Base**: Vector-like search through stored documents for context-aware responses
- **Response Customization**: Configurable AI personality, response style, and length parameters
- **Training**: Conversation-based training system for improving AI responses, including admin learning mode and proactive response system.

## Platform Integrations
- **Discord**: Bot integration using Discord.js with real-time message monitoring, moderation, and per-server/channel configuration.
- **Telegram**: Bot integration using node-telegram-bot-api for automated responses and per-group/chat configuration.
- **Website**: Embeddable chat widget for web-based customer support.
- **Token Management**: Secure storage of platform tokens with validation and connection status tracking.

## Real-time Communication
- **Chat Interfaces**: WebSocket-like real-time messaging for website chat widget.
- **Bot Handlers**: Event-driven message processing for Discord and Telegram platforms.
- **Demo Mode**: Fallback demonstration system when platform connections are unavailable.

# External Dependencies

## Core Infrastructure
- **Database**: Neon serverless PostgreSQL for data persistence.
- **AI Services**: OpenAI API for GPT-4o language model capabilities.
- **Email**: SendGrid for transactional emails and team invitations.

## Platform APIs
- **Discord**: Discord Bot API for server integration and message handling.
- **Telegram**: Telegram Bot API for chat automation.
- **Stripe**: Payment processing for subscription billing.