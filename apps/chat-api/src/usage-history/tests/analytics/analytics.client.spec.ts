import {
  BadGatewayException,
  ForbiddenException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalyticsClient } from '../../analytics/analytics.client';
import {
  type FakeAnalyticsServer,
  startFakeAnalytics,
} from '../fake-analytics.server';

const TOKEN = 'secret-session-token';

const buildClient = (url: string | undefined, timeoutMs = 1000) => {
  vi.stubEnv('ANALYTICS_URL', url ?? '');
  vi.stubEnv('ANALYTICS_TIMEOUT_MS', String(timeoutMs));
  return new AnalyticsClient(new ConfigService({}));
};

describe('AnalyticsClient', () => {
  let analytics: FakeAnalyticsServer;

  beforeEach(async () => {
    analytics = await startFakeAnalytics(() => ({
      status: 200,
      body: { rows: [] },
    }));
  });

  afterEach(async () => {
    await analytics.close();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('reports not configured when ANALYTICS_URL is unset', () => {
    expect(buildClient(undefined).isConfigured).toBe(false);
    expect(buildClient(analytics.url).isConfigured).toBe(true);
  });

  it('sends only the bearer token to the fixed table and schema paths', async () => {
    const client = buildClient(analytics.url);

    await client.getUsageLogTable(TOKEN);
    await client.getUsageLogSchema(TOKEN);

    expect(analytics.requests.map((r) => `${r.method} ${r.path}`)).toEqual([
      'GET /v1/tables/dial_usage_log',
      'GET /v1/queries/entities/schema/dial_usage_log',
    ]);
    for (const recorded of analytics.requests) {
      expect(recorded.headers.authorization).toBe(`Bearer ${TOKEN}`);
      expect(recorded.headers['api-key']).toBeUndefined();
      expect(recorded.headers.cookie).toBeUndefined();
    }
  });

  it('posts the query document unchanged as JSON and returns the parsed body', async () => {
    const client = buildClient(analytics.url);
    const query = { entity: 'dial_usage_log', mode: 'aggregate' };

    await expect(client.executeQuery(TOKEN, query)).resolves.toEqual({
      rows: [],
    });

    expect(analytics.requests).toHaveLength(1);
    expect(analytics.requests[0]).toMatchObject({
      method: 'POST',
      path: '/v1/queries/execute',
      body: query,
    });
    expect(analytics.requests[0].headers['content-type']).toBe(
      'application/json',
    );
  });

  it('keeps a path prefix of the base URL', async () => {
    const client = buildClient(`${analytics.url}/analytics/`);

    await client.executeQuery(TOKEN, {});

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
      const client = buildClient(analytics.url);

      await expect(client.executeQuery(TOKEN, {})).rejects.toBeInstanceOf(
        exception,
      );
      expect(analytics.requests).toHaveLength(1);
    },
  );

  it('does not follow a redirect with the token and reports the raw ADAS status', async () => {
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    analytics.setHandler((recorded) =>
      recorded.path === '/v1/queries/execute'
        ? { status: 302, headers: { Location: `${analytics.url}/elsewhere` } }
        : { status: 200, body: { rows: [] } },
    );
    const client = buildClient(analytics.url);

    await expect(client.executeQuery(TOKEN, {})).rejects.toBeInstanceOf(
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
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    analytics.setHandler(() => ({ status: 503 }));
    const client = buildClient(analytics.url);

    await expect(client.executeQuery(TOKEN, {})).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    expect(JSON.stringify(warn.mock.calls)).toContain('answered 503');
  });

  it('throws ServiceUnavailableException when ADAS does not answer within the timeout', async () => {
    analytics.setHandler(() => ({ hang: true }));
    const client = buildClient(analytics.url, 1000);

    await expect(client.executeQuery(TOKEN, {})).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(analytics.requests).toHaveLength(1);
  });

  it('throws ServiceUnavailableException when the connection is refused', async () => {
    const refusedUrl = analytics.url;
    await analytics.close();
    analytics = await startFakeAnalytics();
    const client = buildClient(refusedUrl);

    await expect(client.executeQuery(TOKEN, {})).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('throws ServiceUnavailableException for a body that is not JSON', async () => {
    analytics.setHandler(() => ({ status: 200, body: undefined }));
    const client = buildClient(analytics.url);

    await expect(client.executeQuery(TOKEN, {})).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('never logs the token or the ADAS error body', async () => {
    const spies = (['log', 'debug', 'warn', 'error', 'verbose'] as const).map(
      (level) => vi.spyOn(Logger.prototype, level),
    );
    analytics.setHandler(() => ({
      status: 403,
      body: { message: `denied for ${TOKEN}` },
    }));
    const client = buildClient(analytics.url);

    await expect(client.getUsageLogTable(TOKEN)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    analytics.setHandler(() => ({ status: 200, body: { rows: [] } }));
    await client.executeQuery(TOKEN, {});

    const logged = JSON.stringify(spies.flatMap((spy) => spy.mock.calls));
    expect(logged).not.toContain(TOKEN);
    expect(logged).not.toContain('denied for');
  });
});
