import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { NotificationsModule } from './notification/notifications.module';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health/health.controller';
import { QUEUE_NAMES, EXCHANGE_NAME } from '@app/common';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ClientsModule.register([
      {
        name: 'RABBITMQ_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://rabbitmq_user:rabbitmq_pass_2024@localhost:5672'],
          queue: 'gateway_queue',
          queueOptions: {
            durable: true,
          },
        },
      },
    ]),
    NotificationsModule,
    AuthModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}