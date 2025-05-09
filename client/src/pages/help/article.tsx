import React, { useState, useEffect } from "react";
import { useParams } from "wouter";
import { ChevronLeft, HelpCircle, BookOpen, Printer, Share } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

// Article content for demo purposes
const articleContent: Record<string, {
  title: string;
  category: string;
  content: React.ReactNode;
}> = {
  'onboarding': {
    title: 'Setting up your first platform',
    category: 'Getting Started',
    content: (
      <div className="space-y-4">
        <p>Welcome to ModerateAI! This guide will help you connect your first platform to our AI moderation system.</p>
        
        <h3 className="text-xl font-semibold mt-6">Choose a platform</h3>
        <p>
          ModerateAI supports several platforms including:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Website Chat</strong> - Add our chat widget to your website</li>
          <li><strong>Telegram</strong> - Connect your Telegram bot or channels</li>
          <li><strong>Discord</strong> - Add ModerateAI to your Discord server</li>
        </ul>
        
        <h3 className="text-xl font-semibold mt-6">Connect your platform</h3>
        <p>
          Navigate to the Integrations section in the sidebar and select your preferred platform.
          Each platform has a step-by-step guide to complete the connection process.
        </p>
        
        <div className="bg-primary/10 p-4 rounded-md border border-primary/20 mt-6">
          <h4 className="font-semibold text-primary flex items-center">
            <HelpCircle className="h-4 w-4 mr-2" />
            Tip
          </h4>
          <p className="text-sm mt-1">
            The easiest platform to get started with is Website Chat, which requires just a single 
            line of code to be added to your website.
          </p>
        </div>
        
        <h3 className="text-xl font-semibold mt-6">Configure your AI assistant</h3>
        <p>
          Once connected, you can customize how your AI assistant responds to messages:
        </p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>Set a personalized welcome message</li>
          <li>Adjust the AI's tone and style</li>
          <li>Configure content moderation rules</li>
          <li>Set up automated responses for common questions</li>
        </ol>
        
        <h3 className="text-xl font-semibold mt-6">Test your integration</h3>
        <p>
          After setting up your platform, send a test message to ensure everything is working correctly.
          You should receive a response from the AI assistant based on your configuration.
        </p>
      </div>
    )
  },
  'website-integration': {
    title: 'Website chat widget setup',
    category: 'Platform Integration',
    content: (
      <div className="space-y-4">
        <p>
          Adding the ModerateAI chat widget to your website is straightforward and only requires 
          a single script tag. Follow these steps to get your chat widget up and running.
        </p>
        
        <h3 className="text-xl font-semibold mt-6">Step 1: Get your widget code</h3>
        <p>
          Navigate to Integrations → Website in your ModerateAI dashboard. You'll find your unique 
          widget code that looks something like this:
        </p>
        
        <div className="bg-muted p-3 rounded font-mono text-sm mt-2 overflow-x-auto">
          {`<script src="https://cdn.moderateai.com/widget.js?id=YOUR_WIDGET_ID" async></script>`}
        </div>
        
        <h3 className="text-xl font-semibold mt-6">Step 2: Add the code to your website</h3>
        <p>
          Copy the widget code and paste it into the <code>&lt;head&gt;</code> section of your website's HTML.
          Make sure to place it before the closing <code>&lt;/head&gt;</code> tag.
        </p>
        
        <div className="bg-primary/10 p-4 rounded-md border border-primary/20 mt-6">
          <h4 className="font-semibold text-primary flex items-center">
            <HelpCircle className="h-4 w-4 mr-2" />
            Tip
          </h4>
          <p className="text-sm mt-1">
            If you're using a content management system like WordPress, look for options to add code to 
            the header, or use a plugin that allows adding custom HTML.
          </p>
        </div>
        
        <h3 className="text-xl font-semibold mt-6">Step 3: Customize the widget</h3>
        <p>
          Return to the Website integration page in your dashboard to customize:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Chat widget colors and theme</li>
          <li>Widget position (bottom-right, bottom-left, etc.)</li>
          <li>Welcome message and bot name</li>
          <li>Chat bubble icon and badge</li>
        </ul>
        
        <h3 className="text-xl font-semibold mt-6">Step 4: Test your widget</h3>
        <p>
          After adding the widget code to your website, visit your site and look for the chat bubble 
          in the position you specified. Click on it to open the chat widget and test sending messages.
        </p>
      </div>
    )
  },
  'ai-config': {
    title: 'AI configuration basics',
    category: 'Getting Started',
    content: (
      <div className="space-y-4">
        <p>
          Understanding and configuring your AI's behavior is essential for providing 
          effective support and moderation. This guide explains the key configuration options.
        </p>
        
        <h3 className="text-xl font-semibold mt-6">Response Style</h3>
        <p>
          You can customize how your AI responds to users by adjusting these settings:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Tone</strong> - Choose from Professional, Friendly, or Casual</li>
          <li><strong>Detail Level</strong> - Set how comprehensive responses should be</li>
          <li><strong>Personality</strong> - Add specific personality traits to your AI</li>
        </ul>
        
        <div className="bg-primary/10 p-4 rounded-md border border-primary/20 mt-6">
          <h4 className="font-semibold text-primary flex items-center">
            <HelpCircle className="h-4 w-4 mr-2" />
            Best Practice
          </h4>
          <p className="text-sm mt-1">
            Match your AI's tone to your brand voice. For customer support, a friendly professional
            tone usually works best.
          </p>
        </div>
        
        <h3 className="text-xl font-semibold mt-6">Moderation Settings</h3>
        <p>
          Control what content your AI will filter or flag:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Content Filtering</strong> - Block inappropriate language and content</li>
          <li><strong>Spam Protection</strong> - Detect and handle repeated or spam messages</li>
          <li><strong>Custom Rules</strong> - Create specific rules for your community's needs</li>
        </ul>
        
        <h3 className="text-xl font-semibold mt-6">Knowledge Base</h3>
        <p>
          Your AI can pull information from your knowledge base to provide more accurate responses:
        </p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>Go to AI Configuration → Knowledge Base</li>
          <li>Upload documents or add URLs to websites with your information</li>
          <li>The AI will automatically reference this information when responding to related questions</li>
        </ol>
      </div>
    )
  },
  'telegram-bot': {
    title: 'Creating a Telegram bot',
    category: 'Platform Integration',
    content: (
      <div className="space-y-4">
        <p>
          Connecting ModerateAI to Telegram allows you to bring AI-powered moderation and support
          to your Telegram groups and channels. This guide walks you through the process.
        </p>
        
        <h3 className="text-xl font-semibold mt-6">Step 1: Create a Telegram bot</h3>
        <p>
          Before connecting to ModerateAI, you need to create a bot on Telegram:
        </p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>Open Telegram and search for @BotFather</li>
          <li>Start a chat with BotFather and send the command /newbot</li>
          <li>Follow the instructions to name your bot</li>
          <li>BotFather will give you an API token - save this for the next step</li>
        </ol>
        
        <h3 className="text-xl font-semibold mt-6">Step 2: Connect to ModerateAI</h3>
        <p>
          Now connect your Telegram bot to ModerateAI:
        </p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>In ModerateAI, go to Integrations → Telegram</li>
          <li>Enter your Telegram bot token in the configuration field</li>
          <li>Click "Connect" to establish the connection</li>
        </ol>
        
        <div className="bg-primary/10 p-4 rounded-md border border-primary/20 mt-6">
          <h4 className="font-semibold text-primary flex items-center">
            <HelpCircle className="h-4 w-4 mr-2" />
            Important
          </h4>
          <p className="text-sm mt-1">
            Keep your bot token secret. If compromised, anyone could control your bot.
            You can reset it with BotFather if needed.
          </p>
        </div>
        
        <h3 className="text-xl font-semibold mt-6">Step 3: Add your bot to groups</h3>
        <p>
          To use your bot in Telegram groups:
        </p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>Open the Telegram group where you want to add the bot</li>
          <li>Click on the group name at the top to open group info</li>
          <li>Select "Add member" and search for your bot's username</li>
          <li>Add the bot and give it admin privileges for moderation functions</li>
        </ol>
      </div>
    )
  },
  'content-rules': {
    title: 'Setting up content filtering rules',
    category: 'Moderation',
    content: (
      <div className="space-y-4">
        <p>
          Content filtering is essential for maintaining a healthy community environment.
          ModerateAI offers powerful tools to automatically detect and handle inappropriate content.
        </p>
        
        <h3 className="text-xl font-semibold mt-6">Default Filtering Categories</h3>
        <p>
          ModerateAI provides these pre-configured filtering categories:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Profanity</strong> - Detects and filters offensive language</li>
          <li><strong>Hate Speech</strong> - Identifies discriminatory or hateful content</li>
          <li><strong>Personal Attacks</strong> - Catches insults and targeted harassment</li>
          <li><strong>NSFW Content</strong> - Filters sexually explicit material</li>
          <li><strong>Spam</strong> - Catches repetitive or promotional content</li>
        </ul>
        
        <h3 className="text-xl font-semibold mt-6">Setting Moderation Levels</h3>
        <p>
          For each category, you can set one of these moderation levels:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Off</strong> - No filtering for this category</li>
          <li><strong>Low</strong> - Only catches clear violations</li>
          <li><strong>Medium</strong> - Balanced approach (recommended)</li>
          <li><strong>High</strong> - Strict filtering, may catch some edge cases</li>
          <li><strong>Maximum</strong> - Zero tolerance, highest sensitivity</li>
        </ul>
        
        <div className="bg-primary/10 p-4 rounded-md border border-primary/20 mt-6">
          <h4 className="font-semibold text-primary flex items-center">
            <HelpCircle className="h-4 w-4 mr-2" />
            Tip
          </h4>
          <p className="text-sm mt-1">
            Start with Medium settings and adjust based on your community needs. 
            Too strict filtering may frustrate users, while too lenient may not protect your community.
          </p>
        </div>
        
        <h3 className="text-xl font-semibold mt-6">Creating Custom Rules</h3>
        <p>
          Beyond the default categories, you can create custom rules:
        </p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>Go to AI Configuration → Content Rules → Custom Rules</li>
          <li>Click "Add New Rule" and provide a name</li>
          <li>Define patterns to match (keywords, phrases, or regex)</li>
          <li>Set the action to take when triggered (warn, delete, mute user, etc.)</li>
        </ol>
      </div>
    )
  },
  'discord-setup': {
    title: 'Discord server integration',
    category: 'Platform Integration',
    content: (
      <div className="space-y-4">
        <p>
          Integrate ModerateAI with your Discord server to provide AI-powered moderation and assistance
          for your community. This guide will help you set up and configure the integration.
        </p>
        
        <h3 className="text-xl font-semibold mt-6">Step 1: Create a Discord Bot</h3>
        <p>Before connecting to ModerateAI, you need to create a Discord application and bot:</p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>Visit the <a href="https://discord.com/developers/applications" className="text-primary">Discord Developer Portal</a></li>
          <li>Click "New Application" and name your bot</li>
          <li>Navigate to the "Bot" tab and click "Add Bot"</li>
          <li>Under the bot settings, enable "Server Members Intent" and "Message Content Intent"</li>
          <li>Copy your bot token (keep this secure)</li>
        </ol>
        
        <h3 className="text-xl font-semibold mt-6">Step 2: Connect to ModerateAI</h3>
        <p>Now connect your Discord bot to ModerateAI:</p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>In ModerateAI, go to Integrations → Discord</li>
          <li>Enter your Discord bot token</li>
          <li>Click "Connect" to establish the connection</li>
        </ol>
        
        <div className="bg-primary/10 p-4 rounded-md border border-primary/20 mt-6">
          <h4 className="font-semibold text-primary flex items-center">
            <HelpCircle className="h-4 w-4 mr-2" />
            Important
          </h4>
          <p className="text-sm mt-1">
            Never share your Discord bot token publicly. If compromised, reset it immediately in the Discord Developer Portal.
          </p>
        </div>
        
        <h3 className="text-xl font-semibold mt-6">Step 3: Invite the Bot to Your Server</h3>
        <p>Add the bot to your Discord server:</p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>In the Discord Developer Portal, go to the "OAuth2" tab</li>
          <li>Under "URL Generator", select "bot" scope</li>
          <li>Select permissions including "Read Messages", "Send Messages", "Manage Messages", etc.</li>
          <li>Copy the generated URL and open it in your browser</li>
          <li>Select your server and authorize the bot</li>
        </ol>
        
        <h3 className="text-xl font-semibold mt-6">Step 4: Configure Moderation Settings</h3>
        <p>
          Return to ModerateAI to configure how the bot will operate in your server:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Set which channels the bot should monitor</li>
          <li>Configure automatic responses for specific triggers</li>
          <li>Set up content moderation rules specific to your Discord community</li>
          <li>Customize the bot's behavior and responses</li>
        </ul>
      </div>
    )
  },
  'ai-training': {
    title: 'Training a custom AI model',
    category: 'AI Configuration',
    content: (
      <div className="space-y-4">
        <p>
          Training a custom AI model allows your ModerateAI assistant to provide more accurate and
          specific responses based on your unique content and requirements.
        </p>
        
        <h3 className="text-xl font-semibold mt-6">Understanding Custom Training</h3>
        <p>
          Custom training enhances the base AI model with your specific:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Brand voice and terminology</li>
          <li>Product knowledge</li>
          <li>Support protocols and procedures</li>
          <li>Community guidelines and standards</li>
        </ul>
        
        <h3 className="text-xl font-semibold mt-6">Step 1: Gather Training Data</h3>
        <p>
          Good training data should include:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Example conversations showing ideal interactions</li>
          <li>Common questions with their best answers</li>
          <li>Problematic content with appropriate moderation responses</li>
          <li>Brand-specific terminology and approved language</li>
        </ul>
        
        <div className="bg-primary/10 p-4 rounded-md border border-primary/20 mt-6">
          <h4 className="font-semibold text-primary flex items-center">
            <HelpCircle className="h-4 w-4 mr-2" />
            Best Practice
          </h4>
          <p className="text-sm mt-1">
            Aim for at least 50 high-quality example interactions for initial training. More examples will produce better results.
          </p>
        </div>
        
        <h3 className="text-xl font-semibold mt-6">Step 2: Start Training</h3>
        <p>To begin the training process:</p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>Go to AI Configuration → Custom Training</li>
          <li>Click "Create New Training" and name your model</li>
          <li>Upload your training data in CSV, JSON, or plain text format</li>
          <li>Adjust the training parameters if needed</li>
          <li>Click "Start Training"</li>
        </ol>
        
        <h3 className="text-xl font-semibold mt-6">Step 3: Test and Refine</h3>
        <p>After training completes:</p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>Test your custom model with various scenarios</li>
          <li>Identify areas where responses need improvement</li>
          <li>Add more training examples focused on weak areas</li>
          <li>Re-train the model with the expanded dataset</li>
        </ol>
        
        <h3 className="text-xl font-semibold mt-6">Step 4: Deploy Your Custom Model</h3>
        <p>Once satisfied with performance:</p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>Go to AI Configuration → AI Models</li>
          <li>Select your trained model</li>
          <li>Click "Deploy to Production"</li>
          <li>Choose which platforms should use this model</li>
        </ol>
      </div>
    )
  },
  'analytics-dashboard': {
    title: 'User Analytics Dashboard',
    category: 'AI Configuration',
    content: (
      <div className="space-y-4">
        <p>
          The Analytics Dashboard provides valuable insights into how users interact with your AI
          assistants across all platforms. This guide explains how to access and interpret this data.
        </p>
        
        <h3 className="text-xl font-semibold mt-6">Overview of the Analytics Dashboard</h3>
        <p>
          The dashboard provides these key metrics:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Total conversations and messages</li>
          <li>User satisfaction and sentiment</li>
          <li>Response times and quality metrics</li>
          <li>Common topics and questions</li>
          <li>Platform-specific performance</li>
        </ul>
        
        <h3 className="text-xl font-semibold mt-6">Accessing the Dashboard</h3>
        <p>
          To access your analytics:
        </p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>Navigate to the Dashboard section in the sidebar</li>
          <li>For detailed analytics, click "View Full Analytics"</li>
          <li>Use the date range selector to focus on specific time periods</li>
        </ol>
        
        <h3 className="text-xl font-semibold mt-6">Key Performance Metrics</h3>
        <p>
          Pay special attention to these metrics:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Resolution Rate</strong> - Percentage of conversations where the AI successfully resolved the user's query</li>
          <li><strong>Average Response Time</strong> - How quickly users receive responses</li>
          <li><strong>Escalation Rate</strong> - Percentage of conversations requiring human intervention</li>
          <li><strong>User Satisfaction Score</strong> - Based on feedback and conversation analysis</li>
        </ul>
        
        <div className="bg-primary/10 p-4 rounded-md border border-primary/20 mt-6">
          <h4 className="font-semibold text-primary flex items-center">
            <HelpCircle className="h-4 w-4 mr-2" />
            Tip
          </h4>
          <p className="text-sm mt-1">
            Set up weekly analytics reports to be emailed to your team members responsible for AI performance.
          </p>
        </div>
        
        <h3 className="text-xl font-semibold mt-6">Topic Analysis</h3>
        <p>
          The Topic Analysis section shows common themes in user conversations:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Most frequent questions and topics</li>
          <li>Trending issues (topics growing in frequency)</li>
          <li>Seasonal patterns in user inquiries</li>
          <li>Topic distribution by platform</li>
        </ul>
        
        <h3 className="text-xl font-semibold mt-6">Using Analytics to Improve Performance</h3>
        <p>
          Apply insights from analytics to enhance your AI:
        </p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>Identify topics with low satisfaction scores and add more training examples</li>
          <li>Review unanswered questions to expand your knowledge base</li>
          <li>Adjust AI configuration based on platform-specific performance</li>
          <li>Create custom responses for frequently asked questions</li>
        </ol>
      </div>
    )
  },
  'response-templates': {
    title: 'Creating AI Response Templates',
    category: 'AI Configuration',
    content: (
      <div className="space-y-4">
        <p>
          Response templates help your AI provide consistent, accurate answers to common questions.
          This guide shows you how to create effective templates for various scenarios.
        </p>
        
        <h3 className="text-xl font-semibold mt-6">Understanding Response Templates</h3>
        <p>
          Templates are pre-defined responses that:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Ensure consistency across all user interactions</li>
          <li>Reduce response time for common questions</li>
          <li>Maintain your brand voice and messaging</li>
          <li>Can include dynamic elements that personalize responses</li>
        </ul>
        
        <h3 className="text-xl font-semibold mt-6">Creating a Basic Template</h3>
        <p>
          To create a response template:
        </p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>Go to AI Configuration → Response Templates</li>
          <li>Click "Add New Template"</li>
          <li>Provide a descriptive name for the template</li>
          <li>Define trigger patterns (phrases or questions that should activate this template)</li>
          <li>Write the response content</li>
          <li>Click "Save Template"</li>
        </ol>
        
        <div className="bg-primary/10 p-4 rounded-md border border-primary/20 mt-6">
          <h4 className="font-semibold text-primary flex items-center">
            <HelpCircle className="h-4 w-4 mr-2" />
            Best Practice
          </h4>
          <p className="text-sm mt-1">
            Include multiple trigger patterns for each template to cover different ways users might ask the same question.
          </p>
        </div>
        
        <h3 className="text-xl font-semibold mt-6">Using Variables in Templates</h3>
        <p>
          Make your templates dynamic with these variables:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><code>{'{{user.name}}'}</code> - Inserts the user's name</li>
          <li><code>{'{{time.greeting}}'}</code> - Adds a time-appropriate greeting (Good morning, etc.)</li>
          <li><code>{'{{platform.name}}'}</code> - Includes the platform name (Website, Telegram, etc.)</li>
          <li><code>{'{{response.custom}}'}</code> - Allows for AI-generated additions to the template</li>
        </ul>
        
        <h3 className="text-xl font-semibold mt-6">Template Categories to Consider</h3>
        <p>
          Create templates for these common scenarios:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Greetings</strong> - Welcome messages for new conversations</li>
          <li><strong>FAQ</strong> - Answers to frequently asked questions</li>
          <li><strong>Troubleshooting</strong> - Common problem-solving processes</li>
          <li><strong>Escalation</strong> - How to connect with human support when needed</li>
          <li><strong>Closing</strong> - End-of-conversation messages with satisfaction checks</li>
        </ul>
        
        <h3 className="text-xl font-semibold mt-6">Testing and Refining Templates</h3>
        <p>
          After creating templates:
        </p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>Use the Preview function to see how the template will appear</li>
          <li>Test with different trigger phrases to verify activation</li>
          <li>Monitor template usage in analytics to identify improvement opportunities</li>
          <li>Regularly update templates based on user feedback and changing needs</li>
        </ol>
      </div>
    )
  },
  'custom-responses': {
    title: 'Custom Response Templates',
    category: 'Moderation',
    content: (
      <div className="space-y-4">
        <p>
          Custom response templates allow you to create personalized, scenario-specific responses
          for your AI assistant. This guide explains how to build and manage effective templates.
        </p>
        
        <h3 className="text-xl font-semibold mt-6">Benefits of Custom Responses</h3>
        <p>
          Custom responses help you:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Maintain consistent messaging across all interactions</li>
          <li>Provide accurate information without AI hallucinations</li>
          <li>Handle sensitive topics with approved language</li>
          <li>Ensure compliance with regulations and policies</li>
        </ul>
        
        <h3 className="text-xl font-semibold mt-6">Creating Custom Responses</h3>
        <p>
          To create a custom response template:
        </p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>Go to Moderation → Custom Responses</li>
          <li>Click "Create New Response"</li>
          <li>Enter a name for the template</li>
          <li>Define triggers - patterns that will activate this response</li>
          <li>Create the response content using the template editor</li>
          <li>Set priority level to determine which template takes precedence when multiple matches occur</li>
          <li>Save and activate your template</li>
        </ol>
        
        <div className="bg-primary/10 p-4 rounded-md border border-primary/20 mt-6">
          <h4 className="font-semibold text-primary flex items-center">
            <HelpCircle className="h-4 w-4 mr-2" />
            Pro Tip
          </h4>
          <p className="text-sm mt-1">
            Use the "Partial AI" option to create hybrid responses where parts are templated and parts are AI-generated.
          </p>
        </div>
        
        <h3 className="text-xl font-semibold mt-6">Template Components</h3>
        <p>
          Effective templates typically include:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Acknowledgment</strong> - Recognizing the user's question or concern</li>
          <li><strong>Information</strong> - Clear, factual content addressing the topic</li>
          <li><strong>Action Steps</strong> - Instructions or next steps if applicable</li>
          <li><strong>Follow-up</strong> - An invitation for further questions</li>
        </ul>
        
        <h3 className="text-xl font-semibold mt-6">Different Response Types</h3>
        <p>
          ModerateAI supports various response configurations:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Fixed Response</strong> - Always provides exactly the same answer</li>
          <li><strong>Variable Response</strong> - Includes dynamic fields that change based on context</li>
          <li><strong>Conditional Response</strong> - Different answers based on user attributes or history</li>
          <li><strong>Sequential Response</strong> - Changes based on previous interactions within the same conversation</li>
        </ul>
        
        <h3 className="text-xl font-semibold mt-6">Testing and Optimization</h3>
        <p>
          After creating templates:
        </p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>Use the test function to see how the template works with different inputs</li>
          <li>Review analytics to see which templates are being used most frequently</li>
          <li>Collect user feedback on template effectiveness</li>
          <li>Regularly update templates based on changing information and user needs</li>
        </ol>
      </div>
    )
  },
  'banned-words': {
    title: 'Managing banned words and phrases',
    category: 'Moderation',
    content: (
      <div className="space-y-4">
        <p>
          Creating and maintaining a comprehensive banned words list is essential for effective content
          moderation. This guide explains how to set up and manage these filters in ModerateAI.
        </p>
        
        <h3 className="text-xl font-semibold mt-6">Understanding Banned Words Lists</h3>
        <p>
          In ModerateAI, banned words and phrases:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Can be categorized by severity and type</li>
          <li>Allow for different actions based on category</li>
          <li>Support pattern matching and context awareness</li>
          <li>Can be platform-specific or global</li>
        </ul>
        
        <h3 className="text-xl font-semibold mt-6">Creating Your Banned Words List</h3>
        <p>
          To set up or modify your banned words list:
        </p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>Go to Moderation → Content Filters → Banned Words</li>
          <li>Click "Create New List" or edit an existing list</li>
          <li>Add words and phrases, one per line</li>
          <li>Set the category (Profanity, Hate Speech, etc.)</li>
          <li>Configure the action to take when detected</li>
          <li>Save your changes</li>
        </ol>
        
        <div className="bg-primary/10 p-4 rounded-md border border-primary/20 mt-6">
          <h4 className="font-semibold text-primary flex items-center">
            <HelpCircle className="h-4 w-4 mr-2" />
            Important
          </h4>
          <p className="text-sm mt-1">
            ModerateAI includes built-in banned word lists that are regularly updated. You can choose to use these exclusively, or supplement them with your custom lists.
          </p>
        </div>
        
        <h3 className="text-xl font-semibold mt-6">Advanced Pattern Matching</h3>
        <p>
          For more sophisticated filtering, use these pattern options:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Wildcard Matching</strong> - Use asterisks (*) to match variations (e.g., "bad*" matches "badly", "badness", etc.)</li>
          <li><strong>Regular Expressions</strong> - For complex pattern matching, enable regex mode</li>
          <li><strong>Word Boundaries</strong> - Option to match only complete words, not substrings</li>
          <li><strong>Case Sensitivity</strong> - Choose whether matches should be case-sensitive</li>
        </ul>
        
        <h3 className="text-xl font-semibold mt-6">Evasion Detection</h3>
        <p>
          Users sometimes try to bypass filters through techniques like:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Character substitution (using numbers or symbols instead of letters)</li>
          <li>Adding spaces or periods between letters</li>
          <li>Unicode character tricks</li>
        </ul>
        <p className="mt-4">
          ModerateAI's advanced detection can identify these evasion attempts. Enable "Evasion Detection" in your filter settings for this functionality.
        </p>
        
        <h3 className="text-xl font-semibold mt-6">False Positive Management</h3>
        <p>
          To reduce false positives:
        </p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>Use the "Exception List" to add words that should never be filtered despite matching patterns</li>
          <li>Enable "Context Awareness" to analyze surrounding text before filtering</li>
          <li>Regularly review the moderation logs to identify false positives</li>
          <li>Adjust your lists based on these findings</li>
        </ol>
      </div>
    )
  },
  'moderation-levels': {
    title: 'Understanding moderation levels',
    category: 'Moderation',
    content: (
      <div className="space-y-4">
        <p>
          Moderation levels in ModerateAI determine how strictly content is filtered across your platforms.
          This guide helps you understand and configure these levels appropriately.
        </p>
        
        <h3 className="text-xl font-semibold mt-6">The Five Moderation Levels</h3>
        <p>
          ModerateAI offers five levels of content moderation:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Level 1: Minimal</strong> - Only filters the most egregious content</li>
          <li><strong>Level 2: Low</strong> - Basic filtering of clearly inappropriate content</li>
          <li><strong>Level 3: Moderate</strong> - Balanced approach suitable for most communities</li>
          <li><strong>Level 4: High</strong> - Strict filtering appropriate for family-friendly environments</li>
          <li><strong>Level 5: Maximum</strong> - Ultra-strict filtering for environments requiring the highest standards</li>
        </ul>
        
        <h3 className="text-xl font-semibold mt-6">Setting Platform-Specific Levels</h3>
        <p>
          To configure moderation levels:
        </p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>Go to Moderation → Settings</li>
          <li>Select the platform you want to configure</li>
          <li>Choose the appropriate moderation level</li>
          <li>Optionally, configure category-specific levels (for more granular control)</li>
          <li>Save your settings</li>
        </ol>
        
        <div className="bg-primary/10 p-4 rounded-md border border-primary/20 mt-6">
          <h4 className="font-semibold text-primary flex items-center">
            <HelpCircle className="h-4 w-4 mr-2" />
            Recommendation
          </h4>
          <p className="text-sm mt-1">
            For most general-purpose communities, start with Level 3 (Moderate) and adjust based on feedback and community needs.
          </p>
        </div>
        
        <h3 className="text-xl font-semibold mt-6">Impact of Moderation Levels</h3>
        <p>
          Each level affects different aspects of content moderation:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Word Filtering</strong> - Higher levels expand the list of banned words and phrases</li>
          <li><strong>Context Sensitivity</strong> - Higher levels apply stricter context analysis</li>
          <li><strong>Pattern Matching</strong> - Higher levels use more aggressive pattern matching</li>
          <li><strong>AI Responses</strong> - Higher levels restrict potentially controversial topics in AI responses</li>
        </ul>
        
        <h3 className="text-xl font-semibold mt-6">Category-Specific Settings</h3>
        <p>
          For more precise control, you can set different levels for each category:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Profanity</strong> - Filter for offensive language</li>
          <li><strong>Hate Speech</strong> - Filter for discriminatory content</li>
          <li><strong>Violence</strong> - Filter for violent content and threats</li>
          <li><strong>Sexual Content</strong> - Filter for adult/NSFW content</li>
          <li><strong>Personal Information</strong> - Filter for sharing of private details</li>
        </ul>
        
        <h3 className="text-xl font-semibold mt-6">Testing Your Configuration</h3>
        <p>
          After setting moderation levels:
        </p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>Use the Moderation Simulator to test how various content would be handled</li>
          <li>Monitor moderation logs for the first few days after changing settings</li>
          <li>Collect feedback from users and moderators</li>
          <li>Adjust levels based on real-world performance</li>
        </ol>
      </div>
    )
  },
  'intro-video': {
    title: 'Introduction to ModerateAI',
    category: 'Videos',
    content: (
      <div className="space-y-4">
        <p>
          Welcome to the Introduction to ModerateAI video tutorial. This comprehensive overview
          will get you familiar with the platform's key features and capabilities.
        </p>
        
        <div className="mt-6 aspect-video bg-muted/50 rounded-lg flex items-center justify-center">
          <div className="text-center p-8">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3 text-muted-foreground">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            <p className="text-muted-foreground">Video Player</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Introduction to ModerateAI - 8:24
            </p>
          </div>
        </div>
        
        <h3 className="text-xl font-semibold mt-6">Video Chapters</h3>
        <p>This introduction covers the following topics:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>0:00</strong> - Welcome and overview</li>
          <li><strong>0:45</strong> - Dashboard tour</li>
          <li><strong>2:12</strong> - Platform integrations overview</li>
          <li><strong>3:38</strong> - AI configuration basics</li>
          <li><strong>5:20</strong> - Moderation capabilities</li>
          <li><strong>6:47</strong> - Analytics and reporting</li>
          <li><strong>7:53</strong> - Getting help and next steps</li>
        </ul>
        
        <div className="bg-primary/10 p-4 rounded-md border border-primary/20 mt-6">
          <h4 className="font-semibold text-primary flex items-center">
            <HelpCircle className="h-4 w-4 mr-2" />
            Note
          </h4>
          <p className="text-sm mt-1">
            We recommend watching this video before exploring other tutorials to get a solid foundation in ModerateAI concepts.
          </p>
        </div>
        
        <h3 className="text-xl font-semibold mt-6">Additional Resources</h3>
        <p>
          After watching this video, explore these resources to continue your learning:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Platform-specific integration guides</li>
          <li>AI configuration tutorials</li>
          <li>Moderation best practices</li>
          <li>Sample templates and configurations</li>
        </ul>
      </div>
    )
  },
  'telegram-video': {
    title: 'Setting up Telegram integration',
    category: 'Videos',
    content: (
      <div className="space-y-4">
        <p>
          This video tutorial walks you through the complete process of setting up and configuring 
          the Telegram integration for ModerateAI. Follow along for step-by-step instructions.
        </p>
        
        <div className="mt-6 aspect-video bg-muted/50 rounded-lg flex items-center justify-center">
          <div className="text-center p-8">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3 text-muted-foreground">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            <p className="text-muted-foreground">Video Player</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Telegram Integration Tutorial - 6:52
            </p>
          </div>
        </div>
        
        <h3 className="text-xl font-semibold mt-6">Video Chapters</h3>
        <p>This tutorial covers the following steps:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>0:00</strong> - Introduction</li>
          <li><strong>0:30</strong> - Creating a Telegram bot with BotFather</li>
          <li><strong>1:45</strong> - Copying your bot token</li>
          <li><strong>2:20</strong> - Configuring the bot in ModerateAI</li>
          <li><strong>3:42</strong> - Setting up AI responses</li>
          <li><strong>4:55</strong> - Configuring moderation rules</li>
          <li><strong>5:48</strong> - Testing your bot</li>
          <li><strong>6:30</strong> - Troubleshooting tips</li>
        </ul>
        
        <div className="bg-primary/10 p-4 rounded-md border border-primary/20 mt-6">
          <h4 className="font-semibold text-primary flex items-center">
            <HelpCircle className="h-4 w-4 mr-2" />
            Important
          </h4>
          <p className="text-sm mt-1">
            Keep your bot token secure. Anyone with access to this token can control your bot.
          </p>
        </div>
        
        <h3 className="text-xl font-semibold mt-6">Prerequisites</h3>
        <p>
          Before starting this tutorial, make sure you have:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>A Telegram account</li>
          <li>Access to your ModerateAI dashboard</li>
          <li>Admin permissions in any Telegram groups where you want to add the bot</li>
        </ul>
        
        <h3 className="text-xl font-semibold mt-6">Additional Configuration Options</h3>
        <p>
          While not covered in detail in the video, these advanced options may be useful:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Custom Commands</strong> - Create special commands for your bot</li>
          <li><strong>Group-Specific Settings</strong> - Configure different behaviors for different groups</li>
          <li><strong>Scheduled Messages</strong> - Set up automatic announcements or reminders</li>
          <li><strong>Webhook Configuration</strong> - For advanced users needing custom integrations</li>
        </ul>
      </div>
    )
  },
  'contact-support': {
    title: 'How to contact support',
    category: 'Support',
    content: (
      <div className="space-y-4">
        <p>
          ModerateAI offers multiple support channels to help you resolve issues and answer 
          questions. This guide covers all available options and how to use them effectively.
        </p>
        
        <h3 className="text-xl font-semibold mt-6">Available Support Channels</h3>
        <p>
          You can reach our support team through these channels:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Live Chat</strong> - Available Monday-Friday, 9 AM - 6 PM ET</li>
          <li><strong>Email Support</strong> - 24/7 access with responses within 24 hours</li>
          <li><strong>Help Center</strong> - Self-service articles and tutorials</li>
          <li><strong>Community Forum</strong> - Peer support and discussions</li>
          <li><strong>Phone Support</strong> - Available for Enterprise plan users</li>
        </ul>
        
        <h3 className="text-xl font-semibold mt-6">Live Chat Support</h3>
        <p>
          To access live chat support:
        </p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>Log into your ModerateAI dashboard</li>
          <li>Click the chat icon in the bottom-right corner</li>
          <li>Describe your issue in detail</li>
          <li>A support agent will respond, typically within 5 minutes during business hours</li>
        </ol>
        
        <div className="bg-primary/10 p-4 rounded-md border border-primary/20 mt-6">
          <h4 className="font-semibold text-primary flex items-center">
            <HelpCircle className="h-4 w-4 mr-2" />
            Pro Tip
          </h4>
          <p className="text-sm mt-1">
            Have your account details ready when contacting support. Knowing your account ID, plan type, and affected platform will help us resolve your issue faster.
          </p>
        </div>
        
        <h3 className="text-xl font-semibold mt-6">Email Support</h3>
        <p>
          For email support:
        </p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>Send your inquiry to support@moderateai.com</li>
          <li>Include a descriptive subject line</li>
          <li>Provide relevant details about your issue</li>
          <li>Add screenshots or error messages if applicable</li>
        </ol>
        
        <h3 className="text-xl font-semibold mt-6">Support Ticket Best Practices</h3>
        <p>
          When submitting a support request, include:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Clear Description</strong> - Explain what happened and what you expected</li>
          <li><strong>Steps to Reproduce</strong> - List the actions that led to the issue</li>
          <li><strong>Error Messages</strong> - Copy exact error text or screenshots</li>
          <li><strong>Account Details</strong> - Your account ID and affected platforms</li>
          <li><strong>Recent Changes</strong> - Note any recent changes you made before the issue</li>
        </ul>
        
        <h3 className="text-xl font-semibold mt-6">Enterprise Support Options</h3>
        <p>
          Enterprise customers receive additional support benefits:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Dedicated account manager</li>
          <li>24/7 priority support</li>
          <li>Phone support line</li>
          <li>Guaranteed response times</li>
          <li>Custom training and onboarding sessions</li>
        </ul>
      </div>
    )
  },
  'billing-support': {
    title: 'Billing and subscription help',
    category: 'Support',
    content: (
      <div className="space-y-4">
        <p>
          This guide provides information about ModerateAI's billing processes, subscription management,
          and how to get help with billing-related questions.
        </p>
        
        <h3 className="text-xl font-semibold mt-6">Understanding Your Subscription</h3>
        <p>
          ModerateAI offers these subscription tiers:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Basic</strong> - For small projects and personal use</li>
          <li><strong>Professional</strong> - For growing companies and communities</li>
          <li><strong>Business</strong> - For larger organizations with advanced needs</li>
          <li><strong>Enterprise</strong> - Custom solutions for enterprise-level requirements</li>
        </ul>
        
        <h3 className="text-xl font-semibold mt-6">Viewing and Managing Your Subscription</h3>
        <p>
          To access your subscription details:
        </p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>Log into your ModerateAI dashboard</li>
          <li>Click on your profile icon in the top-right corner</li>
          <li>Select "Billing & Subscription"</li>
          <li>Here you can view your current plan, usage, payment history, and invoices</li>
        </ol>
        
        <div className="bg-primary/10 p-4 rounded-md border border-primary/20 mt-6">
          <h4 className="font-semibold text-primary flex items-center">
            <HelpCircle className="h-4 w-4 mr-2" />
            Note
          </h4>
          <p className="text-sm mt-1">
            Changes to your subscription typically take effect immediately for upgrades, or at the end of your current billing cycle for downgrades.
          </p>
        </div>
        
        <h3 className="text-xl font-semibold mt-6">Billing Cycles and Payments</h3>
        <p>
          Key information about billing:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Subscriptions are billed monthly or annually</li>
          <li>Annual subscriptions receive a 15% discount</li>
          <li>Payments are processed securely via Stripe</li>
          <li>We accept major credit cards and some regional payment methods</li>
          <li>Enterprise customers can request invoice-based billing</li>
        </ul>
        
        <h3 className="text-xl font-semibold mt-6">Usage-Based Billing</h3>
        <p>
          Some features include usage-based billing:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>API Calls</strong> - Each plan includes a monthly allowance, with overage charges for additional usage</li>
          <li><strong>Storage</strong> - Plans include base storage, with additional storage available</li>
          <li><strong>Custom AI Training</strong> - Advanced training may incur additional costs</li>
        </ul>
        <p className="mt-4">
          You can monitor your usage on the Billing & Subscription page, with alerts when you approach limits.
        </p>
        
        <h3 className="text-xl font-semibold mt-6">Common Billing Questions</h3>
        <ol className="list-decimal pl-6 space-y-2">
          <li>
            <strong>How do I change my payment method?</strong>
            <p className="text-sm mt-1">Go to Billing & Subscription → Payment Methods → Add New Method</p>
          </li>
          <li>
            <strong>Can I get a refund?</strong>
            <p className="text-sm mt-1">Refund requests are handled on a case-by-case basis. Contact billing@moderateai.com for assistance.</p>
          </li>
          <li>
            <strong>How do I cancel my subscription?</strong>
            <p className="text-sm mt-1">Go to Billing & Subscription → Subscription Management → Cancel Subscription</p>
          </li>
          <li>
            <strong>I need an invoice for my records</strong>
            <p className="text-sm mt-1">All invoices are available for download in the Billing & Subscription section</p>
          </li>
        </ol>
      </div>
    )
  },
  'team-roles': {
    title: 'Team roles and permissions',
    category: 'Getting Started',
    content: (
      <div className="space-y-4">
        <p>
          Setting up the right team roles and permissions is crucial for efficient collaboration 
          and security. This guide explains ModerateAI's role-based access control system.
        </p>
        
        <h3 className="text-xl font-semibold mt-6">Understanding Team Roles</h3>
        <p>
          ModerateAI offers these predefined roles:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Owner</strong> - Full access to all settings and billing</li>
          <li><strong>Admin</strong> - Full access to settings but limited billing access</li>
          <li><strong>Manager</strong> - Can manage most settings but cannot add/remove users</li>
          <li><strong>Moderator</strong> - Can handle content moderation and conversations</li>
          <li><strong>Viewer</strong> - Read-only access to dashboards and reports</li>
        </ul>
        
        <h3 className="text-xl font-semibold mt-6">Role Capabilities</h3>
        <table className="w-full mt-4 border-collapse">
          <thead>
            <tr className="bg-muted/50">
              <th className="border p-2 text-left">Capability</th>
              <th className="border p-2 text-center">Owner</th>
              <th className="border p-2 text-center">Admin</th>
              <th className="border p-2 text-center">Manager</th>
              <th className="border p-2 text-center">Moderator</th>
              <th className="border p-2 text-center">Viewer</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border p-2">Manage Billing</td>
              <td className="border p-2 text-center">✓</td>
              <td className="border p-2 text-center">Limited</td>
              <td className="border p-2 text-center">-</td>
              <td className="border p-2 text-center">-</td>
              <td className="border p-2 text-center">-</td>
            </tr>
            <tr>
              <td className="border p-2">Add/Remove Users</td>
              <td className="border p-2 text-center">✓</td>
              <td className="border p-2 text-center">✓</td>
              <td className="border p-2 text-center">-</td>
              <td className="border p-2 text-center">-</td>
              <td className="border p-2 text-center">-</td>
            </tr>
            <tr>
              <td className="border p-2">Configure AI</td>
              <td className="border p-2 text-center">✓</td>
              <td className="border p-2 text-center">✓</td>
              <td className="border p-2 text-center">✓</td>
              <td className="border p-2 text-center">-</td>
              <td className="border p-2 text-center">-</td>
            </tr>
            <tr>
              <td className="border p-2">Manage Integrations</td>
              <td className="border p-2 text-center">✓</td>
              <td className="border p-2 text-center">✓</td>
              <td className="border p-2 text-center">✓</td>
              <td className="border p-2 text-center">-</td>
              <td className="border p-2 text-center">-</td>
            </tr>
            <tr>
              <td className="border p-2">Moderate Content</td>
              <td className="border p-2 text-center">✓</td>
              <td className="border p-2 text-center">✓</td>
              <td className="border p-2 text-center">✓</td>
              <td className="border p-2 text-center">✓</td>
              <td className="border p-2 text-center">-</td>
            </tr>
            <tr>
              <td className="border p-2">View Reports</td>
              <td className="border p-2 text-center">✓</td>
              <td className="border p-2 text-center">✓</td>
              <td className="border p-2 text-center">✓</td>
              <td className="border p-2 text-center">✓</td>
              <td className="border p-2 text-center">✓</td>
            </tr>
          </tbody>
        </table>
        
        <div className="bg-primary/10 p-4 rounded-md border border-primary/20 mt-6">
          <h4 className="font-semibold text-primary flex items-center">
            <HelpCircle className="h-4 w-4 mr-2" />
            Best Practice
          </h4>
          <p className="text-sm mt-1">
            Assign permissions based on the principle of least privilege - give team members only the access they need to perform their specific roles.
          </p>
        </div>
        
        <h3 className="text-xl font-semibold mt-6">Managing Team Members</h3>
        <p>
          To add or manage team members:
        </p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>Go to Settings → Team Management</li>
          <li>Click "Add Team Member" to invite new users</li>
          <li>Enter their email address and select the appropriate role</li>
          <li>Optionally, add a personal message to the invitation</li>
          <li>Click "Send Invitation"</li>
        </ol>
        
        <h3 className="text-xl font-semibold mt-6">Custom Roles</h3>
        <p>
          For Business and Enterprise plans, you can create custom roles:
        </p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>Go to Settings → Team Management → Custom Roles</li>
          <li>Click "Create Custom Role"</li>
          <li>Name your role and select the permissions to include</li>
          <li>Save the role configuration</li>
          <li>You can now assign this custom role to team members</li>
        </ol>
      </div>
    )
  },
  'telegram-integration': {
    title: 'Telegram Bot Integration',
    category: 'Platform Integration',
    content: (
      <div className="space-y-4">
        <p>
          The Telegram integration allows you to connect ModerateAI to your Telegram channels and groups,
          providing AI-powered moderation and engagement. This comprehensive guide walks you through the setup process.
        </p>
        
        <h3 className="text-xl font-semibold mt-6">Benefits of Telegram Integration</h3>
        <p>
          Connecting ModerateAI to Telegram enables:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Automatic content moderation in groups and channels</li>
          <li>AI-powered responses to user questions</li>
          <li>Customized welcome messages for new members</li>
          <li>Moderation alerts for administrators</li>
          <li>Data collection for analytics and insights</li>
        </ul>
        
        <h3 className="text-xl font-semibold mt-6">Step 1: Create a Telegram Bot</h3>
        <p>
          First, you'll need to create a bot through Telegram's BotFather:
        </p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>Open Telegram and search for @BotFather</li>
          <li>Start a chat and send the command `/newbot`</li>
          <li>Follow the prompts to name your bot and create a username</li>
          <li>BotFather will provide you with a token - save this for the next step</li>
        </ol>
        
        <div className="bg-primary/10 p-4 rounded-md border border-primary/20 mt-6">
          <h4 className="font-semibold text-primary flex items-center">
            <HelpCircle className="h-4 w-4 mr-2" />
            Security Note
          </h4>
          <p className="text-sm mt-1">
            Your bot token is essentially the password to your bot. Keep it secure and never share it publicly.
          </p>
        </div>
        
        <h3 className="text-xl font-semibold mt-6">Step 2: Connect to ModerateAI</h3>
        <p>
          Now connect your bot to the ModerateAI platform:
        </p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>Log into your ModerateAI dashboard</li>
          <li>Navigate to Integrations → Telegram</li>
          <li>Click "Add Telegram Bot"</li>
          <li>Enter your bot token from BotFather</li>
          <li>Configure the bot's name and description as it will appear in ModerateAI</li>
          <li>Click "Connect" to establish the integration</li>
        </ol>
        
        <h3 className="text-xl font-semibold mt-6">Step 3: Configure Bot Settings</h3>
        <p>
          Customize how your bot will function:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>AI Configuration</strong> - Select which AI model and knowledge base to use</li>
          <li><strong>Moderation Rules</strong> - Configure content filtering levels and actions</li>
          <li><strong>Welcome Messages</strong> - Set up automatic greetings for new members</li>
          <li><strong>Commands</strong> - Create custom commands for your bot</li>
          <li><strong>Privacy Settings</strong> - Control what messages the bot processes</li>
        </ul>
        
        <h3 className="text-xl font-semibold mt-6">Step 4: Add Bot to Groups</h3>
        <p>
          To use your bot in Telegram groups:
        </p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>Open the Telegram group</li>
          <li>Access group settings by tapping the group name</li>
          <li>Select "Add members" or "Add administrators"</li>
          <li>Search for your bot by username</li>
          <li>Add the bot and grant appropriate permissions</li>
        </ol>
        
        <h3 className="text-xl font-semibold mt-6">Testing and Monitoring</h3>
        <p>
          After setup is complete:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Send test messages to verify the bot is responding correctly</li>
          <li>Check the ModerateAI dashboard for logs of bot activity</li>
          <li>Monitor moderation actions to ensure rules are working as expected</li>
          <li>Collect user feedback to fine-tune the bot's behavior</li>
        </ul>
      </div>
    )
  },
  'discord-integration': {
    title: 'Discord Server Integration',
    category: 'Platform Integration',
    content: (
      <div className="space-y-4">
        <p>
          Integrate ModerateAI with your Discord server to provide AI-powered moderation, 
          support, and engagement for your community. This guide covers the complete setup process.
        </p>
        
        <h3 className="text-xl font-semibold mt-6">What the Discord Integration Offers</h3>
        <p>
          By connecting ModerateAI to Discord, you can:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Automatically moderate messages across all channels</li>
          <li>Provide AI-powered responses to common questions</li>
          <li>Automate member greetings and onboarding</li>
          <li>Get alerts for potential rule violations</li>
          <li>Collect engagement analytics and insights</li>
        </ul>
        
        <h3 className="text-xl font-semibold mt-6">Step 1: Create a Discord Application</h3>
        <p>
          First, create a Discord application and bot:
        </p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>Go to the <a href="https://discord.com/developers/applications" className="text-primary">Discord Developer Portal</a></li>
          <li>Click "New Application" and name it</li>
          <li>Navigate to the "Bot" tab</li>
          <li>Click "Add Bot" and confirm</li>
          <li>Under "Privileged Gateway Intents," enable:
            <ul className="list-disc pl-6 mt-2">
              <li>Presence Intent</li>
              <li>Server Members Intent</li>
              <li>Message Content Intent</li>
            </ul>
          </li>
          <li>Save changes</li>
          <li>Under the "Token" section, click "Reset Token" and copy the new token</li>
        </ol>
        
        <div className="bg-primary/10 p-4 rounded-md border border-primary/20 mt-6">
          <h4 className="font-semibold text-primary flex items-center">
            <HelpCircle className="h-4 w-4 mr-2" />
            Important
          </h4>
          <p className="text-sm mt-1">
            The bot token gives full access to your bot. Never share it publicly or commit it to code repositories.
          </p>
        </div>
        
        <h3 className="text-xl font-semibold mt-6">Step 2: Connect to ModerateAI</h3>
        <p>
          Now connect your Discord bot to ModerateAI:
        </p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>Log into your ModerateAI dashboard</li>
          <li>Go to Integrations → Discord</li>
          <li>Click "Add Discord Bot"</li>
          <li>Enter the bot token you copied</li>
          <li>Configure the display name and description</li>
          <li>Click "Connect" to establish the link</li>
        </ol>
        
        <h3 className="text-xl font-semibold mt-6">Step 3: Invite the Bot to Your Server</h3>
        <p>
          To add the bot to your Discord server:
        </p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>In the Discord Developer Portal, go to the "OAuth2" tab</li>
          <li>Under "URL Generator," select the "bot" and "applications.commands" scopes</li>
          <li>Under "Bot Permissions," select the permissions your bot needs:
            <ul className="list-disc pl-6 mt-2">
              <li>Read Messages/View Channels</li>
              <li>Send Messages</li>
              <li>Manage Messages (for moderation)</li>
              <li>Read Message History</li>
              <li>Add Reactions</li>
              <li>Other permissions as needed for your use case</li>
            </ul>
          </li>
          <li>Copy the generated URL and open it in your browser</li>
          <li>Select your server and authorize the bot</li>
        </ol>
        
        <h3 className="text-xl font-semibold mt-6">Step 4: Configure Discord-Specific Settings</h3>
        <p>
          Customize how the bot operates in your server:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Channel Configuration</strong> - Select which channels to monitor or ignore</li>
          <li><strong>Command Prefix</strong> - Set the prefix for bot commands (e.g., !, /, ?)</li>
          <li><strong>Auto-Responses</strong> - Configure automatic replies to specific triggers</li>
          <li><strong>Role Requirements</strong> - Set permission levels for different commands</li>
          <li><strong>Moderation Actions</strong> - Choose how rule violations are handled</li>
        </ul>
      </div>
    )
  }
}
};

