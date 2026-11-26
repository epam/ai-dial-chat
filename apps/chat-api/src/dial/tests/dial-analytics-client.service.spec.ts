import type {
  AnalyticsComponents,
  SDKResponse,
} from '@epam/ai-dial-typescript-sdk';
import {
  BadGatewayException,
  ForbiddenException,
  HttpException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import {
  initializeCoreRequestTiming,
  stopCoreRequestTiming,
  withCoreRequestTiming,
} from '../../telemetry/core-request-timing';
import {
  RequestTimingState,
  requestTimingStorage,
} from '../../telemetry/request-timing-state';
import { DialAnalyticsClientService } from '../dial-analytics-client.service';
import {
  handleDialAnalyticsFailure,
  readDialAnalyticsData,
} from '../dial-analytics-result';
import {
  type FakeAnalyticsServer,
  startFakeAnalytics,
} from './fake-analytics.server';

type StructuredQuery = AnalyticsComponents['schemas']['StructuredQuery'];

const TOKEN = 'secret-session-token';
const QUERY: StructuredQuery = { entity: 'dial_usage_log', mode: 'aggregate' };

/*
 * ConfigService reads process.env before its constructor config, so the URL
 * is stubbed there and the timeout is unset there and given as the number the
 * validated env yields.
 */
const buildService = (url: string | undefined, timeoutMs = 1000) => {
  vi.stubEnv('ANALYTICS_URL', url ?? '');
  vi.stubEnv('ANALYTICS_TIMEOUT_MS', undefined);
  return new DialAnalyticsClientService(
    new ConfigService({ ANALYTICS_TIMEOUT_MS: timeoutMs }),
  );
};

/* The call-site shape usage-history uses: one SDK call, then the shared helpers. */
const run = async <TData, TError>(
  call: () => Promise<SDKResponse<TData, TError>>,
): Promise<NonNullable<TData>> => {
  try {
    return readDialAnalyticsData(await call());
  } catch (error) {
    return handleDialAnalyticsFailure(error);
  }
};

const readSchema = (
  service: DialAnalyticsClientService,
  headers: Record<string, string> = getBearerAuthHeaders(TOKEN),
) => run(() => service.client.getEntitySchema('dial_usage_log', { headers }));

const executeQuery = (
  service: DialAnalyticsClientService,
  signal?: AbortSignal,
) =>
  run(() =>
    service.client.executeQuery({
      body: QUERY,
      headers: getBearerAuthHeaders(TOKEN),
      signal,
    }),
  );

const spyOnLogs = () =>
  (['log', 'debug', 'warn', 'error', 'verbose'] as const).map((level) =>
    vi.spyOn(Logger.prototype, level).mockImplementation(() => undefined),
  );

describe('DialAnalyticsClientService', () => {
  let analytics: FakeAnalyticsServer;

  beforeEach(async () => {
    analytics = await startFakeAnalytics(() => ({
      status: 200,
      body: { rows: [] },
    }));
  });

  afterEach(async () => {
    stopCoreRequestTiming();
    await analytics.close();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('reports not configured, with no client, when ANALYTICS_URL is unset', () => {
    const unconfigured = buildService(undefined);

    expect(unconfigured.isConfigured).toBe(false);
    expect(() => unconfigured.client).toThrow(/ANALYTICS_URL/);
    expect(buildService(analytics.url).isConfigured).toBe(true);
  });

  it('sends only the bearer token to the fixed schema and query paths', async () => {
    const service = buildService(analytics.url);

    await readSchema(service);
    await executeQuery(service);

    expect(analytics.requests.map((r) => `${r.method} ${r.path}`)).toEqual([
      'GET /v1/queries/entities/schema/dial_usage_log',
      'POST /v1/queries/execute',
    ]);
    for (const recorded of analytics.requests) {
      expect(recorded.headers.authorization).toBe(`Bearer ${TOKEN}`);
      expect(recorded.headers['api-key']).toBeUndefined();
      expect(recorded.headers.cookie).toBeUndefined();
    }
  });

  it('sends the Chat product User-Agent once and asks for JSON', async () => {
    vi.stubEnv('CHAT_VERSION', '2026.08.25-a1b2c3d');
    const service = buildService(analytics.url);

    await readSchema(service);

    expect(analytics.requests[0].headers['user-agent']).toBe(
      'ai-dial-chat/2026.08.25-a1b2c3d',
    );
    expect(analytics.requests[0].headers.accept).toBe('application/json');
  });

  it('posts the query document unchanged as JSON and returns the parsed body', async () => {
    const service = buildService(analytics.url);

    await expect(executeQuery(service)).resolves.toEqual({ rows: [] });

    expect(analytics.requests).toHaveLength(1);
    expect(analytics.requests[0]).toMatchObject({
      method: 'POST',
      path: '/v1/queries/execute',
      body: QUERY,
    });
    expect(analytics.requests[0].headers['content-type']).toBe(
      'application/json',
    );
  });

  it('keeps a path prefix of the base URL', async () => {
    const service = buildService(`${analytics.url}/analytics/`);

    await executeQuery(service);

    expect(analytics.requests[0].path).toBe('/analytics/v1/queries/execute');
  });

  it.each([
    [401, UnauthorizedException],
    [403, ForbiddenException],
    [404, NotFoundException],
    [500, BadGatewayException],
    [503, BadGatewayException],
  ])(
    'throws the shared mapping for ADAS %i, without retrying',
    async (status, exception) => {
      analytics.setHandler(() => ({
        status,
        body: { message: `internal detail with ${TOKEN}` },
      }));
      const service = buildService(analytics.url);

      await expect(executeQuery(service)).rejects.toBeInstanceOf(exception);
      expect(analytics.requests).toHaveLength(1);
    },
  );

  it('does not follow a redirect with the token and reports the raw ADAS status', async () => {
    const [, , warn] = spyOnLogs();
    analytics.setHandler((recorded) =>
      recorded.path === '/v1/queries/execute'
        ? { status: 302, headers: { Location: `${analytics.url}/elsewhere` } }
        : { status: 200, body: { rows: [] } },
    );
    const service = buildService(analytics.url);

    await expect(executeQuery(service)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    expect(analytics.requests.map((r) => r.path)).toEqual([
      '/v1/queries/execute',
    ]);
    expect(JSON.stringify(warn.mock.calls)).toContain(
      'POST /v1/queries/execute answered 302',
    );
  });

  it('logs the raw ADAS status even when the mapped exception differs', async () => {
    const [, , warn] = spyOnLogs();
    analytics.setHandler(() => ({ status: 503 }));
    const service = buildService(analytics.url);

    await expect(executeQuery(service)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    expect(JSON.stringify(warn.mock.calls)).toContain('answered 503');
  });

  it('throws ServiceUnavailableException when ADAS does not answer within the timeout', async () => {
    analytics.setHandler(() => ({ hang: true }));
    const service = buildService(analytics.url, 1000);

    await expect(executeQuery(service)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(analytics.requests).toHaveLength(1);
  });

  it('throws ServiceUnavailableException when the body stalls past the timeout', async () => {
    analytics.setHandler(() => ({ status: 200, stallBody: true }));
    const service = buildService(analytics.url, 1000);

    await expect(executeQuery(service)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('throws ServiceUnavailableException when the connection is refused', async () => {
    const refusedUrl = analytics.url;
    await analytics.close();
    analytics = await startFakeAnalytics();
    const service = buildService(refusedUrl);

    await expect(executeQuery(service)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it.each([
    ['an empty body', undefined],
    ['a JSON null', null],
  ])('throws ServiceUnavailableException for %s', async (_label, body) => {
    analytics.setHandler(() => ({ status: 200, body }));
    const service = buildService(analytics.url);

    await expect(executeQuery(service)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('throws ServiceUnavailableException for a body that is not JSON', async () => {
    analytics.setHandler(() => ({ status: 200, rawBody: 'not json' }));
    const service = buildService(analytics.url);

    await expect(executeQuery(service)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('never logs the token or the ADAS error body', async () => {
    const spies = spyOnLogs();
    analytics.setHandler(() => ({
      status: 403,
      body: { message: `denied for ${TOKEN}` },
    }));
    const service = buildService(analytics.url);

    await expect(readSchema(service)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    analytics.setHandler(() => ({ status: 200, body: { rows: [] } }));
    await executeQuery(service);

    const logged = JSON.stringify(spies.flatMap((spy) => spy.mock.calls));
    expect(logged).not.toContain(TOKEN);
    expect(logged).not.toContain('denied for');
  });

  it('never names DIAL Core for an ADAS failure, in logs or exception messages', async () => {
    const spies = spyOnLogs();
    const failures: unknown[] = [];
    for (const response of [
      { status: 400 },
      { status: 403 },
      { status: 500 },
      { status: 302 },
      { hang: true },
      { status: 200, body: undefined },
      { status: 200, rawBody: 'not json' },
    ]) {
      analytics.setHandler(() => response);
      await executeQuery(buildService(analytics.url)).catch(
        (error: unknown) => {
          failures.push(error);
        },
      );
    }

    expect(failures).toHaveLength(7);
    const messages = JSON.stringify(
      failures.map((error) =>
        error instanceof HttpException ? error.getResponse() : String(error),
      ),
    );
    expect(messages).not.toContain('DIAL Core');
    expect(messages).toContain('DIAL Analytics');
    expect(
      JSON.stringify(spies.flatMap((spy) => spy.mock.calls)),
    ).not.toContain('DIAL Core');
  });
  it('keeps an Accept header the call sets itself', async () => {
    const service = buildService(analytics.url);

    await readSchema(service, {
      ...getBearerAuthHeaders(TOKEN),
      Accept: 'text/csv',
    });

    expect(analytics.requests[0].headers.accept).toBe('text/csv');
  });

  it("aborts with the caller's own signal before the timeout", async () => {
    analytics.setHandler(() => ({ hang: true }));
    const service = buildService(analytics.url, 5000);
    const controller = new AbortController();
    const startedAt = Date.now();
    setTimeout(() => controller.abort(), 50);

    await expect(
      executeQuery(service, controller.signal),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(Date.now() - startedAt).toBeLessThan(2000);
  });

  it('discards an ADAS error body unread', async () => {
    analytics.setHandler(() => ({
      status: 403,
      body: { message: `internal detail with ${TOKEN}` },
    }));
    const service = buildService(analytics.url);

    const result = await service.client.executeQuery({
      body: QUERY,
      headers: getBearerAuthHeaders(TOKEN),
    });

    expect(result.response.status).toBe(403);
    expect(JSON.stringify(result.error ?? null)).not.toContain(
      'internal detail',
    );
  });

  it('does not count an ADAS call as DIAL Core time', async () => {
    initializeCoreRequestTiming();
    analytics.setHandler(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ status: 200, body: { rows: [] } }), 50);
        }),
    );
    const service = buildService(analytics.url);
    const analyticsTiming = new RequestTimingState();
    const coreTiming = new RequestTimingState();

    await requestTimingStorage.run(analyticsTiming, () =>
      executeQuery(service),
    );
    /* The same wire call made through the Core marker is counted, so the probe works. */
    await requestTimingStorage.run(coreTiming, () =>
      withCoreRequestTiming(() => executeQuery(service).catch(() => undefined)),
    );

    expect(analyticsTiming.settle().core).toBe(0);
    expect(coreTiming.settle().core).toBeGreaterThan(0);
  });
});
