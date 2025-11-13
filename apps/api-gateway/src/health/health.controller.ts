import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RedisService } from '../common/redis.service';
import { CircuitBreakerService } from '../common/circuit-breaker.service';
import { ServiceDiscoveryService } from '../common/service-discovery.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly redisService: RedisService,
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly serviceDiscoveryService: ServiceDiscoveryService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  async check() {
    const redisHealthy = await this.redisService.isHealthy();

    return {
      status: redisHealthy ? 'ok' : 'degraded',
      service: 'api-gateway',
      timestamp: new Date().toISOString(),
      dependencies: {
        redis: redisHealthy ? 'up' : 'down',
      },
    };
  }

  @Get('circuit-breakers')
  @ApiOperation({ summary: 'Get circuit breaker status' })
  getCircuitBreakers() {
    return {
      success: true,
      data: this.circuitBreakerService.getAllStats(),
    };
  }

  @Get('services')
  @ApiOperation({ summary: 'Get all registered services' })
  async getServices() {
    const services = await this.serviceDiscoveryService.getAllServices();
    return {
      success: true,
      data: services,
    };
  }
}
