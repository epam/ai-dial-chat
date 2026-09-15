import { EventEmitter } from 'node:events';
import http from 'node:http';
import { Writable } from 'node:stream';
import {
  ConflictException,
  INestApplication,
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
import { AuthSource } from '../../auth/auth-source.enum';
import type { SessionUser } from '../../auth/session/session.types';
import {
  ConversationGenerationService,
  GenerationStatus,
} from '../conversation-generation.service';
import { ConversationController } from '../conversation.controller';
import { ConversationService } from '../conversation.service';
import type { SendCompletionDto } from '../dto/send-completion.dto';

const TEST_USER = {
  sid: 'test-sid',
  sub: 'test-sub',
  providerId: 'keycloak',
  at: 'test-access-token',
  bucket: 'test-bucket',
  claims: {},
  csrf: 'test-csrf',
};

/*
 * A header (bearer) authenticated caller: `HeaderTokenStrategy.authenticate`
 * returns no `sid` and no `csrf`, because no session is created for one
 * (`apps/chat-api/src/auth/strategies/header-token.strategy.ts`).
 */
const HEADER_USER: SessionUser = {
  sub: 'header-sub',
  providerId: 'keycloak',
  at: 'header-access-token',
  bucket: 'test-bucket',
  claims: {},
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
        req.authSource = AuthSource.Cookie;
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
    const [path, at, bucket, genId, mode, message, , model, , ownerKey] =
      mockService.streamCompletion.mock.calls[0];
    expect(path).toBe(VALID_COMPLETION_BODY.path);
    expect(at).toBe(TEST_USER.at);
    expect(bucket).toBe(TEST_USER.bucket);
    expect(genId).toBe(VALID_COMPLETION_BODY.generationId);
    expect(mode).toBe('append');
    expect(message).toBe('Hello');
    expect(model).toBe('gpt-4o');
    expect(ownerKey).toBe(`c:${TEST_USER.sid}`);
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

  /*
   * Regression check: the disconnect-during-setup path (before
   * `onReadyToStream`/headers are sent) must keep draining the generator to
   * completion exactly like the mid-stream disconnect above — the
   * `writeSseChunk` swap must not change this refactor-safety guarantee.
   */
  it('keeps draining the generator to completion when the client disconnects before onReadyToStream fires', async () => {
    const res = new EventEmitter() as unknown as ExpressResponse;
    Object.assign(res, {
      writableEnded: false,
      setHeader: vi.fn(),
      flushHeaders: vi.fn(),
      write: vi.fn().mockReturnValue(true),
      end: vi.fn(),
    });

    let reachedNaturalEnd = false;
    mockService.streamCompletion.mockImplementation(async function* (
      ...args: unknown[]
    ) {
      // Simulates the browser closing before setup finishes — no headers
      // have been sent yet.
      res.emit('close');
      (args[10] as () => void)();
      yield Buffer.from('data: [DONE]\n\n');
      reachedNaturalEnd = true;
    });

    await new ConversationController(
      mockService as unknown as ConversationService,
      mockGenerationService as unknown as ConversationGenerationService,
    ).streamCompletion(
      {
        user: TEST_USER,
        authSource: AuthSource.Cookie,
      } as unknown as ExpressRequest,
      res,
      VALID_COMPLETION_BODY as unknown as SendCompletionDto,
      undefined,
    );

    expect(reachedNaturalEnd).toBe(true);
    expect(mockGenerationService.abort).not.toHaveBeenCalled();
  });
});

