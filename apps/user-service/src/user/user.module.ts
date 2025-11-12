import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { RedisProvider } from '../common/redis.provider';
import { RabbitProvider } from '../common/rabbitmq.providers';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [TypeOrmModule.forFeature([User]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'default_secret_key',
      signOptions: { expiresIn: '1h' },
    }),
],
  controllers: [UserController],
  providers: [UserService, RabbitProvider, RedisProvider],
  exports: [UserService],
})
export class UserModule {}
