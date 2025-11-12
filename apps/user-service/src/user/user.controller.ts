import { Body, Controller, Post, Get, Param, UseGuards, Request, HttpCode, HttpStatus, Headers } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './create_user.dto';
import { MessagePattern } from '@nestjs/microservices';
import { LoginUserDto } from './login.dto';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiParam, 
  ApiHeader, 
  ApiBearerAuth,
  ApiBody 
} from '@nestjs/swagger';

@ApiTags('users')
@Controller('users')
export class UserController {
    constructor(private readonly userService: UserService) {}

    @Get('health')
    @ApiOperation({ summary: 'Health check', description: 'Check if user service is running' })
    @ApiResponse({ status: 200, description: 'Service is healthy' })
    healthCheck() {
        return { status: 'User service is healthy' };
    }

    @Post('signup')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'User registration', description: 'Create a new user account' })
    @ApiHeader({
        name: 'x-request-id',
        description: 'Request ID for idempotency',
        required: false
    })
    @ApiBody({ type: CreateUserDto })
    @ApiResponse({ 
        status: 201, 
        description: 'User successfully registered',
        schema: {
            example: {
                success: true,
                data: {
                    user: {
                        user_id: 'uuid-string',
                        email: 'user@example.com',
                        push_token: 'push-token',
                        notification_preferences: {
                            email_enabled: true,
                            push_enabled: true,
                            language: 'en'
                        }
                    },
                    access_token: 'jwt-token'
                },
                message: 'User registered successfully'
            }
        }
    })
    @ApiResponse({ status: 409, description: 'Email already registered' })
    async signup(
        @Body() dto: CreateUserDto,
        @Headers('x-request-id') requestId?: string
    ) {
        // Use header request-id if provided, otherwise generate one
        dto.request_id = requestId || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const result = await this.userService.signup(dto);
        return {
            success: true,
            data: result,
            message: 'User registered successfully',
        };
    }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'User login', description: 'Authenticate user and return JWT token' })
    @ApiBody({ type: LoginUserDto })
    @ApiResponse({ 
        status: 200, 
        description: 'Login successful',
        schema: {
            example: {
                success: true,
                data: {
                    user: {
                        user_id: 'uuid-string',
                        email: 'user@example.com',
                        push_token: 'push-token',
                        notification_preferences: {
                            email_enabled: true,
                            push_enabled: true,
                            language: 'en'
                        }
                    },
                    access_token: 'jwt-token'
                },
                message: 'Login successful'
            }
        }
    })
    @ApiResponse({ status: 401, description: 'Invalid credentials' })
    async login(@Body() dto: LoginUserDto) {
        const result = await this.userService.login(dto);
        return {
            success: true,
            data: result,
            message: 'Login successful',
        };
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get user by ID', description: 'Retrieve user information by user ID' })
    @ApiParam({ name: 'id', description: 'User UUID', type: String })
    @ApiResponse({ 
        status: 200, 
        description: 'User found',
        schema: {
            example: {
                user_id: 'uuid-string',
                email: 'user@example.com',
                push_token: 'push-token',
                notification_preferences: {
                    email_enabled: true,
                    push_enabled: true,
                    language: 'en'
                }
            }
        }
    })
    @ApiResponse({ status: 404, description: 'User not found' })
    async getUserById(@Param('id') id: string) {
        const user = await this.userService.getUserById(id);
        if (!user) {
            return { message: 'User not found' };
        }
        return user;
    }

    // RPC endpoint for microservices - typically not exposed via Swagger
    @MessagePattern('user.get_by_id')
    async handleGetUserById(data: { user_id: string }) {
        return this.userService.getUserById(data.user_id);
    }
}