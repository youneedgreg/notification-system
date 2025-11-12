import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Check service health' })
  check() {
    return {
      status: 'ok',
      service: 'template-service',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}