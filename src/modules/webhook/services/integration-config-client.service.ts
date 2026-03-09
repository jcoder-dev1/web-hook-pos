import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WEBHOOK_TEST_CONFIG } from '../../../config/webhook-test.config';

export interface IntegrationConfigResult {
  provider: string;
  config: Record<string, unknown>;
}

@Injectable()
export class IntegrationConfigClientService {
  private readonly logger = new Logger(IntegrationConfigClientService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl =
      this.configService.get('MAIN_APP_URL') ||
      this.configService.get('INTEGRATION_CONFIG_URL') ||
      WEBHOOK_TEST_CONFIG.MAIN_APP_URL;
    this.apiKey =
      this.configService.get('INTEGRATION_CONFIG_API_KEY') ||
      WEBHOOK_TEST_CONFIG.INTEGRATION_CONFIG_API_KEY;
  }

  /**
   * Fetch integration config from main app (iPlugPOS_be) for the given tenant/company/branch/channel.
   * Returns null if not configured or on error.
   */
  async getConfig(
    mpin: string,
    companyId: number,
    branchId: number,
    channel: string,
  ): Promise<IntegrationConfigResult | null> {
    if (!mpin || companyId == null) {
      this.logger.debug('Skipping config fetch: mpin or companyId missing');
      return null;
    }
    if (!this.apiKey) {
      this.logger.debug('INTEGRATION_CONFIG_API_KEY not set; skipping config fetch');
      return null;
    }
    const url = new URL(`${this.baseUrl.replace(/\/$/, '')}/integrations/config`);
    url.searchParams.set('mpin', mpin);
    url.searchParams.set('companyId', String(companyId));
    url.searchParams.set('branchId', String(branchId));
    url.searchParams.set('channel', channel);
    try {
      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'x-integration-api-key': this.apiKey,
          Accept: 'application/json',
        },
      });
      if (res.status === 404 || res.status === 204) return null;
      if (!res.ok) {
        this.logger.warn(
          `Integration config API returned ${res.status} for ${mpin}/${companyId}/${branchId}/${channel}`,
        );
        return null;
      }
      const body = await res.json();
      if (body && typeof body.provider === 'string' && body.config && typeof body.config === 'object') {
        return { provider: body.provider, config: body.config };
      }
      return null;
    } catch (err: any) {
      this.logger.warn(
        `Failed to fetch integration config: ${err?.message || err}`,
      );
      return null;
    }
  }
}
