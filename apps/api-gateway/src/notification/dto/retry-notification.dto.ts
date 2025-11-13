import { IsUUID, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RetryNotificationDto {
  @ApiProperty({
    description: 'Notification ID to retry',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID()
  notification_id: string;

  @ApiProperty({
    description: 'Optional reason for retry',
    example: 'Manual retry after SMTP fix',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class BulkRetryDto {
  @ApiProperty({
    description: 'Array of notification IDs to retry',
    type: [String],
  })
  @IsUUID('4', { each: true })
  notification_ids: string[];
}
