import { Body, Controller, Post, Get, Param, UseGuards, Request, HttpCode, HttpStatus, Headers } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './create_user.dto';
import { MessagePattern } from '@nestjs/microservices';
import { LoginUserDto } from './login.dto';

@Controller('users')
export class UserController {
    constructor(private readonly userService: UserService) {}

    @Get('health')
    healthCheck() {
        return { status: 'User service is healthy' };
    }


    @Post('signup')
    @HttpCode(HttpStatus.CREATED)
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
    async login(@Body() dto: LoginUserDto) {
            const result = await this.userService.login(dto);
            return {
            success: true,
            data: result,
            message: 'Login successful',
            };
    }

    @Get(':id')
    async getUserById(@Param('id') id: string) {
        const user = await this.userService.getUserById(id);
        if (!user) {
            return { message: 'User not found' };
        }
        return user;
    }

    // RPC endpoint for microservices
    @MessagePattern('user.get_by_id')
    async handleGetUserById(data: { user_id: string }) {
        return this.userService.getUserById(data.user_id);
    }
}