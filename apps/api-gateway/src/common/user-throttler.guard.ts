import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // Attempt to extract tracking identifier in this order:
    // 1. JWT User ID (if authenticated)
    // 2. API Key (if provided in headers)
    // 3. Fallback to IP address
    
    if (req.user && req.user.sub) {
      return `user-${req.user.sub}`;
    }
    
    const apiKey = req.headers['x-api-key'];
    if (apiKey) {
      return `apikey-${apiKey}`;
    }
    
    return `ip-${req.ip}`;
  }
}
