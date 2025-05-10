import express from 'express';
import { sendEmail, sendInvitationEmail } from './emailService';

const router = express.Router();

// Test route to send a simple email
router.get('/test-simple-email', async (req, res) => {
  try {
    const { to } = req.query;
    
    if (!to || typeof to !== 'string') {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing or invalid "to" parameter' 
      });
    }
    
    const senderEmail = process.env.SENDGRID_SENDER_EMAIL || 'noreply@moderateai.app';
    
    const result = await sendEmail({
      to,
      from: senderEmail,
      subject: 'Test Email from ModerateAI',
      text: 'This is a test email from the ModerateAI platform.',
      html: '<p>This is a <strong>test email</strong> from the ModerateAI platform.</p>'
    });
    
    if (result) {
      res.json({ 
        success: true, 
        message: `Test email sent to ${to}` 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to send test email' 
      });
    }
  } catch (error: any) {
    console.error('Test email error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Internal server error' 
    });
  }
});

// Test route to send an invitation email
router.get('/test-invitation-email', async (req, res) => {
  try {
    const { to } = req.query;
    
    if (!to || typeof to !== 'string') {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing or invalid "to" parameter' 
      });
    }
    
    // Create a test invitation link
    const baseUrl = process.env.BASE_URL || `http://localhost:5000`;
    const testToken = `test-token-${Date.now()}`;
    const inviteLink = `${baseUrl}/accept-invitation?token=${testToken}`;
    
    const result = await sendInvitationEmail(
      to,
      'ModerateAI Team',
      'Test Admin',
      'moderator',
      inviteLink
    );
    
    if (result) {
      res.json({ 
        success: true, 
        message: `Test invitation email sent to ${to}` 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to send test invitation email' 
      });
    }
  } catch (error: any) {
    console.error('Test invitation email error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Internal server error' 
    });
  }
});

export default router;