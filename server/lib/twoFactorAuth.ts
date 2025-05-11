import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';

// Generate a new secret key for 2FA
export function generateSecret(label: string, issuer: string = 'ModerateAI') {
  const secret = speakeasy.generateSecret({
    name: `${issuer}:${label}`,
    issuer
  });
  
  return {
    otpAuthUrl: secret.otpauth_url,
    base32: secret.base32
  };
}

// Generate QR code image data URL from OTP auth URL
export async function generateQRCode(otpAuthUrl: string): Promise<string> {
  try {
    return await QRCode.toDataURL(otpAuthUrl);
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
}

// Verify a token against the secret
export function verifyToken(token: string, secret: string): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 1 // Allow 1 time step before/after for clock drift (30 seconds)
  });
}

// Generate backup codes
export function generateBackupCodes(count: number = 10): string[] {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(`${code.substring(0, 4)}-${code.substring(4)}`);
  }
  return codes;
}

// Generate a recovery token
export function generateRecoveryToken(): string {
  return crypto.randomBytes(20).toString('hex');
}

// Verify if a team member should be required to use 2FA
export function shouldRequire2FA(
  user: { role: string, twoFactorEnabled: boolean }, 
  teamSettings: { securitySettings: { twoFactorRequired: boolean } }
): boolean {
  // Admin users are exempt from 2FA requirement (they can always access)
  if (user.role === 'admin') {
    return false;
  }
  
  // Check if user already has 2FA enabled
  if (user.twoFactorEnabled) {
    return false;
  }
  
  // Check if team settings require 2FA
  return teamSettings?.securitySettings?.twoFactorRequired === true;
}