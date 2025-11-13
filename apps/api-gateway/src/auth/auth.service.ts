import {
  Injectable,
  UnauthorizedException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiResponse } from '../common/types';
import axios from 'axios';

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  name: string;
  email: string;
  password: string;
  push_token?: string;
  preferences: {
    email: boolean;
    push: boolean;
  };
}

@Injectable()
export class AuthService {
  private readonly userServiceUrl: string;

  constructor(private jwtService: JwtService) {
    // URL of the User Service
    this.userServiceUrl =
      process.env.USER_SERVICE_URL || 'http://localhost:3001/api/v1';
  }

  /**
   * Login user by validating credentials with User Service
   */
  async login(
    loginDto: LoginDto,
  ): Promise<ApiResponse<{ access_token: string; user: any }>> {
    try {
      // Call User Service to validate credentials
      const response = await axios.post(
        `${this.userServiceUrl}/auth/login`,
        loginDto,
      );

      if (!response.data.success) {
        throw new UnauthorizedException(
          response.data.error || 'Invalid credentials',
        );
      }

      // User Service returns a token, we can pass it through or generate our own
      const token = response.data.data.access_token;

      return {
        success: true,
        data: {
          access_token: token,
          user: response.data.data.user,
        },
        message: 'Login successful',
      };
    } catch (error) {
      if (error.response?.status === 401) {
        throw new UnauthorizedException('Invalid email or password');
      }

      throw new HttpException(
        error.response?.data?.error || 'Login failed',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Register new user via User Service
   */
  async register(registerDto: RegisterDto): Promise<ApiResponse<any>> {
    try {
      // Call User Service to create user
      const response = await axios.post(
        `${this.userServiceUrl}/users`,
        registerDto,
      );

      if (!response.data.success) {
        throw new HttpException(
          response.data.error || 'Registration failed',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Auto-login after registration
      const loginResult = await this.login({
        email: registerDto.email,
        password: registerDto.password,
      });

      return {
        success: true,
        data: {
          user: response.data.data,
          access_token: loginResult.data?.access_token,
        },
        message: 'Registration successful',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        error.response?.data?.error || 'Registration failed',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Validate JWT token
   */
  async validateToken(token: string): Promise<any> {
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret:
          process.env.JWT_SECRET ||
          'your-super-secret-jwt-key-change-in-production',
      });
      return payload;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  /**
   * Generate JWT token (if you want API Gateway to generate its own tokens)
   */
  async generateToken(payload: any): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret:
        process.env.JWT_SECRET ||
        'your-super-secret-jwt-key-change-in-production',
      expiresIn: '24h',
    });
  }

  /**
   * Verify user exists and get user data
   */
  async getUserById(userId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.userServiceUrl}/users/${userId}`,
      );

      if (!response.data.success) {
        throw new UnauthorizedException('User not found');
      }

      return response.data.data;
    } catch (error) {
      throw new UnauthorizedException('Failed to verify user');
    }
  }

  /**
   * Refresh token (optional feature)
   */
  async refreshToken(
    oldToken: string,
  ): Promise<ApiResponse<{ access_token: string }>> {
    try {
      const payload = await this.validateToken(oldToken);

      // Generate new token with same payload
      const newToken = await this.generateToken({
        sub: payload.sub,
        email: payload.email,
      });

      return {
        success: true,
        data: { access_token: newToken },
        message: 'Token refreshed successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Token refresh failed',
      };
    }
  }
}
