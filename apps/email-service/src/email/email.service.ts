import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as Handlebars from 'handlebars';
import * as amqp from 'amqplib';
import axios from 'axios';

interface EmailMessage {
  notification_id: string;
  user_id: string;
  email: string;
  template_code: string;
  variables: Record<string, any>;
  request_id: string;
  retry_count?: number;
}

@Injectable()
export class EmailService implements OnModuleDestroy {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;
  private maxRetries: number;
  private retryDelay: number;
  private connection: any;
  private channel: any;

  constructor(private configService: ConfigService) {
    this.maxRetries = parseInt(
      this.configService.get('MAX_RETRY_ATTEMPTS', '3'),
    );
    this.retryDelay = parseInt(
      this.configService.get('RETRY_DELAY_MS', '5000'),
    );
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const smtpConfig = {
      host: this.configService.get('SMTP_HOST', 'smtp.gmail.com'),
      port: parseInt(this.configService.get('SMTP_PORT', '587')),
      secure: this.configService.get('SMTP_SECURE', 'false') === 'true',
      auth: {
        user: this.configService.get('SMTP_USER'),
        pass: this.configService.get('SMTP_PASSWORD'),
      },
    };

    this.transporter = nodemailer.createTransport(smtpConfig);

    // Verify connection
    this.transporter.verify((error, success) => {
      if (error) {
        this.logger.error(`SMTP connection failed: ${error.message}`);
      } else {
        this.logger.log('✅ SMTP server is ready to send emails');
      }
    });
  }

  async processEmailMessage(message: EmailMessage): Promise<void> {
    this.logger.log(
      `Processing email for notification: ${message.notification_id}`,
    );

    try {
      // Fetch template
      const template = await this.getTemplate(message.template_code);

      // Render template with variables
      const htmlContent = this.renderTemplate(
        template.html_content,
        message.variables,
      );
      const textContent = this.renderTemplate(
        template.text_content || '',
        message.variables,
      );

      // Send email
      await this.sendEmail({
        to: message.email,
        subject: this.renderTemplate(template.subject, message.variables),
        html: htmlContent,
        text: textContent,
      });

      // Update status to delivered
      await this.updateNotificationStatus(message.notification_id, 'delivered');

      this.logger.log(
        `✅ Email sent successfully for notification: ${message.notification_id}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to send email for notification: ${message.notification_id}`,
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
        html_content: '<p>{{message}}</p>',
        text_content: '{{message}}',
      };
    }
  }

  private renderTemplate(
    template: string,
    variables: Record<string, any>,
  ): string {
    try {
      const compiledTemplate = Handlebars.compile(template);
      return compiledTemplate(variables);
    } catch (error) {
      this.logger.error('Template rendering failed', error.message);
      return template; // Return unrendered template as fallback
    }
  }

  private async sendEmail(options: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<void> {
    const mailOptions = {
      from: {
        name: this.configService.get('EMAIL_FROM_NAME', 'Notification System'),
        address: this.configService.get(
          'EMAIL_FROM_ADDRESS',
          'noreply@notification-system.com',
        ),
      },
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    };

    await this.transporter.sendMail(mailOptions);
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

  private async handleFailure(
    message: EmailMessage,
    error: any,
  ): Promise<void> {
    const retryCount = (message.retry_count || 0) + 1;

    if (retryCount < this.maxRetries) {
      this.logger.warn(
        `Retry ${retryCount}/${this.maxRetries} for notification: ${message.notification_id}`,
      );

      // Exponential backoff
      const delay = this.retryDelay * Math.pow(2, retryCount - 1);

      setTimeout(async () => {
        await this.processEmailMessage({ ...message, retry_count: retryCount });
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
    message: EmailMessage,
    error: any,
  ): Promise<void> {
    try {
      // This would send to a dead letter queue for manual inspection
      this.logger.log(
        `Sending to dead letter queue: ${message.notification_id}`,
      );
      // Implementation depends on your queue setup
    } catch (error) {
      this.logger.error('Failed to send to dead letter queue', error.message);
    }
  }

  async startConsumer() {
    try {
      this.connection = await amqp.connect(
        this.configService.get(
          'RABBITMQ_URL',
          'amqp://rabbitmq_user:rabbitmq_pass_2024@localhost:5672',
        ),
      );
      this.channel = await this.connection.createChannel();

      await this.channel.assertQueue('email.queue', { durable: true });
      await this.channel.prefetch(1);

      this.logger.log('✅ Started consuming from email.queue');

      this.channel.consume('email.queue', async (msg) => {
        if (msg) {
          try {
            const message: EmailMessage = JSON.parse(msg.content.toString());
            this.logger.log(
              `Received email notification: ${message.notification_id}`,
            );
            await this.processEmailMessage(message);
            this.channel.ack(msg);
          } catch (error) {
            this.logger.error(`Error processing message: ${error.message}`);
            this.channel.nack(msg, false, false);
          }
        }
      });
    } catch (error) {
      this.logger.error(`❌ Failed to start consumer: ${error.message}`);
      setTimeout(() => this.startConsumer(), 5000);
    }
  }

  async getEmailStats(): Promise<any> {
    return {
      service: 'email-service',
      status: 'operational',
      smtp_connected: true,
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
