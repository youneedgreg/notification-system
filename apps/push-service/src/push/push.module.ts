import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PushController } from './push.controller';
import { PushService } from './push.service';

@Module({
  imports: [ConfigModule],
  controllers: [PushController],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