describe('POST /conversations/completions — backpressure-driven detachment (direct controller)', () => {
  const TEST_REQUEST = {
    user: TEST_USER,
    authSource: AuthSource.Cookie,
  } as unknown as ExpressRequest;

  it('detaches the response once buffered output exceeds SSE_COMPLETION_MAX_BUFFERED_BYTES, while the generator keeps running to completion', async () => {
    const pendingCallbacks: Array<() => void> = [];
    const res = new Writable({
      highWaterMark: 1024,
      write(_chunk, _encoding, callback) {
        // Never calls back — simulates a browser that stopped reading, so
        // writes pile up in the internal buffer and `writableLength` grows
        // past the threshold instead of ever draining.
        pendingCallbacks.push(callback);
      },
    }) as unknown as ExpressResponse;
    Object.assign(res, { setHeader: vi.fn(), flushHeaders: vi.fn() });

    const chunkSize = 64 * 1024;
    const totalChunks = 20; // 20 * 64 KiB = 1.25 MiB, past the 1 MiB limit
    let reachedNaturalEnd = false;
    const mockService = {
      streamCompletion: vi.fn().mockImplementation(async function* (
        ...args: unknown[]
      ) {
        (args[10] as () => void)();
        for (let i = 0; i < totalChunks; i += 1) {
          yield Buffer.alloc(chunkSize, 'x');
        }
        reachedNaturalEnd = true;
      }),
    };
    const mockGenerationService = {
      register: vi.fn().mockReturnValue(new AbortController()),
      abort: vi.fn().mockReturnValue(true),
      complete: vi.fn(),
      error: vi.fn(),
      getStatus: vi.fn().mockReturnValue(GenerationStatus.Active),
    };

    const controller = new ConversationController(
      mockService as unknown as ConversationService,
      mockGenerationService as unknown as ConversationGenerationService,
    );

    await controller.streamCompletion(
      TEST_REQUEST,
      res,
      VALID_COMPLETION_BODY as unknown as SendCompletionDto,
      undefined,
    );

    expect(reachedNaturalEnd).toBe(true);
    // Fewer writes actually reached the underlying stream than were yielded
    // (plus the init comment) — proof that the response was detached instead
    // of continuing to buffer every chunk without bound.
    expect(pendingCallbacks.length).toBeLessThan(totalChunks + 1);
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
        req.authSource = AuthSource.Cookie;
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
      `c:${TEST_USER.sid}`,
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

describe('completions endpoints — header-authenticated (bearer) caller', () => {
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
        ...args: unknown[]
      ) {
        (args[10] as () => void)();
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
        req.user = HEADER_USER;
        req.authSource = AuthSource.Header;
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

  it('streams a completion for a bearer caller with no session cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/conversations/completions')
      .send(VALID_COMPLETION_BODY)
      .expect(200);

    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.text).toContain('data: [DONE]');
    expect(mockService.streamCompletion).toHaveBeenCalledOnce();
    expect(mockService.streamCompletion.mock.calls[0][9]).toBe(
      `h:${HEADER_USER.providerId}:${HEADER_USER.sub}`,
    );
  });

  it('stops a bearer caller’s own generation with 204', async () => {
    await request(app.getHttpServer())
      .post('/conversations/completions/stop')
      .send({
        generationId: VALID_STOP_GENERATION_ID,
        path: VALID_COMPLETION_BODY.path,
      })
      .expect(204);

    expect(mockGenerationService.abort).toHaveBeenCalledWith(
      `h:${HEADER_USER.providerId}:${HEADER_USER.sub}`,
      VALID_COMPLETION_BODY.path,
      VALID_STOP_GENERATION_ID,
    );
  });
});

/*
 * Adversarial ownership coverage, against the real registry rather than a
 * mock: the controller resolves an owner key, so the only way to show that one
 * principal cannot reach another's generation is to let both go through the
 * same `ConversationGenerationService` instance.
 */
describe('generation ownership isolation (real registry)', () => {
  let app: INestApplication;
  let generationService: ConversationGenerationService;
  let principal: { user: SessionUser; authSource: AuthSource };

  const headerUser = (
    providerId: string,
    sub: string,
    at = 'access-token-1',
  ): SessionUser => ({
    sub,
    providerId,
    at,
    bucket: 'test-bucket',
    claims: {},
  });

  const actAs = (user: SessionUser, authSource: AuthSource): void => {
    principal = { user, authSource };
  };

  const PATH = VALID_COMPLETION_BODY.path;
  const GEN_ID = VALID_COMPLETION_BODY.generationId;

  const startGeneration = () =>
    request(app.getHttpServer())
      .post('/conversations/completions')
      .send(VALID_COMPLETION_BODY);

  const stopGeneration = () =>
    request(app.getHttpServer())
      .post('/conversations/completions/stop')
      .send({ generationId: GEN_ID, path: PATH });

  const attachToGeneration = () =>
    request(app.getHttpServer())
      .post('/conversations/completions/attach')
      .send({ path: PATH });

  beforeEach(async () => {
    principal = {
      user: headerUser('provider-1', 'subject-1'),
      authSource: AuthSource.Header,
    };

    /*
     * Registers into the real registry with whatever owner key the controller
     * resolved, then ends without completing — so the entry stays `active` for
     * the conflict, stop and attach assertions that follow.
     */
    const mockService = {
      streamCompletion: vi.fn().mockImplementation(async function* (
        ...args: unknown[]
      ) {
        generationService.register(
          args[9] as string,
          args[0] as string,
          args[3] as string,
        );
        (args[10] as () => void)();
        yield Buffer.from('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n');
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConversationController],
      providers: [
        { provide: ConversationService, useValue: mockService },
        { provide: ConfigService, useValue: { get: vi.fn() } },
        ConversationGenerationService,
      ],
    }).compile();

    app = module.createNestApplication();
    app.use(
      (req: ExpressRequest, _res: ExpressResponse, next: NextFunction) => {
        req.user = principal.user;
        req.authSource = principal.authSource;
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

    generationService = app.get(ConversationGenerationService);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  it('does not let a different sub of the same provider stop the generation', async () => {
    await startGeneration().expect(200);

    actAs(headerUser('provider-1', 'subject-2'), AuthSource.Header);
    await stopGeneration().expect(404);

    expect(generationService.getStatus('h:provider-1:subject-1', PATH)).toBe(
      GenerationStatus.Active,
    );
  });

  it('treats the same sub under a different provider as a different principal', async () => {
    await startGeneration().expect(200);

    actAs(headerUser('provider-2', 'subject-1'), AuthSource.Header);
    await stopGeneration().expect(404);
    await attachToGeneration().expect(404);

    expect(generationService.getStatus('h:provider-1:subject-1', PATH)).toBe(
      GenerationStatus.Active,
    );
  });

  it('keeps a cookie session and a header principal isolated in both directions', async () => {
    await startGeneration().expect(200);

    actAs(TEST_USER as SessionUser, AuthSource.Cookie);
    await stopGeneration().expect(404);
    await attachToGeneration().expect(404);

    /* Now the other way round: the cookie session starts its own. */
    await startGeneration().expect(200);
    expect(generationService.getStatus(`c:${TEST_USER.sid}`, PATH)).toBe(
      GenerationStatus.Active,
    );

    actAs(headerUser('provider-1', 'subject-1'), AuthSource.Header);
    /*
     * The header principal's own entry is still active, so its stop hits its
     * own generation — abort it first, then confirm the cookie session's entry
     * survived untouched.
     */
    await stopGeneration().expect(204);
    expect(generationService.getStatus(`c:${TEST_USER.sid}`, PATH)).toBe(
      GenerationStatus.Active,
    );
  });

  /*
   * Subject-scoped ownership (`generation-principal-ownership`): a bearer
   * request carries no server-issued session artifact, so every client of one
   * (providerId, sub) is one principal.
   */
  it('treats a second client of the same principal as the same owner', async () => {
    await startGeneration().expect(200);

    actAs(
      headerUser('provider-1', 'subject-1', 'a-different-token'),
      AuthSource.Header,
    );
    await startGeneration().expect(409);
    await stopGeneration().expect(204);

    expect(generationService.getStatus('h:provider-1:subject-1', PATH)).toBe(
      GenerationStatus.Stopped,
    );
  });

  it('keeps ownership across an access-token renewal', async () => {
    actAs(headerUser('provider-1', 'subject-1', 'token-T1'), AuthSource.Header);
    await startGeneration().expect(200);

    actAs(headerUser('provider-1', 'subject-1', 'token-T2'), AuthSource.Header);

    const attachPromise = attachToGeneration();
    setTimeout(() => {
      generationService.complete('h:provider-1:subject-1', PATH, GEN_ID);
    }, 20);
    const attachRes = await attachPromise.expect(200);
    expect(attachRes.text).toContain('"type":"snapshot"');
    expect(attachRes.text).toContain('"type":"done"');

    /* A fresh generation under T2 stops fine — the key holds no token. */
    await startGeneration().expect(200);
    await stopGeneration().expect(204);
  });

  it('conflicts on the same path after a token renewal instead of starting a second generation', async () => {
    actAs(headerUser('provider-1', 'subject-1', 'token-T1'), AuthSource.Header);
    await startGeneration().expect(200);

    actAs(headerUser('provider-1', 'subject-1', 'token-T2'), AuthSource.Header);
    await startGeneration().expect(409);
  });

  /*
   * Naive concatenation would flatten both of these to `h:a:b:c`, letting each
   * one address the other's generation. Per-component encoding is what keeps
   * them apart (`generation-principal-ownership`, Decision 4).
   */
  it('keeps principals whose components would concatenate identically isolated', async () => {
    actAs(headerUser('a', 'b:c'), AuthSource.Header);
    await startGeneration().expect(200);

    actAs(headerUser('a:b', 'c'), AuthSource.Header);
    await stopGeneration().expect(404);
    await attachToGeneration().expect(404);

    expect(generationService.getStatus('h:a:b%3Ac', PATH)).toBe(
      GenerationStatus.Active,
    );
    expect(generationService.getStatus('h:a%3Ab:c', PATH)).toBeUndefined();

    /* And the second principal can hold its own generation on the same path. */
    await startGeneration().expect(200);
    expect(generationService.getStatus('h:a%3Ab:c', PATH)).toBe(
      GenerationStatus.Active,
    );
    expect(generationService.getStatus('h:a:b%3Ac', PATH)).toBe(
      GenerationStatus.Active,
    );
  });
});
