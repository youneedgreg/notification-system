import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { QUEUE_NAMES } from '../common/types';

export interface FailedMessage {
  notification_id: string;
  user_id: string;
  notification_type: string;
  template_code: string;
  variables: Record<string, any>;
  request_id: string;
  retry_count: number;
  error: string;
  failed_at: string;
  original_queue: string;
}

@Injectable()
export class DeadLetterService implements OnModuleInit {
  private readonly logger = new Logger(DeadLetterService.name);
  private connection: any;
  private channel: any;
  private failedMessages: Map<string, FailedMessage> = new Map();

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.startConsumer();
  }

  private async startConsumer() {
    try {
      this.connection = await amqp.connect(
        this.configService.get(
          'RABBITMQ_URL',
          'amqp://rabbitmq_user:rabbitmq_pass_2024@localhost:5672',
        ),
      );

      this.channel = await this.connection.createChannel();

      // Assert dead letter queue
      await this.channel.assertQueue(QUEUE_NAMES.FAILED, { durable: true });
      await this.channel.prefetch(10);

      this.logger.log('✅ Started consuming from failed.queue');

      // Consume failed messages
      this.channel.consume(QUEUE_NAMES.FAILED, async (msg) => {
        if (msg) {
          try {
            const message: FailedMessage = JSON.parse(msg.content.toString());
            // Validate message has required fields
            if (!message || !message.notification_id) {
              this.logger.error(
                `📥 Invalid message structure: ${msg.content.toString()}`,
              );
              this.channel.nack(msg, false, false);
              return;
            }

            this.logger.error(
              `📥 Failed message received: ${message.notification_id} - ${message.error || 'Unknown error'}`,
            );

            // Store in memory for inspection
            this.failedMessages.set(message.notification_id, {
              ...message,
              failed_at: new Date().toISOString(),
            });

            this.channel.ack(msg);
          } catch (error) {
            this.logger.error(
              `Error processing failed message: ${error.message}`,
            );
            this.channel.nack(msg, false, false);
          }
        }
      });
    } catch (error) {
      this.logger.error(`❌ Failed to start DLQ consumer: ${error.message}`);
      setTimeout(() => this.startConsumer(), 5000);
    }
  }

  async getFailedMessages(limit: number = 50): Promise<FailedMessage[]> {
    const messages = Array.from(this.failedMessages.values())
      .sort(
        (a, b) =>
          new Date(b.failed_at).getTime() - new Date(a.failed_at).getTime(),
      )
      .slice(0, limit);

    return messages;
  }

  async getFailedMessage(notificationId: string): Promise<FailedMessage> {
    return this.failedMessages.get(notificationId);
  }

  async retryMessage(notificationId: string): Promise<boolean> {
    try {
      const message = this.failedMessages.get(notificationId);
      if (!message) {
        throw new Error('Failed message not found');
      }

      // Determine target queue based on notification type
      const targetQueue =
        message.notification_type === 'email'
          ? QUEUE_NAMES.EMAIL
          : QUEUE_NAMES.PUSH;

      // Reset retry count and send to appropriate queue
      const retryMessage = {
        notification_id: message.notification_id,
        user_id: message.user_id,
        template_code: message.template_code,
        variables: message.variables,
        request_id: message.request_id,
        retry_count: 0,
        created_at: new Date().toISOString(),
      };

      this.channel.sendToQueue(
        targetQueue,
        Buffer.from(JSON.stringify(retryMessage)),
        { persistent: true },
      );

      // Remove from failed messages
      this.failedMessages.delete(notificationId);

      this.logger.log(`✅ Retrying notification: ${notificationId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to retry message: ${error.message}`);
      return false;
    }
  }

  async retryBulk(notificationIds: string[]): Promise<{
    success: number;
    failed: number;
  }> {
    let success = 0;
    let failed = 0;

    for (const id of notificationIds) {
      const result = await this.retryMessage(id);
      if (result) {
        success++;
      } else {
        failed++;
      }
    }

    return { success, failed };
  }

  async clearFailedMessage(notificationId: string): Promise<boolean> {
    return this.failedMessages.delete(notificationId);
  }

  async getStats() {
    const messages = Array.from(this.failedMessages.values());

    const byType = messages.reduce(
      (acc, msg) => {
        acc[msg.notification_type] = (acc[msg.notification_type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const byError = messages.reduce(
      (acc, msg) => {
        const errorType = msg.error.split(':')[0] || 'Unknown';
        acc[errorType] = (acc[errorType] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      total: this.failedMessages.size,
      by_type: byType,
      by_error: byError,
      oldest_failure:
        messages.length > 0
          ? messages.reduce((oldest, msg) =>
              new Date(msg.failed_at) < new Date(oldest.failed_at)
                ? msg
                : oldest,
            ).failed_at
          : null,
    };
  }

  async onModuleDestroy() {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      this.logger.log('✅ Dead Letter Queue connection closed');
    } catch (error) {
      this.logger.error('Error closing DLQ connection:', error);
    }
  }
}
