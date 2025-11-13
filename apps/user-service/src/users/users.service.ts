import {
  Injectable,
  ConflictException,
  NotFoundException,
  Inject,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';
import {
  ApiResponse,
  PaginationMeta,
} from '../common/interfaces/api-response.interface';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly USER_CACHE_TTL = 3600; // 1 hour
  private readonly USER_CACHE_PREFIX = 'user:';

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<ApiResponse<User>> {
    try {
      const existingUser = await this.usersRepository.findOne({
        where: { email: createUserDto.email },
      });

      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }

      const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10;
      const hashedPassword = await bcrypt.hash(
        createUserDto.password,
        saltRounds,
      );

      const user = this.usersRepository.create({
        ...createUserDto,
        password: hashedPassword,
      });

      const savedUser = await this.usersRepository.save(user);
      delete savedUser.password;

      return {
        success: true,
        data: savedUser,
        message: 'User created successfully',
      };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      return {
        success: false,
        error: error.message,
        message: 'Failed to create user',
      };
    }
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
  ): Promise<ApiResponse<User[]>> {
    try {
      const skip = (page - 1) * limit;

      const [users, total] = await this.usersRepository.findAndCount({
        skip,
        take: limit,
        select: [
          'id',
          'name',
          'email',
          'push_token',
          'preferences',
          'created_at',
          'updated_at',
        ],
        order: { created_at: 'DESC' },
      });

      const meta: PaginationMeta = {
        total,
        limit,
        page,
        total_pages: Math.ceil(total / limit),
        has_next: page * limit < total,
        has_previous: page > 1,
      };

      return {
        success: true,
        data: users,
        message: 'Users retrieved successfully',
        meta,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to retrieve users',
      };
    }
  }

  async findOne(id: string): Promise<ApiResponse<User>> {
    try {
      // Check cache first
      const cacheKey = `${this.USER_CACHE_PREFIX}${id}`;
      const cached = await this.redisClient.get(cacheKey);

      if (cached) {
        this.logger.log(`Cache hit for user: ${id}`);
        return {
          success: true,
          data: JSON.parse(cached),
          message: 'User retrieved successfully (from cache)',
        };
      }

      // Cache miss - fetch from database
      this.logger.log(`Cache miss for user: ${id}`);
      const user = await this.usersRepository.findOne({
        where: { id },
        select: [
          'id',
          'name',
          'email',
          'push_token',
          'preferences',
          'created_at',
          'updated_at',
        ],
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Store in cache
      await this.redisClient.setex(
        cacheKey,
        this.USER_CACHE_TTL,
        JSON.stringify(user),
      );

      return {
        success: true,
        data: user,
        message: 'User retrieved successfully',
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      return {
        success: false,
        error: error.message,
        message: 'Failed to retrieve user',
      };
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<ApiResponse<User>> {
    try {
      const user = await this.usersRepository.findOne({ where: { id } });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (updateUserDto.password) {
        const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10;
        updateUserDto.password = await bcrypt.hash(
          updateUserDto.password,
          saltRounds,
        );
      }

      Object.assign(user, updateUserDto);
      const updatedUser = await this.usersRepository.save(user);
      delete updatedUser.password;

      // Invalidate cache
      const cacheKey = `${this.USER_CACHE_PREFIX}${id}`;
      await this.redisClient.del(cacheKey);
      this.logger.log(`Cache invalidated for user: ${id}`);

      return {
        success: true,
        data: updatedUser,
        message: 'User updated successfully',
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      return {
        success: false,
        error: error.message,
        message: 'Failed to update user',
      };
    }
  }

  async remove(id: string): Promise<ApiResponse<void>> {
    try {
      const result = await this.usersRepository.delete(id);

      if (result.affected === 0) {
        throw new NotFoundException('User not found');
      }

      // Invalidate cache
      const cacheKey = `${this.USER_CACHE_PREFIX}${id}`;
      await this.redisClient.del(cacheKey);
      this.logger.log(`Cache invalidated for deleted user: ${id}`);

      return {
        success: true,
        message: 'User deleted successfully',
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      return {
        success: false,
        error: error.message,
        message: 'Failed to delete user',
      };
    }
  }
}
