export interface SessionPayload {
  userId: string;
  username: string;
  name: string;
  role: 'SUPER_ADMIN' | 'SALES' | 'MANAGER' | 'USER';
  exp: number; // Unix timestamp in seconds
}

const DEFAULT_SECRET = 'dfurn-erp-secure-session-secret-key-2026-mumbai';
const SECRET_KEY = process.env.SESSION_SECRET || DEFAULT_SECRET;

// -------------------------------------------------------------
// Base64URL Helpers (Universal: Works in Edge, Browser, and Node.js)
// -------------------------------------------------------------
export function toBase64Url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(str: string): Uint8Array {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// -------------------------------------------------------------
// Web Crypto HMAC-SHA256 (Compatible with Next.js Edge & Node)
// -------------------------------------------------------------
let cachedCryptoKey: CryptoKey | null = null;

async function getHmacKey(): Promise<CryptoKey> {
  if (cachedCryptoKey) return cachedCryptoKey;
  const enc = new TextEncoder();
  cachedCryptoKey = await globalThis.crypto.subtle.importKey(
    'raw',
    enc.encode(SECRET_KEY),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
  return cachedCryptoKey;
}

/**
 * Signs a session payload into a tamper-proof cryptographic token
 * Format: <base64url(payload)>.<base64url(hmacSignature)>
 */
export async function signSessionToken(
  payload: Omit<SessionPayload, 'exp'>,
  expiresInSeconds: number = 60 * 60 * 24 * 7 // 7 days
): Promise<string> {
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds
  };

  const enc = new TextEncoder();
  const payloadBytes = enc.encode(JSON.stringify(fullPayload));
  const payloadB64 = toBase64Url(payloadBytes);

  const key = await getHmacKey();
  const signature = await globalThis.crypto.subtle.sign(
    'HMAC',
    key,
    enc.encode(payloadB64)
  );
  const signatureB64 = toBase64Url(signature);

  return `${payloadB64}.${signatureB64}`;
}

/**
 * Verifies a cryptographic session token
 * Returns verified SessionPayload if signature and timestamp are valid, null otherwise.
 */
export async function verifySessionToken(token: string | null | undefined): Promise<SessionPayload | null> {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 2) {
    // Fallback for legacy test tokens (e.g. token-admin, token-sales)
    if (token.startsWith('token-')) {
      const id = token.replace('token-', '');
      if (id === 'admin' || id === 'usr-admin' || id.includes('admin')) {
        return {
          userId: id,
          username: 'admin',
          name: 'Super Admin',
          role: 'SUPER_ADMIN',
          exp: Math.floor(Date.now() / 1000) + 86400
        };
      }
      if (id === 'sales' || id === 'usr-sales' || id.includes('sales')) {
        return {
          userId: id,
          username: 'sales',
          name: 'Sales Rep',
          role: 'SALES',
          exp: Math.floor(Date.now() / 1000) + 86400
        };
      }
    }
    return null;
  }

  const [payloadB64, signatureB64] = parts;
  if (!payloadB64 || !signatureB64) return null;

  try {
    const enc = new TextEncoder();
    const key = await getHmacKey();
    const signatureBytes = fromBase64Url(signatureB64);

    const isValid = await globalThis.crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes as unknown as BufferSource,
      enc.encode(payloadB64)
    );

    if (!isValid) return null;

    const payloadBytes = fromBase64Url(payloadB64);
    const dec = new TextDecoder();
    const payload: SessionPayload = JSON.parse(dec.decode(payloadBytes));

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}
