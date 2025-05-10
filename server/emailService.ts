import { MailService } from '@sendgrid/mail';

if (!process.env.SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY environment variable must be set");
}

const mailService = new MailService();
mailService.setApiKey(process.env.SENDGRID_API_KEY);

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  try {
    await mailService.send({
      to: params.to,
      from: params.from,
      subject: params.subject,
      text: params.text || '',
      html: params.html || '',
    });
    console.log(`Email sent successfully to ${params.to}`);
    return true;
  } catch (error) {
    console.error('SendGrid email error:', error);
    return false;
  }
}

export async function sendInvitationEmail(
  to: string, 
  teamName: string, 
  inviterName: string, 
  role: string,
  inviteLink: string
): Promise<boolean> {
  const from = 'no-reply@moderateai.app'; // Replace with your verified sender
  const subject = `Invitation to join ${teamName} on ModerateAI`;
  
  const html = `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
      <h1 style="color: #4f46e5;">ModerateAI</h1>
    </div>
    <div style="padding: 20px; border: 1px solid #e5e7eb; border-radius: 5px; margin-top: 20px;">
      <h2>You've been invited to join ${teamName}</h2>
      <p>${inviterName} has invited you to join their team on ModerateAI as a ${role}.</p>
      <p>ModerateAI is an AI-powered customer support and community moderation platform that helps teams manage communications across multiple channels.</p>
      <div style="margin: 30px 0; text-align: center;">
        <a href="${inviteLink}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Accept Invitation</a>
      </div>
      <p>This invitation link will expire in 7 days.</p>
      <p>If you have any questions, please contact ${inviterName} directly.</p>
    </div>
    <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 0.8em;">
      <p>© ${new Date().getFullYear()} ModerateAI. All rights reserved.</p>
    </div>
  </div>
  `;
  
  const text = `You've been invited to join ${teamName} on ModerateAI by ${inviterName} as a ${role}. Please visit ${inviteLink} to accept the invitation. This link will expire in 7 days.`;
  
  return sendEmail({
    to,
    from,
    subject,
    html,
    text
  });
}