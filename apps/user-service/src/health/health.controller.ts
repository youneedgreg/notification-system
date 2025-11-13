import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Check service health status' })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy',
  })
  async check() {
    const dbHealthy = this.dataSource.isInitialized;
    let redisHealthy = false;

    try {
      await this.redisClient.ping();
      redisHealthy = true;
    } catch (error) {
      redisHealthy = false;
    }

    return {
      status: dbHealthy && redisHealthy ? 'ok' : 'degraded',
      service: 'user-service',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      dependencies: {
        database: dbHealthy ? 'up' : 'down',
        redis: redisHealthy ? 'up' : 'down',
      },
      memory: process.memoryUsage(),
      node_version: process.version,
    };
  }
}
