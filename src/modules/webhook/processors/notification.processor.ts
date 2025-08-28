import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhookLog } from '../entities/webhook-log.entity';
import {
  NotificationChannel,
  NotificationJobDto,
} from '../dto/webhook-payload.dto';
import { SmsService } from '../services/sms.service';
import { EmailService } from '../services/email.service';
import { WhatsappService } from '../services/whatsapp.service';

@Injectable()
export class ProcessorService {
  constructor(
    @InjectRepository(WebhookLog)
    private readonly logRepo: Repository<WebhookLog>,
    private readonly smsService: SmsService,
    private readonly emailService: EmailService,
    private readonly whatsappService: WhatsappService,
  ) {}
  private readonly logger = new Logger(ProcessorService.name);

  /**
   * Process one job (single webhook payload).
   * Return value is stored in queue result (optional).
   */
  // async process(task: { payload: any }): Promise<any> {
  //   console.log('inside ......');
  //   const payload = task.payload ?? task; // be permissive

  //   // // mark "processing" (optional: create row now or at enqueue time)
  //   // const workingRow = this.logRepo.create({
  //   //   payload,
  //   //   status: 'processing',
  //   //   createdDate: null,
  //   //   message: null,
  //   // });
  //   // const row = await this.logRepo.save(workingRow);

  //   try {
  //     console.log('que system');
  //     // ---- YOUR BUSINESS LOGIC HERE ----
  //     // e.g. route by payload.event, call email/SMS/etc.
  //     // Simulate work:
  //     await new Promise((r) => setTimeout(r, 1000));

  //     // // mark success
  //     // row.status = 'success';
  //     // row.createdDate = new Date();
  //     // row.message = null;
  //     // await this.logRepo.save(row);
  //     return { ok: true, id:12 };
  //     // return { ok: true, id: row.id };
  //   } catch (err: any) {
  //     // row.status = 'failed';
  //     // row.createdDate = new Date();
  //     // row.message = err?.message ?? String(err);
  //     // await this.logRepo.save(row);
  //     // Re-throw so Better-Queue can retry
  //     throw err;
  //   }
  // }
  async process(task: { payload: NotificationJobDto }): Promise<any> {
    const payload = task.payload ?? task; // be permissive
    console.log('payload', payload);
    this.logger.log(
      `Processing ${payload.name} notification for webhook: ${payload.webhookId}`,
    );
    const workingRow = this.logRepo.create({
      //    payload,
      recordId: payload.recordId,
      status: 'processing',
      createdDate: null,
      message: null,
    });
    workingRow.status = 'queued';
    try {
      switch (payload.name) {
        case 'send-sms':
          workingRow.type = 'send-sms';
          await this.smsService.sendNotification(payload);
          break;
        case 'send-email':
          const respo = await this.emailService.sendNotification(payload);
          console.log(respo, 'response from email service');
          workingRow.type = 'send-email';
          workingRow.message = `Email send summary → Successful: ${respo?.accepted.join(', ') || 'None'}, Failed: ${respo?.rejected.join(', ') || 'None'}.`;
          break;
        case 'send-whatsapp':
          workingRow.type = 'send-whatsapp';
          await this.whatsappService.sendNotification(payload);
          break;
        default:
          // Generic processing based on channel
          switch (payload.channel) {
            case NotificationChannel.SMS:
              await this.smsService.sendNotification(payload);
              break;
            case NotificationChannel.EMAIL:
              await this.emailService.sendNotification(payload);
              break;
            case NotificationChannel.WHATSAPP:
              await this.whatsappService.sendNotification(payload);
              break;
            default:
              this.logger.warn(
                `Unknown notification channel: ${payload.channel}`,
              );
              throw new Error(
                `Unknown notification channel: ${payload.channel}`,
              );
          }
      }
      
      this.logger.log(
        `${payload.name} notification sent successfully for webhook: ${payload.webhookId}`,
      );
      // // mark success
      workingRow.status = 'success';
      workingRow.createdDate = new Date();

      await this.logRepo.save(workingRow);
      return { success: true, webhookId: payload.webhookId };
    } catch (error: any) {
      workingRow.status = 'failed';
      workingRow.createdDate = new Date();
      workingRow.message = workingRow?.message ?? String(error?.message);
      await this.logRepo.save(workingRow);
      this.logger.error(
        `Failed to send ${payload.eventType} notification for webhook: ${payload.webhookId}`,
        error,
      );
      throw error; // This will trigger retry mechanism
    }
  }
}
