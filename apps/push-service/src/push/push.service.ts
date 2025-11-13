/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-require-imports */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import * as amqp from 'amqplib';
import axios from 'axios';

interface PushMessage {
  notification_id: string;
  user_id: string;
  push_token: string;
  template_code: string;
  variables: Record<string, any>;
  request_id: string;
  retry_count?: number;
}

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private connection: any;
  private channel: any;
  private maxRetries: number;
  private retryDelay: number;
  private firebaseInitialized = false;

  constructor(private configService: ConfigService) {
    this.maxRetries = parseInt(
      this.configService.get('MAX_RETRY_ATTEMPTS', '3'),
    );
    this.retryDelay = parseInt(
      this.configService.get('RETRY_DELAY_MS', '5000'),
    );
  }

  async onModuleInit() {
    await this.initializeFirebase();
    await this.initRabbitMQ();
  }

  private async initializeFirebase() {
    try {
      // Check if already initialized
      if (admin.apps.length > 0) {
        this.firebaseInitialized = true;
        this.logger.log('✅ Firebase already initialized');
        return;
      }

      const serviceAccountPath = this.configService.get<string>(
        'FIREBASE_SERVICE_ACCOUNT_PATH',
      );

      if (serviceAccountPath) {
        // Initialize with service account file
        // Resolve path relative to project root
        const path = require('path');
        const resolvedPath = path.resolve(process.cwd(), serviceAccountPath);
        this.logger.log(`Loading Firebase config from: ${resolvedPath}`);
        const serviceAccount = require(resolvedPath);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
      } else {
        // Initialize with environment variables
        const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
        const privateKey = this.configService
          .get<string>('FIREBASE_PRIVATE_KEY')
          ?.replace(/\\n/g, '\n');
        const clientEmail = this.configService.get<string>(
          'FIREBASE_CLIENT_EMAIL',
        );

        if (!projectId || !privateKey || !clientEmail) {
          throw new Error('Firebase credentials not configured properly');
        }

        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            privateKey,
            clientEmail,
          }),
        });
      }

      this.firebaseInitialized = true;
      this.logger.log('✅ Firebase initialized successfully');
    } catch (error: any) {
      this.logger.error(`❌ Firebase initialization failed: ${error.message}`);
      this.logger.warn(
        'Push notifications will not work without Firebase configuration',
      );
    }
  }

  private async initRabbitMQ() {
    try {
      // amqp.connect returns Connection, then we create a channel from it
      const conn = await amqp.connect(
        this.configService.get(
          'RABBITMQ_URL',
          'amqp://rabbitmq_user:rabbitmq_pass_2024@localhost:5672',
        ),
      );
      this.connection = conn;

      const chan = await conn.createChannel();
      this.channel = chan;

      // Create and bind to push queue
      await this.channel.assertQueue('push.queue', { durable: true });
      await this.channel.prefetch(1); // Process one message at a time

      // Start consuming messages
      await this.channel.consume('push.queue', async (msg) => {
        if (msg) {
          try {
            const message: PushMessage = JSON.parse(msg.content.toString());
            await this.processPushMessage(message);
            this.channel.ack(msg);
          } catch (error) {
            this.logger.error(`Error processing message: ${error.message}`);
            this.channel.nack(msg, false, false); // Don't requeue
          }
        }
      });

      this.logger.log('✅ RabbitMQ initialized and consuming from push.queue');
    } catch (error) {
      this.logger.error(`❌ RabbitMQ initialization failed: ${error.message}`);
      setTimeout(() => void this.initRabbitMQ(), 5000);
    }
  }

  async processPushMessage(message: PushMessage): Promise<void> {
    this.logger.log(`Processing push notification: ${message.notification_id}`);

    try {
      if (!this.firebaseInitialized) {
        throw new Error('Firebase is not initialized');
      }

      // Fetch template
      const template = await this.getTemplate(message.template_code);

      // Render template with variables
      const title = this.renderTemplate(template.subject, message.variables);
      const body = this.renderTemplate(
        template.text_content || template.html_content,
        message.variables,
      );

      // Get image and link from variables if available
      const imageUrl = message.variables.image || null;
      const link = message.variables.link || null;

      // Send push notification
      await this.sendPushNotification({
        token: message.push_token,
        title,
        body,
        imageUrl,
        link,
        data: {
          notification_id: message.notification_id,
          ...message.variables,
        },
      });

      // Update status to delivered
      await this.updateNotificationStatus(message.notification_id, 'delivered');

      this.logger.log(
        `✅ Push notification sent successfully: ${message.notification_id}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to send push notification: ${message.notification_id}`,
        error.stack,
      );

      // Handle retry logic
      await this.handleFailure(message, error);
    }
  }

  private async getTemplate(templateCode: string): Promise<any> {
    try {
      const templateServiceUrl = this.configService.get(
        'TEMPLATE_SERVICE_URL',
        'http://localhost:3004/api/v1',
      );

      const response = await axios.get(
        `${templateServiceUrl}/templates/code/${templateCode}`,
      );

      if (!response.data.success) {
        throw new Error(`Template not found: ${templateCode}`);
      }

      return response.data.data;
    } catch (error) {
      this.logger.error(
        `Failed to fetch template: ${templateCode}`,
        error.message,
      );

      // Return default template as fallback
      return {
        subject: 'Notification',
        text_content: '{{message}}',
        html_content: '<p>{{message}}</p>',
      };
    }
  }

  private renderTemplate(
    template: string,
    variables: Record<string, any>,
  ): string {
    try {
      let rendered = template;
      for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        rendered = rendered.replace(regex, String(value));
      }
      return rendered;
    } catch (error) {
      this.logger.error('Template rendering failed', error.message);
      return template;
    }
  }

  private async sendPushNotification(options: {
    token: string;
    title: string;
    body: string;
    imageUrl?: string;
    link?: string;
    data?: Record<string, any>;
  }): Promise<void> {
    const message: admin.messaging.Message = {
      token: options.token,
      notification: {
        title: options.title,
        body: options.body,
        ...(options.imageUrl && { imageUrl: options.imageUrl }),
      },
      data: options.data || {},
      ...(options.link && {
        webpush: {
          fcmOptions: {
            link: options.link,
          },
        },
      }),
    };

    await admin.messaging().send(message);
  }

  private async updateNotificationStatus(
    notificationId: string,
    status: 'delivered' | 'failed',
    error?: string,
  ): Promise<void> {
    try {
      const apiGatewayUrl = this.configService.get(
        'API_GATEWAY_URL',
        'http://localhost:3000/api/v1',
      );

      await axios.patch(`${apiGatewayUrl}/notifications/status`, {
        notification_id: notificationId,
        status,
        timestamp: new Date().toISOString(),
        error,
      });
    } catch (error) {
      this.logger.error(
        `Failed to update notification status: ${notificationId}`,
        error.message,
      );
    }
  }

  private async handleFailure(message: PushMessage, error: any): Promise<void> {
    const retryCount = (message.retry_count || 0) + 1;

    if (retryCount < this.maxRetries) {
      this.logger.warn(
        `Retry ${retryCount}/${this.maxRetries} for notification: ${message.notification_id}`,
      );

      // Exponential backoff
      const delay = this.retryDelay * Math.pow(2, retryCount - 1);

      setTimeout(() => {
        void this.processPushMessage({ ...message, retry_count: retryCount });
      }, delay);
    } else {
      this.logger.error(
        `Max retries reached for notification: ${message.notification_id}`,
      );

      // Update status to failed
      await this.updateNotificationStatus(
        message.notification_id,
        'failed',
        error.message,
      );

      // Send to dead letter queue
      await this.sendToDeadLetterQueue(message, error);
    }
  }

  private async sendToDeadLetterQueue(
    message: PushMessage,
    error: any,
  ): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.sendToQueue(
          'failed.queue',
          Buffer.from(JSON.stringify({ ...message, error: error.message })),
          {
            persistent: true,
          },
        );
        this.logger.log(
          `Sent to dead letter queue: ${message.notification_id}`,
        );
      }
    } catch (error) {
      this.logger.error('Failed to send to dead letter queue', error.message);
    }
  }

  getPushStats() {
    return {
      service: 'push-service',
      status: 'operational',
      firebase_initialized: this.firebaseInitialized,
      max_retries: this.maxRetries,
      retry_delay: this.retryDelay,
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
      this.logger.log('✅ RabbitMQ connection closed gracefully');
    } catch (error) {
      this.logger.error('❌ Error closing RabbitMQ connection:', error);
    }
  }
}
