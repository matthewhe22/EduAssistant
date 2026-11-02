import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Encrypts small secrets (API keys) for storage with AES-256-GCM.
 * The key is derived from SETTINGS_SECRET, a long random string set on the server.
 */
const VERSION = "v1";

function key(secret = process.env.SETTINGS_SECRET) {
  if (!secret || secret.length < 16) {
    throw new Error("SETTINGS_SECRET is not set (needs at least 16 characters), so API keys can't be stored safely.");
  }
  return createHash("sha256").update(secret).digest();
}

export function canEncrypt(secret = process.env.SETTINGS_SECRET) {
  return Boolean(secret && secret.length >= 16);
}

export function encryptSecret(plain: string, secret?: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

export function decryptSecret(stored: string, secret?: string): string {
  const [version, iv, tag, data] = stored.split(".");
  if (version !== VERSION || !iv || !tag || !data) throw new Error("Unrecognised encrypted value");
  const decipher = createDecipheriv("aes-256-gcm", key(secret), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

/** "sk-tx-…a1b2" style hint so the page can show which key is saved without revealing it. */
export const keyHint = (apiKey: string) => `${apiKey.slice(0, 6)}…${apiKey.slice(-4)}`;
