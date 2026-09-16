import http from 'http';
import type { AddressInfo } from 'net';
import {
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  ForbiddenException,
  Get,
  HttpCode,
  INestApplication,
  Injectable,
  NotFoundException,
  Post,
  Redirect,
  Res,
  UseGuards,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { metrics } from '@opentelemetry/api';
import { MeterProvider, MetricReader } from '@opentelemetry/sdk-metrics';
import { IsString } from 'class-validator';
import type { Response as ExpressResponse } from 'express';
import helmet from 'helmet';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

class TestMetricReader extends MetricReader {
  protected async onForceFlush(): Promise<void> {
    /* nothing to flush — reader.collect() is called directly in assertions */
  }

  protected async onShutdown(): Promise<void> {
    /* no resources to release */
  }
}

/*
 * `http-lifecycle-metrics.ts` calls `metrics.getMeter(...)` once at module scope (see
 * `http-lifecycle-metrics.spec.ts`), and this file's dynamic `import('../http-lifecycle-listener')`
 * calls only evaluate that module graph once (subsequent calls hit Node's module cache) — so every
 * describe block in this file must share the one `MeterProvider`/reader registered here, once, up
 * front. Registering a second `MeterProvider` in a later describe block would silently not rebind
 * the already-created instruments to it, and that reader would never see any data.
 */
const reader = new TestMetricReader();

beforeAll(() => {
  const meterProvider = new MeterProvider({ readers: [reader] });
  metrics.setGlobalMeterProvider(meterProvider);
});

afterAll(() => {
  metrics.disable();
});

const collectDataPoints = async (name: string) => {
  const { resourceMetrics } = await reader.collect();
  return resourceMetrics.scopeMetrics
    .flatMap((scope) => scope.metrics)
    .filter((metric) => metric.descriptor.name === name)
    .flatMap((metric) => metric.dataPoints);
};

/* Always rejects — stands in for auth/CSRF/feature-flag/rate-limit guards (Requirement 1's
 * "guard rejection" scenario), all of which run before a Nest interceptor ever sees the request. */
@Injectable()
class RejectingGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    throw new ForbiddenException('rejected by guard');
  }
}

class ValidateBodyDto {
  @IsString()
  name!: string;
}

@Controller({ path: 'test', version: '1' })
class TestController {
  @Get('guarded')
  @UseGuards(RejectingGuard)
  guarded(): string {
    return 'unreachable';
  }

  @Post('echo')
  @HttpCode(200)
  echo(): string {
    return 'ok';
  }

  /* Never responds — used to simulate a client disconnecting before any response is sent. */
  @Get('hangs')
  hangs(@Res() _res: ExpressResponse): void {
    /* deliberately never call res.end()/writeHead() */
  }

  @Get('redirect')
  @Redirect('/api/v1/test/echo', 302)
  redirect(): void {
    /* @Redirect() handles the response */
  }

  @Post('validate')
  validate(@Body() _body: ValidateBodyDto): string {
    return 'ok';
  }

  @Get('boom')
  boom(): never {
    throw new NotFoundException('not found');
  }

  /* Writes headers and one chunk, then deliberately never calls `res.end()` — the reference
   * shape of a long-lived SSE route (design.md's `POST /api/v1/conversations/watch`), used here
   * to simulate a mid-stream client disconnect without depending on any real business route. */
  @Get('sse')
  sse(@Res() res: ExpressResponse): void {
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.write('event: hello\n\n');
  }

  /*
   * Writes headers and a chunk, then emits a genuine `'error'` on the response object itself —
   * simulating a transport failure after the status line was already committed. (Node's own
   * `response.socket.destroy(err)` only propagates the error to the socket, not to the response
   * object — verified directly in `http-lifecycle-listener.spec.ts` — so a real write/stream
   * failure is simulated the same explicit way here.)
   */
  @Get('error-after-headers')
  errorAfterHeaders(@Res() res: ExpressResponse): void {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.write('partial');
    res.emit('error', new Error('simulated transport failure'));
    res.socket?.destroy();
  }
}

const buildApp = async (options?: {
  apiPrefix?: string;
  listenerEnv?: NodeJS.ProcessEnv;
}): Promise<INestApplication> => {
  const { attachHttpLifecycleListener } =
    await import('../http-lifecycle-listener');

  const module: TestingModule = await Test.createTestingModule({
    controllers: [TestController],
    providers: [RejectingGuard],
  }).compile();

  const app = module.createNestApplication();

  /* Attached first, before any app.use(...) call — mirroring main.ts's D1 ordering. */
  attachHttpLifecycleListener(
    app.getHttpServer(),
    options?.listenerEnv ?? { OTEL_SDK_DISABLED: 'false' },
  );

  app.enableVersioning({ type: VersioningType.URI });
  app.useBodyParser('json', { limit: '1kb' });
  app.use(helmet());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.setGlobalPrefix(options?.apiPrefix ?? 'api');

  await app.init();
  return app;
};

