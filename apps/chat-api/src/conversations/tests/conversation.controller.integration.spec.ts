import {
  BadGatewayException,
  INestApplication,
  NotFoundException,
  ServiceUnavailableException,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import type {
  NextFunction,
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DialClientService } from '../../dial/dial-client.service';
import { UserConfigService } from '../../user-config/user-config.service';
import {
  ConversationGenerationService,
  GenerationStatus,
} from '../conversation-generation.service';
import { ConversationNamingService } from '../conversation-naming.service';
import { ConversationController } from '../conversation.controller';
import { ConversationService } from '../conversation.service';

const TEST_USER = {
  sid: 'test-sid',
  sub: 'test-sub',
  providerId: 'keycloak',
  at: 'test-access-token',
  bucket: 'test-bucket',
  claims: {},
  csrf: 'test-csrf',
};

describe('ConversationController (integration)', () => {
  let app: INestApplication;
  let service: {
    createConversation: ReturnType<typeof vi.fn>;
    listConversations: ReturnType<typeof vi.fn>;
    renameConversation: ReturnType<typeof vi.fn>;
    generateTitle: ReturnType<typeof vi.fn>;
    deleteConversations: ReturnType<typeof vi.fn>;
    deleteAllConversations: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      createConversation: vi.fn(),
      listConversations: vi.fn(),
      renameConversation: vi.fn(),
      generateTitle: vi.fn(),
      deleteConversations: vi.fn(),
      deleteAllConversations: vi.fn(),
    };

    const mockGenerationService = {
      register: vi.fn().mockReturnValue(new AbortController()),
      abort: vi.fn().mockReturnValue(true),
      complete: vi.fn(),
      error: vi.fn(),
      getStatus: vi.fn().mockReturnValue(GenerationStatus.Active),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConversationController],
      providers: [
        { provide: ConversationService, useValue: service },
        {
          provide: ConversationGenerationService,
          useValue: mockGenerationService,
        },
      ],
    }).compile();

    app = module.createNestApplication();
    app.use(
      (req: ExpressRequest, _res: ExpressResponse, next: NextFunction) => {
        req.user = TEST_USER;
        next();
      },
    );
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

    it('accepts a percent-encoded deploymentId from the deployments API', async () => {
      const conversation = { id: 'test-bucket/applications/app__Hello' };
      const deploymentId =
        'applications/6LLV3pmfwUbYZj3jFvKWdANHFmWwX3P6eFoFKoxZJVrEW5cQzK965U43R5kWqKCwtd/Untitled%20app%201__0.0.1';
      service.createConversation.mockReturnValue(conversation);

      const result = await request(app.getHttpServer())
        .post('/conversations')
        .send({ firstMessage: 'Hello', deploymentId })
        .expect(201);

      expect(result.body).toEqual(conversation);
      expect(service.createConversation).toHaveBeenCalledWith(
        'Hello',
        TEST_USER.at,
        TEST_USER.bucket,
        deploymentId,
        undefined,
      );
    });

    it('accepts a deploymentId containing parentheses', async () => {
      const conversation = {
        id: 'test-bucket/gemini-2.5-flash-image_(ek)__Hello',
      };
      const deploymentId = 'gemini-2.5-flash-image_(ek)';
      service.createConversation.mockReturnValue(conversation);

      const result = await request(app.getHttpServer())
        .post('/conversations')
        .send({ firstMessage: 'Hello', deploymentId })
        .expect(201);

      expect(result.body).toEqual(conversation);
      expect(service.createConversation).toHaveBeenCalledWith(
        'Hello',
        TEST_USER.at,
        TEST_USER.bucket,
        deploymentId,
        undefined,
      );
    });

    it('returns 400 when deploymentId contains malformed percent-encoding', async () => {
      await request(app.getHttpServer())
        .post('/conversations')
        .send({ firstMessage: 'Hello', deploymentId: 'applications/bad%2-id' })
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
          DialClientService,
          ConversationService,
          UserConfigService,
          ConversationGenerationService,
          {
            provide: ConversationNamingService,
            useValue: { maybeRenameAfterFirstReply: vi.fn() },
          },
        ],
      }).compile();

      const realApp = realModule.createNestApplication();
      realApp.use(
        (req: ExpressRequest, _res: ExpressResponse, next: NextFunction) => {
          req.user = TEST_USER;
          next();
        },
      );
      realApp.useGlobalPipes(
        new ValidationPipe({ whitelist: true, transform: true }),
      );
      await realApp.init();

      vi.spyOn(
        realApp.get(DialClientService).client,
        'saveConversation',
      ).mockResolvedValue({ data: {} } as never);
      vi.spyOn(
        realApp.get(DialClientService).client,
        'getConversationMetadata',
      ).mockResolvedValue({ data: null, error: { status: 404 } } as never);

      const result = await request(realApp.getHttpServer())
        .post('/conversations')
        .send({
          firstMessage: 'Hello from integration',
          deploymentId: 'gpt-4o',
        })
        .expect(201);

      expect(result.body.id).toMatch(
        /^test-bucket\/gpt-4o__Hello from integration__[0-9a-f-]{36}$/,
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

    it('returns 201 when a DIAL file path is provided in an attachment url', async () => {
      const conversation = { id: 'test-id', messages: [] };
      service.createConversation.mockReturnValue(conversation);

      await request(app.getHttpServer())
        .post('/conversations')
        .send({
          firstMessage: 'Here is a file',
          deploymentId: 'gpt-4o',
          custom_content: {
            attachments: [
              {
                type: 'image/jpeg',
                title: 'IMG_4740 2.jpg',
                url: 'files/6LLV3pmfwUbYZj3jFvKWdANHFmWwX3P6eFoFKoxZJVrEW5cQzK965U43R5kWqKCwtd/uploads/2026-06/IMG_4740%202.jpg',
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
      'files/bucket/uploads/2026-06/../secret.txt',
      'files/bucket/uploads/2026-06/secret%2ftoken.txt',
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
    it('returns 200 with items', async () => {
      const response = { items: [], nextToken: undefined };
      service.listConversations.mockReturnValue(response);

      await request(app.getHttpServer()).get('/conversations/list').expect(200);

      expect(service.listConversations).toHaveBeenCalledWith(
        TEST_USER.at,
        TEST_USER.bucket,
        undefined,
        undefined,
      );
    });

    it('forwards limit and nextToken to the service', async () => {
      const response = { items: [], nextToken: undefined };
      service.listConversations.mockReturnValue(response);

      await request(app.getHttpServer())
        .get('/conversations/list?limit=50&nextToken=abc123')
        .expect(200);

      expect(service.listConversations).toHaveBeenCalledWith(
        TEST_USER.at,
        TEST_USER.bucket,
        50,
        'abc123',
      );
    });

    it('accepts a limit of 1000', async () => {
      const response = { items: [], nextToken: undefined };
      service.listConversations.mockReturnValue(response);

      await request(app.getHttpServer())
        .get('/conversations/list?limit=1000')
        .expect(200);

      expect(service.listConversations).toHaveBeenCalledWith(
        TEST_USER.at,
        TEST_USER.bucket,
        1000,
        undefined,
      );
    });

    it('returns 400 when limit exceeds 1000', async () => {
      await request(app.getHttpServer())
        .get('/conversations/list?limit=1001')
        .expect(400);
    });

    it('returns 400 when limit is below 1', async () => {
      await request(app.getHttpServer())
        .get('/conversations/list?limit=0')
        .expect(400);
    });

    it('returns 400 when nextToken exceeds 512 characters', async () => {
      await request(app.getHttpServer())
        .get(`/conversations/list?nextToken=${'x'.repeat(513)}`)
        .expect(400);
    });

    it('returns the public-bucket item verbatim for a published conversation, without falling back to the caller bucket', async () => {
      const response = {
        items: [
          {
            id: 'conversations/public/folder/gpt-4o__shared-title',
            title: 'shared-title',
            updatedAt: 2000,
            sharedWithMe: false,
            publishedWithMe: true,
            isPinned: false,
            isReadonly: true,
          },
        ],
        nextToken: undefined,
      };
      service.listConversations.mockReturnValue(response);

      const { body } = await request(app.getHttpServer())
        .get('/conversations/list')
        .expect(200);

      expect(body.items).toHaveLength(1);
      expect(body.items[0].id).toBe(
        'conversations/public/folder/gpt-4o__shared-title',
      );
      expect(
        body.items[0].id.startsWith(`conversations/${TEST_USER.bucket}/`),
      ).toBe(false);
    });

    it('returns isScheduledTask, scheduleId, and runId for a scheduler-created conversation', async () => {
      const response = {
        items: [
          {
            id: 'conversations/test-bucket/.scheduler/sched_abc/gpt-4o__Morning briefing__c7aeee4c-c01f-41f2-b0db-b8a1a39943f5',
            title: 'Morning briefing',
            updatedAt: 2000,
            sharedWithMe: false,
            publishedWithMe: false,
            isPinned: false,
            isReadonly: false,
            isScheduledTask: true,
            scheduleId: 'sched_abc',
            runId: 'c7aeee4c-c01f-41f2-b0db-b8a1a39943f5',
          },
          {
            id: 'conversations/test-bucket/gpt-4o__Regular chat__uuid',
            title: 'Regular chat',
            updatedAt: 1000,
            sharedWithMe: false,
            publishedWithMe: false,
            isPinned: false,
            isReadonly: false,
            isScheduledTask: false,
          },
        ],
        nextToken: undefined,
      };
      service.listConversations.mockReturnValue(response);

      const { body } = await request(app.getHttpServer())
        .get('/conversations/list')
        .expect(200);

      expect(body.items[0]).toMatchObject({
        isScheduledTask: true,
        scheduleId: 'sched_abc',
        runId: 'c7aeee4c-c01f-41f2-b0db-b8a1a39943f5',
      });
      expect(body.items[1].isScheduledTask).toBe(false);
      expect(body.items[1].scheduleId).toBeUndefined();
      expect(body.items[1].runId).toBeUndefined();
    });
  });

  describe('PATCH /conversations', () => {
    it('returns 200 with the renamed name and the path unchanged', async () => {
      const renamed = { name: 'New Title' };
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

    it('returns 404 when the conversation does not exist', async () => {
      service.renameConversation.mockRejectedValue(
        new NotFoundException('Conversation not found'),
      );

      await request(app.getHttpServer())
        .patch('/conversations?path=gpt-4o__Missing__uuid')
        .send({ newTitle: 'New Title' })
        .expect(404);
    });
  });

  describe('POST /conversations/generate-title', () => {
    it('returns 200 with the generated name for a valid path', async () => {
      service.generateTitle.mockResolvedValue('Docker networking basics');

      const result = await request(app.getHttpServer())
        .post('/conversations/generate-title?path=gpt-4o__Old+Title__uuid')
        .expect(200);

      expect(result.body).toEqual({ name: 'Docker networking basics' });
      expect(service.generateTitle).toHaveBeenCalledWith(
        'gpt-4o__Old Title__uuid',
        TEST_USER.at,
        TEST_USER.bucket,
      );
    });

    it('returns 400 when path query param is missing', async () => {
      await request(app.getHttpServer())
        .post('/conversations/generate-title')
        .expect(400);

      expect(service.generateTitle).not.toHaveBeenCalled();
    });

    it('returns 404 when the conversation does not exist', async () => {
      service.generateTitle.mockRejectedValue(
        new NotFoundException('Conversation not found'),
      );

      await request(app.getHttpServer())
        .post('/conversations/generate-title?path=gpt-4o__Missing__uuid')
        .expect(404);
    });

    it('returns 502 when LLM title generation fails', async () => {
      service.generateTitle.mockRejectedValue(
        new BadGatewayException('LLM title generation failed'),
      );

      await request(app.getHttpServer())
        .post('/conversations/generate-title?path=gpt-4o__Old+Title__uuid')
        .expect(502);
    });

    it('returns 503 when LLM title generation is unavailable', async () => {
      service.generateTitle.mockRejectedValue(
        new ServiceUnavailableException(
          'LLM title generation is not available',
        ),
      );

      await request(app.getHttpServer())
        .post('/conversations/generate-title?path=gpt-4o__Old+Title__uuid')
        .expect(503);
    });
  });

  describe('POST /conversations/deletions', () => {
    const mockResult = {
      requested: 1,
      deleted: 1,
      alreadyAbsent: 0,
      failed: [],
    };

    it('returns 200 with deletion result for a valid body', async () => {
      service.deleteConversations.mockResolvedValue(mockResult);

      const result = await request(app.getHttpServer())
        .post('/conversations/deletions')
        .send({ ids: ['conversations/test-bucket/chat'] })
        .expect(200);

      expect(result.body).toEqual(mockResult);
      expect(service.deleteConversations).toHaveBeenCalledWith(
        ['conversations/test-bucket/chat'],
        TEST_USER.at,
        TEST_USER.bucket,
      );
    });

    it('returns 400 when ids is empty', async () => {
      await request(app.getHttpServer())
        .post('/conversations/deletions')
        .send({ ids: [] })
        .expect(400);
    });

    it('returns 400 when ids has more than 100 items', async () => {
      const ids = Array.from({ length: 101 }, (_, i) => `conv-${i}`);
      await request(app.getHttpServer())
        .post('/conversations/deletions')
        .send({ ids })
        .expect(400);
    });

    it('returns 400 when ids contains a non-string element', async () => {
      await request(app.getHttpServer())
        .post('/conversations/deletions')
        .send({ ids: [123] })
        .expect(400);
    });

    it('returns 400 when body is missing', async () => {
      await request(app.getHttpServer())
        .post('/conversations/deletions')
        .send({})
        .expect(400);
    });
  });

  describe('POST /conversations/deletions/all', () => {
    const mockResult = {
      requested: 5,
      deleted: 5,
      alreadyAbsent: 0,
      failed: [],
    };

    it('returns 200 with deletion result for { confirm: true }', async () => {
      service.deleteAllConversations.mockResolvedValue(mockResult);

      const result = await request(app.getHttpServer())
        .post('/conversations/deletions/all')
        .send({ confirm: true })
        .expect(200);

      expect(result.body).toEqual(mockResult);
      expect(service.deleteAllConversations).toHaveBeenCalledWith(
        TEST_USER.at,
        TEST_USER.bucket,
      );
    });

    it('returns 400 when confirm is false', async () => {
      await request(app.getHttpServer())
        .post('/conversations/deletions/all')
        .send({ confirm: false })
        .expect(400);
    });

    it('returns 400 when confirm is missing', async () => {
      await request(app.getHttpServer())
        .post('/conversations/deletions/all')
        .send({})
        .expect(400);
    });
  });
});
