import { IsEnum, IsString, IsOptional, IsDateString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { NotificationStatus } from '@app/common';

export class UpdateNotificationStatusDto {
  @ApiProperty({
    description: 'Unique notification identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  notification_id: string;

  @ApiProperty({
    description: 'Current status of the notification',
    enum: NotificationStatus,
    example: NotificationStatus.DELIVERED,
  })
  @IsEnum(NotificationStatus)
  status: NotificationStatus;

  @ApiProperty({
    description: 'Timestamp when status was updated',
    required: false,
    example: '2025-11-12T10:30:00Z',
  })
  @IsOptional()
  @IsDateString()
  timestamp?: string;

  @ApiProperty({
    description: 'Error message if status is failed',
    required: false,
    example: 'SMTP connection timeout',
  })
  @IsOptional()
  @IsString()
  error?: string;
}

export class GetNotificationStatusDto {
  @ApiProperty({
    description: 'Notification ID to query',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  notification_id: string;
}

export class BulkStatusQueryDto {
  @ApiProperty({
    description: 'Array of notification IDs',
    type: [String],
    example: [
      '550e8400-e29b-41d4-a716-446655440000',
      '660e8400-e29b-41d4-a716-446655440001',
    ],
  })
  @IsUUID('4', { each: true })
  notification_ids: string[];
}