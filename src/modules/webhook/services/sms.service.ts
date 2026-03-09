import { Injectable, Logger } from '@nestjs/common';
import { NotificationJobDto, WebhookEventType } from '../dto/webhook-payload.dto';

export interface SmsProvider {
  sendSms(to: string, message: string): Promise<boolean>;
}

export interface TextGuruConfig {
  baseUrl?: string;
  username: string;
  password: string;
  source: string;
  dlttempid?: string;
  messageTemplate?: string;
}

// TextGuru: GET https://www.textguru.in/api/v22.0/?username=...&password=...&source=...&dmobile=...&message=...
class TextGuruSmsProvider implements SmsProvider {
  constructor(private readonly config: TextGuruConfig) {}

  async sendSms(to: string, message: string): Promise<boolean> {
    const baseUrl = (this.config.baseUrl || 'https://www.textguru.in/api/v22.0').replace(/\/$/, '');
    const params = new URLSearchParams({
      username: this.config.username,
      password: this.config.password,
      source: this.config.source,
      dmobile: to.replace(/\D/g, '').replace(/^0/, ''),
      message,
    });
    if (this.config.dlttempid) {
      params.set('dlttempid', this.config.dlttempid);
    }
    const url = `${baseUrl}/?${params.toString()}`;
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`TextGuru SMS failed ${res.status}: ${text}`);
    }
    return true;
  }
}

// Example implementation for Twilio
class TwilioSmsProvider implements SmsProvider {
  async sendSms(to: string, message: string): Promise<boolean> {
    // Implement Twilio SMS sending logic here
    console.log(`Sending SMS via Twilio to ${to}: ${message}`);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    return true;
  }
}

// Example implementation for AWS SNS
class AwsSnsSmsProvider implements SmsProvider {
  async sendSms(to: string, message: string): Promise<boolean> {
    // Implement AWS SNS SMS sending logic here
    console.log(`Sending SMS via AWS SNS to ${to}: ${message}`);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    return true;
  }
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly provider: SmsProvider;

  constructor() {
    // Choose provider based on environment or configuration
    const providerType = process.env.SMS_PROVIDER || 'twilio';
    
    switch (providerType.toLowerCase()) {
      case 'aws':
        this.provider = new AwsSnsSmsProvider();
        break;
      case 'twilio':
      default:
        this.provider = new TwilioSmsProvider();
        break;
    }
  }

  async sendNotification(
    job: NotificationJobDto,
    integrationConfig?: { provider: string; config: Record<string, unknown> } | null,
  ): Promise<void> {
    const message = this.buildMessage(job, integrationConfig?.config);
    const recipients = this.getRecipients(job);
    const provider = integrationConfig
      ? this.getProviderFromConfig(integrationConfig)
      : this.provider;

    this.logger.log(
      `Sending SMS (${integrationConfig ? 'DB config' : 'env'}) for webhook: ${job.webhookId}`,
    );

    const sendPromises = recipients.map(async (recipient) => {
      try {
        await provider.sendSms(recipient, message);
        this.logger.log(`SMS sent to ${recipient} for webhook: ${job.webhookId}`);
      } catch (error) {
        this.logger.error(`Failed to send SMS to ${recipient} for webhook: ${job.webhookId}`, error);
        throw error;
      }
    });

    await Promise.all(sendPromises);
  }

  private getProviderFromConfig(integrationConfig: {
    provider: string;
    config: Record<string, unknown>;
  }): SmsProvider {
    const p = integrationConfig.provider?.toLowerCase();
    const c = integrationConfig.config || {};
    if (p === 'textguru') {
      return new TextGuruSmsProvider({
        baseUrl: c.baseUrl as string | undefined,
        username: (c.username as string) || '',
        password: (c.password as string) || '',
        source: (c.source as string) || '',
        dlttempid: c.dlttempid as string | undefined,
        messageTemplate: c.messageTemplate as string | undefined,
      });
    }
    if (p === 'aws') return new AwsSnsSmsProvider();
    return new TwilioSmsProvider();
  }

  /** Replace #placeholder# in template with job.data (e.g. #emailProductCode#, #emailCurrentPrice#). */
  private applyTemplate(template: string, data: Record<string, unknown>): string {
    const alias: Record<string, string> = {
      emailProductCode: 'productCode',
      emailCurrentPrice: 'currentPrice',
      emailNewPrice: 'newPrice',
      emailContactName: 'contactName',
    };
    return template.replace(/#([a-zA-Z0-9_]+)#/g, (_, key) => {
      const val =
        data[key] ??
        data[this.toCamelCase(key)] ??
        (alias[key] ? data[alias[key]] : undefined);
      return val != null ? String(val) : '';
    });
  }

  private toCamelCase(s: string): string {
    return s.replace(/_([a-z])/gi, (_, c) => c.toUpperCase());
  }

  private buildMessage(
    job: NotificationJobDto,
    config?: Record<string, unknown>,
  ): string {
    const template = config?.messageTemplate as string | undefined;
    if (template) {
      return this.applyTemplate(template, job.data || {});
    }
    switch (job.eventType) {
      case WebhookEventType.POS_SAVE:
        return `New POS transaction recorded. Amount: $${job.data?.amount || 'N/A'}. Transaction ID: ${job.data?.transactionId || 'N/A'}`;
      case WebhookEventType.ORDER_CREATE:
        return `New order created! Order #${job.data?.orderId || 'N/A'}. Total: $${job.data?.total || 'N/A'}`;
      case WebhookEventType.ORDER_UPDATE:
        return `Order #${job.data?.orderId || 'N/A'} has been updated. Status: ${job.data?.status || 'Updated'}`;
      case WebhookEventType.PAYMENT_COMPLETE:
        return `Payment confirmed! Amount: $${job.data?.amount || 'N/A'}. Reference: ${job.data?.paymentRef || 'N/A'}`;
      default:
        return `Notification: ${job.eventType} - ${JSON.stringify(job.data || {})}`;
    }
  }

  private getRecipients(job: NotificationJobDto): string[] {
    // Extract phone numbers from webhook data
    const recipients: string[] = [];
    
    if (job.data.customerPhone) {
      recipients.push(job.data.customerPhone);
    }
    
    if (job.data.merchantPhone) {
      recipients.push(job.data.merchantPhone);
    }
    
    // Default recipients from environment
    const defaultRecipients = process.env.SMS_DEFAULT_RECIPIENTS?.split(',') || [];
    recipients.push(...defaultRecipients);
    
    return [...new Set(recipients)]; // Remove duplicates
  }
}
