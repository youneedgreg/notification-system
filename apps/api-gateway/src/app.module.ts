import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsModule } from './notification/notifications.module';
import { AuthModule } from './auth/auth.module';
import { MetricsModule } from './metrics/metrics.module';
import { HealthController } from './health/health.controller';
import { CorrelationIdMiddleware } from './common/correlation-id.middleware';
import { CircuitBreakerService } from './common/circuit-breaker.service';
import { RedisService } from './common/redis.service';
import { ServiceDiscoveryService } from './common/service-discovery.service';
import { NotificationStatus } from './notification/entities/notification-status.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute per IP
      },
    ]),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT, 10) || 5432,
      username: process.env.POSTGRES_USER || 'notif_user',
      password: process.env.POSTGRES_PASSWORD || 'notif_pass_2024',
      database: process.env.POSTGRES_DB || 'notification_system',
      entities: [NotificationStatus],
      synchronize: true, // Set to false in production
    }),
    ClientsModule.register([
      {
        name: 'RABBITMQ_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [
            process.env.RABBITMQ_URL ||
              'amqp://rabbitmq_user:rabbitmq_pass_2024@localhost:5672',
          ],
          queue: 'gateway_queue',
          queueOptions: {
            durable: true,
          },
        },
      },
    ]),
    NotificationsModule,
    AuthModule,
    MetricsModule,
  ],
  controllers: [HealthController],
  providers: [
    CircuitBreakerService,
    RedisService,
    ServiceDiscoveryService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
