import { Transport } from '@nestjs/microservices';

export const getRabbitMQConfig = () => ({
  transport: Transport.RMQ,
  options: {
    urls: [process.env.RABBITMQ_URL || 'amqp://rabbitmq_user:rabbitmq_pass_2024@localhost:5672'],
    queue: '', // Will be set per service
    queueOptions: {
      durable: true,
    },
    prefetchCount: 1,
  },
});