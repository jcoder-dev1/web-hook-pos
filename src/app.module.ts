// import { Module } from '@nestjs/common';
// import { AppController } from './app.controller';
// import { AppService } from './app.service';
// import { WebhookModule } from './modules/webhook/webhook.module';
// import { TestModule } from './modules/test/test.module';
// import { HealthModule } from './modules/health/health.module';
// import { AppConfigModule } from './config/app-config.module';

// @Module({
//   imports: [
//     AppConfigModule,

//     WebhookModule,
//     TestModule,
//     HealthModule,
//   ],
//   controllers: [AppController],
//   providers: [AppService],
// })
// export class AppModule {}
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookLog } from './modules/webhook/entities/webhook-log.entity';
import { WebhookController } from './modules/webhook/webhook.controller';
import { ProcessorService } from './modules/webhook/processors/notification.processor';
import { QueueService } from './modules/webhook/webhook.service';
import { SmsService } from './modules/webhook/services/sms.service';
import { EmailService } from './modules/webhook/services/email.service';
import { WhatsappService } from './modules/webhook/services/whatsapp.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // TypeORM configuration using ConfigService
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],

      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: +configService.get('DB_PORT'),
        username: configService.get('DB_USERNAME'),
        password: 'Welcome@1q3#',
        database: configService.get('DB_NAME'),
        entities: [WebhookLog],
        synchronize: false,

        logging: true,
        autoLoadEntities: true,
        // Additional PostgreSQL options
        extra: {
          max: 10, // Maximum number of connections in the pool
          connectionTimeoutMillis: 2000, // Connection timeout
        },
      }),
      inject: [ConfigService],
    }),

    TypeOrmModule.forFeature([WebhookLog]),
  ],
  controllers: [WebhookController],
  providers: [
    QueueService,
    ProcessorService,
    SmsService,
    EmailService,
    WhatsappService,
  ],
})
export class AppModule {}
