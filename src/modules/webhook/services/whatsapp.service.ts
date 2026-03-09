import { Injectable, Logger } from '@nestjs/common';
import { NotificationJobDto, WebhookEventType } from '../dto/webhook-payload.dto';

export interface WhatsappProvider {
  sendMessage(to: string, message: string): Promise<boolean>;
  sendTemplateMessage?(
    to: string,
    payload: {
      templateName: string;
      languageCode: string;
      bodyParams: string[];
      headerDocument?: { link: string; filename: string };
    },
  ): Promise<boolean>;
}

export interface PowerstextConfig {
  baseUrl?: string;
  phoneId: string;
  bearerToken: string;
  templateName: string;
  languageCode?: string;
  /** Keys from job.data for body parameters in order, e.g. ["invoiceNumber", "date"] */
  bodyParamKeys?: string[];
  /** Key in job.data for document link, or static value when headerDocumentLink is set */
  headerDocumentLink?: string;
  /** Key in job.data for document filename, or static value when headerDocumentFilename is set */
  headerDocumentFilename?: string;
  /** Optional template for when there is no document (text-only, same body params). Use for reliable delivery without 24h rule. */
  templateNameNoDocument?: string;
}

// Powerstext RCS/WhatsApp: matches curl POST .../v23.0/{phoneId}/messages (template with header + body)
const POWERSTEXT_DEFAULT_BASE_URL = 'https://rcs.powerstext.in';
const POWERSTEXT_DEFAULT_TEMPLATE = 'sale_invoice_25_';
const POWERSTEXT_DEFAULT_LANGUAGE = 'en';
const POWERSTEXT_BIZ_CALLBACK = 'DefaultCallback';

class PowerstextWhatsappProvider implements WhatsappProvider {
  private readonly logger = new Logger(PowerstextWhatsappProvider.name);
  private readonly debugEnabled =
    (process.env.WHATSAPP_DEBUG || '').toLowerCase() === 'true';

  constructor(private readonly config: PowerstextConfig) {}

  private maskToken(token: string): string {
    if (!token) return '';
    const t = String(token);
    if (t.length <= 8) return '***';
    return `${t.slice(0, 4)}***${t.slice(-4)}`;
  }

