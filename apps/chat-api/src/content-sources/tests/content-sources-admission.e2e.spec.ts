import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthSource } from '../../auth/auth-source.enum';
import { CsrfGuard } from '../../auth/csrf/csrf.guard';
import { SessionGuard } from '../../auth/session/session.guard';
import type { SessionUser } from '../../auth/session/session.types';
import { AUTH_STRATEGIES } from '../../auth/strategies/auth-strategies.token';
import type { AuthStrategy } from '../../auth/strategies/auth-strategy.interface';
import { ContentSourcesAdmissionService } from '../content-sources-admission.service';
import {
  CONTENT_SOURCES_CACHE,
  ContentSourcesCacheService,
} from '../content-sources-cache.service';
import { ContentSourcesRegistryService } from '../content-sources-registry.service';
import {
  ContentSourceQueueOutcome,
  contentSourcesUpstreamQueueDuration,
} from '../content-sources-telemetry';
import { ContentSourcesUpstreamService } from '../content-sources-upstream.service';
import { ContentSourcesController } from '../content-sources.controller';
import { createContentSourcesCaches } from '../content-sources.module';
import { ContentSourcesService } from '../content-sources.service';
import { GitHubProvider } from '../providers/github.provider';
import { GitLabProvider } from '../providers/gitlab.provider';
import { UpstreamGate } from '../upstream-gate';

/*
 * End-to-end admission: the real controller, service, cache, per-user
 * admission, upstream pool gates and GitHub provider, with only the network
 * (global `fetch`) faked. The fake counts concurrent upstream calls and can
 * hold them open until a test releases them.
 */

class FakeHeaderStrategy implements AuthStrategy {
  readonly source = AuthSource.Header;
  supports(req: Request): boolean {
    return typeof req.headers['x-test-user'] === 'string';
  }
  async authenticate(req: Request): Promise<SessionUser | null> {
    return JSON.parse(req.headers['x-test-user'] as string) as SessionUser;
  }
}

const userHeader = (sub: string) =>
  [
    'x-test-user',
    JSON.stringify({
      sub,
      providerId: 'keycloak',
      claims: {},
      at: 'access-token',
      bucket: 'bucket-1',
      csrf: 'csrf-secret',
    } satisfies SessionUser),
  ] as const;

const SOURCE_CONFIG = JSON.stringify({
  version: 1,
  sources: [
    {
      id: 'rn',
      title: 'Release notes',
      provider: 'github',
      repository: 'epam/ai-dial',
      ref: 'main',
      kind: 'directory',
      path: 'docs/releases',
      assetsPath: 'docs',
      credentialId: 'gh',
    },
  ],
});

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

interface HeldCall {
  readonly url: URL;
  readonly signal?: AbortSignal | null;
  readonly release: () => void;
}

/** The faked network: concurrency counters plus control over each call. */
const createUpstream = () => {
  const state = {
    active: 0,
    peak: 0,
    titleActive: 0,
    titlePeak: 0,
    calls: [] as string[],
    held: [] as HeldCall[],
    shouldHold: false,
    shouldHonorAbort: true,
    delayMs: 0,
    status: 200,
    treeSize: 0,
  };
  const isTitleRead = (url: URL) =>
    url.pathname.includes('/contents/docs/releases/');
  const responseFor = (url: URL): Response => {
    if (state.status !== 200) {
      return new Response('upstream error', { status: state.status });
    }
    if (url.pathname.includes('/git/trees/')) {
      return new Response(
        JSON.stringify({
          tree: Array.from({ length: state.treeSize }, (_, index) => ({
            path: `${index}.md`,
            type: 'blob',
          })),
          truncated: false,
        }),
        { status: 200 },
      );
    }
    if (url.pathname.endsWith('.md')) {
      return new Response('# Title\n', { status: 200 });
    }
    return new Response(PNG, { status: 200 });
  };

  const fetchMock = vi.fn((url: URL, init: RequestInit = {}) => {
    state.calls.push(url.toString());
    const isTitle = isTitleRead(url);
    state.active += 1;
    state.peak = Math.max(state.peak, state.active);
    if (isTitle) {
      state.titleActive += 1;
      state.titlePeak = Math.max(state.titlePeak, state.titleActive);
    }
    return new Promise<Response>((resolve, reject) => {
      let isSettled = false;
      const finish = (settle: () => void) => {
        if (isSettled) return;
        isSettled = true;
        state.active -= 1;
        if (isTitle) state.titleActive -= 1;
        settle();
      };
      const respond = () => finish(() => resolve(responseFor(url)));
      if (state.shouldHonorAbort) {
        init.signal?.addEventListener(
          'abort',
          () => finish(() => reject(new DOMException('aborted', 'AbortError'))),
          { once: true },
        );
      }
      if (state.shouldHold) {
        state.held.push({ url, signal: init.signal, release: respond });
      } else {
        setTimeout(respond, state.delayMs);
      }
    });
  });
  vi.stubGlobal('fetch', fetchMock);

  const releaseAll = () => {
    state.held.splice(0).forEach((call) => call.release());
  };
  return { state, fetchMock, releaseAll };
};

