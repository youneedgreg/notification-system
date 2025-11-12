import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from './auth.service';

export interface JwtPayload {
  sub: string; // user ID
  email: string;
  iat?: number; // issued at
  exp?: number; // expiration
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    });
  }

  /**
   * Validate the JWT payload
   * This method is called automatically after the token is verified
   */
  async validate(payload: JwtPayload) {
    if (!payload || !payload.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // Optionally verify user still exists in database
    try {
      const user = await this.authService.getUserById(payload.sub);
      
      // Return user data that will be attached to request.user
      return {
        userId: payload.sub,
        email: payload.email,
        name: user.name,
        preferences: user.preferences,
      };
    } catch (error) {
      throw new UnauthorizedException('User not found or inactive');
    }
  }
}