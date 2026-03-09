import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';

import { ProcessorService } from './processors/notification.processor';
import { IntegrationConfigMasterService } from './services/integration-config-master.service';
import {
  NotificationChannel,
  NotificationJobDto,
  WebhookEventType,
  WebhookPayloadDto,
} from './dto/webhook-payload.dto';
import { verifyWebhookSignature } from '../../common/canonical-json.util';
import { WEBHOOK_TEST_CONFIG } from '../../config/webhook-test.config';

// Correct BetterQueue import
import BetterQueue from 'better-queue';

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private queue: any;
  private readonly logger = new Logger(QueueService.name);

  constructor(
    private readonly processor: ProcessorService,
    private readonly integrationConfigMaster: IntegrationConfigMasterService,
  ) {
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
    const expectedToken =
      process.env.WEBHOOK_AUTH_TOKEN || WEBHOOK_TEST_CONFIG.WEBHOOK_AUTH_TOKEN;
    const webhookSecret =
      process.env.WEBHOOK_SECRET || WEBHOOK_TEST_CONFIG.WEBHOOK_SECRET;

    const hasValidToken =
      !!expectedToken &&
      authorization === `Bearer ${expectedToken}`;
    const hasValidSignature =
      !!webhookSecret &&
      !!signature &&
      verifyWebhookSignature(payload, signature, webhookSecret);

    if (!hasValidToken && !hasValidSignature) {
      if (!authorization && !signature) {
        throw new UnauthorizedException(
          'Missing authentication: provide Authorization Bearer token or X-Webhook-Signature',
        );
      }
      if (authorization && !hasValidToken) {
        throw new UnauthorizedException('Invalid authorization token');
      }
      if (signature && !hasValidSignature) {
        throw new UnauthorizedException('Invalid webhook signature');
      }
    }

    if (!payload.id || !payload.event_type || !payload.data) {
      throw new BadRequestException('Invalid webhook payload structure');
    }

    this.logger.log(`Webhook validation successful for: ${payload.id}`);
  }

/**
 * Enqueues notification jobs only for channels that have an active integration
 * for this event (from master DB). Falls back to default channels if none configured.
   */
  async enqueueNotificationJobs(payload: WebhookPayloadDto): Promise<void> {
    const mpin = payload.mpin ?? payload.data?.mpin;
    const companyId = payload.company_id ?? payload.data?.companyId ?? payload.data?.company_id;
    const branchId = payload.branch_id ?? payload.data?.branchId ?? payload.data?.branch_id ?? null;
    const correlationId = payload.id ?? `wh-${Date.now()}`;

    let channelStrings: string[] = [];
    if (mpin != null && companyId != null) {
      channelStrings = await this.integrationConfigMaster.getChannelsForEvent(
        String(mpin),
        Number(companyId),
        branchId != null ? Number(branchId) : null,
        payload.event_type,
      );
    }
    const defaultChannels = this.getNotificationChannels(payload.event_type);
    const channels: NotificationChannel[] =
      channelStrings.length > 0
        ? channelStrings.map((c) => c as NotificationChannel)
        : (mpin != null && companyId != null ? [] : defaultChannels);

    for (const channel of channels) {
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
        mpin,
        companyId,
        branchId,
        correlationId,
      };
      this.queue.push({ payload: notificationJob });
    }

    this.logger.log(
      `Enqueued ${channels.length} jobs for webhook: ${payload.id} (channels: ${channels.join(', ')})`,
    );
  }

  private getNotificationChannels(eventType: WebhookEventType): NotificationChannel[] {
    switch (eventType) {
      case WebhookEventType.POS_SAVE:
        return [NotificationChannel.SMS, NotificationChannel.EMAIL, NotificationChannel.WHATSAPP];
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
