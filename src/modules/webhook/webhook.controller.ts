import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { WebhookPayloadDto } from './dto/webhook-payload.dto';
import { QueueService } from './webhook.service';
import { SmsService } from './services/sms.service';
import { SendOtpDto } from './dto/otp.dto';
import { WEBHOOK_TEST_CONFIG } from '../../config/webhook-test.config';

@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly webhookService: QueueService,
    private readonly smsService: SmsService,
  ) {}

  @Post('pos')
  @HttpCode(HttpStatus.OK)
  async handlePosWebhook(
    @Body() payload: WebhookPayloadDto,
    @Headers('x-webhook-signature') signature?: string,
    @Headers('authorization') authorization?: string,
  ) {
    console.log('payload12345', payload);
    this.logger.log(`Received POS webhook: ${payload.id}`);

    try {
      // Validate webhook signature/authorization
      await this.webhookService.validateWebhook(
        payload,
        signature,
        authorization,
      );

      // Immediately enqueue for processing
      this.webhookService.enqueueNotificationJobs(payload);

      this.logger.log(`Successfully enqueued webhook: ${payload.id}`);
      
      return {
        success: true,
        message: 'Webhook received and queued for processing',
        webhookId: payload.id,
        receivedData: payload,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Failed to process webhook ${payload.id}:`, error);
      
      if (
        error instanceof UnauthorizedException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      
      throw new BadRequestException('Failed to process webhook');
    }
  }

  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  async sendOtp(
    @Body() payload: SendOtpDto,
    @Headers('authorization') authorization?: string,
  ) {
    const expectedToken =
      process.env.WEBHOOK_AUTH_TOKEN || WEBHOOK_TEST_CONFIG.WEBHOOK_AUTH_TOKEN;
    if (!expectedToken || authorization !== `Bearer ${expectedToken}`) {
      throw new UnauthorizedException('Invalid auth token for OTP webhook');
    }

    await this.smsService.sendOtp(payload.mobile, payload.otp);

    return {
      success: true,
      message: 'OTP SMS enqueued for sending',
      to: payload.mobile,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  async testWebhook(@Body() payload: any) {
    this.logger.log('Test webhook received');
    
    return {
      success: true,
      message: 'Test webhook received',
      receivedData: payload,
      timestamp: new Date().toISOString(),
    };
  }
}
