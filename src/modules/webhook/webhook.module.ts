import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { NotificationProcessor } from './processors/notification.processor';
import { SmsService } from './services/sms.service';
import { EmailService } from './services/email.service';
import { WhatsappService } from './services/whatsapp.service';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'notification-queue',
    }),
  ],
  controllers: [WebhookController],
  providers: [
    WebhookService, 
    NotificationProcessor,
    SmsService,
    EmailService,
    WhatsappService,
  ],
  exports: [WebhookService],
})
export class WebhookModule {}
