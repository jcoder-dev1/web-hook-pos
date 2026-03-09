/**
 * Hardcoded webhook config for LOCAL TESTING.
 * Used when env vars are not set. Replace with .env in production.
 *
 * Flow: Main app sends POST here → we validate with same token/secret.
 * Config is read from master DB (third_party_integrations); logs written to master DB.
 * Set MASTER_DB_* and ENCRYPTION_KEY to match main app for config decryption.
 */
export const WEBHOOK_TEST_CONFIG = {
  /** Bearer token - MUST match main app WEBHOOK_AUTH_TOKEN */
  WEBHOOK_AUTH_TOKEN: 'test-webhook-auth-token-12345',

  /** HMAC secret for X-Webhook-Signature - MUST match main app WEBHOOK_SECRET */
  WEBHOOK_SECRET: 'test-webhook-secret-67890',

  /** Main app base URL (optional; not used for config - config comes from master DB) */
  MAIN_APP_URL: 'http://localhost:3000',

  /** Shared key for x-integration-api-key (optional; only if using GET /integrations/config) */
  INTEGRATION_CONFIG_API_KEY: 'test-integration-config-api-key-abcde',
} as const;
