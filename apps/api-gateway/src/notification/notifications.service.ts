import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { 
  NotificationType, 
  ApiResponse, 
  QUEUE_NAMES, 
  NotificationStatus,
  NotificationStatusData 
} from '@app/common';
import { v4 as uuidv4 } from 'uuid';
import * as amqp from 'amqplib';

@Injectable()
export class NotificationsService {
  private connection: amqp.Connection;
  private channel: amqp.Channel;
  private notificationStatuses = new Map<string, NotificationStatusData>();
  private processedRequests = new Set<string>();
  private requestToNotificationMap = new Map<string, string>();

  constructor(
    @Inject('RABBITMQ_SERVICE') private rabbitClient: ClientProxy,
  ) {
    this.initRabbitMQ();
  }

  private async initRabbitMQ() {
    try {
      this.connection = await amqp.connect(
        process.env.RABBITMQ_URL || 'amqp://rabbitmq_user:rabbitmq_pass_2024@localhost:5672'
      );
      this.channel = await this.connection.createChannel();

      // Create exchange
      await this.channel.assertExchange('notifications.direct', 'direct', { durable: true });

      // Create queues
      await this.channel.assertQueue(QUEUE_NAMES.EMAIL, { durable: true });
      await this.channel.assertQueue(QUEUE_NAMES.PUSH, { durable: true });
      await this.channel.assertQueue(QUEUE_NAMES.FAILED, { durable: true });

      // Bind queues to exchange
      await this.channel.bindQueue(QUEUE_NAMES.EMAIL, 'notifications.direct', 'email');
      await this.channel.bindQueue(QUEUE_NAMES.PUSH, 'notifications.direct', 'push');

      console.log('✅ RabbitMQ initialized successfully');
    } catch (error) {
      console.error('❌ RabbitMQ initialization failed:', error);
      setTimeout(() => this.initRabbitMQ(), 5000);
    }
  }

  async createNotification(dto: CreateNotificationDto): Promise<ApiResponse<any>> {
    try {
      if (!this.channel) {
        throw new Error('RabbitMQ channel not initialized');
      }

      const notificationId = uuidv4();

      // Check for duplicate request_id (idempotency)
      if (this.isRequestProcessed(dto.request_id)) {
        const existingNotification = this.findNotificationByRequestId(dto.request_id);
        if (existingNotification) {
          return {
            success: true,
            data: existingNotification,
            message: 'Notification already processed (duplicate request_id)',
          };
        }
      }

      // Prepare message
      const message = {
        notification_id: notificationId,
        user_id: dto.user_id,
        template_code: dto.template_code,
        variables: dto.variables,
        request_id: dto.request_id,
        priority: dto.priority,
        metadata: dto.metadata,
        created_at: new Date().toISOString(),
        retry_count: 0,
      };

      // Route to appropriate queue
      const routingKey = dto.notification_type === NotificationType.EMAIL ? 'email' : 'push';
      
      await this.channel.publish(
        'notifications.direct',
        routingKey,
        Buffer.from(JSON.stringify(message)),
        {
          persistent: true,
          priority: dto.priority,
        }
      );

      // Store notification status
      const statusData: NotificationStatusData = {
        notification_id: notificationId,
        status: NotificationStatus.PENDING,
        created_at: new Date(),
        user_id: dto.user_id,
        notification_type: dto.notification_type,
        retry_count: 0,
      };
      this.notificationStatuses.set(notificationId, statusData);

      // Mark request as processed
      this.markRequestProcessed(dto.request_id, notificationId);

      return {
        success: true,
        data: {
          notification_id: notificationId,
          status: NotificationStatus.PENDING,
          request_id: dto.request_id,
        },
        message: 'Notification queued successfully',
      };
    } catch (error) {
      console.error('Error creating notification:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to queue notification',
      };
    }
  }

  async getNotificationStatus(notificationId: string): Promise<ApiResponse<NotificationStatusData>> {
    try {
      const status = this.notificationStatuses.get(notificationId);

      if (!status) {
        return {
          success: false,
          message: 'Notification not found',
          error: 'No notification found with this ID',
        };
      }

      return {
        success: true,
        data: status,
        message: 'Status retrieved successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to retrieve status',
      };
    }
  }