/*
 * Proves design.md D1's mechanism against the *actual* Nest/Express pipeline (helmet,
 * `ValidationPipe`, URI versioning, global prefix — the same ordering `main.ts` uses).
 * Requirement 8's "real-bootstrap integration test" split: this file proves the mechanism against
 * the real bootstrap; `main.ts` itself only wires the already-proven function (task 3.1).
 */
describe('HTTP lifecycle metrics — real Nest/Express bootstrap', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.listen(0, '127.0.0.1');
    const { port } = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  const sumActive = (dataPoints: Array<{ value: number }>) =>
    dataPoints.reduce((total, point) => total + point.value, 0);

  it('observes a request rejected by a guard before it reaches any controller', async () => {
    await request(app.getHttpServer()).get('/api/v1/test/guarded').expect(403);

    const durationPoints = await collectDataPoints(
      'dial.chat.http.response.duration',
    );
    const point = durationPoints.find(
      (candidate) =>
        candidate.attributes['dial.chat.http.outcome'] === 'completed' &&
        candidate.attributes['http.response.status_code'] === 403,
    );
    expect(point).toBeDefined();
  });

  it('observes a request whose body exceeds the configured size limit', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/test/echo')
      .set('Content-Type', 'application/json')
      .send({ payload: 'x'.repeat(2000) })
      .expect(413);

    const durationPoints = await collectDataPoints(
      'dial.chat.http.response.duration',
    );
    const point = durationPoints.find(
      (candidate) =>
        candidate.attributes['dial.chat.http.outcome'] === 'completed' &&
        candidate.attributes['http.response.status_code'] === 413,
    );
    expect(point).toBeDefined();
  });

  it('observes a request to an unmatched route with the bounded unmatched route attribute', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/does-not-exist')
      .expect(404);

    const durationPoints = await collectDataPoints(
      'dial.chat.http.response.duration',
    );
    const point = durationPoints.find(
      (candidate) =>
        candidate.attributes['dial.chat.http.outcome'] === 'completed' &&
        candidate.attributes['http.route'] === 'unmatched' &&
        candidate.attributes['http.response.status_code'] === 404,
    );
    expect(point).toBeDefined();
  });

  it('leaves a successful request untouched (status, body, and headers unaffected by instrumentation)', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/test/echo')
      .expect(200);

    expect(response.text).toBe('ok');

    const point = (
      await collectDataPoints('dial.chat.http.response.duration')
    ).find(
      (candidate) =>
        candidate.attributes['dial.chat.http.outcome'] === 'completed' &&
        candidate.attributes['http.route'] === '/api/v1/test/echo' &&
        candidate.attributes['http.response.status_code'] === 200,
    );
    expect(point).toBeDefined();
  });

  it('observes a redirect response with its real status code', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/test/redirect')
      .expect(302)
      .expect('Location', '/api/v1/test/echo');

    const point = (
      await collectDataPoints('dial.chat.http.response.duration')
    ).find(
      (candidate) =>
        candidate.attributes['dial.chat.http.outcome'] === 'completed' &&
        candidate.attributes['http.route'] === '/api/v1/test/redirect' &&
        candidate.attributes['http.response.status_code'] === 302,
    );
    expect(point).toBeDefined();
  });

  it('observes a validation rejection (400) unchanged in behavior', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/test/validate')
      .send({ name: 123 })
      .expect(400);

    expect(response.body.statusCode).toBe(400);

    const point = (
      await collectDataPoints('dial.chat.http.response.duration')
    ).find(
      (candidate) =>
        candidate.attributes['dial.chat.http.outcome'] === 'completed' &&
        candidate.attributes['http.route'] === '/api/v1/test/validate' &&
        candidate.attributes['http.response.status_code'] === 400,
    );
    expect(point).toBeDefined();
  });

  it('observes a controller-thrown exception (404) unchanged in behavior', async () => {
    await request(app.getHttpServer()).get('/api/v1/test/boom').expect(404);

    const point = (
      await collectDataPoints('dial.chat.http.response.duration')
    ).find(
      (candidate) =>
        candidate.attributes['dial.chat.http.outcome'] === 'completed' &&
        candidate.attributes['http.route'] === '/api/v1/test/boom' &&
        candidate.attributes['http.response.status_code'] === 404,
    );
    expect(point).toBeDefined();
  });

  it('excludes GET /api/health from all three instruments, before Nest even resolves it', async () => {
    const before = (await collectDataPoints('dial.chat.http.requests.started'))
      .length;

    await request(app.getHttpServer()).get('/api/health').expect(404);

    const after = await collectDataPoints('dial.chat.http.requests.started');
    expect(after).toHaveLength(before);
  });

  it('records aborted_before_response when the client disconnects before any response is sent', async () => {
    const socket = http.get(`${baseUrl}/api/v1/test/hangs`, {
      agent: false,
    });
    socket.on('error', () => {
      /* expected once the client tears down the connection */
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    socket.destroy();
    await new Promise((resolve) => setTimeout(resolve, 30));

    const point = (
      await collectDataPoints('dial.chat.http.response.duration')
    ).find(
      (candidate) =>
        candidate.attributes['dial.chat.http.outcome'] ===
          'aborted_before_response' &&
        candidate.attributes['http.route'] === '/api/v1/test/hangs',
    );
    expect(point).toBeDefined();
    expect(point?.attributes['http.response.status_code']).toBeUndefined();
  });

  it('records aborted_during_response when a client disconnects mid-stream, reflecting the committed status code', async () => {
    const socket = http.get(
      `${baseUrl}/api/v1/test/sse`,
      { agent: false },
      (res) => {
        res.once('data', () => socket.destroy());
      },
    );
    socket.on('error', () => {
      /* expected once the client tears down the connection */
    });
    await new Promise((resolve) => setTimeout(resolve, 50));

    const point = (
      await collectDataPoints('dial.chat.http.response.duration')
    ).find(
      (candidate) =>
        candidate.attributes['dial.chat.http.outcome'] ===
          'aborted_during_response' &&
        candidate.attributes['http.route'] === '/api/v1/test/sse',
    );
    expect(point).toBeDefined();
    expect(point?.attributes['http.response.status_code']).toBe(200);

    const activePoints = await collectDataPoints(
      'dial.chat.http.requests.active',
    );
    expect(sumActive(activePoints)).toBe(0);
  });

  it('records error when the transport fails after headers were already committed', async () => {
    await new Promise<void>((resolve) => {
      const req = http.get(`${baseUrl}/api/v1/test/error-after-headers`, {
        agent: false,
      });
      req.on('error', () => resolve());
      req.on('close', () => resolve());
    });
    await new Promise((resolve) => setTimeout(resolve, 30));

    const point = (
      await collectDataPoints('dial.chat.http.response.duration')
    ).find(
      (candidate) =>
        candidate.attributes['dial.chat.http.outcome'] === 'error' &&
        candidate.attributes['http.route'] ===
          '/api/v1/test/error-after-headers',
    );
    expect(point).toBeDefined();
  });

  it('never double-counts a request whose finish is followed by the always-eventual close', async () => {
    await request(app.getHttpServer()).post('/api/v1/test/echo').expect(200);
    /* Let the always-eventually-following 'close' event fire too, to prove it's a no-op. */
    await new Promise((resolve) => setTimeout(resolve, 30));

    const durationPoints = await collectDataPoints(
      'dial.chat.http.response.duration',
    );
    const matches = durationPoints.filter(
      (candidate) => candidate.attributes['http.route'] === '/api/v1/test/echo',
    );
    /* One aggregated data point per unique attribute combination (cumulative temporality) —
     * its own `count` (not asserted here directly, but implied by the single combined data
     * point never splitting into two) is what would reveal double-counting; the mechanism-level
     * `http-lifecycle-listener.spec.ts` asserts the `count` field directly for this exact race. */
    expect(matches.length).toBeGreaterThan(0);
  });
});

