import { Injectable, Inject, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { CreateNotificationDto } from './dto/create-notification.dto';
import {
  NotificationType,
  ApiResponse,
  QUEUE_NAMES,
  NotificationStatus,
  NotificationStatusData,
} from '../common/types';
import { NotificationStatus as NotificationStatusEntity } from './entities/notification-status.entity';
import { MetricsService } from '../metrics/metrics.service';
import { v4 as uuidv4 } from 'uuid';
import * as amqp from 'amqplib';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private connection: amqp.Connection;
  private channel: amqp.Channel;
  private processedRequests = new Set<string>();
  private requestToNotificationMap = new Map<string, string>();

  constructor(
    @Inject('RABBITMQ_SERVICE') private rabbitClient: ClientProxy,
    @InjectRepository(NotificationStatusEntity)
    private notificationRepository: Repository<NotificationStatusEntity>,
    private metricsService: MetricsService,
  ) {
    this.initRabbitMQ();
  }

  private async initRabbitMQ() {
    try {
      const conn = await amqp.connect(
        process.env.RABBITMQ_URL ||
          'amqp://rabbitmq_user:rabbitmq_pass_2024@localhost:5672',
      );
      this.connection = conn as any;
      this.channel = await conn.createChannel();

      // Create exchange
      await this.channel.assertExchange('notifications.direct', 'direct', {
        durable: true,
      });

      // Create queues
      await this.channel.assertQueue(QUEUE_NAMES.EMAIL, { durable: true });
      await this.channel.assertQueue(QUEUE_NAMES.PUSH, { durable: true });
      await this.channel.assertQueue(QUEUE_NAMES.FAILED, { durable: true });

      // Bind queues to exchange
      await this.channel.bindQueue(
        QUEUE_NAMES.EMAIL,
        'notifications.direct',
        'email',
      );
      await this.channel.bindQueue(
        QUEUE_NAMES.PUSH,
        'notifications.direct',
        'push',
      );

      console.log('✅ RabbitMQ initialized successfully');
    } catch (error) {
      console.error('❌ RabbitMQ initialization failed:', error);
      setTimeout(() => this.initRabbitMQ(), 5000);
    }
  }

  async createNotification(
    dto: CreateNotificationDto,
  ): Promise<ApiResponse<any>> {
    try {
      if (!this.channel) {
        throw new Error('RabbitMQ channel not initialized');
      }

      const notificationId = uuidv4();

      // Check for duplicate request_id (idempotency)
      if (this.isRequestProcessed(dto.request_id)) {
        const existingNotification = this.findNotificationByRequestId(
          dto.request_id,
        );
        if (existingNotification) {
          return {
            success: true,
            data: existingNotification,
            message: 'Notification already processed (duplicate request_id)',
          };
        }
      }

      // Validate required fields based on notification type
      if (dto.notification_type === NotificationType.EMAIL && !dto.email) {
        throw new BadRequestException(
          'Email is required for email notifications',
        );
      }
      if (dto.notification_type === NotificationType.PUSH && !dto.push_token) {
        throw new BadRequestException(
          'Push token is required for push notifications',
        );
      }

      // Prepare message
      const message: any = {
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

      // Add type-specific fields
      if (dto.notification_type === NotificationType.EMAIL) {
        message.email = dto.email;
      } else if (dto.notification_type === NotificationType.PUSH) {
        message.push_token = dto.push_token;
      }

      // Route to appropriate queue
      const routingKey =
        dto.notification_type === NotificationType.EMAIL ? 'email' : 'push';

      this.channel.publish(
        'notifications.direct',
        routingKey,
        Buffer.from(JSON.stringify(message)),
        {
          persistent: true,
          priority: dto.priority,
        },
      );

      // Record metrics
      this.metricsService.recordNotification(dto.notification_type, 'sent');

      // Store notification status in database
      const statusEntity = this.notificationRepository.create({
        notification_id: notificationId,
        status: NotificationStatus.PENDING,
        user_id: dto.user_id,
        notification_type: dto.notification_type,
        request_id: dto.request_id,
        retry_count: 0,
        metadata: dto.metadata || {},
      });
      await this.notificationRepository.save(statusEntity);

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

  async getNotificationStatus(
    notificationId: string,
  ): Promise<ApiResponse<NotificationStatusData>> {
    try {
      const status = await this.notificationRepository.findOne({
        where: { notification_id: notificationId },
      });

      if (!status) {
        return {
          success: false,
          message: 'Notification not found',
          error: 'No notification found with this ID',
        };
      }

      return {
        success: true,
        data: this.entityToStatusData(status),
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

  async getBulkNotificationStatus(
    notificationIds: string[],
  ): Promise<ApiResponse<NotificationStatusData[]>> {
    try {
      if (!notificationIds || notificationIds.length === 0) {
        throw new BadRequestException('notification_ids array cannot be empty');
      }

      if (notificationIds.length > 100) {
        throw new BadRequestException(
          'Maximum 100 notification IDs allowed per request',
        );
      }

      const statuses = await this.notificationRepository
        .createQueryBuilder('notification')
        .where('notification.notification_id IN (:...ids)', {
          ids: notificationIds,
        })
        .getMany();

      const results = statuses.map((s) => this.entityToStatusData(s));
      const found = new Set(statuses.map((s) => s.notification_id));
      const notFound = notificationIds.filter((id) => !found.has(id));

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

  async createBroadcastNotification(
    dto: any,
  ): Promise<ApiResponse<any>> {
    try {
      if (!this.channel) {
        throw new Error('RabbitMQ channel not initialized');
      }

      // Validate required fields
      if (!dto.email && !dto.push_token) {
        throw new BadRequestException(
          'At least one of email or push_token is required for broadcast',
        );
      }

      const results = {
        email: null as any,
        push: null as any,
      };

      // Send email notification if email is provided
      if (dto.email) {
        const emailNotificationId = uuidv4();
        const emailMessage: any = {
          notification_id: emailNotificationId,
          user_id: dto.user_id,
          email: dto.email,
          template_code: dto.email_template_code,
          variables: dto.variables,
          request_id: `${dto.request_id}-email`,
          priority: dto.priority,
          metadata: dto.metadata,
          created_at: new Date().toISOString(),
          retry_count: 0,
        };

        this.channel.publish(
          'notifications.direct',
          'email',
          Buffer.from(JSON.stringify(emailMessage)),
          {
            persistent: true,
            priority: dto.priority,
          },
        );

        // Store status
        const emailStatusEntity = this.notificationRepository.create({
          notification_id: emailNotificationId,
          status: NotificationStatus.PENDING,
          user_id: dto.user_id,
          notification_type: NotificationType.EMAIL,
          request_id: `${dto.request_id}-email`,
          retry_count: 0,
          metadata: dto.metadata || {},
        });
        await this.notificationRepository.save(emailStatusEntity);

        results.email = {
          notification_id: emailNotificationId,
          status: NotificationStatus.PENDING,
          type: 'email',
        };

        this.metricsService.recordNotification('email', 'sent');
      }

      // Send push notification if push_token is provided
      if (dto.push_token) {
        const pushNotificationId = uuidv4();
        const pushMessage: any = {
          notification_id: pushNotificationId,
          user_id: dto.user_id,
          push_token: dto.push_token,
          template_code: dto.push_template_code,
          variables: dto.variables,
          request_id: `${dto.request_id}-push`,
          priority: dto.priority,
          metadata: dto.metadata,
          created_at: new Date().toISOString(),
          retry_count: 0,
        };

        this.channel.publish(
          'notifications.direct',
          'push',
          Buffer.from(JSON.stringify(pushMessage)),
          {
            persistent: true,
            priority: dto.priority,
          },
        );

        // Store status
        const pushStatusEntity = this.notificationRepository.create({
          notification_id: pushNotificationId,
          status: NotificationStatus.PENDING,
          user_id: dto.user_id,
          notification_type: NotificationType.PUSH,
          request_id: `${dto.request_id}-push`,
          retry_count: 0,
          metadata: dto.metadata || {},
        });
        await this.notificationRepository.save(pushStatusEntity);

        results.push = {
          notification_id: pushNotificationId,
          status: NotificationStatus.PENDING,
          type: 'push',
        };

        this.metricsService.recordNotification('push', 'sent');
      }

      // Mark request as processed
      this.markRequestProcessed(dto.request_id, results.email?.notification_id || results.push?.notification_id);

      return {
        success: true,
        data: results,
        message: 'Broadcast notifications queued successfully',
      };
    } catch (error) {
      this.logger.error(
        `Failed to create broadcast notification: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        error: error.message,
        message: 'Failed to queue broadcast notifications',
      };
    }
  }

  async updateNotificationStatus(
    notificationId: string,
    status: NotificationStatus,
    error?: string,
  ): Promise<ApiResponse<NotificationStatusData>> {
    try {
      const existing = await this.notificationRepository.findOne({
        where: { notification_id: notificationId },
      });

      if (!existing) {
        return {
          success: false,
          message: 'Notification not found',
          error: 'Cannot update status for non-existent notification',
        };
      }

      existing.status = status;
      existing.error = error;
      existing.updated_at = new Date();

      if (status === NotificationStatus.PENDING) {
        existing.retry_count = (existing.retry_count || 0) + 1;
      }

      const updated = await this.notificationRepository.save(existing);

      return {
        success: true,
        data: this.entityToStatusData(updated),
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

  async getNotificationsByStatus(
    status: NotificationStatus,
  ): Promise<ApiResponse<NotificationStatusData[]>> {
    try {
      const notifications = await this.notificationRepository.find({
        where: { status },
        order: { created_at: 'DESC' },
      });

      const results = notifications.map((n) => this.entityToStatusData(n));

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

  async getUserNotifications(
    userId: string,
    limit: number = 50,
  ): Promise<ApiResponse<NotificationStatusData[]>> {
    try {
      const notifications = await this.notificationRepository.find({
        where: { user_id: userId },
        order: { created_at: 'DESC' },
        take: limit,
      });

      const results = notifications.map((n) => this.entityToStatusData(n));

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
      const [total, pending, delivered, failed, email, push] =
        await Promise.all([
          this.notificationRepository.count(),
          this.notificationRepository.count({
            where: { status: NotificationStatus.PENDING },
          }),
          this.notificationRepository.count({
            where: { status: NotificationStatus.DELIVERED },
          }),
          this.notificationRepository.count({
            where: { status: NotificationStatus.FAILED },
          }),
          this.notificationRepository.count({
            where: { notification_type: 'email' },
          }),
          this.notificationRepository.count({
            where: { notification_type: 'push' },
          }),
        ]);

      const stats = {
        total,
        pending,
        delivered,
        failed,
        email,
        push,
      };

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

  private markRequestProcessed(
    requestId: string,
    notificationId: string,
  ): void {
    this.processedRequests.add(requestId);
    this.requestToNotificationMap.set(requestId, notificationId);
  }

  private async findNotificationByRequestId(
    requestId: string,
  ): Promise<NotificationStatusData | null> {
    const notification = await this.notificationRepository.findOne({
      where: { request_id: requestId },
    });
    return notification ? this.entityToStatusData(notification) : null;
  }

  private entityToStatusData(
    entity: NotificationStatusEntity,
  ): NotificationStatusData {
    return {
      notification_id: entity.notification_id,
      status: entity.status as NotificationStatus,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
      user_id: entity.user_id,
      notification_type: entity.notification_type,
      retry_count: entity.retry_count,
      error: entity.error,
    };
  }

  async cleanupOldNotifications(olderThanDays: number = 7): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    await this.notificationRepository
      .createQueryBuilder()
      .delete()
      .where('created_at < :cutoffDate', { cutoffDate })
      .execute();

    console.log(`🧹 Cleaned up notifications older than ${olderThanDays} days`);
  }

  async onModuleDestroy() {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await (this.connection as any).close();
      }
      console.log('✅ RabbitMQ connection closed gracefully');
    } catch (error) {
      console.error('❌ Error closing RabbitMQ connection:', error);
    }
  }
}
