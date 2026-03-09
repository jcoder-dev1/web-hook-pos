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
import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookLog } from './modules/webhook/entities/webhook-log.entity';
import { IntegrationDeliveryLog } from './modules/webhook/entities/integration-delivery-log.entity';
import { ThirdPartyIntegration } from './modules/webhook/entities/third-party-integration.entity';
import { IntegrationConfigMasterService } from './modules/webhook/services/integration-config-master.service';
import { WebhookController } from './modules/webhook/webhook.controller';
import { ProcessorService } from './modules/webhook/processors/notification.processor';
import { QueueService } from './modules/webhook/webhook.service';
import { SmsService } from './modules/webhook/services/sms.service';
import { EmailService } from './modules/webhook/services/email.service';
import { WhatsappService } from './modules/webhook/services/whatsapp.service';

/**
 * Single DB connection to MASTER DB.
 * - Reads third_party_integrations for config (by mpin, companyId, branchId, channel).
 * - Writes webhook_logs and integration_delivery_logs for tracing.
 * Use MASTER_DB_* env vars (fallback to DB_*).
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('MASTER_DB_HOST') || configService.get('DB_HOST'),
        port: +(configService.get('MASTER_DB_PORT') || configService.get('DB_PORT') || 5432),
        username: configService.get('MASTER_DB_USERNAME') || configService.get('DB_USERNAME'),
        password: 'Welcome@1q3#',        //configService.get('MASTER_DB_PASSWORD') || configService.get('DB_PASSWORD') || '',
        database: configService.get('MASTER_DB_DATABASE') || configService.get('MASTER_DB_NAME') || configService.get('DB_NAME'),
        entities: [ThirdPartyIntegration, WebhookLog, IntegrationDeliveryLog],
        synchronize: false,
        logging: true,
        autoLoadEntities: true,
        extra: {
          max: 10,
          connectionTimeoutMillis: 2000,
        },
      }),
      inject: [ConfigService],
    }),

    TypeOrmModule.forFeature([ThirdPartyIntegration, WebhookLog, IntegrationDeliveryLog]),
  ],
  controllers: [WebhookController],
  providers: [
    QueueService,
    ProcessorService,
    SmsService,
    EmailService,
    WhatsappService,
    IntegrationConfigMasterService,
  ],
})
export class AppModule implements OnModuleInit {
  private readonly logger = new Logger(AppModule.name);

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const whatsappDebug =
      (this.configService.get<string>('WHATSAPP_DEBUG') ||
        process.env.WHATSAPP_DEBUG ||
        '')
        .toString()
        .toLowerCase() === 'true';

    // NOTE: Do not log secrets here. This is just a startup indicator.
    this.logger.log(
      `Webhook service started (WHATSAPP_DEBUG=${whatsappDebug ? 'true' : 'false'})`,
    );
  }
}