interface Limits {
  timeoutMs?: number;
  cacheTtlMs?: number;
  concurrency?: number;
  queueSize?: number;
  missConcurrency?: number;
}

const buildApp = async (limits: Limits = {}) => {
  const values: Record<string, unknown> = {
    CONTENT_SOURCES_CONFIG: SOURCE_CONFIG,
    CONTENT_SOURCES_CREDENTIALS: '{"gh":"ghp_token"}',
    CONTENT_SOURCES_TIMEOUT_MS: limits.timeoutMs ?? 10_000,
    CONTENT_SOURCES_CACHE_TTL_MS: limits.cacheTtlMs ?? 60_000,
    CONTENT_SOURCES_UPSTREAM_CONCURRENCY: limits.concurrency ?? 8,
    CONTENT_SOURCES_UPSTREAM_QUEUE_SIZE: limits.queueSize ?? 64,
    CONTENT_SOURCES_PRINCIPAL_MISS_CONCURRENCY: limits.missConcurrency ?? 8,
    CORS_ORIGIN: 'https://app.example.com',
  };
  const moduleRef = await Test.createTestingModule({
    controllers: [ContentSourcesController],
    providers: [
      {
        provide: CONTENT_SOURCES_CACHE,
        useFactory: createContentSourcesCaches,
      },
      ContentSourcesRegistryService,
      ContentSourcesCacheService,
      ContentSourcesAdmissionService,
      ContentSourcesUpstreamService,
      ContentSourcesService,
      GitHubProvider,
      GitLabProvider,
      Reflector,
      {
        provide: ConfigService,
        useValue: { get: (key: string) => values[key] },
      },
      { provide: AUTH_STRATEGIES, useValue: [new FakeHeaderStrategy()] },
      { provide: APP_GUARD, useClass: SessionGuard },
      { provide: APP_GUARD, useClass: CsrfGuard },
    ],
  }).compile();
  const app = moduleRef.createNestApplication();
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
  return app;
};

const assetPath = (name: string) =>
  `/api/v1/content-sources/rn/asset?path=docs/${name}.png`;

/*
 * Tests observe the gate instead of sleeping: `UpstreamGate.run` enqueues
 * synchronously, so its call count says a request has reached the queue.
 */
const spyGateRuns = () => vi.spyOn(UpstreamGate.prototype, 'run');

const queueOutcomes = (record: { mock: { calls: unknown[][] } }) =>
  record.mock.calls.map(
    ([, attributes]) =>
      (attributes as Record<string, string>)[
        'dial.chat.content_sources.queue_outcome'
      ],
  );

