// import { Controller, Post, Body, Get } from '@nestjs/common';
// import { QueueService } from '../webhook/webhook.service';
// import { WebhookPayloadDto, WebhookEventType } from '../webhook/dto/webhook-payload.dto';

// @Controller('test')
// export class TestController {
//   constructor(private readonly webhookService: QueueService) {}

//   @Get('webhook-sample')
//   getSampleWebhookPayloads() {
//     return {
//       pos_save: {
//         id: 'webhook_' + Date.now(),
//         event_type: WebhookEventType.POS_SAVE,
//         timestamp: new Date().toISOString(),
//         source: 'pos_system',
//         data: {
//           transactionId: 'TXN_' + Math.random().toString(36).substr(2, 9),
//           amount: 125.50,
//           customerName: 'John Doe',
//           customerPhone: '+1234567890',
//           customerEmail: 'john.doe@example.com',
//           merchantPhone: '+0987654321',
//           merchantEmail: 'merchant@store.com',
//           paymentMethod: 'Credit Card',
//           items: [
//             { name: 'Coffee', quantity: 2, price: 4.50 },
//             { name: 'Sandwich', quantity: 1, price: 12.00 },
//             { name: 'Cookie', quantity: 3, price: 2.00 }
//           ]
//         }
//       },
//       order_create: {
//         id: 'webhook_' + Date.now(),
//         event_type: WebhookEventType.ORDER_CREATE,
//         timestamp: new Date().toISOString(),
//         source: 'order_system',
//         data: {
//           orderId: 'ORD_' + Math.random().toString(36).substr(2, 9),
//           total: 89.99,
//           status: 'Created',
//           customerName: 'Jane Smith',
//           customerPhone: '+1987654321',
//           customerEmail: 'jane.smith@example.com',
//           customerWhatsapp: '+1987654321',
//           items: [
//             { name: 'Pizza Large', quantity: 1, price: 24.99 },
//             { name: 'Drink', quantity: 2, price: 3.50 },
//             { name: 'Dessert', quantity: 1, price: 8.00 }
//           ]
//         }
//       },
//       payment_complete: {
//         id: 'webhook_' + Date.now(),
//         event_type: WebhookEventType.PAYMENT_COMPLETE,
//         timestamp: new Date().toISOString(),
//         source: 'payment_gateway',
//         data: {
//           paymentRef: 'PAY_' + Math.random().toString(36).substr(2, 9),
//           amount: 199.99,
//           paymentMethod: 'PayPal',
//           orderId: 'ORD_12345',
//           customerName: 'Bob Wilson',
//           customerEmail: 'bob.wilson@example.com',
//           customerPhone: '+1555123456'
//         }
//       }
//     };
//   }

//   @Post('simulate-webhook')
//   async simulateWebhook(@Body() payload: WebhookPayloadDto) {
//     try {
//       await this.webhookService.enqueue(payload);
//       return {
//         success: true,
//         message: 'Webhook simulation successful',
//         webhookId: payload.id
//       };
//     } catch (error) {
//       return {
//         success: false,
//         message: 'Webhook simulation failed',
//         error: error.message
//       };
//     }
//   }
// }
