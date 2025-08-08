import { Injectable, Logger } from '@nestjs/common';
import { NotificationJobDto, WebhookEventType } from '../dto/webhook-payload.dto';

export interface SmsProvider {
  sendSms(to: string, message: string): Promise<boolean>;
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

  async sendNotification(job: NotificationJobDto): Promise<void> {
    const message = this.buildMessage(job);
    const recipients = this.getRecipients(job);

    this.logger.log(`Sending SMS notification for webhook: ${job.webhookId}`);

    const sendPromises = recipients.map(async (recipient) => {
      try {
        await this.provider.sendSms(recipient, message);
        this.logger.log(`SMS sent successfully to ${recipient} for webhook: ${job.webhookId}`);
      } catch (error) {
        this.logger.error(`Failed to send SMS to ${recipient} for webhook: ${job.webhookId}`, error);
        throw error;
      }
    });

    await Promise.all(sendPromises);
  }

  private buildMessage(job: NotificationJobDto): string {
    switch (job.eventType) {
      case WebhookEventType.POS_SAVE:
        return `New POS transaction recorded. Amount: $${job.data.amount || 'N/A'}. Transaction ID: ${job.data.transactionId || 'N/A'}`;
      
      case WebhookEventType.ORDER_CREATE:
        return `New order created! Order #${job.data.orderId || 'N/A'}. Total: $${job.data.total || 'N/A'}`;
      
      case WebhookEventType.ORDER_UPDATE:
        return `Order #${job.data.orderId || 'N/A'} has been updated. Status: ${job.data.status || 'Updated'}`;
      
      case WebhookEventType.PAYMENT_COMPLETE:
        return `Payment confirmed! Amount: $${job.data.amount || 'N/A'}. Reference: ${job.data.paymentRef || 'N/A'}`;
      
      default:
        return `Notification: ${job.eventType} - ${JSON.stringify(job.data)}`;
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
