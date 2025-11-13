import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DataSource } from 'typeorm';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  @ApiOperation({ summary: 'Check service health' })
  check() {
    const dbHealthy = this.dataSource.isInitialized;

    return {
      status: dbHealthy ? 'ok' : 'degraded',
      service: 'template-service',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      dependencies: {
        database: dbHealthy ? 'up' : 'down',
      },
      memory: process.memoryUsage(),
    };
  }
}
