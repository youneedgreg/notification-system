import { IsEnum, IsString, IsObject, IsNumber, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { NotificationType } from '@app/common';

export class UserDataDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  link: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  meta?: Record<string, any>;
}

export class CreateNotificationDto {
  @ApiProperty({ enum: NotificationType })
  @IsEnum(NotificationType)
  notification_type: NotificationType;

  @ApiProperty()
  @IsUUID()
  user_id: string;

  @ApiProperty()
  @IsString()
  template_code: string;

  @ApiProperty({ type: UserDataDto })
  @IsObject()
  variables: UserDataDto;

  @ApiProperty()
  @IsString()
  request_id: string;

  @ApiProperty()
  @IsNumber()
  priority: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}