describe('content-sources upstream admission (e2e)', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  const get = (path: string, sub = 'user-1') =>
    request(app?.getHttpServer())
      .get(path)
      .set(...userHeader(sub));

  it('serves 20 concurrent cached asset requests of one user with zero upstream calls', async () => {
    const upstream = createUpstream();
    app = await buildApp();
    await get(assetPath('cached')).expect(200);
    upstream.fetchMock.mockClear();

    const statuses = await Promise.all(
      Array.from({ length: 20 }, () =>
        get(assetPath('cached')).then((res) => res.status),
      ),
    );
    expect(statuses).toEqual(Array(20).fill(200));
    expect(upstream.fetchMock).not.toHaveBeenCalled();
  });

  it('never runs more than 8 upstream calls for 20 cold requests and answers them all', async () => {
    const upstream = createUpstream();
    upstream.state.delayMs = 20;
    app = await buildApp({ concurrency: 8 });

    const statuses = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        get(assetPath(`cold-${index}`), `user-${index % 4}`).then(
          (res) => res.status,
        ),
      ),
    );
    expect(statuses).toEqual(Array(20).fill(200));
    expect(upstream.fetchMock).toHaveBeenCalledTimes(20);
    expect(upstream.state.peak).toBeLessThanOrEqual(8);
    expect(upstream.state.peak).toBeGreaterThan(1);
  });

  it('answers 429 when the upstream queue is full', async () => {
    const upstream = createUpstream();
    upstream.state.shouldHold = true;
    app = await buildApp({ concurrency: 1, queueSize: 1 });
    const runs = spyGateRuns();

    const running = get(assetPath('one')).then((res) => res.status);
    await vi.waitFor(() => expect(upstream.state.held).toHaveLength(1));
    const queued = get(assetPath('two')).then((res) => res.status);
    await vi.waitFor(() => expect(runs).toHaveBeenCalledTimes(2));

    await get(assetPath('three')).expect(429);
    expect(upstream.fetchMock).toHaveBeenCalledOnce();

    upstream.releaseAll();
    await vi.waitFor(() => expect(upstream.state.held).toHaveLength(1));
    upstream.releaseAll();
    expect(await Promise.all([running, queued])).toEqual([200, 200]);
  });

  it('answers 503 when a queued call waits longer than the timeout', async () => {
    const upstream = createUpstream();
    upstream.state.shouldHold = true;
    /* The held call ignores its own deadline, so only the queue wait expires. */
    upstream.state.shouldHonorAbort = false;
    app = await buildApp({ concurrency: 1, timeoutMs: 300 });

    const running = get(assetPath('slow')).then((res) => res.status);
    await vi.waitFor(() => expect(upstream.state.held).toHaveLength(1));

    await get(assetPath('waiting')).expect(503);
    expect(upstream.fetchMock).toHaveBeenCalledOnce();

    upstream.releaseAll();
    expect(await running).toBe(200);
  });

  it('serves an expired asset stale when its refresh cannot get a slot', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const upstream = createUpstream();
    app = await buildApp({ concurrency: 1, queueSize: 0, cacheTtlMs: 1000 });
    await get(assetPath('stale')).expect(200);
    vi.advanceTimersByTime(1001);

    upstream.state.shouldHold = true;
    const busy = get(assetPath('busy')).then((res) => res.status);
    await vi.waitFor(() => expect(upstream.state.held).toHaveLength(1));
    upstream.fetchMock.mockClear();

    const res = await get(assetPath('stale')).expect(200);
    expect(Buffer.from(res.body)).toEqual(Buffer.from(PNG));
    expect(upstream.fetchMock).not.toHaveBeenCalled();

    upstream.releaseAll();
    expect(await busy).toBe(200);
  });

  it("answers a user's 9th concurrent cold request with 429 and no upstream call", async () => {
    const upstream = createUpstream();
    upstream.state.shouldHold = true;
    /* A pool wider than the miss limit, so only the miss limit can refuse. */
    app = await buildApp({ concurrency: 16, missConcurrency: 8 });

    const held = Array.from({ length: 8 }, (_, index) =>
      get(assetPath(`miss-${index}`)).then((res) => res.status),
    );
    await vi.waitFor(() => expect(upstream.state.held).toHaveLength(8));

    await get(assetPath('miss-9')).expect(429);
    expect(upstream.fetchMock).toHaveBeenCalledTimes(8);

    /* Another user still gets through. */
    const other = get(assetPath('other-user'), 'user-2').then(
      (res) => res.status,
    );
    await vi.waitFor(() => expect(upstream.state.held).toHaveLength(9));
    upstream.releaseAll();
    expect(await Promise.all([...held, other])).toEqual(Array(9).fill(200));
  });

  describe('slot release', () => {
    it('releases the slot after an upstream error', async () => {
      const upstream = createUpstream();
      upstream.state.status = 500;
      app = await buildApp({ concurrency: 1, queueSize: 0 });
      await get(assetPath('broken')).expect(502);

      upstream.state.status = 200;
      await get(assetPath('after-error')).expect(200);
    });

    it('releases the slot after a fetch timeout', async () => {
      const upstream = createUpstream();
      upstream.state.shouldHold = true;
      app = await buildApp({ concurrency: 1, queueSize: 0, timeoutMs: 200 });
      await get(assetPath('timeout')).expect(503);

      upstream.state.shouldHold = false;
      await get(assetPath('after-timeout')).expect(200);
    });

    it('releases the slot after the client disconnects', async () => {
      const upstream = createUpstream();
      upstream.state.shouldHold = true;
      app = await buildApp({ concurrency: 1, queueSize: 0 });
      const pending = get(assetPath('abandoned'));
      const settled = pending.then(
        () => undefined,
        () => undefined,
      );
      await vi.waitFor(() => expect(upstream.state.held).toHaveLength(1));

      pending.abort();
      await settled;
      await vi.waitFor(() =>
        expect(upstream.state.held[0].signal?.aborted).toBe(true),
      );
      await vi.waitFor(() => expect(upstream.state.active).toBe(0));

      upstream.state.shouldHold = false;
      await get(assetPath('after-abort')).expect(200);
    });

    it('removes an abandoned queued call from the queue without an upstream call', async () => {
      const upstream = createUpstream();
      upstream.state.shouldHold = true;
      app = await buildApp({ concurrency: 1, queueSize: 1 });
      const runs = spyGateRuns();
      const record = vi.spyOn(contentSourcesUpstreamQueueDuration, 'record');
      const running = get(assetPath('running')).then((res) => res.status);
      await vi.waitFor(() => expect(upstream.state.held).toHaveLength(1));

      const queued = get(assetPath('queued'));
      const settled = queued.then(
        () => undefined,
        () => undefined,
      );
      await vi.waitFor(() => expect(runs).toHaveBeenCalledTimes(2));
      queued.abort();
      await settled;
      await vi.waitFor(() =>
        expect(queueOutcomes(record)).toContain(
          ContentSourceQueueOutcome.Cancelled,
        ),
      );

      /* The queue position is free again, so another call can wait. */
      const next = get(assetPath('next')).then((res) => res.status);
      await vi.waitFor(() => expect(runs).toHaveBeenCalledTimes(3));
      expect(queueOutcomes(record)).not.toContain(
        ContentSourceQueueOutcome.QueueFull,
      );
      upstream.releaseAll();
      await vi.waitFor(() => expect(upstream.state.held).toHaveLength(1));
      upstream.releaseAll();
      expect(await Promise.all([running, next])).toEqual([200, 200]);
      expect(
        upstream.state.calls.some((url) => url.includes('queued.png')),
      ).toBe(false);
    });
  });

  it('serves a fresh cached asset while every slot and queue position is taken', async () => {
    const upstream = createUpstream();
    app = await buildApp({ concurrency: 1, queueSize: 0 });
    await get(assetPath('warm')).expect(200);

    upstream.state.shouldHold = true;
    const busy = get(assetPath('busy')).then((res) => res.status);
    await vi.waitFor(() => expect(upstream.state.held).toHaveLength(1));
    await get(assetPath('another-cold')).expect(429);

    await get(assetPath('warm')).expect(200);
    upstream.releaseAll();
    expect(await busy).toBe(200);
  });

  it('lets a listing wait for slots instead of failing when the queue is full', async () => {
    const upstream = createUpstream();
    upstream.state.treeSize = 3;
    upstream.state.shouldHold = true;
    app = await buildApp({ concurrency: 1, queueSize: 0 });

    const busy = get(assetPath('busy')).then((res) => res.status);
    await vi.waitFor(() => expect(upstream.state.held).toHaveLength(1));
    const listing = get('/api/v1/content-sources/rn').then((res) => ({
      status: res.status,
      count: (res.body.documents ?? []).length,
    }));
    /* An ordinary call is still refused by the full queue meanwhile. */
    await get(assetPath('refused')).expect(429);

    let isDone = false;
    const result = listing.finally(() => {
      isDone = true;
    });
    while (!isDone) {
      await vi.waitFor(() =>
        expect(upstream.state.held.length > 0 || isDone).toBe(true),
      );
      upstream.releaseAll();
    }
    expect(await result).toEqual({ status: 200, count: 3 });
    expect(await busy).toBe(200);
  });

  it('keeps a 200-document listing and concurrent assets within the pool, with at most 4 listing calls', async () => {
    const upstream = createUpstream();
    upstream.state.delayMs = 2;
    upstream.state.treeSize = 200;
    app = await buildApp({ concurrency: 8 });

    const listing = get('/api/v1/content-sources/rn');
    const assets = Array.from({ length: 10 }, (_, index) =>
      get(assetPath(`side-${index}`), `user-${2 + (index % 2)}`).then(
        (res) => res.status,
      ),
    );
    const res = await listing.expect(200);
    expect(res.body.documents).toHaveLength(200);
    expect(await Promise.all(assets)).toEqual(Array(10).fill(200));

    expect(upstream.state.peak).toBeLessThanOrEqual(8);
    expect(upstream.state.titlePeak).toBeLessThanOrEqual(4);
    expect(upstream.state.titlePeak).toBeGreaterThan(1);
  });
});
