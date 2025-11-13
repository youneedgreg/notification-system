import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RedisService } from './redis.service';

export interface ServiceRegistration {
  name: string;
  host: string;
  port: number;
  healthCheckUrl: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class ServiceDiscoveryService implements OnModuleInit {
  private readonly logger = new Logger(ServiceDiscoveryService.name);
  private readonly SERVICE_REGISTRY_PREFIX = 'service:';
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(private readonly redisService: RedisService) {}

  async onModuleInit() {
    this.logger.log('Service Discovery initialized');
  }

  /**
   * Register a service in the registry
   */
  async registerService(registration: ServiceRegistration): Promise<void> {
    const key = `${this.SERVICE_REGISTRY_PREFIX}${registration.name}`;
    const serviceData = {
      ...registration,
      lastHeartbeat: Date.now(),
      status: 'up',
    };

    try {
      await this.redisService.set(key, JSON.stringify(serviceData), 60); // TTL 60 seconds
      this.logger.log(
        `Service registered: ${registration.name} at ${registration.host}:${registration.port}`,
      );

      // Start heartbeat
      this.startHeartbeat(registration);
    } catch (error) {
      this.logger.error(
        `Failed to register service ${registration.name}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Deregister a service from the registry
   */
  async deregisterService(serviceName: string): Promise<void> {
    const key = `${this.SERVICE_REGISTRY_PREFIX}${serviceName}`;

    try {
      await this.redisService.del(key);
      this.stopHeartbeat(serviceName);
      this.logger.log(`Service deregistered: ${serviceName}`);
    } catch (error) {
      this.logger.error(`Failed to deregister service ${serviceName}:`, error);
    }
  }

  /**
   * Get service details by name
   */
  async getService(serviceName: string): Promise<ServiceRegistration | null> {
    const key = `${this.SERVICE_REGISTRY_PREFIX}${serviceName}`;

    try {
      const data = await this.redisService.get(key);
      if (!data) {
        this.logger.warn(`Service not found: ${serviceName}`);
        return null;
      }

      const service = JSON.parse(data) as ServiceRegistration;
      return service;
    } catch (error) {
      this.logger.error(`Failed to get service ${serviceName}:`, error);
      return null;
    }
  }

  /**
   * Get all registered services
   */
  async getAllServices(): Promise<ServiceRegistration[]> {
    try {
      const keys = await this.redisService.keys(
        `${this.SERVICE_REGISTRY_PREFIX}*`,
      );
      const services: ServiceRegistration[] = [];

      for (const key of keys) {
        const data = await this.redisService.get(key);
        if (data) {
          services.push(JSON.parse(data));
        }
      }

      return services;
    } catch (error) {
      this.logger.error('Failed to get all services:', error);
      return [];
    }
  }

  /**
   * Get service URL (for making HTTP requests)
   */
  async getServiceUrl(serviceName: string): Promise<string | null> {
    const service = await this.getService(serviceName);
    if (!service) {
      return null;
    }

    return `http://${service.host}:${service.port}`;
  }

  /**
   * Check if a service is healthy
   */
  async isServiceHealthy(serviceName: string): Promise<boolean> {
    const service = await this.getService(serviceName);
    if (!service) {
      return false;
    }

    try {
      const response = await fetch(service.healthCheckUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      return response.ok;
    } catch (error) {
      this.logger.warn(
        `Health check failed for ${serviceName}:`,
        error.message,
      );
      return false;
    }
  }

  /**
   * Start periodic heartbeat to keep service registration alive
   */
  private startHeartbeat(registration: ServiceRegistration): void {
    // Clear existing heartbeat if any
    this.stopHeartbeat(registration.name);

    const interval = setInterval(async () => {
      try {
        const isHealthy = await this.isServiceHealthy(registration.name);

        if (isHealthy) {
          // Renew registration
          await this.registerService(registration);
        } else {
          this.logger.warn(`Service ${registration.name} failed health check`);
          // Optionally deregister unhealthy services
          // await this.deregisterService(registration.name);
        }
      } catch (error) {
        this.logger.error(`Heartbeat error for ${registration.name}:`, error);
      }
    }, this.HEALTH_CHECK_INTERVAL);

    this.healthCheckIntervals.set(registration.name, interval);
  }

  /**
   * Stop heartbeat for a service
   */
  private stopHeartbeat(serviceName: string): void {
    const interval = this.healthCheckIntervals.get(serviceName);
    if (interval) {
      clearInterval(interval);
      this.healthCheckIntervals.delete(serviceName);
    }
  }

  /**
   * Cleanup on module destroy
   */
  async onModuleDestroy() {
    // Stop all heartbeats
    for (const [serviceName] of this.healthCheckIntervals) {
      this.stopHeartbeat(serviceName);
    }
  }
}
