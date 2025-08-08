import { Injectable, Logger } from '@nestjs/common';
import { NotificationJobDto, WebhookEventType } from '../dto/webhook-payload.dto';

export interface WhatsappProvider {
  sendMessage(to: string, message: string): Promise<boolean>;
}

// Example implementation for Twilio WhatsApp
class TwilioWhatsappProvider implements WhatsappProvider {
  async sendMessage(to: string, message: string): Promise<boolean> {
    // Implement Twilio WhatsApp sending logic here
    console.log(`Sending WhatsApp message via Twilio to ${to}: ${message}`);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    return true;
  }
}

// Example implementation for WhatsApp Business API
class WhatsappBusinessProvider implements WhatsappProvider {
  async sendMessage(to: string, message: string): Promise<boolean> {
    // Implement WhatsApp Business API sending logic here
    console.log(`Sending WhatsApp message via Business API to ${to}: ${message}`);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    return true;
  }
}

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly provider: WhatsappProvider;

  constructor() {
    // Choose provider based on environment or configuration
    const providerType = process.env.WHATSAPP_PROVIDER || 'twilio';
    
    switch (providerType.toLowerCase()) {
      case 'business':
        this.provider = new WhatsappBusinessProvider();
        break;
      case 'twilio':
      default:
        this.provider = new TwilioWhatsappProvider();
        break;
    }
  }

  async sendNotification(job: NotificationJobDto): Promise<void> {
    const message = this.buildMessage(job);
    const recipients = this.getRecipients(job);

    this.logger.log(`Sending WhatsApp notification for webhook: ${job.webhookId}`);

    const sendPromises = recipients.map(async (recipient) => {
      try {
        await this.provider.sendMessage(recipient, message);
        this.logger.log(`WhatsApp message sent successfully to ${recipient} for webhook: ${job.webhookId}`);
      } catch (error) {
        this.logger.error(`Failed to send WhatsApp message to ${recipient} for webhook: ${job.webhookId}`, error);
        throw error;
      }
    });

    await Promise.all(sendPromises);
  }

  private buildMessage(job: NotificationJobDto): string {
    const timestamp = new Date().toLocaleString();
    
    switch (job.eventType) {
      case WebhookEventType.POS_SAVE:
        return `
🏪 *New POS Transaction*

💰 Amount: $${job.data.amount || 'N/A'}
🆔 Transaction ID: ${job.data.transactionId || 'N/A'}
👤 Customer: ${job.data.customerName || 'N/A'}
🕒 Time: ${timestamp}

_Transaction processed successfully_
        `.trim();
      
      case WebhookEventType.ORDER_CREATE:
        return `
🛒 *New Order Created*

📦 Order #${job.data.orderId || 'N/A'}
💰 Total: $${job.data.total || 'N/A'}
👤 Customer: ${job.data.customerName || 'N/A'}
📊 Status: ${job.data.status || 'Created'}
🕒 Time: ${timestamp}

${job.data.items ? this.formatOrderItemsForWhatsApp(job.data.items) : ''}

_Order is being processed_
        `.trim();
      
      case WebhookEventType.ORDER_UPDATE:
        return `
📝 *Order Status Updated*

📦 Order #${job.data.orderId || 'N/A'}
🔄 Status: ${job.data.status || 'Updated'}
📊 Previous: ${job.data.previousStatus || 'N/A'}
🕒 Updated: ${timestamp}

_Order status has been updated_
        `.trim();
      
      case WebhookEventType.PAYMENT_COMPLETE:
        return `
✅ *Payment Confirmed*

💳 Reference: ${job.data.paymentRef || 'N/A'}
💰 Amount: $${job.data.amount || 'N/A'}
💳 Method: ${job.data.paymentMethod || 'N/A'}
📦 Order: ${job.data.orderId || 'N/A'}
👤 Customer: ${job.data.customerName || 'N/A'}
🕒 Time: ${timestamp}

_Payment has been successfully processed_
        `.trim();
      
      default:
        return `
📢 *Webhook Notification*

🔔 Event: ${job.eventType}
🆔 Webhook ID: ${job.webhookId}
🕒 Time: ${timestamp}

_System notification received_
        `.trim();
    }
  }

  private formatOrderItemsForWhatsApp(items: any[]): string {
    if (!Array.isArray(items) || items.length === 0) return '';
    
    let itemsList = '\n📋 *Order Items:*\n';
    items.forEach((item, index) => {
      itemsList += `${index + 1}. ${item.name || 'Item'} x${item.quantity || 1} - $${item.price || 'N/A'}\n`;
    });
    
    return itemsList;
  }

  private getRecipients(job: NotificationJobDto): string[] {
    const recipients: string[] = [];
    
    // WhatsApp numbers should include country code (e.g., +1234567890)
    if (job.data.customerWhatsapp) {
      recipients.push(job.data.customerWhatsapp);
    }
    
    if (job.data.customerPhone) {
      // Format phone number for WhatsApp if needed
      const formattedPhone = this.formatPhoneForWhatsApp(job.data.customerPhone);
      if (formattedPhone) {
        recipients.push(formattedPhone);
      }
    }
    
    if (job.data.merchantWhatsapp) {
      recipients.push(job.data.merchantWhatsapp);
    }
    
    // Default recipients from environment
    const defaultRecipients = process.env.WHATSAPP_DEFAULT_RECIPIENTS?.split(',') || [];
    recipients.push(...defaultRecipients);
    
    return [...new Set(recipients)]; // Remove duplicates
  }

  private formatPhoneForWhatsApp(phone: string): string | null {
    // Remove all non-digit characters
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Add country code if not present (assuming US +1 for example)
    if (cleanPhone.length === 10) {
      return `+1${cleanPhone}`;
    } else if (cleanPhone.length === 11 && cleanPhone.startsWith('1')) {
      return `+${cleanPhone}`;
    } else if (cleanPhone.length > 10) {
      return `+${cleanPhone}`;
    }
    
    return null; // Invalid phone number
  }
}
