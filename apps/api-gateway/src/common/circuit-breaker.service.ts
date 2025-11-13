import { Injectable, Logger } from '@nestjs/common';
import * as CircuitBreaker from 'opossum';

interface CircuitBreakerOptions {
  timeout?: number;
  errorThresholdPercentage?: number;
  resetTimeout?: number;
  name?: string;
}

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private breakers: Map<string, CircuitBreaker> = new Map();

  createBreaker<T>(
    action: (...args: any[]) => Promise<T>,
    options: CircuitBreakerOptions = {},
  ): CircuitBreaker<any[], T> {
    const defaultOptions = {
      timeout: 10000, // 10 seconds
      errorThresholdPercentage: 50,
      resetTimeout: 30000, // 30 seconds
      name: options.name || 'default',
    };

    const breakerOptions = { ...defaultOptions, ...options };
    const breaker = new CircuitBreaker(action, breakerOptions);

    // Event listeners
    breaker.on('open', () => {
      this.logger.warn(
        `Circuit breaker [${breakerOptions.name}] opened - failing fast`,
      );
    });

    breaker.on('halfOpen', () => {
      this.logger.log(
        `Circuit breaker [${breakerOptions.name}] half-open - testing service`,
      );
    });

    breaker.on('close', () => {
      this.logger.log(
        `Circuit breaker [${breakerOptions.name}] closed - service restored`,
      );
    });

    breaker.on('fallback', (result) => {
      this.logger.warn(
        `Circuit breaker [${breakerOptions.name}] fallback triggered`,
      );
    });

    this.breakers.set(breakerOptions.name, breaker);
    return breaker;
  }

  getBreaker(name: string): any {
    return this.breakers.get(name);
  }

  getBreakerStats(name: string): any {
    const breaker = this.breakers.get(name);
    if (!breaker) return null;

    return {
      name,
      state: breaker.opened
        ? 'open'
        : breaker.halfOpen
          ? 'half-open'
          : 'closed',
      stats: breaker.stats,
    };
  }

  getAllStats(): any[] {
    const stats: any[] = [];
    for (const [name, breaker] of this.breakers) {
      stats.push({
        name,
        state: breaker.opened
          ? 'open'
          : breaker.halfOpen
            ? 'half-open'
            : 'closed',
        stats: breaker.stats,
      });
    }
    return stats;
  }
}
