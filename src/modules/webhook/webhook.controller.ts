import { 
  Controller, 
  Post, 
  Body, 
  Headers, 
  HttpCode, 
  HttpStatus, 
  BadRequestException,
  UnauthorizedException,
  Logger
} from '@nestjs/common';
import { WebhookPayloadDto } from './dto/webhook-payload.dto';
import { WebhookService } from './webhook.service';

@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly webhookService: WebhookService) {}

  @Post('pos')
  @HttpCode(HttpStatus.OK)
  async handlePosWebhook(
    @Body() payload: WebhookPayloadDto,
    @Headers('x-webhook-signature') signature?: string,
    @Headers('authorization') authorization?: string,
  ) {
    this.logger.log(`Received POS webhook: ${payload.id}`);

    try {
      // Validate webhook signature/authorization
      await this.webhookService.validateWebhook(payload, signature, authorization);

      // Immediately enqueue for processing
      await this.webhookService.enqueueNotificationJobs(payload);

      this.logger.log(`Successfully enqueued webhook: ${payload.id}`);
      
      return {
        success: true,
        message: 'Webhook received and queued for processing',
        webhookId: payload.id,
      };
    } catch (error) {
      this.logger.error(`Failed to process webhook ${payload.id}:`, error);
      
      if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
        throw error;
      }
      
      throw new BadRequestException('Failed to process webhook');
    }
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
