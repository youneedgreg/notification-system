import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Patch,
  Query,
  Delete,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import {
  UpdateNotificationStatusDto,
  BulkStatusQueryDto,
} from './dto/notification-status.dto';
import {
  RetryNotificationDto,
  BulkRetryDto,
} from './dto/retry-notification.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { NotificationStatus } from '../common/types';
import { DeadLetterService } from './dead-letter.service';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly deadLetterService: DeadLetterService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new notification' })
  async create(@Body() createNotificationDto: CreateNotificationDto) {
    return this.notificationsService.createNotification(createNotificationDto);
  }

  @Post('broadcast')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Send notifications to both email and push channels',
    description: 'Sends the same notification to both email and push channels simultaneously. Requires at least one of email or push_token.'
  })
  async broadcast(@Body() broadcastDto: any) {
    return this.notificationsService.createBroadcastNotification(broadcastDto);
  }

  @Get('status/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get notification status by ID' })
  async getStatus(@Param('id') id: string) {
    return this.notificationsService.getNotificationStatus(id);
  }

  @Post('status/bulk')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get multiple notification statuses' })
  async getBulkStatus(@Body() bulkStatusDto: BulkStatusQueryDto) {
    return this.notificationsService.getBulkNotificationStatus(
      bulkStatusDto.notification_ids,
    );
  }

  @Patch('status')
  @ApiOperation({
    summary: 'Update notification status (internal use by services)',
  })
  async updateStatus(@Body() updateStatusDto: UpdateNotificationStatusDto) {
    return this.notificationsService.updateNotificationStatus(
      updateStatusDto.notification_id,
      updateStatusDto.status,
      updateStatusDto.error,
    );
  }

  @Get('user/:userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all notifications for a user' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getUserNotifications(
    @Param('userId') userId: string,
    @Query('limit') limit: number = 50,
  ) {
    return this.notificationsService.getUserNotifications(userId, limit);
  }

  @Get('by-status/:status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get notifications by status' })
  async getByStatus(@Param('status') status: NotificationStatus) {
    return this.notificationsService.getNotificationsByStatus(status);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get notification statistics' })
  async getStats() {
    return this.notificationsService.getNotificationStats();
  }

  // Dead Letter Queue Management
  @Get('failed')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all failed notifications' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getFailedNotifications(@Query('limit') limit: number = 50) {
    const messages = await this.deadLetterService.getFailedMessages(limit);
    return {
      success: true,
      data: messages,
      message: `Retrieved ${messages.length} failed notifications`,
      meta: {
        total: messages.length,
        limit,
      },
    };
  }

  @Get('failed/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get specific failed notification' })
  async getFailedNotification(@Param('id') id: string) {
    const message = await this.deadLetterService.getFailedMessage(id);
    if (!message) {
      return {
        success: false,
        message: 'Failed notification not found',
      };
    }
    return {
      success: true,
      data: message,
      message: 'Failed notification retrieved',
    };
  }

  @Get('failed-stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get failed notifications statistics' })
  async getFailedStats() {
    const stats = await this.deadLetterService.getStats();
    return {
      success: true,
      data: stats,
      message: 'Failed notifications statistics retrieved',
    };
  }

  @Post('retry')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retry a failed notification' })
  async retryNotification(@Body() retryDto: RetryNotificationDto) {
    const result = await this.deadLetterService.retryMessage(
      retryDto.notification_id,
    );
    return {
      success: result,
      message: result
        ? 'Notification queued for retry'
        : 'Failed to retry notification',
    };
  }

  @Post('retry/bulk')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retry multiple failed notifications' })
  async retryBulk(@Body() bulkRetryDto: BulkRetryDto) {
    const result = await this.deadLetterService.retryBulk(
      bulkRetryDto.notification_ids,
    );
    return {
      success: true,
      data: result,
      message: `Retried ${result.success} notifications, ${result.failed} failed`,
    };
  }

  @Delete('failed/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Clear a failed notification from the queue' })
  async clearFailed(@Param('id') id: string) {
    const result = await this.deadLetterService.clearFailedMessage(id);
    return {
      success: result,
      message: result
        ? 'Failed notification cleared'
        : 'Failed notification not found',
    };
  }
}
