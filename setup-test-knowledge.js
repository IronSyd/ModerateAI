#!/usr/bin/env node

/**
 * Set up test knowledge base with official information
 */

import { storage } from './server/storage.js';

async function setupTestKnowledge() {
  console.log('📚 Setting up test knowledge base for accuracy testing...\n');

  try {
    const userId = 1; // Demo user

    // 1. Create or get knowledge base
    console.log('1. Creating test knowledge base...');
    
    let knowledgeBase = {
      userId,
      name: 'official-product-info',
      title: 'Official Product Information',
      description: 'Authoritative information about our product features and policies',
      isActive: true
    };
    
    const createdKB = await storage.createKnowledgeBase(knowledgeBase);
    console.log(`✅ Created knowledge base: "${createdKB.title}" (ID: ${createdKB.id})`);

    // 2. Add official documentation that might conflict with learned patterns
    console.log('\n2. Adding official knowledge documents...');
    
    const documents = [
      {
        knowledgeBaseId: createdKB.id,
        title: 'Pricing Plans - Official',
        content: `OFFICIAL PRICING INFORMATION:

Professional Plan: $29/month
- Up to 10 team members
- Advanced analytics
- Priority support
- API access included

Enterprise Plan: $99/month  
- Unlimited team members
- Custom integrations
- Dedicated account manager
- SLA guarantee

Starter Plan: $9/month
- Up to 3 team members  
- Basic features
- Community support

IMPORTANT: These are the only authorized pricing tiers. Do not reference any other pricing information.`
      },
      {
        knowledgeBaseId: createdKB.id,
        title: 'Refund Policy - Official',
        content: `OFFICIAL REFUND POLICY:

30-Day Money-Back Guarantee:
- Full refund within 30 days of purchase
- No questions asked
- Processed within 5-7 business days

Cancellation Policy:
- Cancel anytime from your account settings
- No cancellation fees
- Unused portion will be prorated

IMPORTANT: This is our official refund policy. Do not reference any other refund terms.`
      },
      {
        knowledgeBaseId: createdKB.id,
        title: 'Security Information - Official',
        content: `OFFICIAL SECURITY MEASURES:

Data Protection:
- End-to-end encryption
- SOC 2 Type II certified
- GDPR compliant
- Regular security audits

Infrastructure:
- AWS-hosted with 99.9% uptime SLA
- Automated backups every 4 hours
- Multi-factor authentication required
- Role-based access controls

Compliance:
- ISO 27001 certified
- PCI DSS compliant for payments
- Regular penetration testing
- 24/7 security monitoring

IMPORTANT: These are our verified security standards. Do not reference any other security claims.`
      },
      {
        knowledgeBaseId: createdKB.id,
        title: 'Support Contact - Official',
        content: `OFFICIAL SUPPORT INFORMATION:

Primary Support:
- Email: support@moderateai.com
- Response time: Within 24 hours
- Available 24/7 for Enterprise customers

Technical Support:
- Email: tech@moderateai.com  
- For API and integration issues
- Response time: Within 4 hours

Emergency Contact:
- Phone: +1-555-MODERATE (Enterprise only)
- Available for critical issues
- 24/7 availability

IMPORTANT: These are the only official support channels. Do not reference any other contact methods.`
      }
    ];

    for (const doc of documents) {
      const created = await storage.createKnowledgeDocument(doc);
      console.log(`✅ Added document: "${created.title}"`);
    }

    // 3. Verify knowledge base setup
    console.log('\n3. Verifying knowledge base setup...');
    const allKBs = await storage.getKnowledgeBasesByUserId(userId);
    const activeKB = allKBs.find(kb => kb.isActive);
    
    if (activeKB) {
      const docs = await storage.getKnowledgeDocumentsByKnowledgeBaseId(activeKB.id);
      console.log(`✅ Active knowledge base: "${activeKB.title}"`);
      console.log(`✅ Total documents: ${docs.length}`);
      
      docs.forEach((doc, i) => {
        console.log(`   ${i + 1}. ${doc.title} (${doc.content.length} chars)`);
      });
    }

    console.log('\n✅ Test knowledge base setup complete!');
    console.log('   Now the system has official information that can be tested against learned patterns.');

  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

setupTestKnowledge().catch(console.error);