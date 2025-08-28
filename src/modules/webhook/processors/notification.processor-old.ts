// import { Processor, WorkerHost } from '@nestjs/bullmq';
// import { Logger } from '@nestjs/common';
// import { Job } from 'bullmq';
// import { NotificationJobDto, NotificationChannel } from '../dto/webhook-payload.dto';
// import { SmsService } from '../services/sms.service';
// import { EmailService } from '../services/email.service';
// import { WhatsappService } from '../services/whatsapp.service';

// @Processor('notification-queue')
// export class NotificationProcessor extends WorkerHost {
//   private readonly logger = new Logger(NotificationProcessor.name);

//   constructor(
//     private readonly smsService: SmsService,
//     private readonly emailService: EmailService,
//     private readonly whatsappService: WhatsappService,
//   ) {
//     super();
//   }

//   async process(job: Job<NotificationJobDto, any, string>): Promise<any> {
//     const { data } = job;
//     this.logger.log(`Processing ${job.name} notification for webhook: ${data.webhookId}`);

//     try {
//       switch (job.name) {
//         case 'send-sms':
//           await this.smsService.sendNotification(data);
//           break;
//         case 'send-email':
//           await this.emailService.sendNotification(data);
//           break;
//         case 'send-whatsapp':
//           await this.whatsappService.sendNotification(data);
//           break;
//         default:
//           // Generic processing based on channel
//           switch (data.channel) {
//             case NotificationChannel.SMS:
//               await this.smsService.sendNotification(data);
//               break;
//             case NotificationChannel.EMAIL:
//               await this.emailService.sendNotification(data);
//               break;
//             case NotificationChannel.WHATSAPP:
//               await this.whatsappService.sendNotification(data);
//               break;
//             default:
//               this.logger.warn(`Unknown notification channel: ${data.channel}`);
//               throw new Error(`Unknown notification channel: ${data.channel}`);
//           }
//       }

//       this.logger.log(`${job.name} notification sent successfully for webhook: ${data.webhookId}`);
//       return { success: true, webhookId: data.webhookId };
//     } catch (error) {
//       this.logger.error(`Failed to send ${job.name} notification for webhook: ${data.webhookId}`, error);
//       throw error; // This will trigger retry mechanism
//     }
//   }
// }
