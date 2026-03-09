import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsObject, IsOptional, IsEnum, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

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
  @ApiProperty({
    description: 'Unique identifier for the webhook',
    example: 22,
  })
  @IsString()
   @IsNotEmpty()
  id: string;

  @ApiProperty({
    description: 'Type of the webhook event',
    example: WebhookEventType.ORDER_CREATE,
  })
  @IsEnum(WebhookEventType)
  @IsNotEmpty()
  event_type: WebhookEventType;

  @ApiProperty({
    description: 'Data associated with the webhook event',
    example: {
      transactionId: 'TXN_123456',
      amount: 100.00,
      customerName: 'John Doe',
      customerPhone: '+1234567890',
      customerEmail: 'john.doe@example.com',
    },
  })
  @IsObject()
  @IsNotEmpty()
  data: any;

  @ApiProperty({
    description: 'Timestamp of the webhook event',
    example: new Date().toISOString(),
  })
  @IsString()
  @IsNotEmpty()
  timestamp: string;

  @ApiProperty({
    description: 'Source of the webhook event',
    example: 'pos_system',
  })
  @IsString()
  @IsOptional()
  source?: string;

  @ApiPropertyOptional({ description: 'Tenant MPIN for integration config lookup' })
  @IsOptional()
  @IsString()
  mpin?: string;

  @ApiPropertyOptional({ description: 'Company ID for integration config lookup' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  company_id?: number;

  @ApiPropertyOptional({ description: 'Branch ID for integration config lookup' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  branch_id?: number;
}

export class NotificationJobDto {
  name:string
  recordId:string
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

  @IsOptional()
  @IsString()
  mpin?: string;

  @IsOptional()
  companyId?: number;

  @IsOptional()
  branchId?: number;

  @IsOptional()
  correlationId?: string;
}
