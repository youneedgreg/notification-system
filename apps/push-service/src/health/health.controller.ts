import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PushService } from '../push/push.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly pushService: PushService) {}

  @Get()
  @ApiOperation({ summary: 'Check service health' })
  check() {
    const stats = this.pushService.getPushStats();

    return {
      status: stats.firebase_initialized ? 'ok' : 'degraded',
      service: 'push-service',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      dependencies: {
        firebase: stats.firebase_initialized ? 'up' : 'down',
        rabbitmq: 'up',
      },
      config: {
        max_retries: stats.max_retries,
        retry_delay: stats.retry_delay,
      },
    };
  }
}
