import { Inject, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from '@nestjs/typeorm';
import { User } from "./user.entity";
import { Repository } from 'typeorm';
import { ClientProxy } from "@nestjs/microservices";
import Redis from "ioredis";
import * as bcrypt from 'bcryptjs';


@Injectable()
export class UserService {
    private readonly logger = new Logger(UserService.name);

    constructor(
        @InjectRepository(User) private readonly userRepository: Repository<User>,
         @Inject('RABBITMQ_CLIENT') private eventsClient: ClientProxy,
        //  @Inject('REDIS_CLIENT') private redisClient: any,
         @Inject('REDIS_CLIENT') private redisClient: Redis,
    ) { }

    // Idempotency store -> prevent duplicate signup
    private async isDuplicateRequest(request_id: string){
        if(!request_id) return false;
        const key = `request_id:${request_id}`;
        const exists = await this.redisClient.get(key);
        return !!exists;
    }

    private async markRequestProcessed(request_id: string){
        // 1. idempotency check
        if(!request_id) return;
        const key = `request_id:${request_id}`;
        await this.redisClient.set(key, '1', 'EX', 60 * 60); // expire in 1 hour
    }

    async signup(dto: {email: string, name: string, password: string, request_id?: string}) {
        if(await this.isDuplicateRequest(dto.request_id as string)){
            this.logger.warn(`Duplicate signup request detected: ${dto.request_id}`);
            return {status: 'duplicate'};
        };

        // 2. persist user locally
        const password_hash = await bcrypt.hash(dto.password, 10);
        const user = this.userRepository.create({
            email: dto.email,
            name: dto.name,
            password_hash
        });
        const savedUser = await this.userRepository.save(user);

        // 3. cache user snapshot for fast lookups
        const snapshot = {user_id: savedUser.user_id, email: savedUser.email, name: savedUser.name};
        await this.redisClient.set(`user:${savedUser.user_id}`, JSON.stringify(snapshot), 'EX', 60 * 60 * 24);

         // 4. emit user.created event to notification exchange (async)
        const payload = {
        user_id: savedUser.user_id,
        email: savedUser.email,
        name: savedUser.name,
        created_at: savedUser.created_at,
        };
        this.eventsClient.emit('user.created', payload);

        // 5. mark request as processed
        await this.markRequestProcessed(dto.request_id as string);
        return {user: snapshot}
    }

      // RPC: other services call this to get user data quickly
    async getUserById(user_id: string) {
        // try redis cache first
        const cached = await this.redisClient.get(`user:${user_id}`);
        if (cached) return JSON.parse(cached);

        const user = await this.userRepository.findOne({ where: { user_id } });
        if (!user) return null;

        const snapshot = { user_id: user.user_id, email: user.email, name: user.name };
        await this.redisClient.set(`user:${user.user_id}`, JSON.stringify(snapshot), 'EX', 60 * 60 * 24);
        return snapshot;
    }


}