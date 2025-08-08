# Scalable Webhook Notification System

A robust NestJS-based webhook system that processes POS events and sends notifications via SMS, Email, and WhatsApp using message queues for scalability and reliability.

## Architecture Overview

```
POS System → Webhook Endpoint → Message Queue → Worker Processes → Notification Services
                     ↓              ↓              ↓                    ↓
              [Validation]    [Redis/BullMQ]   [Processors]      [SMS/Email/WhatsApp]
```

## Features

- **Scalable Architecture**: Uses Redis + BullMQ for message queuing (modern TypeScript implementation)
- **Multiple Notification Channels**: SMS, Email, WhatsApp
- **Webhook Security**: Signature validation and auth token support
- **Retry Mechanism**: Automatic retries with exponential backoff
- **Provider Abstraction**: Easy to switch between different service providers
- **Priority Queuing**: Different priorities based on event types
- **Monitoring**: Comprehensive logging and error handling

## Installation

1. **Install dependencies**:
```bash
npm install
```

2. **Install additional packages** (if not already installed):
```bash
npm install @nestjs/bullmq bullmq @nestjs/config class-validator class-transformer
```

3. **Setup Redis** (required for message queuing):
   - Install Redis locally or use a cloud service
   - Default connection: `localhost:6379`

4. **Environment Configuration**:
```bash
cp .env.example .env
# Edit .env with your configuration
```

## Configuration

### Environment Variables

```env
# Server
PORT=3000
NODE_ENV=development

# Redis (Message Queue)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Webhook Security
WEBHOOK_SECRET=your-webhook-secret-here
WEBHOOK_AUTH_TOKEN=your-auth-token-here

# Default Recipients
SMS_DEFAULT_RECIPIENTS=+1234567890,+0987654321
EMAIL_DEFAULT_RECIPIENTS=admin@company.com,manager@company.com
WHATSAPP_DEFAULT_RECIPIENTS=+1234567890,+0987654321

# Service Providers
SMS_PROVIDER=twilio          # or 'aws'
EMAIL_PROVIDER=sendgrid      # or 'aws'
WHATSAPP_PROVIDER=twilio     # or 'business'
```

## Usage

### 1. Start the Application

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

### 2. Webhook Endpoints

#### Main POS Webhook
```
POST /webhooks/pos
Content-Type: application/json
Authorization: Bearer your-auth-token
X-Webhook-Signature: sha256-hash (optional)

{
  "id": "webhook_12345",
  "event_type": "pos_save",
  "timestamp": "2024-01-01T12:00:00Z",
  "source": "pos_system",
  "data": {
    "transactionId": "TXN_67890",
    "amount": 125.50,
    "customerName": "John Doe",
    "customerPhone": "+1234567890",
    "customerEmail": "john.doe@example.com"
  }
}
```

#### Test Webhook
```
POST /webhooks/test
Content-Type: application/json

{
  "message": "Test webhook data"
}
```

### 3. Event Types Supported

- `pos_save`: POS transaction recorded
- `order_create`: New order created
- `order_update`: Order status updated
- `payment_complete`: Payment processed

### 4. Testing

#### Get Sample Payloads
```bash
GET /test/webhook-sample
```

#### Simulate Webhook Processing
```bash
POST /test/simulate-webhook
Content-Type: application/json

{
  "id": "test_webhook_123",
  "event_type": "pos_save",
  "timestamp": "2024-01-01T12:00:00Z",
  "data": {
    "transactionId": "TEST_TXN_123",
    "amount": 50.00,
    "customerEmail": "test@example.com"
  }
}
```

## Notification Channels

### SMS Service
- **Providers**: Twilio, AWS SNS
- **Features**: Template-based messages, phone number formatting
- **Configuration**: Set `SMS_PROVIDER` in environment

### Email Service
- **Providers**: SendGrid, AWS SES
- **Features**: HTML templates, order details formatting
- **Configuration**: Set `EMAIL_PROVIDER` in environment

### WhatsApp Service
- **Providers**: Twilio WhatsApp, WhatsApp Business API
- **Features**: Rich formatting, emoji support, order item lists
- **Configuration**: Set `WHATSAPP_PROVIDER` in environment

## Queue Management

### Job Priorities
1. **Payment Complete** (Priority 1) - Highest
2. **Order Create** (Priority 2)
3. **POS Save** (Priority 3)
4. **Order Update** (Priority 4) - Lowest

### Retry Configuration
- **Attempts**: 3 retries per job
- **Backoff**: Exponential (2s, 4s, 8s)
- **Cleanup**: Keep 100 completed, 50 failed jobs

## Security

### Webhook Validation
1. **Authorization Header**: `Bearer token` validation
2. **Signature Validation**: HMAC-SHA256 signature verification
3. **Payload Validation**: DTO validation with class-validator

### Example Signature Generation (Node.js)
```javascript
const crypto = require('crypto');
const payload = JSON.stringify(webhookData);
const signature = crypto
  .createHmac('sha256', process.env.WEBHOOK_SECRET)
  .update(payload)
  .digest('hex');
```

## Monitoring and Logging

### Queue Dashboard
Access BullMQ dashboard (if configured):
```
http://localhost:3000/admin/queues
```

### Log Levels
- **INFO**: Successful operations
- **ERROR**: Failed operations with retry
- **WARN**: Non-critical issues

### Key Metrics to Monitor
- Queue size and processing rate
- Failed job count
- Notification delivery success rate
- API response times

## Scaling Considerations

### Horizontal Scaling
- Run multiple worker instances
- Share Redis queue between instances
- Load balance webhook endpoints

### Performance Optimization
- Adjust queue concurrency settings
- Implement rate limiting for external APIs
- Use connection pooling for Redis

### High Availability
- Redis clustering or sentinel setup
- Multiple webhook endpoint replicas
- Circuit breaker pattern for external services

## Provider Implementation

### Adding New SMS Provider
```typescript
class CustomSmsProvider implements SmsProvider {
  async sendSms(to: string, message: string): Promise<boolean> {
    // Implement your SMS provider logic
    return true;
  }
}
```

### Adding New Email Provider
```typescript
class CustomEmailProvider implements EmailProvider {
  async sendEmail(to: string[], subject: string, content: string): Promise<boolean> {
    // Implement your email provider logic
    return true;
  }
}
```

## Error Handling

### Common Issues
1. **Redis Connection**: Ensure Redis is running and accessible
2. **Provider API Keys**: Verify all API keys are correctly configured
3. **Queue Stalling**: Monitor for stuck jobs and restart workers if needed

### Troubleshooting
```bash
# Check Redis connection
redis-cli ping

# View queue status in Redis
redis-cli
> KEYS bull:notification-queue:*

# Monitor application logs
npm run start:dev
```

## Development

### Project Structure
```
src/
├── modules/
│   ├── webhook/
│   │   ├── dto/
│   │   ├── processors/
│   │   ├── services/
│   │   ├── webhook.controller.ts
│   │   ├── webhook.service.ts
│   │   └── webhook.module.ts
│   ├── notification/
│   └── test/
├── config/
└── main.ts
```

### Running Tests
```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## Production Deployment

### Environment Setup
1. Configure production Redis instance
2. Set up monitoring and alerting
3. Configure provider API keys
4. Set appropriate log levels

### Health Checks
- Redis connectivity
- Queue processing status
- Provider API availability

### Backup and Recovery
- Redis data persistence
- Configuration backup
- Queue job recovery procedures

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## License

This project is licensed under the MIT License.
