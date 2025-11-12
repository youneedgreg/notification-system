import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { ApiResponse } from '../common/interfaces/api-response.interface';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async login(email: string, password: string): Promise<ApiResponse<{ access_token: string; user: any }>> {
    try {
      const user = await this.usersService.findByEmail(email);

      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const payload = { sub: user.id, email: user.email };
      const access_token = await this.jwtService.signAsync(payload);

      const { password: _, ...userWithoutPassword } = user;

      return {
        success: true,
        data: {
          access_token,
          user: userWithoutPassword,
        },
        message: 'Login successful',
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      return {
        success: false,
        error: error.message,
        message: 'Login failed',
      };
    }
  }

  async validateUser(userId: string): Promise<any> {
    const result = await this.usersService.findOne(userId);
    return result.data;
  }
}