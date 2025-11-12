import { Controller, Post, Get, Body, Param, UseGuards, Patch, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationStatusDto, BulkStatusQueryDto } from './dto/notification-status.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { NotificationStatus } from '@app/common';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new notification' })
  async create(@Body() createNotificationDto: CreateNotificationDto) {
    return this.notificationsService.createNotification(createNotificationDto);
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
    return this.notificationsService.getBulkNotificationStatus(bulkStatusDto.notification_ids);
  }

  @Patch('status')
  @ApiOperation({ summary: 'Update notification status (internal use by services)' })
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
}