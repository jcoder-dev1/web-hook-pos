import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'; // Importing Swagger tools for API documentation
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
 
  // Configure Swagger for API documentation
  const config = new DocumentBuilder()
    .setTitle('iPlugPOS WebHooks API')
    .setDescription('iPlugPOS WebHooks API docs')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        in: 'header',
      },
      'access-token' // 🔑 custom name for the security
    )
    .addTag('API List') // Add a tag for grouping endpoints in Swagger
    .build();

  // Apply global validation pipes for request validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    })
  );

  app.enableCors();

  // Create the Swagger document and set up the Swagger UI
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory);
  await app.listen(process.env.PORT ?? 3000);
}
//
bootstrap();
