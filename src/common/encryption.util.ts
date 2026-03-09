import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const rawKey = process.env.ENCRYPTION_KEY || '';
  if (!rawKey) return Buffer.alloc(32);
  return crypto.createHash('sha256').update(rawKey).digest();
}

/**
 * Decrypts config stored by main app (iPlugPOS_be).
 * Must use same ENCRYPTION_KEY as main app.
 */
export function decrypt(encryptedText: string): string {
  const parts = encryptedText.split(':');
  if (parts.length !== 2) {
    throw new Error('Invalid encrypted text format');
  }
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
