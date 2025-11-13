import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from './common/filters/http-exeption.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptors';
import { ServiceDiscoveryService } from './common/service-discovery.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global filters and interceptors
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  // CORS
  app.enableCors();

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Notification System API')
    .setDescription('Distributed Notification System API Gateway')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);

  // Register API Gateway in service discovery
  const serviceDiscovery = app.get(ServiceDiscoveryService);
  await serviceDiscovery.registerService({
    name: 'api-gateway',
    host: process.env.HOST || 'localhost',
    port: Number(port),
    healthCheckUrl: `http://localhost:${port}/api/v1/health`,
    metadata: {
      version: '1.0',
      type: 'gateway',
    },
  });

  console.log(`🚀 API Gateway running on http://localhost:${port}`);
  console.log(`📚 Swagger docs: http://localhost:${port}/api/docs`);
  console.log(`✅ Registered in service discovery`);
}
bootstrap();
