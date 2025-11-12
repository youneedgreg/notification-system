import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { EmailModule } from './email/email.module';
import { HealthController } from './health/health.controller';

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
          queue: 'email.queue',
          queueOptions: {
            durable: true,
          },
        },
      },
    ]),
    EmailModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}