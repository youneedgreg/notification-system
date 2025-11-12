import { IsString, IsArray, IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTemplateDto {
  @ApiProperty({ example: 'welcome_email', description: 'Unique template code' })
  @IsString()
  code: string;

  @ApiProperty({ example: 'Welcome Email', description: 'Template name' })
  @IsString()
  name: string;

  @ApiProperty({ 
    required: false, 
    example: 'Welcome email sent to new users',
    description: 'Template description'
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'Welcome to {{app_name}}!', description: 'Email subject' })
  @IsString()
  subject: string;

  @ApiProperty({ 
    example: '<h1>Hello {{name}}!</h1><p>Welcome to our platform.</p>',
    description: 'HTML email content'
  })
  @IsString()
  html_content: string;

  @ApiProperty({ 
    required: false,
    example: 'Hello {{name}}! Welcome to our platform.',
    description: 'Plain text email content'
  })
  @IsOptional()
  @IsString()
  text_content?: string;

  @ApiProperty({ 
    required: false,
    type: [String],
    example: ['name', 'app_name', 'link'],
    description: 'List of variables used in template'
  })
  @IsOptional()
  @IsArray()
  variables?: string[];

  @ApiProperty({ 
    required: false,
    example: 'email',
    enum: ['email', 'push'],
    description: 'Template type'
  })
  @IsOptional()
  @IsEnum(['email', 'push'])
  type?: string;

  @ApiProperty({ 
    required: false,
    example: 'en',
    description: 'Template language'
  })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiProperty({ 
    required: false,
    example: true,
    description: 'Whether template is active'
  })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}