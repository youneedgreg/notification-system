import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PushModule } from './push/push.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PushModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
