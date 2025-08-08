import { IsString, IsNotEmpty, IsObject, IsOptional, IsEnum } from 'class-validator';

export enum WebhookEventType {
  POS_SAVE = 'pos_save',
  ORDER_CREATE = 'order_create',
  ORDER_UPDATE = 'order_update',
  PAYMENT_COMPLETE = 'payment_complete',
}

export enum NotificationChannel {
  SMS = 'sms',
  EMAIL = 'email',
  WHATSAPP = 'whatsapp',
}

export class WebhookPayloadDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsEnum(WebhookEventType)
  @IsNotEmpty()
  event_type: WebhookEventType;

  @IsObject()
  @IsNotEmpty()
  data: any;

  @IsString()
  @IsNotEmpty()
  timestamp: string;

  @IsString()
  @IsOptional()
  source?: string;
}

export class NotificationJobDto {
  @IsString()
  @IsNotEmpty()
  webhookId: string;

  @IsEnum(WebhookEventType)
  @IsNotEmpty()
  eventType: WebhookEventType;

  @IsEnum(NotificationChannel)
  @IsNotEmpty()
  channel: NotificationChannel;

  @IsObject()
  @IsNotEmpty()
  data: any;

  @IsObject()
  @IsOptional()
  metadata?: {
    retryCount?: number;
    priority?: number;
    delay?: number;
  };
}
