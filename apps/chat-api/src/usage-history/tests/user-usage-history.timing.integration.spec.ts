import { type INestApplication, Logger, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { metrics } from '@opentelemetry/api';
import {
  MeterProvider,
  MetricReader,
  type MetricData,
} from '@opentelemetry/sdk-metrics';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { DialAnalyticsClientService } from '../../dial/dial-analytics-client.service';
import {
  type FakeAnalyticsServer,
  type FakeResponse,
  type RecordedRequest,
  startFakeAnalytics,
} from '../../dial/tests/fake-analytics.server';
import { UsageHistoryService } from '../usage-history.service';
import { UserUsageHistoryController } from '../user-usage-history.controller';

class TestMetricReader extends MetricReader {
  protected async onForceFlush(): Promise<void> {
    /* Tests collect in-memory data directly. */
  }

  protected async onShutdown(): Promise<void> {
    /* No external resources. */
  }
}

const HISTORY_PATH = '/api/v1/user/usage/history';
const ADAS_DELAY_MS = 50;

const delayed = (response: FakeResponse): Promise<FakeResponse> =>
  new Promise((resolve) => {
    setTimeout(() => resolve(response), ADAS_DELAY_MS);
  });

/* Every ADAS answer arrives after ADAS_DELAY_MS: schema, then the queries. */
const slowAdas = (recorded: RecordedRequest): Promise<FakeResponse> => {
  if (recorded.path === '/v1/queries/entities/schema/dial_usage_log') {
    return delayed({ status: 200, body: { fields: [{ name: 'deployment' }] } });
  }
  return delayed({ status: 200, body: { rows: [] } });
};

describe('UserUsageHistoryController request timing (integration)', () => {
  const metricReader = new TestMetricReader();
  let meterProvider: MeterProvider;
  let analytics: FakeAnalyticsServer;
  let app: INestApplication;

  beforeAll(async () => {
    vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    meterProvider = new MeterProvider({ readers: [metricReader] });
    metrics.setGlobalMeterProvider(meterProvider);
    /* The meter is created at module load, after the provider is installed. */
    const { createRequestTimingMiddleware } =
      await import('../../telemetry/request-timing');

    analytics = await startFakeAnalytics(slowAdas);
    vi.stubEnv('ANALYTICS_URL', analytics.url);
    vi.stubEnv('ANALYTICS_TIMEOUT_MS', undefined);

    const module = await Test.createTestingModule({
      controllers: [UserUsageHistoryController],
      providers: [
        DialAnalyticsClientService,
        UsageHistoryService,
        {
          provide: ConfigService,
          useValue: new ConfigService({ ANALYTICS_TIMEOUT_MS: 5000 }),
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.use(
      createRequestTimingMiddleware({
        OTEL_SDK_DISABLED: 'false',
        OTEL_METRICS_EXPORTER: 'prometheus',
        OTEL_TRACES_EXPORTER: 'none',
        OTEL_LOGS_EXPORTER: 'none',
      }),
    );
    /* Stands in for the session guard, which runs after the timing middleware. */
    app.use(
      (
        req: Express.Request & { user?: unknown },
        _res: unknown,
        next: () => void,
      ) => {
        req.user = { sub: 'user-123', at: 'test-access-token', bucket: 'b' };
        next();
      },
    );
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI });
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await analytics?.close();
    await meterProvider?.shutdown();
    metrics.disable();
    const { stopUpstreamRequestTiming } =
      await import('../../telemetry/upstream-request-timing');
    stopUpstreamRequestTiming();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  const getPhases = async (): Promise<
    Record<string, { sum: number; count: number }>
  > => {
    const { resourceMetrics } = await metricReader.collect();
    return Object.fromEntries(
      resourceMetrics.scopeMetrics
        .flatMap((scope) => scope.metrics)
        .filter(
          (metric) =>
            metric.descriptor.name === 'dial.chat.http.request.phase.duration',
        )
        .flatMap<MetricData['dataPoints'][number]>(
          (metric) => metric.dataPoints,
        )
        .filter((point) => point.attributes['http.route'] === HISTORY_PATH)
        .map((point) => {
          const value = point.value;
          if (typeof value === 'number' || !('sum' in value)) {
            throw new Error('Expected request phase histogram data');
          }
          return [
            String(point.attributes['dial.chat.http.phase']),
            { sum: value.sum ?? 0, count: value.count },
          ];
        }),
    );
  };

  it('records DIAL Analytics wait as the analytics phase and keeps it out of chat time', async () => {
    const response = await request(app.getHttpServer())
      .get(`${HISTORY_PATH}?period=today`)
      .expect(200);
    expect(response.body).toMatchObject({ available: true });
    expect(analytics.requests.length).toBeGreaterThan(1);

    const phases = await getPhases();
    expect(Object.keys(phases).sort()).toEqual([
      'analytics',
      'chat',
      'core',
      'total',
    ]);
    for (const phase of Object.values(phases)) {
      expect(phase.count).toBe(1);
    }
    expect(phases.core.sum).toBe(0);
    expect(phases.analytics.sum).toBeGreaterThanOrEqual(
      (ADAS_DELAY_MS - 5) / 1000,
    );
    expect(phases.chat.sum).toBeGreaterThanOrEqual(0);
    expect(phases.chat.sum).toBeCloseTo(
      phases.total.sum - phases.analytics.sum,
      10,
    );
  });
});
