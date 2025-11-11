import Redis from 'ioredis';

export const RedisProvider = {
  provide: 'REDIS_CLIENT',
  useFactory: () => {
    return new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT || 6379),
    });
  },
};