export default function HelpArticlePage() {
  const params = useParams();
  const articleId = params.articleId;
  const [article, setArticle] = useState<typeof articleContent[string] | null>(null);
  
  useEffect(() => {
    // In a real app, this would be an API call to fetch the article
    if (articleId && articleContent[articleId]) {
      setArticle(articleContent[articleId]);
    }
  }, [articleId]);
  
  if (!article) {
    return (
      <div className="max-w-3xl mx-auto py-8 px-4">
        <div className="flex items-center mb-6">
          <Link href="/help">
            <Button variant="outline" size="sm" className="mr-2">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Help Center
            </Button>
          </Link>
        </div>
        
        <div className="text-center py-12">
          <HelpCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">Article Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The help article you're looking for doesn't exist or has been moved.
          </p>
          <Link href="/help">
            <Button>Return to Help Center</Button>
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="max-w-3xl mx-auto pt-0 pb-8 px-4">
      <div className="flex items-center mb-4">
        <Link href="/help">
          <Button variant="outline" size="sm" className="mr-2">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Help Center
          </Button>
        </Link>
      </div>
      
      <div className="bg-gradient-to-r from-primary/20 to-background border border-primary/10 rounded-xl p-6 mb-6">
        <h1 className="text-3xl font-bold">{article.title}</h1>
        <div className="flex items-center mt-2 text-muted-foreground text-sm">
          <BookOpen className="h-4 w-4 mr-1" />
          <span>{article.category}</span>
        </div>
      </div>
      
      <div className="flex justify-end mb-6 space-x-2">
        <Button variant="outline" size="sm">
          <Printer className="h-4 w-4 mr-1" />
          Print
        </Button>
        <Button variant="outline" size="sm">
          <Share className="h-4 w-4 mr-1" />
          Share
        </Button>
      </div>
      
      <Separator className="mb-6" />
      
      <div className="prose prose-blue max-w-none dark:prose-invert">
        {article.content}
      </div>
      
      <Separator className="my-8" />
      
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Was this article helpful?</h3>
        <div className="flex justify-center space-x-2">
          <Button variant="outline">Yes, thanks!</Button>
          <Button variant="outline">No, I need more help</Button>
        </div>
      </div>
    </div>
  );
}