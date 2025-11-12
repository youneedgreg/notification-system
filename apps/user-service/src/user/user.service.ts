import { Inject, Injectable, Logger, UnauthorizedException, ConflictException } from "@nestjs/common";
import { InjectRepository } from '@nestjs/typeorm';
import { User } from "./user.entity";
import { Repository } from 'typeorm';
import { ClientProxy } from "@nestjs/microservices";
import Redis from "ioredis";
import * as bcrypt from 'bcryptjs';
import { CreateUserDto } from "./create_user.dto";
import { JwtService } from '@nestjs/jwt';
import { LoginUserDto } from "./login.dto";

@Injectable()
export class UserService {
    private readonly logger = new Logger(UserService.name);

    constructor(
        @InjectRepository(User) private readonly userRepository: Repository<User>,
        @Inject('RABBITMQ_CLIENT') private eventsClient: ClientProxy,
        @Inject('REDIS_CLIENT') private redisClient: Redis,
        private jwtService: JwtService,
    ) { }

    // Idempotency store -> prevent duplicate signup
    private async isDuplicateRequest(request_id: string) {
        if (!request_id) return false;
        const key = `request_id:${request_id}`;
        const exists = await this.redisClient.get(key);
        return !!exists;
    }

    private async markRequestProcessed(request_id: string) {
        if (!request_id) return;
        const key = `request_id:${request_id}`;
        await this.redisClient.set(key, '1', 'EX', 60 * 60); // expire in 1 hour
    }

    async signup(dto: CreateUserDto) {
        // 1. Idempotency check
        if (await this.isDuplicateRequest(dto.request_id as string)) {
            this.logger.warn(`Duplicate signup request detected: ${dto.request_id}`);
            return { status: 'duplicate' };
        }

        // Check if email already exists
        const existingUser = await this.userRepository.findOne({ where: { email: dto.email } });
        if (existingUser) {
            throw new ConflictException('Email already registered');
        }

        // 2. Persist user locally
        const password_hash = await bcrypt.hash(dto.password, 10);
        
        // Set default notification preferences if not provided
        const defaultPreferences = {
            email_enabled: true,
            push_enabled: true,
            language: 'en'
        };

        const user = this.userRepository.create({
            email: dto.email,
            password_hash,
            push_token: dto.push_token,
            notification_preferences: dto.notification_preferences || defaultPreferences
        });
        
        try {
            const savedUser = await this.userRepository.save(user);

            // 3. Cache user snapshot for fast lookups
            const snapshot = { 
                user_id: savedUser.user_id, 
                email: savedUser.email,
                push_token: savedUser.push_token,
                notification_preferences: savedUser.notification_preferences
            };
            await this.redisClient.set(
                `user:${savedUser.user_id}`, 
                JSON.stringify(snapshot), 
                'EX', 
                60 * 60 * 24
            );

            // 4. Emit user.created event to notification exchange (async)
            const payload = {
                user_id: savedUser.user_id,
                email: savedUser.email,
                push_token: savedUser.push_token,
                notification_preferences: savedUser.notification_preferences,
                created_at: savedUser.created_at,
            };
            this.eventsClient.emit('user.created', payload);

            // 5. Mark request as processed
            await this.markRequestProcessed(dto.request_id as string);

            // 6. Generate JWT token
            const token = await this.generateToken(savedUser);

            return { 
                user: snapshot,
                access_token: token
            };
        } catch (error) {
            this.logger.error(`Signup failed: ${error.message}`);
            throw error;
        }
    }

    async login(dto: LoginUserDto) {
        // 1. Find user by email
        const user = await this.userRepository.findOne({ 
            where: { email: dto.email },
            select: ['user_id', 'email', 'password_hash', 'push_token', 'notification_preferences', 'created_at']
        });

        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        // 2. Verify password
        const isPasswordValid = await bcrypt.compare(dto.password, user.password_hash);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        // 3. Cache user snapshot
        const snapshot = { 
            user_id: user.user_id, 
            email: user.email,
            push_token: user.push_token,
            notification_preferences: user.notification_preferences
        };
        await this.redisClient.set(
            `user:${user.user_id}`, 
            JSON.stringify(snapshot), 
            'EX', 
            60 * 60 * 24
        );

        // 4. Generate JWT token
        const token = await this.generateToken(user);

        // 5. Emit login event (optional)
        this.eventsClient.emit('user.login', {
            user_id: user.user_id,
            email: user.email,
            logged_in_at: new Date(),
        });

        return {
            user: snapshot,
            access_token: token
        };
    }

    private async generateToken(user: User): Promise<string> {
        const payload = {
            sub: user.user_id,
            email: user.email,
        };
        return this.jwtService.signAsync(payload);
    }

    // RPC: other services call this to get user data quickly
    async getUserById(user_id: string) {
        // Try redis cache first
        const cached = await this.redisClient.get(`user:${user_id}`);
        if (cached) return JSON.parse(cached);

        const user = await this.userRepository.findOne({ where: { user_id } });
        if (!user) return null;

        const snapshot = { 
            user_id: user.user_id, 
            email: user.email,
            push_token: user.push_token,
            notification_preferences: user.notification_preferences
        };
        await this.redisClient.set(
            `user:${user.user_id}`, 
            JSON.stringify(snapshot), 
            'EX', 
            60 * 60 * 24
        );
        return snapshot;
    }

    // Update push token for a user
    async updatePushToken(user_id: string, push_token: string) {
        const user = await this.userRepository.findOne({ where: { user_id } });
        if (!user) {
            throw new ConflictException('User not found');
        }

        user.push_token = push_token;
        await this.userRepository.save(user);

        // Invalidate cache
        await this.redisClient.del(`user:${user_id}`);

        return { message: 'Push token updated successfully' };
    }

    // Update notification preferences
    async updateNotificationPreferences(
        user_id: string, 
        preferences: { email_enabled?: boolean; push_enabled?: boolean; language?: string }
    ) {
        const user = await this.userRepository.findOne({ where: { user_id } });
        if (!user) {
            throw new ConflictException('User not found');
        }

        user.notification_preferences = {
            ...user.notification_preferences,
            ...preferences
        };
        await this.userRepository.save(user);

        // Invalidate cache
        await this.redisClient.del(`user:${user_id}`);

        return { 
            message: 'Notification preferences updated successfully',
            preferences: user.notification_preferences
        };
    }
}