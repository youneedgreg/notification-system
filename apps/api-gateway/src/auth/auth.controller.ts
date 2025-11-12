import { Controller, Post, Body, UseGuards, Get, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import * as authService_1 from './auth.service';
import { JwtAuthGuard } from './auth.guard';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: authService_1.AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'User login' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'user@example.com' },
        password: { type: 'string', example: 'password123' },
      },
    },
  })
  async login(@Body() loginDto: authService_1.LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('register')
  @ApiOperation({ summary: 'Register new user' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'John Doe' },
        email: { type: 'string', example: 'user@example.com' },
        password: { type: 'string', example: 'password123' },
        push_token: { type: 'string'},
        preferences: {
          type: 'object',
          properties: {
            email: { type: 'boolean', example: true },
            push: { type: 'boolean', example: true },
          },
        },
      },
    },
  })
  async register(@Body() registerDto: authService_1.RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh JWT token' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async refreshToken(@Request() req) {
    const token = req.headers.authorization?.split(' ')[1];
    return this.authService.refreshToken(token);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user info' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req) {
    return {
      success: true,
      data: req.user,
      message: 'User profile retrieved successfully',
    };
  }
}