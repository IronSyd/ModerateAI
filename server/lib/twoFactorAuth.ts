import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { randomBytes } from 'crypto';
import { User } from '@shared/schema';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Generate a new TOTP secret for a user
 */
export function generateSecret(username: string) {
  const secret = speakeasy.generateSecret({
    name: `ModerateAI:${username}`
  });
  
  return {
    secret: secret.base32,
    otpauth_url: secret.otpauth_url
  };
}

/**
 * Generate a QR code for the TOTP secret
 */
export async function generateQRCode(otpauthUrl: string): Promise<string> {
  try {
    return await QRCode.toDataURL(otpauthUrl);
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Verify a TOTP token
 */
export function verifyTOTP(secret: string, token: string): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 1 // Allow a time skew of ±30 seconds
  });
}

/**
 * Generate backup codes for a user
 */
export function generateBackupCodes(count = 10): string[] {
  const codes: string[] = [];
  
  for (let i = 0; i < count; i++) {
    // Generate a random 8-character code and format it as XXXX-XXXX
    const code = randomBytes(4).toString('hex').toUpperCase();
    codes.push(`${code.slice(0, 4)}-${code.slice(4, 8)}`);
  }
  
  return codes;
}

/**
 * Verify a backup code
 */
export async function verifyBackupCode(user: User, code: string): Promise<boolean> {
  if (!user.twoFactorBackupCodes) {
    return false;
  }
  
  // Convert from JSON to array if needed
  const backupCodes = Array.isArray(user.twoFactorBackupCodes) 
    ? user.twoFactorBackupCodes 
    : JSON.parse(String(user.twoFactorBackupCodes));
  
  // Check if the provided code exists in the backup codes
  const codeIndex = backupCodes.indexOf(code);
  if (codeIndex === -1) {
    return false;
  }
  
  // Remove the used backup code
  backupCodes.splice(codeIndex, 1);
  
  // Update the user's backup codes
  const { storage } = await import('../storage');
  await storage.updateUser(user.id, { twoFactorBackupCodes: backupCodes });
  
  return true;
}

/**
 * Enable 2FA for a user
 */
export async function enable2FA(userId: number, secret: string): Promise<void> {
  // Generate backup codes
  const backupCodes = generateBackupCodes();
  
  // Update the user record
  await db.update(users)
    .set({
      twoFactorSecret: secret,
      twoFactorEnabled: true,
      twoFactorBackupCodes: backupCodes
    })
    .where(eq(users.id, userId));
}

/**
 * Disable 2FA for a user
 */
export async function disable2FA(userId: number): Promise<void> {
  await db.update(users)
    .set({
      twoFactorSecret: null,
      twoFactorEnabled: false,
      twoFactorBackupCodes: null,
      twoFactorRecoveryToken: null
    })
    .where(eq(users.id, userId));
}

/**
 * Generate new backup codes for a user
 */
export async function regenerateBackupCodes(userId: number): Promise<string[]> {
  const backupCodes = generateBackupCodes();
  
  await db.update(users)
    .set({ twoFactorBackupCodes: backupCodes })
    .where(eq(users.id, userId));
  
  return backupCodes;
}