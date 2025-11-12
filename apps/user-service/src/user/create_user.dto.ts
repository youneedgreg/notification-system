import { IsEmail, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ description: 'Full name of the user' })
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Email address of the user' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'Password for the account' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiPropertyOptional({ description: 'Push notification token' })
  @IsString()
  @IsOptional()
  push_token?: string;

  @ApiPropertyOptional({ description: 'Request ID for idempotency' })
  @IsOptional()
  @IsString()
  request_id?: string;

  @ApiPropertyOptional({ 
    description: 'User notification preferences',
    example: {
      email_enabled: true,
      push_enabled: true,
      language: 'en'
    }
  })
  @IsObject()
  @IsOptional()
  notification_preferences?: {
    email_enabled: boolean;
    push_enabled: boolean;
    language: string;
  };
}