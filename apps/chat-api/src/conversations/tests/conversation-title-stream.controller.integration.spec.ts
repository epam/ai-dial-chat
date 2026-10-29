import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD, Reflector } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthSource } from '../../auth/auth-source.enum';
import { CsrfGuard } from '../../auth/csrf/csrf.guard';
import { SessionGuard } from '../../auth/session/session.guard';
import type { SessionUser } from '../../auth/session/session.types';
import { AUTH_STRATEGIES } from '../../auth/strategies/auth-strategies.token';
import type { AuthStrategy } from '../../auth/strategies/auth-strategy.interface';
import { DialClientService } from '../../dial/dial-client.service';
import { ConversationGenerationService } from '../conversation-generation.service';
import { ConversationController } from '../conversation.controller';
import { ConversationService } from '../conversation.service';
import { ConversationTitleCacheService } from '../listing/conversation-title-cache.service';
import {
  CONVERSATION_TITLE_STREAM_MAX_ACTIVE,
  CONVERSATION_TITLE_STREAM_MAX_PENDING_ITEMS,
  ConversationTitleStreamService,
} from '../listing/conversation-title-stream.service';
import { ConversationTitlesService } from '../listing/conversation-titles.service';

const APP_ORIGIN = 'https://app.example.com';
const STREAM_PATH = '/api/v1/conversations/titles/stream';
const USER: SessionUser = {
  sub: 'user-1',
  providerId: 'keycloak',
  claims: {},
  at: 'access-token',
  bucket: 'bucket',
  csrf: 'csrf-secret',
};

class FakeHeaderStrategy implements AuthStrategy {
  readonly source = AuthSource.Header;
  supports(req: Request): boolean {
    return req.headers['x-test-header-user'] === 'yes';
  }
  async authenticate(): Promise<SessionUser | null> {
    return USER;
  }
}

class FakeCookieStrategy implements AuthStrategy {
  readonly source = AuthSource.Cookie;
  supports(req: Request): boolean {
    return req.headers['x-test-cookie-user'] === 'yes';
  }
  async authenticate(): Promise<SessionUser | null> {
    return USER;
  }
}

const idAt = (index: number) => `conversations/bucket/gpt-4o__Chat${index}`;
const pathAt = (index: number) => `gpt-4o__Chat${index}`;

interface CoreRead {
  respond: (result: unknown) => void;
  signal: AbortSignal;
}

interface StreamClient {
  status: number | undefined;
  contentType: string | undefined;
  events: () => Array<Record<string, unknown>>;
  isEnded: () => boolean;
  close: () => void;
}

const titleResult = (name: string) => ({
  data: { name, llmNamingDone: true, messages: [{ content: 'private' }] },
  response: new Response(null, { status: 200 }),
});
const statusResult = (status: number) => ({
  error: 'failure',
  response: new Response(null, { status }),
});

