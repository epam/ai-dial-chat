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
        ConversationGenerationService,
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
    generationService.register(TEST_USER.sid, PATH, GEN_ID);
    generationService.complete(TEST_USER.sid, PATH, GEN_ID);

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
    generationService.register(TEST_USER.sid, PATH, GEN_ID);
    generationService.seedAssembledMessage(
      TEST_USER.sid,
      PATH,
      GEN_ID,
      makeMessage(''),
    );

    const reqPromise = request(app.getHttpServer())
      .post('/conversations/completions/attach')
      .send({ path: PATH });

    setTimeout(() => {
      generationService.applyChunk(
        TEST_USER.sid,
        PATH,
        GEN_ID,
        { choices: [{ delta: { content: 'Hi' } }] },
        makeMessage('Hi'),
      );
      generationService.complete(TEST_USER.sid, PATH, GEN_ID);
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
    generationService.register(TEST_USER.sid, PATH, GEN_ID);
    generationService.seedAssembledMessage(
      TEST_USER.sid,
      PATH,
      GEN_ID,
      makeMessage(''),
    );

    const reqPromise = request(app.getHttpServer())
      .post('/conversations/completions/attach')
      .send({ path: PATH });

    setTimeout(() => {
      generationService.abort(TEST_USER.sid, PATH, GEN_ID);
      generationService.error(TEST_USER.sid, PATH, GEN_ID);
    }, 20);

    const res = await reqPromise.expect(200);
    expect(res.text).toContain('"type":"stopped"');
  });

  it('supports two concurrent subscribers on the same generation, each with their own snapshot', async () => {
    generationService.register(TEST_USER.sid, PATH, GEN_ID);
    generationService.seedAssembledMessage(
      TEST_USER.sid,
      PATH,
      GEN_ID,
      makeMessage(''),
    );

    const req1 = request(app.getHttpServer())
      .post('/conversations/completions/attach')
      .send({ path: PATH });
    const req2 = request(app.getHttpServer())
      .post('/conversations/completions/attach')
      .send({ path: PATH });

    setTimeout(() => {
      generationService.applyChunk(
        TEST_USER.sid,
        PATH,
        GEN_ID,
        { choices: [{ delta: { content: 'Hi' } }] },
        makeMessage('Hi'),
      );
      generationService.complete(TEST_USER.sid, PATH, GEN_ID);
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