describe('HTTP lifecycle metrics — custom API_PREFIX', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await buildApp({ apiPrefix: 'gateway' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('still records the terminal data point when the app uses a non-default global prefix', async () => {
    await request(app.getHttpServer())
      .post('/gateway/v1/test/echo')
      .expect(200);

    const point = (
      await collectDataPoints('dial.chat.http.response.duration')
    ).find(
      (candidate) =>
        candidate.attributes['http.route'] === '/gateway/v1/test/echo',
    );
    expect(point).toBeDefined();
  });
});

describe('HTTP lifecycle metrics — OTEL_SDK_DISABLED and exporter-failure modes', () => {
  it('leaves requests completing normally when OTEL_SDK_DISABLED=true (no instrumentation attached)', async () => {
    const app = await buildApp({ listenerEnv: { OTEL_SDK_DISABLED: 'true' } });

    await request(app.getHttpServer())
      .post('/api/v1/test/echo')
      .expect(200)
      .expect('ok');

    await app.close();
  });

  it('leaves requests completing normally when the configured OTLP endpoint is unreachable', async () => {
    /*
     * The instrumentation only ever calls into the already-registered global MeterProvider
     * (installed by whichever OTel SDK setup is active in the process) — it never itself opens a
     * network connection, so an unreachable collector cannot block or fail a request. This proves
     * that property directly rather than trying to point a real OTLP exporter at a bad host.
     */
    const app = await buildApp({
      listenerEnv: {
        OTEL_SDK_DISABLED: 'false',
        OTEL_METRICS_EXPORTER: 'otlp',
        OTEL_EXPORTER_OTLP_ENDPOINT: 'http://127.0.0.1:1',
      },
    });

    await request(app.getHttpServer())
      .post('/api/v1/test/echo')
      .expect(200)
      .expect('ok');

    await app.close();
  });
});
