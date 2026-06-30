import {
  ConflictException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type {
  NextFunction,
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ConversationGenerationService,
  GenerationStatus,
} from '../conversation-generation.service';
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

const VALID_COMPLETION_BODY = {
  generationId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
  path: 'test-bucket/gpt-4o__Hello__uuid',
  model: 'gpt-4o',
  mode: 'append',
  message: 'Hello',
};
const VALID_STOP_GENERATION_ID = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const UNKNOWN_GENERATION_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

describe('POST /conversations/completions (integration)', () => {
  let app: INestApplication;
  let mockService: { streamCompletion: ReturnType<typeof vi.fn> };
  let mockGenerationService: {
    register: ReturnType<typeof vi.fn>;
    abort: ReturnType<typeof vi.fn>;
    complete: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    getStatus: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockService = {
      streamCompletion: vi
        .fn()
        .mockImplementation(
          (
            _path,
            _at,
            _bucket,
            _genId,
            _mode,
            _msg,
            _msgIdx,
            _model,
            _cc,
            _sid,
            res: ExpressResponse,
          ) => {
            res.setHeader('Content-Type', 'text/event-stream');
            res.write('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n');
            res.write('data: [DONE]\n\n');
            res.end();
          },
        ),
    };

    mockGenerationService = {
      register: vi.fn().mockReturnValue(new AbortController()),
      abort: vi.fn().mockReturnValue(true),
      complete: vi.fn(),
      error: vi.fn(),
      getStatus: vi.fn().mockReturnValue(GenerationStatus.Active),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConversationController],
      providers: [
        { provide: ConversationService, useValue: mockService },
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

  it('returns SSE stream and calls streamCompletion with correct args', async () => {
    const res = await request(app.getHttpServer())
      .post('/conversations/completions')
      .send(VALID_COMPLETION_BODY)
      .expect(200);

    expect(res.text).toContain('data: [DONE]');
    expect(mockService.streamCompletion).toHaveBeenCalledOnce();
    const [path, at, bucket, genId, mode, message, , model, , sid] =
      mockService.streamCompletion.mock.calls[0];
    expect(path).toBe(VALID_COMPLETION_BODY.path);
    expect(at).toBe(TEST_USER.at);
    expect(bucket).toBe(TEST_USER.bucket);
    expect(genId).toBe(VALID_COMPLETION_BODY.generationId);
    expect(mode).toBe('append');
    expect(message).toBe('Hello');
    expect(model).toBe('gpt-4o');
    expect(sid).toBe(TEST_USER.sid);
  });

  it('returns 409 when ConversationService throws ConflictException (duplicate active generation)', async () => {
    mockService.streamCompletion.mockRejectedValue(
      new ConflictException('Another generation is already active'),
    );

    await request(app.getHttpServer())
      .post('/conversations/completions')
      .send(VALID_COMPLETION_BODY)
      .expect(409);
  });

  it('returns 400 when generationId is missing', async () => {
    const { generationId: _, ...bodyWithout } = VALID_COMPLETION_BODY;
    await request(app.getHttpServer())
      .post('/conversations/completions')
      .send(bodyWithout)
      .expect(400);
  });

  it('returns 400 when generationId is not a UUID v4', async () => {
    await request(app.getHttpServer())
      .post('/conversations/completions')
      .send({ ...VALID_COMPLETION_BODY, generationId: 'not-a-uuid' })
      .expect(400);
  });

  it('returns 400 when mode is missing', async () => {
    const { mode: _, ...bodyWithout } = VALID_COMPLETION_BODY;
    await request(app.getHttpServer())
      .post('/conversations/completions')
      .send(bodyWithout)
      .expect(400);
  });

  it('returns 400 when mode is an invalid value', async () => {
    await request(app.getHttpServer())
      .post('/conversations/completions')
      .send({ ...VALID_COMPLETION_BODY, mode: 'not-a-mode' })
      .expect(400);
  });

  it('returns 400 when path contains path traversal characters (..)', async () => {
    await request(app.getHttpServer())
      .post('/conversations/completions')
      .send({ ...VALID_COMPLETION_BODY, path: 'bucket/../secret' })
      .expect(400);
  });

  it('accepts a valid regenerate request with messageIndex', async () => {
    await request(app.getHttpServer())
      .post('/conversations/completions')
      .send({
        ...VALID_COMPLETION_BODY,
        mode: 'regenerate',
        messageIndex: 2,
        message: undefined,
      })
      .expect(200);

    expect(mockService.streamCompletion).toHaveBeenCalledOnce();
    const [, , , , mode, , msgIdx] = mockService.streamCompletion.mock.calls[0];
    expect(mode).toBe('regenerate');
    expect(msgIdx).toBe(2);
  });
});

describe('POST /conversations/completions/stop (integration)', () => {
  let app: INestApplication;
  let mockGenerationService: {
    register: ReturnType<typeof vi.fn>;
    abort: ReturnType<typeof vi.fn>;
    complete: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    getStatus: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    const mockService = { streamCompletion: vi.fn() };
    mockGenerationService = {
      register: vi.fn().mockReturnValue(new AbortController()),
      abort: vi.fn().mockReturnValue(true),
      complete: vi.fn(),
      error: vi.fn(),
      getStatus: vi.fn().mockReturnValue(GenerationStatus.Active),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConversationController],
      providers: [
        { provide: ConversationService, useValue: mockService },
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

  it('returns 204 and calls generationService.abort when generation is found', async () => {
    mockGenerationService.abort.mockReturnValue(true);

    await request(app.getHttpServer())
      .post('/conversations/completions/stop')
      .send({
        generationId: VALID_STOP_GENERATION_ID,
        path: 'test-bucket/gpt-4o__Hello__uuid',
      })
      .expect(204);

    expect(mockGenerationService.abort).toHaveBeenCalledWith(
      TEST_USER.sid,
      'test-bucket/gpt-4o__Hello__uuid',
      VALID_STOP_GENERATION_ID,
    );
  });

  it('returns 404 when no active generation is found for the given generationId', async () => {
    mockGenerationService.abort.mockReturnValue(false);

    await request(app.getHttpServer())
      .post('/conversations/completions/stop')
      .send({
        generationId: UNKNOWN_GENERATION_ID,
        path: 'test-bucket/gpt-4o__Hello__uuid',
      })
      .expect(404);
  });

  it('returns 400 when generationId is missing', async () => {
    await request(app.getHttpServer())
      .post('/conversations/completions/stop')
      .send({ path: 'test-bucket/gpt-4o__Hello__uuid' })
      .expect(400);
  });

  it('returns 400 when generationId is not a UUID v4', async () => {
    await request(app.getHttpServer())
      .post('/conversations/completions/stop')
      .send({
        generationId: 'not-a-uuid',
        path: 'test-bucket/gpt-4o__Hello__uuid',
      })
      .expect(400);
  });

  it('returns 400 when path is missing', async () => {
    await request(app.getHttpServer())
      .post('/conversations/completions/stop')
      .send({ generationId: VALID_STOP_GENERATION_ID })
      .expect(400);
  });

  it('returns 400 when path contains path traversal characters (..)', async () => {
    await request(app.getHttpServer())
      .post('/conversations/completions/stop')
      .send({
        generationId: VALID_STOP_GENERATION_ID,
        path: 'bucket/../secret',
      })
      .expect(400);
  });
});
