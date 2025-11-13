import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Template } from './entities/template.entity';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import * as Handlebars from 'handlebars';
import {
  ApiResponse,
  PaginationMeta,
} from '../common/interfaces/api-response.interface';
import { RedisService } from '../common/redis.service';

@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name);
  private readonly TEMPLATE_CACHE_TTL = 3600; // 1 hour
  private readonly TEMPLATE_CACHE_PREFIX = 'template:';

  constructor(
    @InjectRepository(Template)
    private templatesRepository: Repository<Template>,
    private readonly redisService: RedisService,
  ) {
    this.seedDefaultTemplates();
  }

  private async seedDefaultTemplates() {
    const existingTemplates = await this.templatesRepository.count();

    if (existingTemplates === 0) {
      const defaultTemplates = [
        {
          code: 'welcome_email',
          name: 'Welcome Email',
          description: 'Welcome email for new users',
          subject: 'Welcome to {{app_name}}!',
          html_content:
            '<h1>Hello {{name}}!</h1><p>Welcome to our platform. Click <a href="{{link}}">here</a> to get started.</p>',
          text_content:
            'Hello {{name}}! Welcome to our platform. Visit {{link}} to get started.',
          variables: ['name', 'app_name', 'link'],
          type: 'email',
        },
        {
          code: 'password_reset',
          name: 'Password Reset',
          description: 'Password reset email',
          subject: 'Reset Your Password',
          html_content:
            '<h1>Password Reset Request</h1><p>Hi {{name}},</p><p>Click <a href="{{link}}">here</a> to reset your password.</p>',
          text_content:
            'Hi {{name}}, Click the link to reset your password: {{link}}',
          variables: ['name', 'link'],
          type: 'email',
        },
        {
          code: 'notification_alert',
          name: 'Notification Alert',
          description: 'General notification alert',
          subject: 'New Notification from {{app_name}}',
          html_content:
            '<h2>Hello {{name}},</h2><p>You have a new notification: {{message}}</p><p><a href="{{link}}">View Details</a></p>',
          text_content:
            'Hello {{name}}, You have a new notification: {{message}}. View details at: {{link}}',
          variables: ['name', 'app_name', 'message', 'link'],
          type: 'email',
        },
      ];

      await this.templatesRepository.save(defaultTemplates);
      console.log('✅ Default templates seeded');
    }
  }

  async create(
    createTemplateDto: CreateTemplateDto,
  ): Promise<ApiResponse<Template>> {
    try {
      const existing = await this.templatesRepository.findOne({
        where: { code: createTemplateDto.code },
      });

      if (existing) {
        throw new ConflictException('Template with this code already exists');
      }

      const template = this.templatesRepository.create(createTemplateDto);
      const saved = await this.templatesRepository.save(template);

      return {
        success: true,
        data: saved,
        message: 'Template created successfully',
      };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      return {
        success: false,
        error: error.message,
        message: 'Failed to create template',
      };
    }
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
  ): Promise<ApiResponse<Template[]>> {
    try {
      const skip = (page - 1) * limit;
      const [templates, total] = await this.templatesRepository.findAndCount({
        skip,
        take: limit,
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
        data: templates,
        message: 'Templates retrieved successfully',
        meta,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to retrieve templates',
      };
    }
  }

  async findOne(id: string): Promise<ApiResponse<Template>> {
    try {
      const template = await this.templatesRepository.findOne({
        where: { id },
      });

      if (!template) {
        throw new NotFoundException('Template not found');
      }

      return {
        success: true,
        data: template,
        message: 'Template retrieved successfully',
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      return {
        success: false,
        error: error.message,
        message: 'Failed to retrieve template',
      };
    }
  }

  async findByCode(code: string): Promise<ApiResponse<Template>> {
    try {
      // Check cache first
      const cacheKey = `${this.TEMPLATE_CACHE_PREFIX}${code}`;
      const cached = await this.redisService.get(cacheKey);

      if (cached) {
        this.logger.log(`Cache hit for template: ${code}`);
        return {
          success: true,
          data: JSON.parse(cached),
          message: 'Template retrieved successfully (from cache)',
        };
      }

      // Cache miss - fetch from database
      this.logger.log(`Cache miss for template: ${code}`);
      const template = await this.templatesRepository.findOne({
        where: { code },
      });

      if (!template) {
        throw new NotFoundException('Template not found');
      }

      // Store in cache
      await this.redisService.set(
        cacheKey,
        JSON.stringify(template),
        this.TEMPLATE_CACHE_TTL,
      );

      return {
        success: true,
        data: template,
        message: 'Template retrieved successfully',
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      return {
        success: false,
        error: error.message,
        message: 'Failed to retrieve template',
      };
    }
  }

  async update(
    id: string,
    updateTemplateDto: UpdateTemplateDto,
  ): Promise<ApiResponse<Template>> {
    try {
      const template = await this.templatesRepository.findOne({
        where: { id },
      });

      if (!template) {
        throw new NotFoundException('Template not found');
      }

      // Increment version if content changed
      if (updateTemplateDto.html_content || updateTemplateDto.text_content) {
        template.version += 1;
      }

      Object.assign(template, updateTemplateDto);
      const updated = await this.templatesRepository.save(template);

      // Invalidate cache
      const cacheKey = `${this.TEMPLATE_CACHE_PREFIX}${template.code}`;
      await this.redisService.del(cacheKey);
      this.logger.log(`Cache invalidated for template: ${template.code}`);

      return {
        success: true,
        data: updated,
        message: 'Template updated successfully',
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      return {
        success: false,
        error: error.message,
        message: 'Failed to update template',
      };
    }
  }

  async remove(id: string): Promise<ApiResponse<void>> {
    try {
      const template = await this.templatesRepository.findOne({
        where: { id },
      });

      if (!template) {
        throw new NotFoundException('Template not found');
      }

      const result = await this.templatesRepository.delete(id);

      if (result.affected === 0) {
        throw new NotFoundException('Template not found');
      }

      // Invalidate cache
      const cacheKey = `${this.TEMPLATE_CACHE_PREFIX}${template.code}`;
      await this.redisService.del(cacheKey);
      this.logger.log(
        `Cache invalidated for deleted template: ${template.code}`,
      );

      return {
        success: true,
        message: 'Template deleted successfully',
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      return {
        success: false,
        error: error.message,
        message: 'Failed to delete template',
      };
    }
  }

  async renderTemplate(
    templateCode: string,
    variables: Record<string, any>,
  ): Promise<ApiResponse<{ html: string; text: string; subject: string }>> {
    try {
      const result = await this.findByCode(templateCode);

      if (!result.success || !result.data) {
        throw new NotFoundException(`Template not found: ${templateCode}`);
      }

      const template = result.data;

      const htmlCompiled = Handlebars.compile(template.html_content);
      const textCompiled = Handlebars.compile(template.text_content || '');
      const subjectCompiled = Handlebars.compile(template.subject);

      return {
        success: true,
        data: {
          html: htmlCompiled(variables),
          text: textCompiled(variables),
          subject: subjectCompiled(variables),
        },
        message: 'Template rendered successfully',
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      return {
        success: false,
        error: error.message,
        message: 'Failed to render template',
      };
    }
  }
}
