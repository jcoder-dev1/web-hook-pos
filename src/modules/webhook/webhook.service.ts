import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';

import { ProcessorService } from './processors/notification.processor';
import {
  NotificationChannel,
  NotificationJobDto,
  WebhookEventType,
  WebhookPayloadDto,
} from './dto/webhook-payload.dto';

// Correct BetterQueue import
const BetterQueue = require('better-queue');

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private queue: any;
  private readonly logger = new Logger(QueueService.name);

  constructor(private readonly processor: ProcessorService) {
    this.queue = new BetterQueue(
      async (job, done) => {
        console.log('Processing job:', job);

        try {
          const result = await this.processor.process(job);
          console.log('Job success:', job, result);
          done(null, result);
        } catch (err) {
          console.error('Job failed:', job, err);
          done(err);
        }
      },
      {
        concurrent: 5,
        maxRetries: 3,
        retryDelay: 2000,
      },
    );
  }

  onModuleInit() {
    this.queue.on('task_finish', (taskId, result) => {
      this.logger.log(`✅ task ${taskId} finished: ${JSON.stringify(result)}`);
    });
    this.queue.on('task_failed', (taskId, err) => {
      this.logger.error(`❌ task ${taskId} failed: ${err?.message || err}`);
    });
  }

  onModuleDestroy() {
    if (this.queue) {
      this.queue.destroy(() => {
        this.logger.log('Queue destroyed and persisted store closed.');
      });
    }
  }

  enqueue(payload: any) {
    return this.queue.push({ payload });
  }

  async validateWebhook(
    payload: WebhookPayloadDto, 
    signature?: string, 
    authorization?: string,
  ): Promise<void> {
    // Validate authorization header
    if (authorization) {
      const expectedToken = process.env.WEBHOOK_AUTH_TOKEN || 'your-auth-token';
      if (authorization !== `Bearer ${expectedToken}`) {
        throw new UnauthorizedException('Invalid authorization token');
      }
    }

    // Validate webhook signature if provided
    // if (signature) {
    //   const expectedSignature = this.generateSignature(JSON.stringify(payload));
    //   if (signature !== expectedSignature) {
    //     throw new UnauthorizedException('Invalid webhook signature');
    //   }
    // }

    // Validate payload structure
    if (!payload.id || !payload.event_type || !payload.data) {
      throw new BadRequestException('Invalid webhook payload structure');
    }

    this.logger.log(`Webhook validation successful for: ${payload.id}`);
  }

/**
 * Enqueues notification jobs for each relevant channel based on the webhook event type.
 * @param payload The webhook payload containing event and data.
 */
async enqueueNotificationJobs(payload: WebhookPayloadDto): Promise<void> {
    const jobPromises: Promise<any>[] = [];

    // Determine which notification channels to use based on event type
    const channels = this.getNotificationChannels(payload.event_type);

    for (const channel of channels) {
        // Build the notification job data
        const notificationJob: NotificationJobDto = {
        recordId: payload.id,
        name: `send-${channel}`,
            webhookId: payload.id,
            eventType: payload.event_type,
            channel,
            data: payload.data,
            metadata: {
                retryCount: 0,
                priority: this.getJobPriority(payload.event_type),
                delay: 0,
            },
        };

      this.queue.push(notificationJob);
      
    }

    this.logger.log(
      `Enqueued ${channels.length} jobs for webhook: ${payload.id}`,
    );
  }

  private getNotificationChannels(eventType: WebhookEventType): NotificationChannel[] {
    switch (eventType) {
      case WebhookEventType.POS_SAVE:
        return [NotificationChannel.SMS, NotificationChannel.EMAIL];
      case WebhookEventType.ORDER_CREATE:
        return [
          NotificationChannel.SMS,
          NotificationChannel.EMAIL,
          NotificationChannel.WHATSAPP,
        ];
      case WebhookEventType.ORDER_UPDATE:
        return [NotificationChannel.EMAIL];
      case WebhookEventType.PAYMENT_COMPLETE:
        return [NotificationChannel.SMS, NotificationChannel.EMAIL];
      default:
        return [NotificationChannel.EMAIL];
    }
  }

  private getJobPriority(eventType: WebhookEventType): number {
    switch (eventType) {
      case WebhookEventType.PAYMENT_COMPLETE:
        return 1; // Highest priority
      case WebhookEventType.ORDER_CREATE:
        return 2;
      case WebhookEventType.POS_SAVE:
        return 3;
      case WebhookEventType.ORDER_UPDATE:
        return 4; // Lowest priority
      default:
        return 5;
    }
  }
}
