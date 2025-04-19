import { db } from './server/db';
import { knowledgeDocuments } from './shared/schema';

async function addKnowledgeDocuments() {
  console.log('Adding knowledge documents...');
  
  // Pricing document
  await db.insert(knowledgeDocuments).values({
    knowledgeBaseId: 1, // Using the default knowledge base from the demo data
    title: 'ModerateAI Pricing Plans',
    content: `
      ModerateAI offers the following pricing plans:
      
      1. Free Plan: For small communities and personal projects
         - Up to 1,000 messages moderated per month
         - Basic content moderation features
         - Single platform integration
         - Community support
      
      2. Pro Plan: $49/month
         - Up to 50,000 messages moderated per month
         - Advanced content moderation
         - Multi-platform integration (up to 3)
         - Priority email support
         - Custom moderation rules
         - Analytics dashboard
      
      3. Business Plan: Custom pricing
         - Unlimited messages
         - Enterprise-grade moderation
         - Unlimited platform integrations
         - Dedicated support
         - Advanced analytics
         - Custom AI training
         - SLA guarantees
    `,
    metadata: {},
  }).onConflictDoNothing();
  
  // Discord features document
  await db.insert(knowledgeDocuments).values({
    knowledgeBaseId: 1,
    title: 'ModerateAI Discord Features',
    content: `
      ModerateAI's Discord integration includes these key features:
      
      - Real-time message moderation with AI-powered content analysis
      - Automatic detection and removal of toxic content, spam, and inappropriate media
      - User behavior tracking to identify problematic patterns
      - Custom moderation rules based on your server's specific needs
      - Automated warnings and escalation for repeat offenders
      - Moderation logs and analytics to track server health
      - Integration with Discord's role system for graduated permissions
      - Customizable auto-responses and welcome messages
      - Support for multiple language moderation
    `,
    metadata: {},
  }).onConflictDoNothing();
  
  // Website features document
  await db.insert(knowledgeDocuments).values({
    knowledgeBaseId: 1,
    title: 'ModerateAI Website Integration Features',
    content: `
      ModerateAI's Website integration provides:
      
      - Embeddable chat widget for direct customer support
      - Comment section moderation for blogs and forums
      - Form submission filtering to prevent spam and abuse
      - User-generated content review and approval workflows
      - Profanity filtering and sensitive content detection
      - IP-based and behavior-based anti-spam measures
      - Customer feedback analysis and sentiment tracking
      - Integration with popular CMS platforms (WordPress, Shopify, etc.)
      - Customizable moderation thresholds based on your audience
    `,
    metadata: {},
  }).onConflictDoNothing();
  
  // Telegram features document
  await db.insert(knowledgeDocuments).values({
    knowledgeBaseId: 1,
    title: 'ModerateAI Telegram Integration',
    content: `
      ModerateAI's Telegram integration offers:
      
      - Bot-based moderation for Telegram groups and channels
      - Automated content filtering in real-time
      - Message approval workflows for sensitive groups
      - Media content scanning (images, videos, files)
      - Link filtering and protection against malicious URLs
      - User reputation scoring to identify trusted members
      - Multi-language support for global communities
      - Anti-flood and anti-spam protection
      - Automated reports for group administrators
    `,
    metadata: {},
  }).onConflictDoNothing();
  
  console.log('Knowledge documents added successfully!');
}

addKnowledgeDocuments().catch(err => {
  console.error('Error adding knowledge documents:', err);
});