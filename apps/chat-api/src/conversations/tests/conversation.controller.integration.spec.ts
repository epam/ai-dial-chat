import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserConfigService } from '../../user-config/user-config.service';
import { ConversationController } from '../conversation.controller';
import { ConversationService } from '../conversation.service';

const TEST_USER = {
  at: 'test-access-token',
  bucket: 'test-bucket',
};

describe('ConversationController (integration)', () => {
  let app: INestApplication;
  let service: {
    createConversation: ReturnType<typeof vi.fn>;
    listConversations: ReturnType<typeof vi.fn>;
    renameConversation: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      createConversation: vi.fn(),
      listConversations: vi.fn(),
      renameConversation: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConversationController],
      providers: [{ provide: ConversationService, useValue: service }],
    }).compile();

    app = module.createNestApplication();
    app.use((req, _res, next) => {
      req.user = TEST_USER;
      next();
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  describe('POST /conversations', () => {
    it('returns 201 with the created conversation for a valid body', async () => {
      const conversation = {
        id: '11111111-1111-1111-1111-111111111111',
        messages: [
          {
            id: '22222222-2222-2222-2222-222222222222',
            role: 'user',
            content: 'Hello',
            timestamp: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
      };
      service.createConversation.mockReturnValue(conversation);

      const result = await request(app.getHttpServer())
        .post('/conversations')
        .send({ firstMessage: 'Hello', deploymentId: 'gpt-4o' })
        .expect(201);

      expect(result.body).toEqual(conversation);
      expect(service.createConversation).toHaveBeenCalledWith(
        'Hello',
        TEST_USER.at,
        TEST_USER.bucket,
        'gpt-4o',
        undefined,
      );
    });

    it('returns 400 when firstMessage is empty and no attachment is provided', async () => {
      await request(app.getHttpServer())
        .post('/conversations')
        .send({ firstMessage: '', deploymentId: 'gpt-4o' })
        .expect(400);
    });

    it('returns 400 when body is empty', async () => {
      await request(app.getHttpServer())
        .post('/conversations')
        .send({})
        .expect(400);
    });

    it('returns 400 when firstMessage exceeds 4000 characters', async () => {
      await request(app.getHttpServer())
        .post('/conversations')
        .send({ firstMessage: 'a'.repeat(4001), deploymentId: 'gpt-4o' })
        .expect(400);
    });

    it('returns 400 when deploymentId is missing', async () => {
      await request(app.getHttpServer())
        .post('/conversations')
        .send({ firstMessage: 'Hello' })
        .expect(400);
    });

    it('returns 400 when deploymentId is an empty string', async () => {
      await request(app.getHttpServer())
        .post('/conversations')
        .send({ firstMessage: 'Hello', deploymentId: '' })
        .expect(400);
    });

    it('returns 400 when deploymentId exceeds 256 characters', async () => {
      await request(app.getHttpServer())
        .post('/conversations')
        .send({ firstMessage: 'Hello', deploymentId: 'a'.repeat(257) })
        .expect(400);
    });

    it('returns 400 when deploymentId contains disallowed characters', async () => {
      await request(app.getHttpServer())
        .post('/conversations')
        .send({ firstMessage: 'Hello', deploymentId: 'bad id!' })
        .expect(400);
    });

    it('returns 201 with a valid conversation shape from the real service', async () => {
      const configService = {
        get: vi.fn((key: string) => {
          if (key === 'DIAL_CORE_URL') return 'http://localhost:3000';
          if (key === 'DIAL_API_KEY') return 'test-api-key';
          return undefined;
        }),
      };

      const realModule: TestingModule = await Test.createTestingModule({
        controllers: [ConversationController],
        providers: [
          { provide: ConfigService, useValue: configService },
          ConversationService,
          UserConfigService,
        ],
      }).compile();

      const realApp = realModule.createNestApplication();
      realApp.use((req, _res, next) => {
        req.user = TEST_USER;
        next();
      });
      realApp.useGlobalPipes(
        new ValidationPipe({ whitelist: true, transform: true }),
      );
      await realApp.init();

      vi.spyOn(
        realApp.get(ConversationService)['client'],
        'saveConversation',
      ).mockResolvedValue({ data: {} } as never);

      const result = await request(realApp.getHttpServer())
        .post('/conversations')
        .send({
          firstMessage: 'Hello from integration',
          deploymentId: 'gpt-4o',
        })
        .expect(201);

      expect(result.body.id).toMatch(
        /^test-bucket\/gpt-4o__Hello from integration.*__[0-9a-f-]{36}$/i,
      );
      expect(result.body.messages).toHaveLength(1);
      expect(result.body.messages[0].content).toBe('Hello from integration');

      await realApp.close();
    });

    it('returns 201 when valid attachments are provided', async () => {
      const conversation = { id: 'test-id', messages: [] };
      service.createConversation.mockReturnValue(conversation);

      const result = await request(app.getHttpServer())
        .post('/conversations')
        .send({
          firstMessage: 'Here is a file',
          deploymentId: 'gpt-4o',
          custom_content: {
            attachments: [
              {
                type: 'application/pdf',
                title: 'report.pdf',
                data: 'base64data',
              },
            ],
          },
        })
        .expect(201);

      expect(result.body).toEqual(conversation);
      expect(service.createConversation).toHaveBeenCalledWith(
        'Here is a file',
        TEST_USER.at,
        TEST_USER.bucket,
        'gpt-4o',
        {
          attachments: [
            {
              type: 'application/pdf',
              title: 'report.pdf',
              data: 'base64data',
            },
          ],
        },
      );
    });

    it('returns 201 with an empty firstMessage when an attachment is provided', async () => {
      const conversation = { id: 'test-id', messages: [] };
      service.createConversation.mockReturnValue(conversation);

      const result = await request(app.getHttpServer())
        .post('/conversations')
        .send({
          firstMessage: '',
          deploymentId: 'gpt-4o',
          custom_content: {
            attachments: [
              {
                type: 'application/pdf',
                title: 'report.pdf',
                data: 'base64data',
              },
            ],
          },
        })
        .expect(201);

      expect(result.body).toEqual(conversation);
      expect(service.createConversation).toHaveBeenCalledWith(
        '',
        TEST_USER.at,
        TEST_USER.bucket,
        'gpt-4o',
        {
          attachments: [
            {
              type: 'application/pdf',
              title: 'report.pdf',
              data: 'base64data',
            },
          ],
        },
      );
    });

    it('returns 400 when an attachment is missing the required type field', async () => {
      await request(app.getHttpServer())
        .post('/conversations')
        .send({
          firstMessage: 'Hello',
          deploymentId: 'gpt-4o',
          custom_content: { attachments: [{ title: 'file.pdf' }] },
        })
        .expect(400);
    });

    it('returns 400 when an attachment is missing the required title field', async () => {
      await request(app.getHttpServer())
        .post('/conversations')
        .send({
          firstMessage: 'Hello',
          deploymentId: 'gpt-4o',
          custom_content: { attachments: [{ type: 'application/pdf' }] },
        })
        .expect(400);
    });

    it('returns 201 when a valid https url is provided in an attachment', async () => {
      const conversation = { id: 'test-id', messages: [] };
      service.createConversation.mockReturnValue(conversation);

      await request(app.getHttpServer())
        .post('/conversations')
        .send({
          firstMessage: 'Here is a link',
          deploymentId: 'gpt-4o',
          custom_content: {
            attachments: [
              {
                type: 'image/png',
                title: 'screenshot.png',
                url: 'https://files.example.com/screenshot.png',
              },
            ],
          },
        })
        .expect(201);
    });

    it.each([
      'http://169.254.169.254/latest/meta-data/',
      'http://internal.service/secret',
      'file:///etc/passwd',
      'javascript:alert(1)',
      'not-a-url',
    ])(
      'returns 400 when attachment url is a disallowed value: %s',
      async (badUrl) => {
        await request(app.getHttpServer())
          .post('/conversations')
          .send({
            firstMessage: 'Hello',
            deploymentId: 'gpt-4o',
            custom_content: {
              attachments: [{ type: 'image/png', title: 'x.png', url: badUrl }],
            },
          })
          .expect(400);
      },
    );

    it.each([
      'http://169.254.169.254/latest/meta-data/',
      'file:///etc/passwd',
      'not-a-url',
    ])(
      'returns 400 when attachment reference_url is a disallowed value: %s',
      async (badUrl) => {
        await request(app.getHttpServer())
          .post('/conversations')
          .send({
            firstMessage: 'Hello',
            deploymentId: 'gpt-4o',
            custom_content: {
              attachments: [
                {
                  type: 'image/png',
                  title: 'x.png',
                  data: 'base64data',
                  reference_url: badUrl,
                },
              ],
            },
          })
          .expect(400);
      },
    );
  });

  describe('GET /conversations/list', () => {
    it('returns 200 with items when path is omitted', async () => {
      const response = { items: [], nextToken: undefined };
      service.listConversations.mockReturnValue(response);

      await request(app.getHttpServer()).get('/conversations/list').expect(200);

      expect(service.listConversations).toHaveBeenCalledWith(
        TEST_USER.at,
        TEST_USER.bucket,
        undefined,
        undefined,
        undefined,
      );
    });

    it('forwards non-empty path to the service', async () => {
      const response = { items: [], nextToken: undefined };
      service.listConversations.mockReturnValue(response);

      await request(app.getHttpServer())
        .get('/conversations/list?path=work%2Fproject-x')
        .expect(200);

      expect(service.listConversations).toHaveBeenCalledWith(
        TEST_USER.at,
        TEST_USER.bucket,
        undefined,
        undefined,
        'work/project-x',
      );
    });

    it('returns 400 when path exceeds 512 characters', async () => {
      await request(app.getHttpServer())
        .get(`/conversations/list?path=${'a'.repeat(513)}`)
        .expect(400);
    });

    it('returns 400 when limit exceeds 100', async () => {
      await request(app.getHttpServer())
        .get('/conversations/list?limit=200')
        .expect(400);
    });
  });

  describe('PATCH /conversations', () => {
    it('returns 200 with newPath for a valid request', async () => {
      const renamed = {
        newPath: 'conversations/test-bucket/gpt-4o__New Title__uuid',
      };
      service.renameConversation.mockReturnValue(renamed);

      const result = await request(app.getHttpServer())
        .patch('/conversations?path=gpt-4o__Old+Title__uuid')
        .send({ newTitle: 'New Title' })
        .expect(200);

      expect(result.body).toEqual(renamed);
      expect(service.renameConversation).toHaveBeenCalledWith(
        'gpt-4o__Old Title__uuid',
        'New Title',
        TEST_USER.at,
        TEST_USER.bucket,
      );
    });

    it('returns 400 when newTitle is empty', async () => {
      await request(app.getHttpServer())
        .patch('/conversations?path=gpt-4o__Old+Title__uuid')
        .send({ newTitle: '' })
        .expect(400);
    });

    it('returns 400 when newTitle exceeds 255 UTF-8 bytes', async () => {
      await request(app.getHttpServer())
        .patch('/conversations?path=gpt-4o__Old+Title__uuid')
        .send({ newTitle: 'a'.repeat(256) })
        .expect(400);
    });

    it('returns 400 when path query param is missing', async () => {
      await request(app.getHttpServer())
        .patch('/conversations')
        .send({ newTitle: 'New Title' })
        .expect(400);
    });
  });
});
