import http from 'http';
import type { AddressInfo } from 'net';
import {
  CanActivate,
  Controller,
  ForbiddenException,
  Get,
  INestApplication,
  Injectable,
  Post,
  Res,
  UseGuards,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { metrics } from '@opentelemetry/api';
import {
  MeterProvider,
  MetricReader,
  type MetricData,
} from '@opentelemetry/sdk-metrics';
import type { Response as ExpressResponse } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../config/environment.config';
import type { DialClientService } from '../../dial/dial-client.service';

class TestMetricReader extends MetricReader {
  protected async onForceFlush(): Promise<void> {
    /* Tests collect in-memory data directly. */
  }

  protected async onShutdown(): Promise<void> {
    /* No external resources. */
  }
}

const pause = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

let upstreamUrl: string;
let dialClient: DialClientService;
let backgroundWork: Promise<unknown> | undefined;

const coreText = async (path: string) => {
  const response = await dialClient.fetchCore(`${upstreamUrl}${path}`);
  return response.text();
};

@Injectable()
class CoreCheckingGuard implements CanActivate {
  async canActivate(): Promise<boolean> {
    await coreText('/headers');
    throw new ForbiddenException('guard rejected after Core lookup');
  }
}

@Controller({ version: '1' })
class TimingController {
  @Get('timing/no-core')
  noCore(): string {
    return 'ok';
  }

  @Get('timing/other-upstream')
  async otherUpstream(): Promise<string> {
    const response = await fetch(`${upstreamUrl}/headers`);
    return response.text();
  }

  @Get('timing/guarded')
  @UseGuards(CoreCheckingGuard)
  guarded(): string {
    return 'unreachable';
  }

  @Get('timing/body')
  body(): Promise<string> {
    return coreText('/body');
  }

  @Get('timing/parallel')
  async parallel(): Promise<string> {
    await Promise.all([
      coreText('/headers'),
      coreText('/headers'),
      coreText('/headers'),
    ]);
    await pause(35);
    return 'ok';
  }

  @Get('timing/failure')
  async failure(): Promise<string> {
    try {
      await coreText('/failure');
    } catch {
      await pause(35);
      return 'recovered';
    }
    return 'unexpected';
  }

  @Get('timing/cancel')
  async cancel(): Promise<string> {
    const controller = new AbortController();
    const response = await dialClient.fetchCore(`${upstreamUrl}/body`, {
      signal: controller.signal,
    });
    await pause(25);
    controller.abort();
    await response.text().catch(() => undefined);
    await pause(35);
    return 'cancelled';
  }

  @Get('timing/detached')
  detached(): string {
    backgroundWork = pause(30).then(() => coreText('/body'));
    return 'accepted';
  }

  @Get('timing/inflight')
  async inflight(): Promise<string> {
    const response = await dialClient.fetchCore(`${upstreamUrl}/long-body`);
    backgroundWork = response.text();
    return 'accepted';
  }

  @Get('timing/disconnected')
  async disconnected(@Res() response: ExpressResponse): Promise<void> {
    const upstream = await dialClient.fetchCore(`${upstreamUrl}/long-body`);
    backgroundWork = upstream.text();
    response.setHeader('Content-Type', 'text/event-stream');
    response.write('data: ready\n\n');
  }

  @Post('conversations/completions')
  async stream(@Res() response: ExpressResponse): Promise<void> {
    const upstream = await dialClient.fetchCore(`${upstreamUrl}/body`);
    response.setHeader('Content-Type', 'text/event-stream');
    const reader = upstream.body!.getReader();
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        response.write(chunk.value);
      }
    } finally {
      reader.releaseLock();
      response.end();
    }
  }
}

