/**
 * Encrypt / decrypt database IDs for use in URLs.
 *
 * Uses AES-256-CBC with a server-side secret so raw cuid IDs are never
 * exposed in browser URLs. The output is URL-safe base64.
 *
 * Env: ID_SECRET — a 32+ character string. Falls back to a dev-only key.
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

const ALG = "aes-256-cbc";

/** Derive a 32-byte key from the secret (SHA-256). */
function getKey(): Buffer {
  const secret =
    process.env.ID_SECRET || "dev-only-pari-express-id-secret-32!";
  return createHash("sha256").update(secret).digest();
}

/** URL-safe base64 encode. */
function toUrlSafe(buf: Buffer): string {
  return buf.toString("base64url");
}

/** URL-safe base64 decode. */
function fromUrlSafe(s: string): Buffer {
  return Buffer.from(s, "base64url");
}

/**
 * Encrypt a plaintext ID → URL-safe token.
 *
 * Format: iv (16 bytes) + ciphertext, all base64url-encoded.
 */
export function encryptId(id: string): string {
  const key = getKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALG, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(id, "utf8"),
    cipher.final(),
  ]);
  // Prepend IV so we can decrypt later
  return toUrlSafe(Buffer.concat([iv, encrypted]));
}

/**
 * Decrypt a URL-safe token → original ID.
 *
 * Returns null if the token is invalid or tampered with.
 */
export function decryptId(token: string): string | null {
  try {
    const key = getKey();
    const raw = fromUrlSafe(token);
    if (raw.length < 17) return null; // iv (16) + at least 1 byte
    const iv = raw.subarray(0, 16);
    const ciphertext = raw.subarray(16);
    const decipher = createDecipheriv(ALG, key, iv);
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}
