import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { EmailService } from '../email/email.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly emailService: EmailService) {}

  @Get()
  @ApiOperation({ summary: 'Check service health' })
  async check() {
    const stats = await this.emailService.getEmailStats();

    return {
      status: 'ok',
      service: 'email-service',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      dependencies: {
        smtp: stats.smtp_connected ? 'up' : 'down',
        rabbitmq: 'up',
      },
      config: {
        max_retries: stats.max_retries,
        retry_delay: stats.retry_delay,
      },
    };
  }
}