describe('request timing — Core wire attribution through the real Nest pipeline', () => {
  let app: INestApplication;
  let upstream: http.Server;
  let meterProvider: MeterProvider;
  let appUrl: string;
  const metricReader = new TestMetricReader();

  const buildApp = async (disabled = false): Promise<INestApplication> => {
    const { createRequestTimingMiddleware } = await import('../request-timing');
    const testModule = await Test.createTestingModule({
      controllers: [TimingController],
      providers: [CoreCheckingGuard],
    }).compile();
    const instance = testModule.createNestApplication<NestExpressApplication>();
    instance.use(
      createRequestTimingMiddleware({
        OTEL_SDK_DISABLED: String(disabled),
        OTEL_METRICS_EXPORTER: 'prometheus',
        OTEL_TRACES_EXPORTER: 'none',
        OTEL_LOGS_EXPORTER: 'none',
      }),
    );
    instance.setGlobalPrefix('api');
    instance.enableVersioning({ type: VersioningType.URI });
    await instance.init();
    return instance;
  };

  beforeAll(async () => {
    meterProvider = new MeterProvider({ readers: [metricReader] });
    metrics.setGlobalMeterProvider(meterProvider);
    upstream = http.createServer((req, res) => {
      if (req.url === '/failure') {
        setTimeout(() => res.destroy(), 40);
        return;
      }
      if (req.url === '/headers') {
        setTimeout(() => res.end('ok'), 55);
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.write('start');
      setTimeout(() => res.end('-end'), req.url === '/long-body' ? 180 : 65);
    });
    await new Promise<void>((resolve, reject) => {
      upstream.once('error', reject);
      upstream.listen(0, '127.0.0.1', () => {
        upstream.off('error', reject);
        resolve();
      });
    });
    upstreamUrl = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;
    const { DialClientService: Client } =
      await import('../../dial/dial-client.service');
    dialClient = new Client(
      new ConfigService<EnvironmentVariables>({ DIAL_CORE_URL: upstreamUrl }),
    );
    app = await buildApp();
    await app.listen(0, '127.0.0.1');
    appUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await backgroundWork;
    await app?.close();
    upstream?.closeAllConnections();
    await new Promise<void>((resolve) => upstream?.close(() => resolve()));
    await meterProvider?.shutdown();
    metrics.disable();
    const { stopCoreRequestTiming } = await import('../core-request-timing');
    stopCoreRequestTiming();
  });

  const getPhases = async (route: string) => {
    const { resourceMetrics } = await metricReader.collect();
    const points = resourceMetrics.scopeMetrics
      .flatMap((scope) => scope.metrics)
      .filter(
        (metric) =>
          metric.descriptor.name === 'dial.chat.http.request.phase.duration',
      )
      .flatMap<MetricData['dataPoints'][number]>((metric) => metric.dataPoints)
      .filter((point) => point.attributes['http.route'] === route);

    return Object.fromEntries(
      points.map((point) => {
        const value = point.value;
        if (typeof value === 'number' || !('sum' in value)) {
          throw new Error('Expected request phase histogram data');
        }
        return [
          point.attributes['dial.chat.http.phase'],
          {
            sum: value.sum ?? 0,
            count: value.count,
            attributes: point.attributes,
          },
        ];
      }),
    );
  };

  const expectCompletePhases = async (route: string) => {
    const phases = await getPhases(route);
    expect(Object.keys(phases).sort()).toEqual(['chat', 'core', 'total']);
    expect(phases.total.count).toBe(1);
    expect(phases.core.count).toBe(1);
    expect(phases.chat.count).toBe(1);
    expect(phases.total.sum).toBeGreaterThanOrEqual(0);
    expect(phases.core.sum).toBeGreaterThanOrEqual(0);
    expect(phases.chat.sum).toBeGreaterThanOrEqual(0);
    expect(phases.core.sum + phases.chat.sum).toBeCloseTo(phases.total.sum, 10);
    return phases;
  };

  it('emits a zero Core phase and one terminal observation for a request with no Core calls', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/timing/no-core')
      .expect(200, 'ok');
    const phases = await expectCompletePhases('/api/v1/timing/no-core');
    expect(phases.core.sum).toBe(0);
    expect(phases.chat.sum).toBe(phases.total.sum);
    expect(phases.total.attributes).toMatchObject({
      'http.request.method': 'GET',
      'http.response.status_code': 200,
      'dial.chat.http.outcome': 'completed',
      'dial.chat.http.transport_kind': 'ordinary',
    });
  });

  it('keeps an untagged outbound fetch outside Core even when it uses the same origin', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/timing/other-upstream')
      .expect(200, 'ok');
    const phases = await expectCompletePhases('/api/v1/timing/other-upstream');
    expect(phases.core.sum).toBe(0);
    expect(phases.chat.sum).toBeGreaterThan(0.035);
  });

  it('includes a Core call from a rejecting guard before controller execution', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/timing/guarded')
      .expect(403);
    const phases = await expectCompletePhases('/api/v1/timing/guarded');
    expect(phases.core.sum).toBeGreaterThan(0.035);
    expect(phases.total.attributes['http.response.status_code']).toBe(403);
  });

  it('measures the delayed body beyond the initial response headers without changing bytes', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/timing/body')
      .expect(200, 'start-end');
    const phases = await expectCompletePhases('/api/v1/timing/body');
    expect(phases.core.sum).toBeGreaterThan(0.045);
  });

  it('merges parallel Core intervals and preserves the subsequent local wait', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/timing/parallel')
      .expect(200, 'ok');
    const phases = await expectCompletePhases('/api/v1/timing/parallel');
    expect(phases.core.sum).toBeGreaterThan(0.035);
    expect(phases.chat.sum).toBeGreaterThan(0.025);
  });

  it('stops Core timing when the upstream fails, before local error handling completes', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/timing/failure')
      .expect(200, 'recovered');
    const phases = await expectCompletePhases('/api/v1/timing/failure');
    expect(phases.core.sum).toBeGreaterThan(0.025);
    expect(phases.chat.sum).toBeGreaterThan(0.025);
  });

  it('stops Core timing when the response body is aborted', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/timing/cancel')
      .expect(200, 'cancelled');
    const phases = await expectCompletePhases('/api/v1/timing/cancel');
    expect(phases.core.sum).toBeGreaterThan(0.015);
    expect(phases.chat.sum).toBeGreaterThan(0.025);
  });

  it('measures streamed body transfer through terminal response completion', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/conversations/completions')
      .expect(201, 'start-end');
    const phases = await expectCompletePhases(
      '/api/v1/conversations/completions',
    );
    expect(phases.core.sum).toBeGreaterThan(0.045);
    expect(phases.total.attributes['dial.chat.http.transport_kind']).toBe(
      'streaming',
    );
  });

  it('does not mutate a completed observation when new detached work calls Core', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/timing/detached')
      .expect(200, 'accepted');
    const before = await expectCompletePhases('/api/v1/timing/detached');
    expect(before.core.sum).toBe(0);
    await backgroundWork;
    expect(await getPhases('/api/v1/timing/detached')).toEqual(before);
  });

  it('clips active Core time to HTTP completion and ignores the later body settlement', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/timing/inflight')
      .expect(200, 'accepted');
    const before = await expectCompletePhases('/api/v1/timing/inflight');
    expect(before.core.sum).toBeGreaterThan(0);
    expect(before.core.sum).toBeLessThanOrEqual(before.total.sum);
    await backgroundWork;
    expect(await getPhases('/api/v1/timing/inflight')).toEqual(before);
  });

  it('clips active Core time at a browser disconnect while backend work continues', async () => {
    await new Promise<void>((resolve, reject) => {
      const client = http.get(
        `${appUrl}/api/v1/timing/disconnected`,
        (response) => {
          response.once('data', () => {
            client.destroy();
            resolve();
          });
        },
      );
      client.on('error', reject);
    });
    await vi.waitFor(async () => {
      const phases = await getPhases('/api/v1/timing/disconnected');
      expect(phases.total?.attributes['dial.chat.http.outcome']).toBe(
        'aborted_during_response',
      );
    });
    const before = await expectCompletePhases('/api/v1/timing/disconnected');
    expect(before.core.sum).toBeGreaterThan(0);
    await backgroundWork;
    expect(await getPhases('/api/v1/timing/disconnected')).toEqual(before);
  });

  it("keeps concurrent inbound requests isolated from another request's Core activity", async () => {
    const before = await getPhases('/api/v1/timing/other-upstream');
    await Promise.all([
      request(app.getHttpServer()).get('/api/v1/timing/body').expect(200),
      request(app.getHttpServer())
        .get('/api/v1/timing/other-upstream')
        .expect(200),
    ]);
    const after = await getPhases('/api/v1/timing/other-upstream');
    expect(after.core.sum).toBe(0);
    expect(after.core.count).toBe(before.core.count + 1);
  });

  it('leaves responses untouched and emits no new observations when telemetry is disabled', async () => {
    const disabledApp = await buildApp(true);
    const before = await getPhases('/api/v1/timing/body');
    try {
      await request(disabledApp.getHttpServer())
        .get('/api/v1/timing/body')
        .expect(200, 'start-end');
      expect(await getPhases('/api/v1/timing/body')).toEqual(before);
    } finally {
      await disabledApp.close();
    }
  });

  it('excludes health traffic from the timing population', async () => {
    await request(app.getHttpServer()).get('/api/health').expect(404);
    await vi.waitFor(async () => {
      expect(await getPhases('unmatched')).toEqual({});
    });
  });
});
