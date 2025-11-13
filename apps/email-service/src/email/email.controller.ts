import { Controller, Get } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { EmailService } from './email.service';

@ApiTags('email')
@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @MessagePattern('send_email')
  async handleEmailMessage(@Payload() data: any) {
    await this.emailService.processEmailMessage(data);
    return { processed: true };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get email service statistics' })
  async getStats() {
    return this.emailService.getEmailStats();
  }
}
