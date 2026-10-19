import { cookies } from 'next/headers';
import crypto from 'crypto';
import {
  SessionPayload,
  signSessionToken,
  verifySessionToken,
  toBase64Url,
  fromBase64Url
} from './session';

export type { SessionPayload };
export { signSessionToken, verifySessionToken, toBase64Url, fromBase64Url };

/**
 * Extracts and verifies the session from cookies or an HTTP Request
 */
export async function getAuthenticatedSession(req?: Request): Promise<SessionPayload | null> {
  let token: string | undefined;

  if (req) {
    const cookieHeader = req.headers.get('cookie') || '';
    const match = cookieHeader.match(/(?:^|;\s*)auth_token=([^;]+)/);
    if (match) token = match[1];
  }

  if (!token) {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get('auth_token')?.value;
    } catch {
      // Cookies not accessible in current context
    }
  }

  if (!token) return null;

  // 1. Check cryptographic signature and legacy test tokens
  const verified = await verifySessionToken(token);
  if (verified) return verified;

  return null;
}

// -------------------------------------------------------------
// Password Hashing & Verification (Salted PBKDF2)
// -------------------------------------------------------------
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `pbkdf2:${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHashOrPlain: string): boolean {
  if (!storedHashOrPlain || !password) return false;

  // Hashed format: pbkdf2:<salt>:<hash>
  if (storedHashOrPlain.startsWith('pbkdf2:')) {
    const parts = storedHashOrPlain.split(':');
    if (parts.length !== 3) return false;
    const [, salt, originalHash] = parts;
    const computedHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    
    // Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(Buffer.from(computedHash, 'hex'), Buffer.from(originalHash, 'hex'));
  }

  // Plaintext backwards compatibility
  return storedHashOrPlain === password || storedHashOrPlain.trim() === password.trim();
}
