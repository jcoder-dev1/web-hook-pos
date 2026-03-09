import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { WebhookLog } from '../entities/webhook-log.entity';
import { IntegrationDeliveryLog } from '../entities/integration-delivery-log.entity';
import {
  NotificationChannel,
  NotificationJobDto,
} from '../dto/webhook-payload.dto';
import { SmsService } from '../services/sms.service';
import { EmailService } from '../services/email.service';
import { WhatsappService } from '../services/whatsapp.service';
import { IntegrationConfigMasterService } from '../services/integration-config-master.service';
import { getIdempotencyWindowMs } from '../../../common/idempotency.helper';

@Injectable()
export class ProcessorService {
  constructor(
    @InjectRepository(WebhookLog)
    private readonly logRepo: Repository<WebhookLog>,
    @InjectRepository(IntegrationDeliveryLog)
    private readonly deliveryLogRepo: Repository<IntegrationDeliveryLog>,
    private readonly smsService: SmsService,
    private readonly emailService: EmailService,
    private readonly whatsappService: WhatsappService,
    private readonly integrationConfigMaster: IntegrationConfigMasterService,
  ) {}
  private readonly logger = new Logger(ProcessorService.name);

  /** Idempotency: skip if we already successfully sent for this webhookId + channel within the window. */
  private async wasAlreadySent(webhookId: string, channel: string): Promise<boolean> {
    const since = new Date(Date.now() - getIdempotencyWindowMs());
    const count = await this.deliveryLogRepo.count({
      where: {
        webhookId,
        channel,
        status: 'sent',
        createdAt: MoreThanOrEqual(since),
      },
    });
    return count > 0;
  }

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
    const payload = task.payload ?? task;
    const correlationId = payload.correlationId ?? payload.webhookId;
    this.logger.log(
      `[${correlationId}] Processing ${payload.name} for webhook: ${payload.webhookId}`,
    );

    if (await this.wasAlreadySent(payload.webhookId, payload.channel)) {
      this.logger.log(
        `[${correlationId}] Idempotency: already sent for webhook ${payload.webhookId} channel ${payload.channel}; skipping`,
      );
      return { success: true, webhookId: payload.webhookId, idempotent: true };
    }

    let integrationConfig: { provider: string; config: Record<string, unknown> } | null = null;
    if (payload.mpin != null && payload.companyId != null) {
      integrationConfig = await this.integrationConfigMaster.getConfig(
        payload.mpin,
        payload.companyId,
        payload.branchId ?? null,
        payload.channel,
      );
    }

    if (!integrationConfig) {
      this.logger.log(
        `[${correlationId}] No integration configured for ${payload.channel} (mpin=${payload.mpin}, company=${payload.companyId}); skipping send`,
      );
      await this.saveDeliveryLog(
        payload,
        'skipped',
        'No integration configured for this channel',
        null,
        correlationId,
      );
      return { success: true, webhookId: payload.webhookId, skipped: true };
    }

    const workingRow = this.logRepo.create({
      recordId: payload.recordId,
      status: 'queued',
      type: payload.name,
      createdDate: null,
      message: null,
    });
    try {
      switch (payload.name) {
        case 'send-sms':
          workingRow.type = 'send-sms';
          await this.smsService.sendNotification(payload, integrationConfig);
          break;
        case 'send-email':
          const respo = await this.emailService.sendNotification(payload, integrationConfig);
          workingRow.type = 'send-email';
          workingRow.message = respo
            ? `Successful: ${respo?.accepted?.join(', ') || 'None'}, Failed: ${respo?.rejected?.join(', ') || 'None'}.`
            : null;
          break;
        case 'send-whatsapp':
          workingRow.type = 'send-whatsapp';
          await this.whatsappService.sendNotification(payload, integrationConfig);
          break;
        default:
          switch (payload.channel) {
            case NotificationChannel.SMS:
              await this.smsService.sendNotification(payload, integrationConfig);
              break;
            case NotificationChannel.EMAIL:
              await this.emailService.sendNotification(payload, integrationConfig);
              break;
            case NotificationChannel.WHATSAPP:
              await this.whatsappService.sendNotification(payload, integrationConfig);
              break;
            default:
              this.logger.warn(`Unknown channel: ${payload.channel}`);
              throw new Error(`Unknown notification channel: ${payload.channel}`);
          }
      }

      workingRow.status = 'success';
      workingRow.createdDate = new Date();
      await this.logRepo.save(workingRow);
      await this.saveDeliveryLog(payload, 'sent', null, integrationConfig?.provider ?? null, correlationId);
      return { success: true, webhookId: payload.webhookId };
    } catch (error: any) {
      workingRow.status = 'failed';
      workingRow.createdDate = new Date();
      workingRow.message = error?.message ?? String(error);
      await this.logRepo.save(workingRow);
      await this.saveDeliveryLog(
        payload,
        'failed',
        error?.message ?? String(error),
        integrationConfig?.provider ?? null,
        correlationId,
      );
      this.logger.error(`[${correlationId}] Failed ${payload.name}: ${workingRow.message}`);
      throw error;
    }
  }

  private maskRecipient(recipient: string): string {
    if (!recipient || recipient.length <= 4) return '***';
    return '*' + recipient.slice(-4);
  }

  private async saveDeliveryLog(
    payload: NotificationJobDto,
    status: string,
    errorMessage: string | null,
    provider: string | null,
    correlationId: string,
  ): Promise<void> {
    const recipient = payload.data?.customerPhone || payload.data?.customerEmail || payload.data?.customerWhatsapp || '?';
    const masked = typeof recipient === 'string' ? this.maskRecipient(recipient) : '?';
    const log = this.deliveryLogRepo.create({
      webhookId: payload.webhookId,
      channel: payload.channel,
      provider,
      status,
      recipientMasked: masked,
      errorMessage,
      retryCount: payload.metadata?.retryCount ?? 0,
      correlationId,
    });
    await this.deliveryLogRepo.save(log);
  }
}
