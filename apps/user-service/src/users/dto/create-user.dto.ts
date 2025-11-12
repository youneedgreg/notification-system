import { IsString, IsEmail, IsObject, IsOptional, MinLength, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UserPreferenceDto {
  @ApiProperty({ example: true, description: 'Email notification preference' })
  @IsBoolean()
  email: boolean;

  @ApiProperty({ example: true, description: 'Push notification preference' })
  @IsBoolean()
  push: boolean;
}

export class CreateUserDto {
  @ApiProperty({ example: 'John Doe', description: 'User full name' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'john@example.com', description: 'User email address' })
  @IsEmail()
  email: string;

  @ApiProperty({ 
    required: false, 
    example: 'fcm-device-token-here',
    description: 'Firebase Cloud Messaging device token for push notifications'
  })
  @IsOptional()
  @IsString()
  push_token?: string;

  @ApiProperty({ 
    type: UserPreferenceDto,
    example: { email: true, push: true },
    description: 'User notification preferences'
  })
  @IsObject()
  preferences: UserPreferenceDto;

  @ApiProperty({ 
    example: 'password123',
    description: 'User password (minimum 6 characters)',
    minLength: 6
  })
  @IsString()
  @MinLength(6)
  password: string;
}