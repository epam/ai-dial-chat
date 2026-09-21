import { INestApplication, ValidationPipe } from '@nestjs/common';
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
import { ConversationGenerationService } from '../conversation-generation.service';
import { ConversationController } from '../conversation.controller';
import { ConversationService } from '../conversation.service';
import {
  ConversationMessageDto,
  ConversationMessageRole,
} from '../dto/conversation-message.dto';

const TEST_USER = {
  sid: 'test-sid',
  sub: 'test-sub',
  providerId: 'keycloak',
  at: 'test-access-token',
  bucket: 'test-bucket',
  claims: {},
  csrf: 'test-csrf',
};

/* A bearer caller carries no `sid`/`csrf` — no session is created for one. */
const HEADER_USER: SessionUser = {
  sub: 'header-sub',
  providerId: 'keycloak',
  at: 'header-access-token',
  bucket: 'test-bucket',
  claims: {},
};

const COOKIE_OWNER_KEY = `c:${TEST_USER.sid}`;

const PATH = 'test-bucket/gpt-4o__Hello__uuid';
const GEN_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';

const makeMessage = (content: string): ConversationMessageDto => ({
  role: ConversationMessageRole.Assistant,
  content,
  timestamp: '2026-01-01T00:00:00.000Z',
});

describe('POST /conversations/completions/attach (integration)', () => {
  let app: INestApplication;
  let generationService: ConversationGenerationService;

  beforeEach(async () => {
    const mockService = { streamCompletion: vi.fn() };

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

    generationService = app.get(ConversationGenerationService);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  it('returns 404 when no active generation exists for the given path', async () => {
    await request(app.getHttpServer())
      .post('/conversations/completions/attach')
      .send({ path: PATH })
      .expect(404);
  });

  it('returns 404 when the generation already finished before attach arrives', async () => {
    const lease = generationService.register(COOKIE_OWNER_KEY, PATH, GEN_ID);
    generationService.complete(lease);

    await request(app.getHttpServer())
      .post('/conversations/completions/attach')
      .send({ path: PATH })
      .expect(404);
  });

  it('returns 400 when path contains path traversal characters (..)', async () => {
    await request(app.getHttpServer())
      .post('/conversations/completions/attach')
      .send({ path: 'bucket/../secret' })
      .expect(400);
  });

  it('delivers a snapshot, then live chunks, then a terminal event, in order', async () => {
    const lease = generationService.register(COOKIE_OWNER_KEY, PATH, GEN_ID);
    generationService.seedAssembledMessage(lease, makeMessage(''));

    const reqPromise = request(app.getHttpServer())
      .post('/conversations/completions/attach')
      .send({ path: PATH });

    setTimeout(() => {
      generationService.applyChunk(
        lease,
        { choices: [{ delta: { content: 'Hi' } }] },
        makeMessage('Hi'),
      );
      generationService.complete(lease);
    }, 20);

    const res = await reqPromise.expect(200);

    expect(res.headers['content-type']).toContain('text/event-stream');
    const snapshotIdx = res.text.indexOf('"type":"snapshot"');
    const chunkIdx = res.text.indexOf('"type":"chunk"');
    const doneIdx = res.text.indexOf('"type":"done"');
    expect(snapshotIdx).toBeGreaterThanOrEqual(0);
    expect(chunkIdx).toBeGreaterThan(snapshotIdx);
    expect(doneIdx).toBeGreaterThan(chunkIdx);
    expect(res.text).toContain('"content":"Hi"');
  });

  it('emits a stopped terminal event when the generation was stopped by the user', async () => {
    const lease = generationService.register(COOKIE_OWNER_KEY, PATH, GEN_ID);
    generationService.seedAssembledMessage(lease, makeMessage(''));

    const reqPromise = request(app.getHttpServer())
      .post('/conversations/completions/attach')
      .send({ path: PATH });

    setTimeout(() => {
      generationService.abort(COOKIE_OWNER_KEY, PATH, GEN_ID);
      generationService.error(lease);
    }, 20);

    const res = await reqPromise.expect(200);
    expect(res.text).toContain('"type":"stopped"');
  });

  it('supports two concurrent subscribers on the same generation, each with their own snapshot', async () => {
    const lease = generationService.register(COOKIE_OWNER_KEY, PATH, GEN_ID);
    generationService.seedAssembledMessage(lease, makeMessage(''));

    const req1 = request(app.getHttpServer())
      .post('/conversations/completions/attach')
      .send({ path: PATH });
    const req2 = request(app.getHttpServer())
      .post('/conversations/completions/attach')
      .send({ path: PATH });

    setTimeout(() => {
      generationService.applyChunk(
        lease,
        { choices: [{ delta: { content: 'Hi' } }] },
        makeMessage('Hi'),
      );
      generationService.complete(lease);
    }, 20);

    const [res1, res2] = await Promise.all([
      req1.expect(200),
      req2.expect(200),
    ]);

    expect(res1.text).toContain('"content":"Hi"');
    expect(res1.text).toContain('"type":"done"');
    expect(res2.text).toContain('"content":"Hi"');
    expect(res2.text).toContain('"type":"done"');
  });
});

describe('POST /conversations/completions/attach — header-authenticated caller', () => {
  let app: INestApplication;
  let generationService: ConversationGenerationService;
  let principal: SessionUser;
  const HEADER_OWNER_KEY = `h:${HEADER_USER.providerId}:${HEADER_USER.sub}`;

  beforeEach(async () => {
    principal = HEADER_USER;
    const mockService = { streamCompletion: vi.fn() };

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
        req.user = principal;
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

    generationService = app.get(ConversationGenerationService);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  /*
   * A non-owning principal gets the same `404` as a path with no generation at
   * all, disclosing nothing about the running one
   * (`generation-principal-ownership`).
   */
  it('returns 404 and opens no stream for a non-owning principal', async () => {
    const lease = generationService.register(HEADER_OWNER_KEY, PATH, GEN_ID);
    generationService.seedAssembledMessage(lease, makeMessage('secret so far'));

    /* Same sub, different provider — a different principal. */
    principal = {
      ...HEADER_USER,
      providerId: 'another-provider',
    };

    const res = await request(app.getHttpServer())
      .post('/conversations/completions/attach')
      .send({ path: PATH })
      .expect(404);

    expect(res.headers['content-type']).not.toContain('text/event-stream');
    expect(res.text).not.toContain('secret so far');
    expect(res.text).not.toContain('snapshot');
  });

  it('replays snapshot, live chunks and one terminal event for the bearer principal', async () => {
    const lease = generationService.register(HEADER_OWNER_KEY, PATH, GEN_ID);
    generationService.seedAssembledMessage(lease, makeMessage(''));

    const reqPromise = request(app.getHttpServer())
      .post('/conversations/completions/attach')
      .send({ path: PATH });

    setTimeout(() => {
      generationService.applyChunk(
        lease,
        { choices: [{ delta: { content: 'Hi' } }] },
        makeMessage('Hi'),
      );
      generationService.complete(lease);
    }, 20);

    const res = await reqPromise.expect(200);

    const snapshotIdx = res.text.indexOf('"type":"snapshot"');
    const chunkIdx = res.text.indexOf('"type":"chunk"');
    const doneIdx = res.text.indexOf('"type":"done"');
    expect(snapshotIdx).toBeGreaterThanOrEqual(0);
    expect(chunkIdx).toBeGreaterThan(snapshotIdx);
    expect(doneIdx).toBeGreaterThan(chunkIdx);
  });
});
