ModerateAI
A multi-platform AI-powered customer support and content moderation SaaS application that provides automated moderation, AI-driven customer support, and conversation management across Discord and Telegram platforms.

🚀 Features
AI-Powered Support
- Smart Response Generation: GPT-4o powered responses with customizable personality and style
- Knowledge Base Integration: Context-aware responses using vector-like search through stored documents
- Conversation Training: Learning system that improves AI responses based on admin interactions
- Proactive Response System: Automatic enhancement of responses using learned patterns

Multi-Platform Integration
- Discord Bot: Real-time message monitoring, per-server/channel configuration, mention-only mode
- Telegram Bot: Automated responses with per-group/chat configuration and admin learning
- Unified Dashboard: Centralized management across all platforms

Content Moderation
- Automated Filtering: AI-powered content analysis and moderation actions
- Customizable Policies: Configurable strictness levels and filtering rules
- Manual Review: Admin oversight and manual moderation capabilities
- Real-time Monitoring: Live conversation tracking and moderation alerts

Team Management
- User Authentication: Secure email-based authentication with whitelist validation
- Role-Based Access: Admin, moderator, and user role management
- Team Invitations: Secure invitation system for team collaboration
- Activity Tracking: Comprehensive analytics and user activity monitoring

🛠️ Technology Stack
Frontend
- React with TypeScript
- Vite for development and building
- Wouter for client-side routing
- TanStack Query for server state management
- Tailwind CSS + Radix UI for styling and components

Backend
- Express.js with TypeScript
- Passport.js for authentication
- PostgreSQL with Drizzle ORM
- OpenAI GPT-4o for AI capabilities
- Discord.js and Telegram Bot API for platform integrations

Infrastructure
- Neon Serverless PostgreSQL for data persistence
- Session-based authentication with database storage
- Rate limiting and CORS protection
- Production-ready security configurations

🏗️ Architecture
Data Flow
1. Platform Integration: Bots monitor Discord/Telegram for messages
2. AI Processing: Messages processed through knowledge base and training insights
3. Response Generation: GPT-4o generates contextual responses
4. Learning Loop: Admin interactions continuously improve AI responses

Security Features
- Database-backed session storage
- Secure cookie configuration (httpOnly, secure, sameSite)
- Rate limiting (1000 requests/15min, 20 login attempts/15min)
- CORS protection with restricted origins
- Input validation and sanitization
- Production error handling without information leakage

📋 Prerequisites
- Node.js 18+
- PostgreSQL database
- OpenAI API key
- Discord Bot Token (optional)
- Telegram Bot Token (optional)

🚀 Quick Start
1. Clone and Install
git clone https://github.com/IronSyd/ModerateAI.git
cd ModerateAI
npm install

2. Environment Setup
Create a .env file with the following variables:
# Database
DATABASE_URL=postgresql://username:password@host:port/database
# Security
SESSION_SECRET=your-secure-session-secret-here
# AI Integration
OPENAI_API_KEY=your-openai-api-key
OPENAI_REQUEST_TIMEOUT_MS=15000
# Performance
DASHBOARD_OVERVIEW_CACHE_TTL_MS=10000
UI_PERF_PROFILE=balanced
# Platform Integration (Optional)
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
# Email (Optional)
SENDGRID_API_KEY=your-sendgrid-api-key
# Production
NODE_ENV=production
FRONTEND_URL=https://your-app-domain.com
# Documentation (Optional but recommended for in-app Help links)
VITE_DOCS_BASE_URL=https://docs.moderate.ai

3. Database Setup
npm run db:push

4. Start the Application
# Development
npm run dev
# Production (recommended for real performance/load behavior)
npm run start:prod
# Or start only (when already built)
npm start
The application will be available at http://localhost:5000

For performance hardening:
- Apply hot-path indexes safely: `npm run db:indexes:perf`
- Run load smoke checks: `npm run perf:smoke`

Script Conventions
- TypeScript is the default for maintained source and utility scripts.
- JavaScript files in the repo root are mostly legacy/manual scripts and are not part of normal runtime/build.
- When a script becomes part of regular workflow, prefer a `.ts` version and wire it through `package.json` scripts.
- Utility script usage is documented in `scripts/README.md`.

Documentation
- GitBook is the canonical customer documentation surface.
- In-app Help routes (`/help`, `/help/article/*`) resolve to GitBook links when `VITE_DOCS_BASE_URL` is configured.
- Lean v1 GitBook source pages are available in `docs/gitbook`.
- Internal runbook/script notes are tracked in `docs/internal`.

🔧 Configuration
AI Configuration
- Response Style: Adjust AI personality (1-100 scale)
- Response Length: Control response verbosity
- System Prompt: Customize AI behavior and knowledge
- Training Mode: Enable/disable conversation learning

Platform Setup
1. Discord: Create bot, get token, invite to servers
2. Telegram: Create bot via BotFather, get token
3. Configuration: Set up per-channel/group settings through dashboard

Team Management
1. Admin Setup: First user becomes admin automatically
2. Whitelist Emails: Add team member emails to whitelist
3. Role Assignment: Assign admin/moderator roles
4. Invite System: Send secure invitation links to team members

📊 Usage
Dashboard Overview
- Real-time Statistics: Conversation counts, AI responses, moderation actions
- Recent Activity: Live feed of conversations and AI interactions
- Platform Status: Connection status for Discord/Telegram bots

AI Management
- Knowledge Base: Upload and manage documentation for context-aware responses
- Training Insights: View and manage learned patterns from admin conversations
- Configuration: Adjust AI parameters and behavior

Monitoring
- Conversation History: Full conversation logs with search and filtering
- Analytics: Usage patterns, response effectiveness, user engagement
- Moderation Logs: Track moderation actions and policy effectiveness

🔒 Security
ModerateAI implements enterprise-grade security:
- Authentication: Email-based with whitelist validation
- Session Management: Secure, database-backed sessions
- Rate Limiting: Protection against abuse and attacks
- Data Protection: No sensitive information in logs or client-side code
- CORS Policy: Restricted cross-origin access
- Input Validation: Comprehensive request validation and sanitization

🚀 Deployment
The application is production-ready and can be deployed to any Node.js hosting platform:
- Environment Variables: Ensure all required variables are set
- Database: Provision PostgreSQL database
- Build: npm run build (if needed for your platform)
- Start: npm start
- Health Check: Verify bots connect and dashboard loads

Docker (Optional)
- Build: docker build -t moderateai .
- Run: docker run --rm -p 5000:5000 --env-file .env moderateai
- Or with Compose (proxy + app + Postgres): docker compose up --build
- Compose runs an Nginx reverse proxy with gzip/brotli in front of the app on port `5000` and persists DB data in `postgres_data`.

Recommended Platforms
- Replit Deployments: Zero-config deployment with automatic scaling
- Vercel: Serverless deployment with edge functions
- Railway: Simple deployment with managed PostgreSQL
- Heroku: Traditional PaaS with add-on ecosystem

🤝 Contributing
1. Fork the repository
2. Create a feature branch (git checkout -b feature/amazing-feature)
3. Commit your changes (git commit -m 'Add amazing feature')
4. Push to the branch (git push origin feature/amazing-feature)
5. Open a Pull Request

📝 License
This project is licensed under the MIT License.

🆘 Support
For support, please create an issue in the GitHub repository or contact the development team.

ModerateAI - Intelligent moderation and support across all your platforms 🤖✨



