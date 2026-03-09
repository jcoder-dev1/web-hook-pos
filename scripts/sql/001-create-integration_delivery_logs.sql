-- Run this against the web-hook-pos database (same DB as webhook_logs)
-- Usage: psql -h <host> -U <user> -d <webhook_db_name> -f scripts/sql/001-create-integration_delivery_logs.sql

-- Optional: create webhook_logs if it does not exist
CREATE TABLE IF NOT EXISTS webhook_logs (
  "ID" SERIAL PRIMARY KEY,
  "RecordID" VARCHAR(255) NULL,
  "Status" VARCHAR(20) NOT NULL,
  "Type" VARCHAR(50) NOT NULL,
  "Message" TEXT NULL,
  "CreatedDate" TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
);

-- Integration delivery logs for per-attempt tracing
CREATE TABLE IF NOT EXISTS integration_delivery_logs (
  "ID" SERIAL PRIMARY KEY,
  "WebhookId" VARCHAR(100) NOT NULL,
  "Channel" VARCHAR(20) NOT NULL,
  "Provider" VARCHAR(50) NULL,
  "Status" VARCHAR(20) NOT NULL,
  "RecipientMasked" VARCHAR(100) NULL,
  "ExternalId" VARCHAR(200) NULL,
  "ErrorMessage" TEXT NULL,
  "RetryCount" INTEGER NOT NULL DEFAULT 0,
  "CorrelationId" VARCHAR(100) NULL,
  "CreatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "IDX_integration_delivery_logs_webhook_channel"
  ON integration_delivery_logs ("WebhookId", "Channel");
CREATE INDEX IF NOT EXISTS "IDX_integration_delivery_logs_correlation"
  ON integration_delivery_logs ("CorrelationId");
