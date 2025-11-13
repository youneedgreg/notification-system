import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as client from 'prom-client';
import * as amqp from 'amqplib';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly logger = new Logger(MetricsService.name);
  private register: client.Registry;
  private connection: any;
  private channel: any;

  // Metrics
  private notificationCounter: client.Counter;
  private notificationDuration: client.Histogram;
  private queueSize: client.Gauge;
  private failedNotifications: client.Counter;
  private retryCounter: client.Counter;

  constructor(private configService: ConfigService) {
    this.register = new client.Registry();
    this.initializeMetrics();
  }

  async onModuleInit() {
    await this.connectToRabbitMQ();
    this.startQueueMonitoring();
  }

  private initializeMetrics() {
    // Default metrics (CPU, memory, etc.)
    client.collectDefaultMetrics({ register: this.register });

    // Custom metrics
    this.notificationCounter = new client.Counter({
      name: 'notifications_total',
      help: 'Total number of notifications sent',
      labelNames: ['type', 'status'],
      registers: [this.register],
    });

    this.notificationDuration = new client.Histogram({
      name: 'notification_processing_duration_seconds',
      help: 'Time taken to process notifications',
      labelNames: ['type'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [this.register],
    });

    this.queueSize = new client.Gauge({
      name: 'rabbitmq_queue_messages',
      help: 'Number of messages in RabbitMQ queues',
      labelNames: ['queue'],
      registers: [this.register],
    });

    this.failedNotifications = new client.Counter({
      name: 'notifications_failed_total',
      help: 'Total number of failed notifications',
      labelNames: ['type', 'error_type'],
      registers: [this.register],
    });

    this.retryCounter = new client.Counter({
      name: 'notifications_retry_total',
      help: 'Total number of notification retries',
      labelNames: ['type', 'retry_count'],
      registers: [this.register],
    });
  }

  private async connectToRabbitMQ() {
    try {
      this.connection = await amqp.connect(
        this.configService.get(
          'RABBITMQ_URL',
          'amqp://rabbitmq_user:rabbitmq_pass_2024@localhost:5672',
        ),
      );
      this.channel = await this.connection.createChannel();
      this.logger.log('✅ Metrics service connected to RabbitMQ');
    } catch (error) {
      this.logger.error(
        `Failed to connect to RabbitMQ for metrics: ${error.message}`,
      );
    }
  }

  private startQueueMonitoring() {
    // Monitor queue sizes every 10 seconds
    setInterval(async () => {
      if (!this.channel) return;

      try {
        const queues = ['email.queue', 'push.queue', 'failed.queue'];

        for (const queueName of queues) {
          const queueInfo = await this.channel.checkQueue(queueName);
          this.queueSize.set({ queue: queueName }, queueInfo.messageCount);
        }
      } catch (error) {
        this.logger.error(`Error monitoring queues: ${error.message}`);
      }
    }, 10000);
  }

  // Public methods to record metrics
  recordNotification(type: string, status: string) {
    this.notificationCounter.inc({ type, status });
  }

  recordNotificationDuration(type: string, durationSeconds: number) {
    this.notificationDuration.observe({ type }, durationSeconds);
  }

  recordFailedNotification(type: string, errorType: string) {
    this.failedNotifications.inc({ type, error_type: errorType });
  }

  recordRetry(type: string, retryCount: number) {
    this.retryCounter.inc({ type, retry_count: retryCount.toString() });
  }

  async getMetrics(): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return Promise.resolve(this.register.metrics());
  }

  async getMetricsSummary() {
    const metrics = await this.register.getMetricsAsJSON();

    return {
      timestamp: new Date().toISOString(),
      metrics: metrics.map((metric) => ({
        name: metric.name,
        help: metric.help,
        type: metric.type,
        values: metric.values,
      })),
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
      this.logger.log('✅ Metrics service disconnected from RabbitMQ');
    } catch (error) {
      this.logger.error('Error closing metrics connection:', error);
    }
  }
}
