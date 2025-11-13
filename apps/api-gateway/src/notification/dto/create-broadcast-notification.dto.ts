import {
  IsString,
  IsObject,
  IsNumber,
  IsOptional,
  IsUUID,
  IsEmail,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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

export class CreateBroadcastNotificationDto {
  @ApiProperty()
  @IsUUID()
  user_id: string;

  @ApiProperty({
    required: false,
    description: 'Recipient email for email notifications',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    required: false,
    description: 'Push token for push notifications',
  })
  @IsOptional()
  @IsString()
  push_token?: string;

  @ApiProperty({
    description: 'Template code for email',
  })
  @IsString()
  email_template_code: string;

  @ApiProperty({
    description: 'Template code for push',
  })
  @IsString()
  push_template_code: string;

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