  async sendMessage(to: string, message: string): Promise<boolean> {
    const sanitized = String(message ?? '')
      .replace(/\r\n|\r|\n|\t/g, ' ')
      .replace(/\s{5,}/g, '    ');
    const baseUrl = (this.config.baseUrl || POWERSTEXT_DEFAULT_BASE_URL).replace(/\/$/, '');
    const url = `${baseUrl}/v23.0/${this.config.phoneId}/messages`;
    const toDigits = to.replace(/\D/g, '').replace(/^0/, '');
    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: toDigits,
      type: 'text',
      text: { body: sanitized },
    };
    this.logger.log(
      `[WhatsApp] Final URL (test in Chrome): ${url}`,
    );
    this.logger.log(
      `[WhatsApp] Request (text) to=${toDigits} body=${JSON.stringify(body)}`,
    );
    if (this.debugEnabled) {
      this.logger.log(
        `[WHATSAPP_DEBUG] Powerstext text message: url=${url} to=***${toDigits.slice(-4)}`,
      );
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.bearerToken}`,
      },
      body: JSON.stringify(body),
    });
    const responseText = await res.text();
    this.logger.log(
      `[Powerstext] sendMessage response status=${res.status} to=***${toDigits.slice(-4)} body=${responseText}`,
    );
    if (!res.ok) {
      throw new Error(`Powerstext WhatsApp failed ${res.status}: ${responseText}`);
    }
    this.logger.warn(
      '[WhatsApp] Plain text messages may not be delivered if the user has not messaged your business in the last 24 hours. Use an approved template for reliable delivery.',
    );
    return true;
  }

  async sendTemplateMessage(
    to: string,
    payload: {
      templateName: string;
      languageCode: string;
      bodyParams: string[];
      headerDocument?: { link: string; filename: string };
    },
  ): Promise<boolean> {
    const baseUrl = (this.config.baseUrl || POWERSTEXT_DEFAULT_BASE_URL).replace(/\/$/, '');
    const url = `${baseUrl}/v23.0/${this.config.phoneId}/messages`;
    const toDigits = to.replace(/\D/g, '').replace(/^0/, '');
    const templateName = payload.templateName || POWERSTEXT_DEFAULT_TEMPLATE;
    const languageCode = payload.languageCode || POWERSTEXT_DEFAULT_LANGUAGE;

    const components: Array<{ type: string; parameters: unknown[] }> = [];
    if (payload.headerDocument) {
      components.push({
        type: 'header',
        parameters: [
          {
            type: 'document',
            document: {
              link: payload.headerDocument.link,
              filename: payload.headerDocument.filename,
            },
          },
        ],
      });
    }
    const sanitized = payload.bodyParams.map((t) =>
      String(t ?? '')
        .replace(/\r\n|\r|\n|\t/g, ' ')
        .replace(/\s{5,}/g, '    '),
    );
    components.push({
      type: 'body',
      parameters: sanitized.map((text) => ({ type: 'text', text })),
    });

    // Exact structure as curl: messaging_product, recipient_type, to, type, template, biz_opaque_callback_data
    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: toDigits,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components,
      },
      biz_opaque_callback_data: POWERSTEXT_BIZ_CALLBACK,
    };

    this.logger.log(
      `[WhatsApp] Final URL (test in Chrome): ${url}`,
    );
    this.logger.log(
      `[WhatsApp] Request (template) to=${toDigits} template=${templateName} body=${JSON.stringify(body)}`,
    );
    if (this.debugEnabled) {
      this.logger.log(
        `[WHATSAPP_DEBUG] Powerstext request: url=${url} phoneId=${this.config.phoneId} token=${this.maskToken(this.config.bearerToken)} template=${templateName} lang=${languageCode}`,
      );
      this.logger.log(
        `[WHATSAPP_DEBUG] Powerstext request body: ${JSON.stringify(body)}`,
      );
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.bearerToken}`,
      },
      body: JSON.stringify(body),
    });
    const responseText = await res.text();
    this.logger.log(
      `[Powerstext] sendTemplateMessage response status=${res.status} to=***${toDigits.slice(-4)} template=${templateName} body=${responseText}`,
    );
    if (!res.ok) {
      throw new Error(`Powerstext WhatsApp failed ${res.status}: ${responseText}`);
    }
    return true;
  }
}

