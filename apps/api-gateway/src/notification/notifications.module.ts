import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { DeadLetterService } from './dead-letter.service';
import { NotificationStatus } from './entities/notification-status.entity';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationStatus]),
    MetricsModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '1d' },
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
          queueOptions: { durable: true },
        },
      },
    ]),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, DeadLetterService],
})
export class NotificationsModule {}
