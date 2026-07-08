import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type {
  NextFunction,
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConversationGenerationService } from '../conversation-generation.service';
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

const VALID_PREVIEW_BODY = {
  model: 'applications/my-custom-app',
  messages: [{ role: 'user', content: 'Hello' }],
};

describe('POST /conversations/preview-completions (integration)', () => {
  let app: INestApplication;
  let mockService: { streamPreviewCompletion: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockService = {
      streamPreviewCompletion: vi
        .fn()
        .mockImplementation(
          (_model, _messages, _at, _signal, res: ExpressResponse) => {
            res.setHeader('Content-Type', 'text/event-stream');
            res.write('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n');
            res.write('data: [DONE]\n\n');
            res.end();
          },
        ),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConversationController],
      providers: [
        { provide: ConversationService, useValue: mockService },
        {
          provide: ConversationGenerationService,
          useValue: {},
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

  it('returns SSE stream and calls streamPreviewCompletion with correct args', async () => {
    const res = await request(app.getHttpServer())
      .post('/conversations/preview-completions')
      .send(VALID_PREVIEW_BODY)
      .expect(200);

    expect(res.text).toContain('data: [DONE]');
    expect(mockService.streamPreviewCompletion).toHaveBeenCalledOnce();
    const [model, messages, at] =
      mockService.streamPreviewCompletion.mock.calls[0];
    expect(model).toBe(VALID_PREVIEW_BODY.model);
    expect(messages).toEqual(VALID_PREVIEW_BODY.messages);
    expect(at).toBe(TEST_USER.at);
  });

  it('returns 400 when model is missing', async () => {
    const { model: _model, ...bodyWithout } = VALID_PREVIEW_BODY;
    await request(app.getHttpServer())
      .post('/conversations/preview-completions')
      .send(bodyWithout)
      .expect(400);
  });

  it('returns 400 when messages is empty', async () => {
    await request(app.getHttpServer())
      .post('/conversations/preview-completions')
      .send({ ...VALID_PREVIEW_BODY, messages: [] })
      .expect(400);
  });

  it('returns 400 when a message role is invalid', async () => {
    await request(app.getHttpServer())
      .post('/conversations/preview-completions')
      .send({
        ...VALID_PREVIEW_BODY,
        messages: [{ role: 'not-a-role', content: 'Hello' }],
      })
      .expect(400);
  });

  it('returns 400 when a message exceeds the max content length', async () => {
    await request(app.getHttpServer())
      .post('/conversations/preview-completions')
      .send({
        ...VALID_PREVIEW_BODY,
        messages: [{ role: 'user', content: 'a'.repeat(4001) }],
      })
      .expect(400);
  });

  it('returns 400 when messages exceeds the max array size', async () => {
    await request(app.getHttpServer())
      .post('/conversations/preview-completions')
      .send({
        ...VALID_PREVIEW_BODY,
        messages: Array.from({ length: 101 }, () => ({
          role: 'user',
          content: 'Hello',
        })),
      })
      .expect(400);
  });

  it('returns 400 when generationId is not a UUID v4', async () => {
    await request(app.getHttpServer())
      .post('/conversations/preview-completions')
      .send({ ...VALID_PREVIEW_BODY, generationId: 'not-a-uuid' })
      .expect(400);
  });
});
