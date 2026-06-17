import { ConflictException, NotFoundException } from '@nestjs/common';
import { Template } from './entities/template.entity';
import { TemplatesService } from './templates.service';

type MockTemplatesRepository = {
  count: jest.Mock;
  create: jest.Mock;
  delete: jest.Mock;
  findAndCount: jest.Mock;
  findOne: jest.Mock;
  save: jest.Mock;
};

type MockRedisService = {
  del: jest.Mock;
  get: jest.Mock;
  set: jest.Mock;
};

const makeTemplate = (overrides: Partial<Template> = {}): Template =>
  ({
    id: 'template-1',
    code: 'welcome_email',
    name: 'Welcome Email',
    description: 'Welcome email',
    subject: 'Welcome {{name}} to {{app_name}}',
    html_content: '<h1>Hello {{name}}</h1><a href="{{link}}">Start</a>',
    text_content: 'Hello {{name}}. Start at {{link}}',
    variables: ['name', 'app_name', 'link'],
    type: 'email',
    language: 'en',
    version: 1,
    is_active: true,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  }) as Template;

describe('TemplatesService', () => {
  let repository: MockTemplatesRepository;
  let redisService: MockRedisService;
  let service: TemplatesService;

  beforeEach(() => {
    repository = {
      count: jest.fn().mockResolvedValue(1),
      create: jest.fn((template) => template),
      delete: jest.fn(),
      findAndCount: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };

    redisService = {
      del: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };

    service = new TemplatesService(repository as any, redisService as any);
  });

  it('seeds default templates when the repository is empty', async () => {
    repository.count.mockResolvedValueOnce(0);
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    new TemplatesService(repository as any, redisService as any);
    await Promise.resolve();
    await Promise.resolve();

    expect(repository.save).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ code: 'welcome_email' }),
        expect.objectContaining({ code: 'password_reset' }),
        expect.objectContaining({ code: 'notification_alert' }),
      ]),
    );

    consoleSpy.mockRestore();
  });

  it('creates templates with code and language uniqueness', async () => {
    const template = makeTemplate();
    repository.findOne.mockResolvedValue(null);
    repository.create.mockReturnValue(template);
    repository.save.mockResolvedValue(template);

    const response = await service.create({
      code: template.code,
      name: template.name,
      description: template.description,
      subject: template.subject,
      html_content: template.html_content,
      text_content: template.text_content,
      variables: template.variables,
      type: template.type,
      language: template.language,
      is_active: template.is_active,
    });

    expect(repository.findOne).toHaveBeenCalledWith({
      where: { code: 'welcome_email', language: 'en' },
    });
    expect(response).toEqual({
      success: true,
      data: template,
      message: 'Template created successfully',
    });
  });

  it('throws a conflict for duplicate code and language pairs', async () => {
    repository.findOne.mockResolvedValue(makeTemplate());

    await expect(
      service.create({
        code: 'welcome_email',
        name: 'Welcome Email',
        subject: 'Welcome {{name}}',
        html_content: '<h1>Hello {{name}}</h1>',
        language: 'en',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('paginates templates', async () => {
    const template = makeTemplate();
    repository.findAndCount.mockResolvedValue([[template], 12]);

    const response = await service.findAll(2, 5);

    expect(repository.findAndCount).toHaveBeenCalledWith({
      skip: 5,
      take: 5,
      order: { created_at: 'DESC' },
    });
    expect(response.meta).toEqual({
      total: 12,
      limit: 5,
      page: 2,
      total_pages: 3,
      has_next: true,
      has_previous: true,
    });
  });

  it('finds one template by id', async () => {
    const template = makeTemplate();
    repository.findOne.mockResolvedValue(template);

    await expect(service.findOne('template-1')).resolves.toMatchObject({
      success: true,
      data: template,
    });
  });

  it('throws when a template id is missing', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(service.findOne('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns cached templates by code and language', async () => {
    const template = makeTemplate({ language: 'es', subject: 'Hola {{name}}' });
    redisService.get.mockResolvedValue(JSON.stringify(template));

    const response = await service.findByCode('welcome_email', 'es');

    expect(redisService.get).toHaveBeenCalledWith('template:welcome_email:es');
    expect(repository.findOne).not.toHaveBeenCalled();
    expect(response.data).toMatchObject({
      code: 'welcome_email',
      language: 'es',
      subject: 'Hola {{name}}',
    });
  });

  it('loads and caches templates by code and language after a cache miss', async () => {
    const template = makeTemplate({ language: 'es', subject: 'Hola {{name}}' });
    repository.findOne.mockResolvedValue(template);

    const response = await service.findByCode('welcome_email', 'es');

    expect(repository.findOne).toHaveBeenCalledWith({
      where: { code: 'welcome_email', language: 'es' },
    });
    expect(redisService.set).toHaveBeenCalledWith(
      'template:welcome_email:es',
      JSON.stringify(template),
      3600,
    );
    expect(response.data).toBe(template);
  });

  it('throws when a localized template cannot be found', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(
      service.findByCode('welcome_email', 'de'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates templates, increments content versions, and clears locale cache', async () => {
    const template = makeTemplate({ version: 2, language: 'es' });
    const updated = makeTemplate({
      version: 3,
      language: 'es',
      html_content: '<p>Hola {{name}}</p>',
    });
    repository.findOne.mockResolvedValue(template);
    repository.save.mockResolvedValue(updated);

    const response = await service.update('template-1', {
      html_content: '<p>Hola {{name}}</p>',
    });

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 3,
        html_content: '<p>Hola {{name}}</p>',
      }),
    );
    expect(redisService.del).toHaveBeenCalledWith('template:welcome_email:es');
    expect(response.data).toBe(updated);
  });

  it('removes templates and clears locale cache', async () => {
    const template = makeTemplate({ language: 'fr' });
    repository.findOne.mockResolvedValue(template);
    repository.delete.mockResolvedValue({ affected: 1 });

    const response = await service.remove('template-1');

    expect(repository.delete).toHaveBeenCalledWith('template-1');
    expect(redisService.del).toHaveBeenCalledWith('template:welcome_email:fr');
    expect(response).toMatchObject({
      success: true,
      message: 'Template deleted successfully',
    });
  });

  it('throws when removing a template does not delete a row', async () => {
    repository.findOne.mockResolvedValue(makeTemplate());
    repository.delete.mockResolvedValue({ affected: 0 });

    await expect(service.remove('template-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('renders template variables into subject, html, and text content', async () => {
    repository.findOne.mockResolvedValue(makeTemplate());

    const response = await service.renderTemplate('welcome_email', {
      name: 'Ada',
      app_name: 'Notify',
      link: 'https://example.test/start',
    });

    expect(response).toMatchObject({
      success: true,
      data: {
        subject: 'Welcome Ada to Notify',
        html: '<h1>Hello Ada</h1><a href="https://example.test/start">Start</a>',
        text: 'Hello Ada. Start at https://example.test/start',
      },
    });
  });

  it('falls back to empty strings for missing variables and missing text content', async () => {
    repository.findOne.mockResolvedValue(
      makeTemplate({
        subject: 'Welcome {{name}} to {{app_name}}',
        html_content: '<p>Hello {{name}} {{missing_value}}</p>',
        text_content: null,
      }),
    );

    const response = await service.renderTemplate('welcome_email', {
      name: 'Ada',
    });

    expect(response.data).toEqual({
      subject: 'Welcome Ada to ',
      html: '<p>Hello Ada </p>',
      text: '',
    });
  });

  it('renders the requested locale when a language is provided', async () => {
    repository.findOne.mockResolvedValue(
      makeTemplate({
        language: 'es',
        subject: 'Hola {{name}}',
        html_content: '<p>Bienvenida {{name}}</p>',
        text_content: 'Bienvenida {{name}}',
      }),
    );

    const response = await service.renderTemplate(
      'welcome_email',
      { name: 'Ada' },
      'es',
    );

    expect(repository.findOne).toHaveBeenCalledWith({
      where: { code: 'welcome_email', language: 'es' },
    });
    expect(redisService.get).toHaveBeenCalledWith('template:welcome_email:es');
    expect(response.data).toEqual({
      subject: 'Hola Ada',
      html: '<p>Bienvenida Ada</p>',
      text: 'Bienvenida Ada',
    });
  });
});
