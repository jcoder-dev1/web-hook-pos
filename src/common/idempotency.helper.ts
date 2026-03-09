/**
 * Idempotency: prevent duplicate sends for the same (webhookId, channel).
 * We consider a job already processed if we have a successful delivery log
 * for this webhookId + channel within the last 24 hours.
 */
export const IDEMPOTENCY_WINDOW_HOURS = 24;

export function getIdempotencyWindowMs(): number {
  return IDEMPOTENCY_WINDOW_HOURS * 60 * 60 * 1000;
}
