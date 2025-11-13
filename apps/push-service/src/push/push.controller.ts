import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PushService } from './push.service';

@ApiTags('push')
@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get push service statistics' })
  getStats() {
    return this.pushService.getPushStats();
  }
}