describe('POST /conversations/titles/stream (integration)', () => {
  let app: NestExpressApplication;
  let port: number;
  let coreReads: Map<string, CoreRead>;
  let getConversation: ReturnType<typeof vi.fn>;
  let streamService: ConversationTitleStreamService;

  /* Raw HTTP so the test observes bytes before the response completes. */
  const openStream = (
    body: unknown,
    headers: Record<string, string> = { 'x-test-header-user': 'yes' },
  ) =>
    new Promise<StreamClient>((resolve, reject) => {
      const req = http.request(
        {
          host: '127.0.0.1',
          port,
          path: STREAM_PATH,
          method: 'POST',
          headers: { 'content-type': 'application/json', ...headers },
        },
        (res) => {
          let text = '';
          let isEnded = false;
          res.setEncoding('utf8');
          res.on('data', (chunk: string) => {
            text += chunk;
          });
          res.on('end', () => {
            isEnded = true;
          });
          res.on('error', () => undefined);
          resolve({
            status: res.statusCode,
            contentType: res.headers['content-type'],
            events: () =>
              text
                .split('\n\n')
                .filter((frame) => frame.startsWith('data: '))
                .map((frame) => JSON.parse(frame.slice('data: '.length))),
            isEnded: () => isEnded,
            close: () => req.destroy(),
          });
        },
      );
      req.on('error', reject);
      req.end(JSON.stringify(body));
    });

  beforeEach(async () => {
    coreReads = new Map();
    getConversation = vi.fn(
      (_bucket: string, path: string, init: { signal: AbortSignal }) =>
        new Promise((respond) => {
          coreReads.set(path, { respond, signal: init.signal });
        }),
    );
    const moduleRef = await Test.createTestingModule({
      controllers: [ConversationController],
      providers: [
        ConversationTitleCacheService,
        ConversationTitlesService,
        ConversationTitleStreamService,
        {
          provide: ConversationService,
          inject: [ConversationTitlesService, ConversationTitleStreamService],
          useFactory: (
            titles: ConversationTitlesService,
            stream: ConversationTitleStreamService,
          ) => ({
            getConversationTitles: titles.getConversationTitles.bind(titles),
            admitConversationTitleStream: stream.admit.bind(stream),
            streamConversationTitles: stream.streamTitles.bind(stream),
          }),
        },
        { provide: ConversationGenerationService, useValue: {} },
        {
          provide: DialClientService,
          useValue: { client: { getConversation } },
        },
        Reflector,
        { provide: ConfigService, useValue: { get: () => APP_ORIGIN } },
        {
          provide: AUTH_STRATEGIES,
          useValue: [new FakeHeaderStrategy(), new FakeCookieStrategy()],
        },
        { provide: APP_GUARD, useClass: SessionGuard },
        { provide: APP_GUARD, useClass: CsrfGuard },
      ],
    }).compile();
    streamService = moduleRef.get(ConversationTitleStreamService);
    app = moduleRef.createNestApplication<NestExpressApplication>();
    /* Production accepts large JSON bodies, so the stream's own byte bound answers 413. */
    app.useBodyParser('json', { limit: 10 * 1024 * 1024 });
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    await app.listen(0, '127.0.0.1');
    port = (app.getHttpServer().address() as AddressInfo).port;
  });

  afterEach(async () => {
    for (const read of coreReads.values()) read.respond(statusResult(404));
    await app.close();
  });

  it('delivers a resolved title before a blocked peer read settles', async () => {
    const client = await openStream({ ids: [idAt(0), idAt(1)] });
    expect(client.status).toBe(200);
    expect(client.contentType).toContain('text/event-stream');
    await vi.waitFor(() => expect(coreReads.size).toBe(2));

    coreReads.get(pathAt(1))?.respond(titleResult('Fast title'));
    await vi.waitFor(() =>
      expect(client.events()).toEqual([
        { type: 'title', id: idAt(1), title: 'Fast title' },
      ]),
    );
    expect(client.isEnded()).toBe(false);
    expect(coreReads.get(pathAt(0))?.signal.aborted).toBe(false);

    coreReads.get(pathAt(0))?.respond(statusResult(404));
    await vi.waitFor(() => expect(client.isEnded()).toBe(true));
    expect(client.events()).toEqual([
      { type: 'title', id: idAt(1), title: 'Fast title' },
      { type: 'unavailable', id: idAt(0) },
      { type: 'done', reason: 'complete', processed: 2, total: 2 },
    ]);
    expect(JSON.stringify(client.events())).not.toContain('private');
  });

  it('reports a Core session rejection in band after the 200 status', async () => {
    const client = await openStream({ ids: [idAt(0), idAt(1)] });
    await vi.waitFor(() => expect(coreReads.size).toBe(2));
    coreReads.get(pathAt(0))?.respond(statusResult(401));
    await vi.waitFor(() => expect(client.isEnded()).toBe(true));
    expect(client.status).toBe(200);
    expect(client.events()).toEqual([
      { type: 'error', status: 401, code: 'unauthenticated' },
    ]);
    expect(coreReads.get(pathAt(1))?.signal.aborted).toBe(true);
  });

  it('cancels owned Core reads and admits no work after the client disconnects', async () => {
    const requested = Array.from({ length: 30 }, (_, index) => idAt(index));
    const client = await openStream({ ids: requested });
    await vi.waitFor(() =>
      expect(getConversation).toHaveBeenCalledTimes(
        CONVERSATION_TITLE_STREAM_MAX_PENDING_ITEMS,
      ),
    );
    client.close();
    await vi.waitFor(() =>
      expect([...coreReads.values()].every((read) => read.signal.aborted)).toBe(
        true,
      ),
    );
    for (const read of coreReads.values()) read.respond(statusResult(499));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(getConversation).toHaveBeenCalledTimes(
      CONVERSATION_TITLE_STREAM_MAX_PENDING_ITEMS,
    );
  });

  it('keeps the JSON titles endpoint working alongside the stream', async () => {
    const pending = request(app.getHttpServer())
      .post('/api/v1/conversations/titles')
      .set('x-test-header-user', 'yes')
      .send({ ids: [idAt(0)] });
    const response = pending.then((result) => result);
    await vi.waitFor(() => expect(coreReads.size).toBe(1));
    coreReads.get(pathAt(0))?.respond(titleResult('JSON title'));
    expect((await response).body).toEqual({
      items: [{ id: idAt(0), title: 'JSON title' }],
    });
  });

  describe('rejections before the event stream opens', () => {
    it('returns 401 without an authenticated session', async () => {
      const client = await openStream({ ids: [idAt(0)] }, {});
      expect(client.status).toBe(401);
      expect(client.contentType).not.toContain('text/event-stream');
      expect(getConversation).not.toHaveBeenCalled();
    });

    it('returns 403 for a cookie session without the CSRF token', async () => {
      const client = await openStream(
        { ids: [idAt(0)] },
        { 'x-test-cookie-user': 'yes', origin: APP_ORIGIN },
      );
      expect(client.status).toBe(403);
      expect(getConversation).not.toHaveBeenCalled();
    });

    it('accepts a cookie session with origin and CSRF token', async () => {
      const client = await openStream(
        { ids: [idAt(0)] },
        {
          'x-test-cookie-user': 'yes',
          origin: APP_ORIGIN,
          'x-csrf-token': USER.csrf as string,
        },
      );
      expect(client.status).toBe(200);
      client.close();
    });

    it.each([
      { ids: [] },
      { ids: Array.from({ length: 501 }, (_, index) => idAt(index)) },
      { ids: ['conversations/bucket/%252e%252e/secret'] },
      { ids: ['conversations/bucket/name%0Ainjected'] },
      { ids: [idAt(0)], extra: true },
    ])('returns 400 for an invalid request', async (payload) => {
      const client = await openStream(payload);
      expect(client.status).toBe(400);
      expect(getConversation).not.toHaveBeenCalled();
    });

    it('returns 413 when the serialized IDs exceed the byte bound', async () => {
      const long = `conversations/bucket/${'a'.repeat(4000)}`;
      const client = await openStream({
        ids: Array.from({ length: 70 }, (_, index) => `${long}${index}`),
      });
      expect(client.status).toBe(413);
      expect(getConversation).not.toHaveBeenCalled();
    });

    it('returns 503 when the instance is at stream capacity', async () => {
      const admissions = Array.from(
        { length: CONVERSATION_TITLE_STREAM_MAX_ACTIVE },
        () => streamService.admit([idAt(0)]),
      );
      const client = await openStream({ ids: [idAt(0)] });
      expect(client.status).toBe(503);
      expect(getConversation).not.toHaveBeenCalled();
      for (const admission of admissions) admission.release();
    });
  });
});
