import * as crypto from 'crypto';

/**
 * Canonical JSON stringify (sorted keys) so HMAC signature is deterministic
 * across sender and receiver.
 */
export function canonicalStringify(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map((item) => canonicalStringify(item)).join(',') + ']';
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = keys.map(
    (k) =>
      JSON.stringify(k) +
      ':' +
      canonicalStringify((obj as Record<string, unknown>)[k]),
  );
  return '{' + pairs.join(',') + '}';
}

export function createWebhookSignature(payload: unknown, secret: string): string {
  const payloadString = canonicalStringify(payload);
  return crypto
    .createHmac('sha256', secret)
    .update(payloadString)
    .digest('hex');
}

export function verifyWebhookSignature(
  payload: unknown,
  signature: string,
  secret: string,
): boolean {
  if (!signature || !secret) return false;
  const expected = createWebhookSignature(payload, secret);
  const sig = signature.startsWith('sha256=') ? signature.slice(7) : signature;
  if (expected.length !== sig.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sig, 'hex'));
  } catch {
    return false;
  }
}
