import { ApiProperty } from '@nestjs/swagger';

export class ApiResponseDto<T> {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  data: T;

  @ApiProperty()
  message: string;
}

export class UserResponseDto {
  @ApiProperty()
  user_id: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ required: false })
  push_token?: string;

  @ApiProperty()
  notification_preferences: {
    email_enabled: boolean;
    push_enabled: boolean;
    language: string;
  };
}

export class AuthResponseDto {
  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;

  @ApiProperty()
  access_token: string;
}