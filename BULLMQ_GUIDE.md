# BullMQ Implementation Guide

This implementation follows the official NestJS BullMQ documentation: https://docs.nestjs.com/techniques/queues#bullmq-installation

## Key Changes from Bull to BullMQ

### 1. Package Dependencies
- **Old**: `@nestjs/bull`, `bull`, `ioredis`
- **New**: `@nestjs/bullmq`, `bullmq`

### 2. Configuration Changes
```typescript
// Old Bull configuration
BullModule.forRoot({
  redis: {
    host: 'localhost',
    port: 6379,
  },
})

// New BullMQ configuration
BullModule.forRoot({
  connection: {
    host: 'localhost',
    port: 6379,
  },
})
```

### 3. Processor Implementation
```typescript
// Old Bull processor pattern
@Processor('notification-queue')
export class NotificationProcessor {
  @Process('send-sms')
  async handleSms(job: Job<NotificationJobDto>) {
    // process job
  }
  
  @Process('send-email')
  async handleEmail(job: Job<NotificationJobDto>) {
    // process job
  }
}

// New BullMQ processor pattern
@Processor('notification-queue')
export class NotificationProcessor extends WorkerHost {
  async process(job: Job<NotificationJobDto>): Promise<any> {
    switch (job.name) {
      case 'send-sms':
        await this.handleSms(job.data);
        break;
      case 'send-email':
        await this.handleEmail(job.data);
        break;
    }
  }
}
```

## Architecture Benefits

### BullMQ Advantages
1. **Modern TypeScript**: Better type safety and IDE support
2. **Better Performance**: Improved Redis usage and memory efficiency
3. **Enhanced Features**: Better flow control, parent-child jobs
4. **Active Development**: Latest features and bug fixes
5. **Improved Observability**: Better monitoring and debugging tools

### Queue Processing Flow
```
Webhook Request → Validation → Queue Job → Worker Process → Notification Service
      ↓              ↓           ↓            ↓                    ↓
  [Fast Response] [Security] [BullMQ] [Background Worker] [SMS/Email/WhatsApp]
```

## Implementation Details

### 1. Queue Configuration
```typescript
// src/config/app-config.module.ts
BullModule.forRootAsync({
  inject: [ConfigService],
  useFactory: async (configService: ConfigService) => ({
    connection: {
      host: configService.get('REDIS_HOST', 'localhost'),
      port: configService.get('REDIS_PORT', 6379),
      password: configService.get('REDIS_PASSWORD'),
      db: configService.get('REDIS_DB', 0),
    },
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  }),
})
```

### 2. Job Producer (Webhook Service)
```typescript
// src/modules/webhook/webhook.service.ts
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class WebhookService {
  constructor(
    @InjectQueue('notification-queue') private notificationQueue: Queue,
  ) {}

  async enqueueNotificationJobs(payload: WebhookPayloadDto): Promise<void> {
    const jobOptions = {
      priority: this.getJobPriority(payload.event_type),
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    };

    await this.notificationQueue.add('send-sms', jobData, jobOptions);
  }
}
```

### 3. Job Consumer (Processor)
```typescript
// src/modules/webhook/processors/notification.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor('notification-queue')
export class NotificationProcessor extends WorkerHost {
  async process(job: Job<NotificationJobDto>): Promise<any> {
    switch (job.name) {
      case 'send-sms':
        await this.smsService.sendNotification(job.data);
        break;
      case 'send-email':
        await this.emailService.sendNotification(job.data);
        break;
      case 'send-whatsapp':
        await this.whatsappService.sendNotification(job.data);
        break;
    }
    
    return { success: true, webhookId: job.data.webhookId };
  }
}
```

## Job Processing Features

### Priority System
Jobs are processed based on priority:
1. **Payment Complete** (Priority 1) - Highest
2. **Order Create** (Priority 2)
3. **POS Save** (Priority 3)
4. **Order Update** (Priority 4) - Lowest

### Retry Mechanism
- **Attempts**: 3 retries per job
- **Backoff**: Exponential (2s, 4s, 8s)
- **Strategy**: Automatic retry with increasing delays

### Job Options
```typescript
const jobOptions = {
  priority: 1,           // Higher priority (1 = highest)
  attempts: 3,           // Retry attempts
  delay: 0,              // Delay before processing (ms)
  backoff: {
    type: 'exponential', // Backoff strategy
    delay: 2000,         // Base delay (ms)
  },
  removeOnComplete: 100, // Keep 100 completed jobs
  removeOnFail: 50,      // Keep 50 failed jobs
};
```

## Monitoring and Health Checks

### Health Endpoint
```bash
GET /health
```

Returns:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00Z",
  "services": {
    "redis": { "status": "connected" },
    "queue": { "status": "running", "name": "notification-queue" }
  }
}
```

### Queue Status
```bash
GET /health/queue
```

Returns:
```json
{
  "status": "ok",
  "queue": "notification-queue",
  "counts": {
    "waiting": 0,
    "active": 2,
    "completed": 150,
    "failed": 3
  }
}
```

## Development vs Production

### Development Setup
```env
NODE_ENV=development
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Production Considerations
1. **Redis Clustering**: For high availability
2. **Multiple Workers**: Scale horizontally
3. **Monitoring**: Use BullMQ dashboard or custom metrics
4. **Error Handling**: Implement dead letter queues
5. **Rate Limiting**: Prevent API abuse

## Troubleshooting

### Common Issues

1. **Module Import Errors**
   - Ensure `@nestjs/bullmq` and `bullmq` are installed
   - Check import statements use correct package names

2. **Redis Connection Issues**
   - Verify Redis is running: `redis-cli ping`
   - Check connection settings in environment variables

3. **Job Processing Stuck**
   - Monitor queue status: `/health/queue`
   - Check worker logs for errors
   - Restart application if needed

### Performance Tips

1. **Job Size**: Keep job payloads small and serializable
2. **Concurrency**: Adjust based on external API limits
3. **Memory Usage**: Monitor Redis memory consumption
4. **Connection Pooling**: Use connection pooling for database operations

## Migration from Bull

If migrating from Bull to BullMQ:

1. **Update Dependencies**:
   ```bash
   npm uninstall @nestjs/bull bull
   npm install @nestjs/bullmq bullmq
   ```

2. **Update Imports**:
   ```typescript
   // Change all imports from '@nestjs/bull' to '@nestjs/bullmq'
   // Change all imports from 'bull' to 'bullmq'
   ```

3. **Update Configuration**:
   - Change `redis` to `connection` in BullModule config
   - Update processor classes to extend `WorkerHost`
   - Replace `@Process()` decorators with switch statements

4. **Test Thoroughly**:
   - Verify job processing works correctly
   - Check retry mechanisms
   - Monitor performance and memory usage

## Additional Resources

- [NestJS BullMQ Documentation](https://docs.nestjs.com/techniques/queues#bullmq-installation)
- [BullMQ Official Documentation](https://docs.bullmq.io/)
- [Redis Configuration Guide](https://redis.io/documentation)
- [Job Patterns and Best Practices](https://docs.bullmq.io/patterns/named-processor)