  async getBulkNotificationStatus(notificationIds: string[]): Promise<ApiResponse<NotificationStatusData[]>> {
    try {
      if (!notificationIds || notificationIds.length === 0) {
        throw new BadRequestException('notification_ids array cannot be empty');
      }

      if (notificationIds.length > 100) {
        throw new BadRequestException('Maximum 100 notification IDs allowed per request');
      }

      const results: NotificationStatusData[] = [];
      const notFound: string[] = [];

      for (const id of notificationIds) {
        const status = this.notificationStatuses.get(id);
        if (status) {
          results.push(status);
        } else {
          notFound.push(id);
        }
      }

      return {
        success: true,
        data: results,
        message: `Retrieved ${results.length} notification statuses`,
        meta: {
          total: results.length,
          requested: notificationIds.length,
          found: results.length,
          not_found: notFound.length,
          not_found_ids: notFound,
        } as any,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to retrieve bulk statuses',
      };
    }
  }

  async updateNotificationStatus(
    notificationId: string, 
    status: NotificationStatus, 
    error?: string
  ): Promise<ApiResponse<NotificationStatusData>> {
    try {
      const existing = this.notificationStatuses.get(notificationId);
      
      if (!existing) {
        return {
          success: false,
          message: 'Notification not found',
          error: 'Cannot update status for non-existent notification',
        };
      }

      const updated: NotificationStatusData = {
        ...existing,
        status,
        error,
        updated_at: new Date(),
      };

      if (status === NotificationStatus.PENDING) {
        updated.retry_count = (existing.retry_count || 0) + 1;
      }

      this.notificationStatuses.set(notificationId, updated);

      return {
        success: true,
        data: updated,
        message: 'Status updated successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to update status',
      };
    }
  }

  async getNotificationsByStatus(status: NotificationStatus): Promise<ApiResponse<NotificationStatusData[]>> {
    try {
      const results: NotificationStatusData[] = [];

      for (const [_, notification] of this.notificationStatuses) {
        if (notification.status === status) {
          results.push(notification);
        }
      }

      return {
        success: true,
        data: results,
        message: `Found ${results.length} notifications with status: ${status}`,
        meta: {
          total: results.length,
          status,
        } as any,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to retrieve notifications by status',
      };
    }
  }

  async getUserNotifications(userId: string, limit: number = 50): Promise<ApiResponse<NotificationStatusData[]>> {
    try {
      const results: NotificationStatusData[] = [];

      for (const [_, notification] of this.notificationStatuses) {
        if (notification.user_id === userId) {
          results.push(notification);
          if (results.length >= limit) break;
        }
      }

      results.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

      return {
        success: true,
        data: results,
        message: `Found ${results.length} notifications for user`,
        meta: {
          total: results.length,
          user_id: userId,
        } as any,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to retrieve user notifications',
      };
    }
  }

  async getNotificationStats(): Promise<ApiResponse<any>> {
    try {
      const stats = {
        total: this.notificationStatuses.size,
        pending: 0,
        delivered: 0,
        failed: 0,
        email: 0,
        push: 0,
      };

      for (const [_, notification] of this.notificationStatuses) {
        if (notification.status === NotificationStatus.PENDING) stats.pending++;
        if (notification.status === NotificationStatus.DELIVERED) stats.delivered++;
        if (notification.status === NotificationStatus.FAILED) stats.failed++;
        if (notification.notification_type === 'email') stats.email++;
        if (notification.notification_type === 'push') stats.push++;
      }

      return {
        success: true,
        data: stats,
        message: 'Statistics retrieved successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to retrieve statistics',
      };
    }
  }

  private isRequestProcessed(requestId: string): boolean {
    return this.processedRequests.has(requestId);
  }

  private markRequestProcessed(requestId: string, notificationId: string): void {
    this.processedRequests.add(requestId);
    this.requestToNotificationMap.set(requestId, notificationId);
  }

  private findNotificationByRequestId(requestId: string): NotificationStatusData | null {
    const notificationId = this.requestToNotificationMap.get(requestId);
    if (notificationId) {
      return this.notificationStatuses.get(notificationId) || null;
    }
    return null;
  }

  async cleanupOldNotifications(olderThanDays: number = 7): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    for (const [id, notification] of this.notificationStatuses) {
      if (notification.created_at < cutoffDate) {
        this.notificationStatuses.delete(id);
      }
    }

    console.log(`🧹 Cleaned up notifications older than ${olderThanDays} days`);
  }

  async onModuleDestroy() {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      console.log('✅ RabbitMQ connection closed gracefully');
    } catch (error) {
      console.error('❌ Error closing RabbitMQ connection:', error);
    }
  }
}