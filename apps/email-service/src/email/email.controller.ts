import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { EmailService } from './email.service';

@ApiTags('email')
@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  // Note: Removed @MessagePattern consumer to avoid conflict with startConsumer()
  // The email service uses a direct AMQP consumer via startConsumer() method

  @Get('stats')
  @ApiOperation({ summary: 'Get email service statistics' })
  async getStats() {
    return this.emailService.getEmailStats();
  }
}