// Example implementation for Twilio WhatsApp
class TwilioWhatsappProvider implements WhatsappProvider {
  async sendMessage(to: string, message: string): Promise<boolean> {
    console.log(`Sending WhatsApp message via Twilio to ${to}: ${message}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    return true;
  }
}

// Example implementation for WhatsApp Business API
class WhatsappBusinessProvider implements WhatsappProvider {
  async sendMessage(to: string, message: string): Promise<boolean> {
    console.log(`Sending WhatsApp message via Business API to ${to}: ${message}`);
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

  private isDebugEnabled(): boolean {
    return (process.env.WHATSAPP_DEBUG || '').toLowerCase() === 'true';
  }

  private maskRecipient(recipient: string): string {
    const s = String(recipient || '');
    const digits = s.replace(/\D/g, '');
    if (!digits) return '***';
    if (digits.length <= 4) return '***';
    return `***${digits.slice(-4)}`;
  }

  private sanitizeConfig(config: Record<string, unknown>): Record<string, unknown> {
    const c = config || {};
    const token = (c.bearerToken as string | undefined) || '';
    return {
      ...c,
      ...(token ? { bearerToken: `${String(token).slice(0, 4)}***${String(token).slice(-4)}` } : {}),
    };
  }

  async sendNotification(
    job: NotificationJobDto,
    integrationConfig?: { provider: string; config: Record<string, unknown> } | null,
  ): Promise<void> {
    const correlationId = job.correlationId ?? job.webhookId;
    const recipients = this.getRecipients(job);
    const provider = integrationConfig
      ? this.getProviderFromConfig(integrationConfig)
      : this.provider;
    const config = integrationConfig?.config || {};
    const useTemplate =
      integrationConfig?.provider?.toLowerCase() === 'powerstext' &&
      config.templateName &&
      Array.isArray(config.bodyParamKeys);

    this.logger.log(
      `[${correlationId}] Sending WhatsApp (${integrationConfig ? 'DB config' : 'env'}) for webhook: ${job.webhookId}`,
    );
    this.logger.log(
      `[${correlationId}] WhatsApp recipients (count=${recipients.length}): ${recipients.map((r) => this.maskRecipient(r)).join(', ')} | useTemplate=${useTemplate}`,
    );

    if (this.isDebugEnabled()) {
      const providerName = integrationConfig?.provider || (process.env.WHATSAPP_PROVIDER || 'twilio');
      this.logger.log(
        `[${correlationId}] [WHATSAPP_DEBUG] provider=${providerName} useTemplate=${useTemplate ? 'true' : 'false'} recipients=${recipients
          .map((r) => this.maskRecipient(r))
          .join(', ')}`,
      );
      if (integrationConfig) {
        this.logger.log(
          `[${correlationId}] [WHATSAPP_DEBUG] integration config (sanitized): ${JSON.stringify(
            this.sanitizeConfig(integrationConfig.config),
          )}`,
        );
      }
      this.logger.log(
        `[${correlationId}] [WHATSAPP_DEBUG] job.data keys: ${Object.keys(job.data || {}).join(', ')}`,
      );
    }

    const sendPromises = recipients.map(async (recipient) => {
      try {
        if (useTemplate && provider.sendTemplateMessage) {
          const data = job.data || {};
          const bodyParams = (config.bodyParamKeys as string[]).map(
            (key: string) => String(data[key] ?? ''),
          );
          const linkCfg = config.headerDocumentLink as string | undefined;
          const fnCfg = config.headerDocumentFilename as string | undefined;
          let headerDoc: { link: string; filename: string } | undefined;
          if (linkCfg || fnCfg) {
            let link =
              linkCfg && (linkCfg.startsWith('http') || linkCfg.startsWith('https'))
                ? linkCfg
                : String(data[linkCfg || 'documentLink'] ?? data.documentLink ?? '');
            let filename =
              fnCfg && (fnCfg.includes('.') || fnCfg.includes('/'))
                ? fnCfg
                : String(data[fnCfg || 'filename'] ?? data.filename ?? data.invoiceNumber ?? '');
            if (!link && process.env.POWERSTEXT_TEST_DOCUMENT_LINK) {
              link = process.env.POWERSTEXT_TEST_DOCUMENT_LINK;
              filename = process.env.POWERSTEXT_TEST_DOCUMENT_FILENAME || data.invoiceNumber || 'document.pdf';
              this.logger.log(
                `[${correlationId}] Using test document from env (POWERSTEXT_TEST_DOCUMENT_LINK) to verify WhatsApp sending`,
              );
            }
            if (link) headerDoc = { link, filename: filename || 'document' };
            // No document link: use no-document template if configured, else plain text.
            if ((linkCfg || fnCfg) && !headerDoc) {
              const noDocTemplate = config.templateNameNoDocument as string | undefined;
              if (noDocTemplate && provider.sendTemplateMessage) {
                this.logger.log(
                  `[${correlationId}] No documentLink; sending template "${noDocTemplate}" (invoice: ${data.invoiceNumber ?? '?'})`,
                );
                await provider.sendTemplateMessage(recipient, {
                  templateName: noDocTemplate,
                  languageCode: (config.languageCode as string) || 'en',
                  bodyParams,
                  headerDocument: undefined,
                });
              } else {
                this.logger.log(
                  `[${correlationId}] No documentLink; sending plain WhatsApp text (invoice: ${data.invoiceNumber ?? '?'}). Set templateNameNoDocument for reliable delivery.`,
                );
                const message = this.buildMessage(job);
                await provider.sendMessage(recipient, message);
              }
              this.logger.log(
                `[${correlationId}] WhatsApp sent to ${this.maskRecipient(recipient)} for webhook: ${job.webhookId}`,
              );
              return;
            }
          }

          // Template requires DOCUMENT header; only use document template when we have it.
          if (!headerDoc) {
            const noDocTemplate = config.templateNameNoDocument as string | undefined;
            if (noDocTemplate && provider.sendTemplateMessage) {
              this.logger.log(
                `[${correlationId}] No document; sending template "${noDocTemplate}" (invoice: ${data.invoiceNumber ?? '?'})`,
              );
              await provider.sendTemplateMessage(recipient, {
                templateName: noDocTemplate,
                languageCode: (config.languageCode as string) || 'en',
                bodyParams,
                headerDocument: undefined,
              });
            } else {
              this.logger.log(
                `[${correlationId}] No document for template; sending plain WhatsApp text (invoice: ${data.invoiceNumber ?? '?'}). Set templateNameNoDocument for reliable delivery.`,
              );
              const message = this.buildMessage(job);
              await provider.sendMessage(recipient, message);
            }
            this.logger.log(
              `[${correlationId}] WhatsApp sent to ${this.maskRecipient(recipient)} for webhook: ${job.webhookId}`,
            );
            return;
          }

          if (this.isDebugEnabled()) {
            this.logger.log(
              `[${correlationId}] [WHATSAPP_DEBUG] templateName=${String(
                config.templateName ?? '',
              )} lang=${String(config.languageCode ?? 'en')} bodyParamKeys=${JSON.stringify(
                config.bodyParamKeys ?? [],
              )} bodyParams=${JSON.stringify(bodyParams)} headerDoc=${JSON.stringify(
                headerDoc ?? null,
              )}`,
            );
          }

          await provider.sendTemplateMessage(recipient, {
            templateName: config.templateName as string,
            languageCode: (config.languageCode as string) || 'en',
            bodyParams,
            headerDocument: headerDoc,
          });
        } else {
          const message = this.buildMessage(job);
          if (this.isDebugEnabled()) {
            this.logger.log(
              `[${correlationId}] [WHATSAPP_DEBUG] sending plain message to=${this.maskRecipient(
                recipient,
              )} message=${JSON.stringify(message)}`,
            );
          }
          await provider.sendMessage(recipient, message);
        }
        this.logger.log(
          `[${correlationId}] WhatsApp sent to ${this.maskRecipient(
            recipient,
          )} for webhook: ${job.webhookId}`,
        );
      } catch (error) {
        this.logger.error(
          `[${correlationId}] Failed to send WhatsApp to ${this.maskRecipient(
            recipient,
          )} for webhook: ${job.webhookId}`,
          error as any,
        );
        throw error;
      }
    });

    await Promise.all(sendPromises);
  }

  private getProviderFromConfig(integrationConfig: {
    provider: string;
    config: Record<string, unknown>;
  }): WhatsappProvider {
    const p = integrationConfig.provider?.toLowerCase();
    const c = integrationConfig.config || {};
    if (p === 'powerstext') {
      return new PowerstextWhatsappProvider({
        baseUrl: c.baseUrl as string | undefined,
        phoneId: (c.phoneId as string) || '',
        bearerToken: (c.bearerToken as string) || '',
        templateName: (c.templateName as string) || '',
        languageCode: c.languageCode as string | undefined,
        bodyParamKeys: c.bodyParamKeys as string[] | undefined,
        headerDocumentLink: c.headerDocumentLink as string | undefined,
        headerDocumentFilename: c.headerDocumentFilename as string | undefined,
        templateNameNoDocument: c.templateNameNoDocument as string | undefined,
      });
    }
    if (p === 'business') return new WhatsappBusinessProvider();
    return new TwilioWhatsappProvider();
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
    
    // Default recipients from environment (e.g. WHATSAPP_DEFAULT_RECIPIENTS=919588623393)
    const defaultRecipients = (process.env.WHATSAPP_DEFAULT_RECIPIENTS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    recipients.push(...defaultRecipients);

    const list = [...new Set(recipients)];
    if (list.length === 0) {
      this.logger.warn(
        `[getRecipients] No WhatsApp recipients for job; set WHATSAPP_DEFAULT_RECIPIENTS (e.g. 919588623393) to send to a fallback number`,
      );
    }
    return list; // Remove duplicates
  }

  private formatPhoneForWhatsApp(phone: string): string | null {
    const cleanPhone = String(phone ?? '').replace(/\D/g, '');
    if (!cleanPhone) return null;
    // Already has country code (e.g. 919588623393)
    if (cleanPhone.length >= 11) return cleanPhone;
    // 10-digit Indian mobile (starts with 6–9) → prefix 91
    if (cleanPhone.length === 10 && /^[6-9]/.test(cleanPhone)) return `91${cleanPhone}`;
    // Other 10-digit → use default country from env or 91
    if (cleanPhone.length === 10) {
      const defaultCc = process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '91';
      return `${defaultCc}${cleanPhone}`;
    }
    return null;
  }
}
