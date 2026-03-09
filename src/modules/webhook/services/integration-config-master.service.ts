import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ThirdPartyIntegration } from '../entities/third-party-integration.entity';
import { decrypt } from '../../../common/encryption.util';

export interface IntegrationConfigResult {
  provider: string;
  config: Record<string, unknown>;
}

/**
 * Resolves integration config by reading from master DB (third_party_integrations).
 * Uses same token/payload context: mpin, companyId, branchId, channel.
 * No API call; requires web-hook-pos to have a DB connection to master and ENCRYPTION_KEY.
 */
@Injectable()
export class IntegrationConfigMasterService {
  private readonly logger = new Logger(IntegrationConfigMasterService.name);

  constructor(
    @InjectRepository(ThirdPartyIntegration)
    private readonly repo: Repository<ThirdPartyIntegration>,
  ) {}

  async getConfig(
    mpin: string,
    companyId: number,
    branchId: number | null,
    channel: string,
  ): Promise<IntegrationConfigResult | null> {
    if (!mpin || companyId == null) {
      this.logger.debug('Skipping config: mpin or companyId missing');
      return null;
    }
    try {
      const entity = await this.repo
        .createQueryBuilder('i')
        .where('i.mpin = :mpin', { mpin })
        .andWhere('i.companyId = :companyId', { companyId })
        .andWhere('i.channel = :channel', { channel })
        .andWhere('i.isActive = :isActive', { isActive: true })
        .andWhere('(i.branchId = :branchId OR i.branchId IS NULL)', { branchId })
        .orderBy('i.branchId', 'DESC')
        .getOne();
      if (entity) {
        const config = JSON.parse(decrypt(entity.configEncrypted)) as Record<string, unknown>;
        return { provider: entity.provider, config };
      }

      // Fallback: hardcoded env-based config (TextGuru / Powerstext)
      const envConfig = this.getHardcodedConfig(channel);
      if (envConfig) {
        this.logger.debug(`Using env fallback config for channel: ${channel}`);
        return envConfig;
      }
      return null;
    } catch (err: any) {
      this.logger.warn(
        `Failed to get integration config from master DB: ${err?.message || err}`,
      );
      return null;
    }
  }

  /** Hardcoded fallback when no DB integration exists. Uses TEXTGURU_* and POWERSTEXT_* env vars. */
  private getHardcodedConfig(channel: string): IntegrationConfigResult | null {
    const ch = channel?.toLowerCase();
    if (ch === 'sms' && process.env.TEXTGURU_USERNAME) {
      return {
        provider: 'textguru',
        config: {
          baseUrl: process.env.TEXTGURU_BASE_URL || 'https://www.textguru.in/api/v22.0',
          username: process.env.TEXTGURU_USERNAME,
          password: process.env.TEXTGURU_PASSWORD || '',
          source: process.env.TEXTGURU_SOURCE || 'IRUJUL',
          dlttempid: process.env.TEXTGURU_DLTTEMPID,
          messageTemplate:
            process.env.TEXTGURU_MESSAGE_TEMPLATE ||
            'OTP:#OTP# for Price Change for item #emailProductCode#, Old Price : #emailCurrentPrice#, New Price: #emailNewPrice#, Customer : #emailContactName# -iRujulERP',
        },
      };
    }
    if (ch === 'whatsapp' && process.env.POWERSTEXT_PHONE_ID) {
      const config: Record<string, unknown> = {
        baseUrl: process.env.POWERSTEXT_BASE_URL || 'https://rcs.powerstext.in',
        phoneId: process.env.POWERSTEXT_PHONE_ID,
        bearerToken: process.env.POWERSTEXT_BEARER_TOKEN || '',
        templateName: process.env.POWERSTEXT_TEMPLATE_NAME || 'sale_invoice_25_',
        languageCode: process.env.POWERSTEXT_LANGUAGE_CODE || 'en',
        bodyParamKeys: (process.env.POWERSTEXT_BODY_PARAM_KEYS || 'invoiceNumber,date').split(',').map((s) => s.trim()),
        headerDocumentLink: process.env.POWERSTEXT_HEADER_DOC_LINK || 'documentLink',
        headerDocumentFilename: process.env.POWERSTEXT_HEADER_DOC_FILENAME || 'filename',
      };
      if (process.env.POWERSTEXT_TEMPLATE_NAME_NO_DOCUMENT) {
        config.templateNameNoDocument = process.env.POWERSTEXT_TEMPLATE_NAME_NO_DOCUMENT;
      }
      return { provider: 'powerstext', config };
    }
    return null;
  }

  /**
   * Returns channel names that have an active integration for this event (e.g. pos_save).
   * Only returns notification channels (sms, email, whatsapp) so we don't enqueue pinelab/payment.
   */
  async getChannelsForEvent(
    mpin: string,
    companyId: number,
    branchId: number | null,
    eventType: string,
  ): Promise<string[]> {
    if (!mpin || companyId == null) return [];
    const NOTIFICATION_CHANNELS = ['sms', 'email', 'whatsapp'];
    const supportedEvents = ['pos_save', 'order_create', 'payment_complete'];
    try {
      const entities = await this.repo
        .createQueryBuilder('i')
        .select(['i.channel', 'i.eventTypes'])
        .where('i.mpin = :mpin', { mpin })
        .andWhere('i.companyId = :companyId', { companyId })
        .andWhere('i.isActive = :isActive', { isActive: true })
        .andWhere('(i.branchId = :branchId OR i.branchId IS NULL)', { branchId })
        .getMany();
      const channels: string[] = [];
      for (const e of entities) {
        if (!NOTIFICATION_CHANNELS.includes(e.channel?.toLowerCase())) continue;
        let types: string[] = [];
        try {
          if (e.eventTypes) types = JSON.parse(e.eventTypes) as string[];
        } catch {
          continue;
        }
        if (types.includes(eventType)) channels.push(e.channel.toLowerCase());
      }

      // Fallback: when no DB integrations, include channels with hardcoded env config for pos_save
      if (channels.length === 0 && supportedEvents.includes(eventType)) {
        if (process.env.TEXTGURU_USERNAME) channels.push('sms');
        if (process.env.POWERSTEXT_PHONE_ID) channels.push('whatsapp');
      }
      return [...new Set(channels)];
    } catch (err: any) {
      this.logger.warn(
        `Failed to get channels for event: ${err?.message || err}`,
      );
      return [];
    }
  }
}
