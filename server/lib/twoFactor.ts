import { randomInt } from "crypto";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { sendEmail } from "../emailService";

export async function generateTwoFactorCode(userId: number): Promise<string> {
  // Generate 6-digit code
  const code = randomInt(100000, 999999).toString();
  
  // Set expiry to 10 minutes from now
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + 10);
  
  // Store code in database
  await db
    .update(users)
    .set({
      twoFactorCode: code,
      twoFactorCodeExpiry: expiry,
    })
    .where(eq(users.id, userId));
    
  return code;
}

export async function verifyTwoFactorCode(userId: number, code: string): Promise<boolean> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId));
    
  if (!user || !user.twoFactorCode || !user.twoFactorCodeExpiry) {
    return false;
  }
  
  // Check if code matches and hasn't expired
  const now = new Date();
  const isValid = user.twoFactorCode === code && user.twoFactorCodeExpiry > now;
  
  if (isValid) {
    // Clear the code after successful verification
    await db
      .update(users)
      .set({
        twoFactorCode: null,
        twoFactorCodeExpiry: null,
      })
      .where(eq(users.id, userId));
  }
  
  return isValid;
}

export async function sendTwoFactorCode(user: any): Promise<void> {
  const code = await generateTwoFactorCode(user.id);
  
  const emailContent = {
    to: user.email,
    from: "noreply@moderateai.com", // This will be overridden by SENDGRID_SENDER_EMAIL
    subject: "Your ModerateAI 2FA Code",
    text: `Your two-factor authentication code is: ${code}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this code, please ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Your ModerateAI 2FA Code</h2>
        <p style="font-size: 16px; color: #666;">Your two-factor authentication code is:</p>
        <div style="background-color: #f0f0f0; padding: 20px; text-align: center; margin: 20px 0;">
          <h1 style="color: #333; letter-spacing: 5px; margin: 0;">${code}</h1>
        </div>
        <p style="font-size: 14px; color: #666;">This code will expire in 10 minutes.</p>
        <p style="font-size: 14px; color: #999;">If you didn't request this code, please ignore this email.</p>
      </div>
    `,
  };
  
  await sendEmail(emailContent);
}