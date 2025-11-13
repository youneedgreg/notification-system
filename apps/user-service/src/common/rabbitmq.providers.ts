import {
  ClientProxyFactory,
  Transport,
  ClientProxy,
  RmqOptions,
} from '@nestjs/microservices';

export const RabbitProvider = {
  provide: 'RABBITMQ_CLIENT',
  useFactory: (): ClientProxy => {
    const url = process.env.RABBITMQ_URL;
    if (!url) {
      throw new Error('RABBITMQ_URL environment variable is not defined');
    }

    const options: RmqOptions = {
      transport: Transport.RMQ,
      options: {
        urls: [url],
        queue: 'events_queue',
        queueOptions: { durable: true },
      },
    };

    return ClientProxyFactory.create(options);
  },
};
