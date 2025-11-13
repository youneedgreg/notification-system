import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('EmailService');

  // Create HTTP app for health checks and status endpoints
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableCors();

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('Email Service API')
    .setDescription('Email Processing & Delivery Service - HNG Stage 4')
    .setVersion('1.0.0')
    .addTag('health', 'Health check endpoints')
    .addTag('email', 'Email processing endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Note: RabbitMQ consumer is handled via EmailService.startConsumer()
  // Not using NestJS microservice pattern to avoid consumer conflicts

  const port = process.env.PORT || 3002;
  await app.listen(port, '0.0.0.0');

  logger.log(`\n${'='.repeat(60)}`);
  logger.log(`📧 Email Service is running on: http://localhost:${port}`);
  logger.log(`📚 Swagger Documentation: http://localhost:${port}/api/docs`);
  logger.log(`🔍 Health Check: http://localhost:${port}/api/v1/health`);
  logger.log(`📨 Listening to RabbitMQ queue: email.queue`);
  logger.log(`${'='.repeat(60)}\n`);
}

bootstrap().catch((error) => {
  console.error('❌ Failed to start Email Service:', error);
  process.exit(1);
});
