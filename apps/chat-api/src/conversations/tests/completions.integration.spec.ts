import http from 'node:http';
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
      streamCompletion: vi.fn().mockImplementation(async function* (
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
        onReadyToStream: () => void,
      ) {
        onReadyToStream();
        yield Buffer.from('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n');
        yield Buffer.from('data: [DONE]\n\n');
      }),
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
    await app.listen(0, '127.0.0.1');
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
    expect(mockService.streamCompletion.mock.calls[0][13]).toBeUndefined();
  });

  /* Firefox keeps the fetch() promise pending until the first body byte
   * arrives, so the stream has to open with a comment rather than waiting for
   * the model's first token — see issue #8587. */
  it('opens the stream with the init comment before the first model chunk', async () => {
    mockService.streamCompletion.mockImplementation(async function* (
      ...args: unknown[]
    ) {
      (args[10] as () => void)();
      yield Buffer.from('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n');
    });

    const res = await request(app.getHttpServer())
      .post('/conversations/completions')
      .send(VALID_COMPLETION_BODY)
      .expect(200);

    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.text).toBe(
      ': init\n\ndata: {"choices":[{"delta":{"content":"Hi"}}]}\n\n',
    );
  });

  it('passes a valid timezone header to the completion service', async () => {
    await request(app.getHttpServer())
      .post('/conversations/completions')
      .set('X-Timezone', 'Europe/Warsaw')
      .send(VALID_COMPLETION_BODY)
      .expect(200);

    expect(mockService.streamCompletion).toHaveBeenCalledOnce();
    expect(mockService.streamCompletion.mock.calls[0][13]).toBe(
      'Europe/Warsaw',
    );
  });

  it.each([
    ['malformed', 'Europe Warsaw'],
    ['unknown', 'Mars/Olympus'],
    ['oversized', 'A'.repeat(256)],
    ['multiple', 'Europe/Warsaw, Asia/Tokyo'],
  ])('returns 400 for a %s timezone header', async (_case, timezone) => {
    await request(app.getHttpServer())
      .post('/conversations/completions')
      .set('X-Timezone', timezone)
      .send(VALID_COMPLETION_BODY)
      .expect(400);

    expect(mockService.streamCompletion).not.toHaveBeenCalled();
  });

  it('returns 409 when ConversationService throws ConflictException (duplicate active generation)', async () => {
    mockService.streamCompletion.mockImplementation(() => {
      throw new ConflictException('Another generation is already active');
    });

    await request(app.getHttpServer())
      .post('/conversations/completions')
      .send(VALID_COMPLETION_BODY)
      .expect(409);
  });

  /*
   * `streamCompletion` is an async generator: its body — including the
   * `generationService.register()` call that rejects a duplicate active
   * generation — does not run until the controller's `for await` pulls the
   * first chunk. The rejection therefore surfaces from inside the consuming
   * loop, after SSE headers may or may not have been sent. Before issue #8688
   * the controller's `finally` ended the response unconditionally, flushing an
   * empty 200 and leaving the exception filter nothing to write: a second
   * browser tab submitting into the same conversation saw an empty LLM answer
   * instead of a conflict.
   */
  it('returns 409 when the generator rejects before the stream opens', async () => {
    mockService.streamCompletion.mockImplementation(
      // eslint-disable-next-line require-yield
      async function* () {
        throw new ConflictException(
          'A generation is already active for this conversation. Stop it before starting a new one.',
        );
      },
    );

    const res = await request(app.getHttpServer())
      .post('/conversations/completions')
      .send(VALID_COMPLETION_BODY)
      .expect(409);

    expect(res.body.message).toContain('already active');
  });

  it('ends the SSE stream without a status rewrite when the generator rejects mid-stream', async () => {
    mockService.streamCompletion.mockImplementation(async function* (
      ...args: unknown[]
    ) {
      (args[10] as () => void)();
      yield Buffer.from('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n');
      throw new Error('upstream exploded');
    });

    const res = await request(app.getHttpServer())
      .post('/conversations/completions')
      .send(VALID_COMPLETION_BODY)
      .expect(200);

    expect(res.text).toContain('"content":"Hi"');
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

  it('keeps draining the generator to completion after the client disconnects mid-stream, without touching the generation registry', async () => {
    let releaseSecondChunk: () => void = () => undefined;
    const secondChunkGate = new Promise<void>((resolve) => {
      releaseSecondChunk = resolve;
    });
    let reachedNaturalEnd = false;
    mockService.streamCompletion.mockImplementation(async function* (
      ...args: unknown[]
    ) {
      (args[10] as () => void)();
      yield Buffer.from('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n');
      // Holds the generator open past the first chunk so the client can
      // disconnect before the stream would otherwise finish on its own.
      await secondChunkGate;
      yield Buffer.from('data: [DONE]\n\n');
      // Only reached if the controller keeps calling `.next()` after the
      // response closed — i.e. it did not `break`/`return` its consuming
      // loop early because of the disconnect.
      reachedNaturalEnd = true;
    });

    const address = app.getHttpServer().address();
    const port =
      typeof address === 'object' && address !== null ? address.port : 0;

    await new Promise<void>((resolve) => {
      const req = http.request(
        {
          host: '127.0.0.1',
          port,
          path: '/conversations/completions',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
        (res) => {
          res.once('data', () => {
            // First chunk arrived — simulate the browser tab closing.
            req.destroy();
          });
        },
      );
      req.on('error', () => resolve());
      req.on('close', () => resolve());
      req.write(JSON.stringify(VALID_COMPLETION_BODY));
      req.end();
    });

    releaseSecondChunk();

    await vi.waitFor(() => expect(reachedNaturalEnd).toBe(true));

    // The controller never calls back into the generation registry as part
    // of handling `streamCompletion`'s own disconnect — that is the whole
    // point of this regression test. `abort`/`error`/`complete` remain the
    // exclusive province of an explicit Stop or the upstream relay's own
    // terminal outcome, neither of which happened here.
    expect(mockGenerationService.abort).not.toHaveBeenCalled();
    expect(mockGenerationService.error).not.toHaveBeenCalled();
    expect(mockGenerationService.complete).not.toHaveBeenCalled();
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
    await app.listen(0, '127.0.0.1');
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
