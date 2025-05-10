import { MailService } from '@sendgrid/mail';

// Initialize SendGrid mail service
const mailService = new MailService();
if (process.env.SENDGRID_API_KEY) {
  mailService.setApiKey(process.env.SENDGRID_API_KEY);
} else {
  console.warn("SENDGRID_API_KEY environment variable not set. Email functionality will be disabled.");
}

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

/**
 * Generic function to send emails
 */
export async function sendEmail(params: EmailParams): Promise<boolean> {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      console.error('SendGrid API key not set. Cannot send email.');
      return false;
    }
    
    // Always use the verified sender email from environment variables
    // We ignore the params.from value to prevent "sender identity" errors
    const senderEmail = process.env.SENDGRID_SENDER_EMAIL;
    
    // Check if sender email is available
    if (!senderEmail) {
      console.error('SENDGRID_SENDER_EMAIL environment variable not set. Cannot send email.');
      return false;
    }

    await mailService.send({
      to: params.to,
      from: senderEmail,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });

    console.log(`Email sent successfully to ${params.to}`);
    return true;
  } catch (error: any) {
    console.error('SendGrid email error:', error);
    
    // Log more detailed error information if available
    if (error.response && error.response.body && error.response.body.errors) {
      console.error('SendGrid detailed error:', JSON.stringify(error.response.body.errors));
    }
    
    return false;
  }
}

/**
 * Send team invitation email
 */
export async function sendInvitationEmail(
  email: string,
  teamName: string,
  inviterName: string,
  role: string,
  inviteLink: string
): Promise<boolean> {
  // Important: Must be an email verified in SendGrid
  const senderEmail = process.env.SENDGRID_SENDER_EMAIL;
  
  const subject = `${inviterName} invited you to join ${teamName}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-bottom: 2px solid #5a67d8;">
        <h1 style="color: #4c51bf; margin: 0;">ModerateAI</h1>
      </div>
      
      <div style="padding: 20px;">
        <h2>You've been invited!</h2>
        
        <p>Hello,</p>
        
        <p>${inviterName} has invited you to join <strong>${teamName}</strong> as a <strong>${role}</strong>.</p>
        
        <p>ModerateAI helps teams manage customer support and content moderation across multiple platforms with AI assistance.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${inviteLink}" style="background-color: #5a67d8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
            Accept Invitation
          </a>
        </div>
        
        <p>Or copy and paste this URL into your browser:</p>
        <p style="word-break: break-all; background-color: #f8f9fa; padding: 10px; border-radius: 4px;">
          ${inviteLink}
        </p>
        
        <p>This invitation will expire in 7 days.</p>
        
        <p>If you have any questions, please contact the person who invited you.</p>
      </div>
      
      <div style="background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #666;">
        <p>© ${new Date().getFullYear()} ModerateAI. All rights reserved.</p>
        <p>If you didn't request this invitation, you can ignore this email.</p>
      </div>
    </div>
  `;
  
  const text = `
You've been invited!

Hello,

${inviterName} has invited you to join ${teamName} as a ${role}.

ModerateAI helps teams manage customer support and content moderation across multiple platforms with AI assistance.

Accept the invitation by visiting this link:
${inviteLink}

This invitation will expire in 7 days.

If you have any questions, please contact the person who invited you.

© ${new Date().getFullYear()} ModerateAI. All rights reserved.
If you didn't request this invitation, you can ignore this email.
  `;
  
  return sendEmail({
    to: email,
    from: senderEmail,
    subject,
    text,
    html
  });
}