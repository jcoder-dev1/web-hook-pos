// import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
// import { InjectQueue } from '@nestjs/bullmq';
// import { Queue } from 'bullmq';
// import * as crypto from 'crypto';
// import { WebhookPayloadDto, NotificationJobDto, WebhookEventType, NotificationChannel } from './dto/webhook-payload.dto';

// @Injectable()
// export class WebhookService {
//   private readonly logger = new Logger(WebhookService.name);
//   private readonly webhookSecret = process.env.WEBHOOK_SECRET || 'your-webhook-secret';

//   constructor(
//     @InjectQueue('notification-queue') private notificationQueue: Queue,
//   ) {}

//   async validateWebhook(
//     payload: WebhookPayloadDto,
//     signature?: string,
//     authorization?: string
//   ): Promise<void> {
//     // Validate authorization header
//     if (authorization) {
//       const expectedToken = process.env.WEBHOOK_AUTH_TOKEN || 'your-auth-token';
//       if (authorization !== `Bearer ${expectedToken}`) {
//         throw new UnauthorizedException('Invalid authorization token');
//       }
//     }

//     // Validate webhook signature if provided
//     // if (signature) {
//     //   const expectedSignature = this.generateSignature(JSON.stringify(payload));
//     //   if (signature !== expectedSignature) {
//     //     throw new UnauthorizedException('Invalid webhook signature');
//     //   }
//     // }

//     // Validate payload structure
//     if (!payload.id || !payload.event_type || !payload.data) {
//       throw new BadRequestException('Invalid webhook payload structure');
//     }

//     this.logger.log(`Webhook validation successful for: ${payload.id}`);
//   }

// /**
//  * Enqueues notification jobs for each relevant channel based on the webhook event type.
//  * @param payload The webhook payload containing event and data.
//  */
// async enqueueNotificationJobs(payload: WebhookPayloadDto): Promise<void> {
//     const jobPromises: Promise<any>[] = [];

//     // Determine which notification channels to use based on event type
//     const channels = this.getNotificationChannels(payload.event_type);

//     for (const channel of channels) {
//         // Build the notification job data
//         const notificationJob: NotificationJobDto = {
//             webhookId: payload.id,
//             eventType: payload.event_type,
//             channel,
//             data: payload.data,
//             metadata: {
//                 retryCount: 0,
//                 priority: this.getJobPriority(payload.event_type),
//                 delay: 0,
//             },
//         };

//         // Configure job options for the queue (priority, retries, backoff, etc.)
//         const jobOptions = {
//             priority: notificationJob.metadata?.priority || 5,
//             attempts: 3,
//             backoff: {
//                 type: 'exponential',
//                 delay: 2000,
//             },
//             removeOnComplete: 100,
//             removeOnFail: 50,
//         };

//         // Add the job to the queue for the specific channel
//         const jobPromise = this.notificationQueue.add(
//             `send-${channel}`,
//             notificationJob,
//             jobOptions
//         );

//         jobPromises.push(jobPromise);
//     }

//     // Wait for all jobs to be enqueued
//     await Promise.all(jobPromises);
//     this.logger.log(`Enqueued ${jobPromises.length} notification jobs for webhook: ${payload.id}`);
// }

//   private generateSignature(payload: string): string {
//     return crypto
//       .createHmac('sha256', this.webhookSecret)
//       .update(payload)
//       .digest('hex');
//   }

//   private getNotificationChannels(eventType: WebhookEventType): NotificationChannel[] {
//     switch (eventType) {
//       case WebhookEventType.POS_SAVE:
//         return [NotificationChannel.SMS, NotificationChannel.EMAIL];
//       case WebhookEventType.ORDER_CREATE:
//         return [NotificationChannel.SMS, NotificationChannel.EMAIL, NotificationChannel.WHATSAPP];
//       case WebhookEventType.ORDER_UPDATE:
//         return [NotificationChannel.EMAIL];
//       case WebhookEventType.PAYMENT_COMPLETE:
//         return [NotificationChannel.SMS, NotificationChannel.EMAIL];
//       default:
//         return [NotificationChannel.EMAIL];
//     }
//   }

//   private getJobPriority(eventType: WebhookEventType): number {
//     switch (eventType) {
//       case WebhookEventType.PAYMENT_COMPLETE:
//         return 1; // Highest priority
//       case WebhookEventType.ORDER_CREATE:
//         return 2;
//       case WebhookEventType.POS_SAVE:
//         return 3;
//       case WebhookEventType.ORDER_UPDATE:
//         return 4; // Lowest priority
//       default:
//         return 5;
//     }
//   }
// }

