import { Injectable, Logger } from '@nestjs/common';
import { NotificationJobDto, WebhookEventType } from '../dto/webhook-payload.dto';

export interface EmailProvider {
  sendEmail(to: string[], subject: string, content: string, isHtml?: boolean): Promise<boolean>;
}

// Example implementation for SendGrid
class SendGridEmailProvider implements EmailProvider {
  async sendEmail(to: string[], subject: string, content: string, isHtml: boolean = true): Promise<boolean> {
    // Implement SendGrid email sending logic here
    console.log(`Sending email via SendGrid to ${to.join(', ')}`);
    console.log(`Subject: ${subject}`);
    console.log(`Content: ${content}`);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    return true;
  }
}

// Example implementation for AWS SES
class AwsSesEmailProvider implements EmailProvider {
  async sendEmail(to: string[], subject: string, content: string, isHtml: boolean = true): Promise<boolean> {
    // Implement AWS SES email sending logic here
    console.log(`Sending email via AWS SES to ${to.join(', ')}`);
    console.log(`Subject: ${subject}`);
    console.log(`Content: ${content}`);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    return true;
  }
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly provider: EmailProvider;

  constructor() {
    // Choose provider based on environment or configuration
    const providerType = process.env.EMAIL_PROVIDER || 'sendgrid';
    
    switch (providerType.toLowerCase()) {
      case 'aws':
        this.provider = new AwsSesEmailProvider();
        break;
      case 'sendgrid':
      default:
        this.provider = new SendGridEmailProvider();
        break;
    }
  }

  async sendNotification(job: NotificationJobDto): Promise<void> {
    const { subject, content } = this.buildEmailContent(job);
    const recipients = this.getRecipients(job);

    this.logger.log(`Sending email notification for webhook: ${job.webhookId}`);

    try {
      await this.provider.sendEmail(recipients, subject, content, true);
      this.logger.log(`Email sent successfully to ${recipients.join(', ')} for webhook: ${job.webhookId}`);
    } catch (error) {
      this.logger.error(`Failed to send email for webhook: ${job.webhookId}`, error);
      throw error;
    }
  }

  private buildEmailContent(job: NotificationJobDto): { subject: string; content: string } {
    const timestamp = new Date().toLocaleString();
    
    switch (job.eventType) {
      case WebhookEventType.POS_SAVE:
        return {
          subject: 'New POS Transaction Recorded',
          content: `
            <h2>New POS Transaction</h2>
            <p><strong>Transaction ID:</strong> ${job.data.transactionId || 'N/A'}</p>
            <p><strong>Amount:</strong> $${job.data.amount || 'N/A'}</p>
            <p><strong>Customer:</strong> ${job.data.customerName || 'N/A'}</p>
            <p><strong>Time:</strong> ${timestamp}</p>
            <p><strong>Webhook ID:</strong> ${job.webhookId}</p>
            
            <h3>Transaction Details:</h3>
            <pre>${JSON.stringify(job.data, null, 2)}</pre>
          `
        };
      
      case WebhookEventType.ORDER_CREATE:
        return {
          subject: `New Order Created - #${job.data.orderId || 'N/A'}`,
          content: `
            <h2>New Order Created</h2>
            <p><strong>Order ID:</strong> ${job.data.orderId || 'N/A'}</p>
            <p><strong>Total Amount:</strong> $${job.data.total || 'N/A'}</p>
            <p><strong>Customer:</strong> ${job.data.customerName || 'N/A'}</p>
            <p><strong>Status:</strong> ${job.data.status || 'Created'}</p>
            <p><strong>Time:</strong> ${timestamp}</p>
            
            <h3>Order Items:</h3>
            ${job.data.items ? this.formatOrderItems(job.data.items) : '<p>No items data available</p>'}
            
            <h3>Full Order Data:</h3>
            <pre>${JSON.stringify(job.data, null, 2)}</pre>
          `
        };
      
      case WebhookEventType.ORDER_UPDATE:
        return {
          subject: `Order Updated - #${job.data.orderId || 'N/A'}`,
          content: `
            <h2>Order Status Updated</h2>
            <p><strong>Order ID:</strong> ${job.data.orderId || 'N/A'}</p>
            <p><strong>New Status:</strong> ${job.data.status || 'Updated'}</p>
            <p><strong>Previous Status:</strong> ${job.data.previousStatus || 'N/A'}</p>
            <p><strong>Updated At:</strong> ${timestamp}</p>
            
            <h3>Update Details:</h3>
            <pre>${JSON.stringify(job.data, null, 2)}</pre>
          `
        };
      
      case WebhookEventType.PAYMENT_COMPLETE:
        return {
          subject: `Payment Confirmed - $${job.data.amount || 'N/A'}`,
          content: `
            <h2>Payment Confirmation</h2>
            <p><strong>Payment Reference:</strong> ${job.data.paymentRef || 'N/A'}</p>
            <p><strong>Amount:</strong> $${job.data.amount || 'N/A'}</p>
            <p><strong>Payment Method:</strong> ${job.data.paymentMethod || 'N/A'}</p>
            <p><strong>Order ID:</strong> ${job.data.orderId || 'N/A'}</p>
            <p><strong>Customer:</strong> ${job.data.customerName || 'N/A'}</p>
            <p><strong>Processed At:</strong> ${timestamp}</p>
            
            <h3>Payment Details:</h3>
            <pre>${JSON.stringify(job.data, null, 2)}</pre>
          `
        };
      
      default:
        return {
          subject: `Webhook Notification - ${job.eventType}`,
          content: `
            <h2>Webhook Notification</h2>
            <p><strong>Event Type:</strong> ${job.eventType}</p>
            <p><strong>Webhook ID:</strong> ${job.webhookId}</p>
            <p><strong>Timestamp:</strong> ${timestamp}</p>
            
            <h3>Event Data:</h3>
            <pre>${JSON.stringify(job.data, null, 2)}</pre>
          `
        };
    }
  }

  private formatOrderItems(items: any[]): string {
    if (!Array.isArray(items)) return '<p>Invalid items data</p>';
    
    return `
      <table border="1" style="border-collapse: collapse; width: 100%;">
        <tr>
          <th style="padding: 8px;">Item</th>
          <th style="padding: 8px;">Quantity</th>
          <th style="padding: 8px;">Price</th>
          <th style="padding: 8px;">Total</th>
        </tr>
        ${items.map(item => `
          <tr>
            <td style="padding: 8px;">${item.name || 'N/A'}</td>
            <td style="padding: 8px;">${item.quantity || 'N/A'}</td>
            <td style="padding: 8px;">$${item.price || 'N/A'}</td>
            <td style="padding: 8px;">$${(item.quantity * item.price) || 'N/A'}</td>
          </tr>
        `).join('')}
      </table>
    `;
  }

  private getRecipients(job: NotificationJobDto): string[] {
    const recipients: string[] = [];
    
    if (job.data.customerEmail) {
      recipients.push(job.data.customerEmail);
    }
    
    if (job.data.merchantEmail) {
      recipients.push(job.data.merchantEmail);
    }
    
    // Default recipients from environment
    const defaultRecipients = process.env.EMAIL_DEFAULT_RECIPIENTS?.split(',') || [];
    recipients.push(...defaultRecipients);
    
    return [...new Set(recipients)]; // Remove duplicates
  }
}
