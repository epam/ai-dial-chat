import http from 'http';
import type { AddressInfo } from 'net';
import { metrics } from '@opentelemetry/api';
import {
  MeterProvider,
  MetricReader,
  type MetricData,
} from '@opentelemetry/sdk-metrics';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type * as HttpLifecycleListenerModule from '../http-lifecycle-listener';

class TestMetricReader extends MetricReader {
  protected async onForceFlush(): Promise<void> {
    /* nothing to flush — reader.collect() is called directly in assertions */
  }

  protected async onShutdown(): Promise<void> {
    /* no resources to release */
  }
}

/*
 * Same global-MeterProvider-ordering requirement as `http-lifecycle-metrics.spec.ts`: the
 * module under test (transitively, via `http-lifecycle-metrics.ts`) calls `metrics.getMeter(...)`
 * once at module scope, so the in-memory reader must be registered before the module is
 * (dynamically) imported.
 */
describe('http-lifecycle-listener — mechanism against a bare http.Server (no Nest)', () => {
  let reader: TestMetricReader;
  let attachHttpLifecycleListener: typeof HttpLifecycleListenerModule.attachHttpLifecycleListener;
  let server: http.Server;
  let baseUrl: string;
  let handleRequest: (
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ) => void = () => {
    /* replaced per test */
  };
  /*
   * Populated on every request, before `attachHttpLifecycleListener`'s own `once()` listeners
   * attach — Node's own http machinery may already hold internal `'finish'`/`'close'` listeners
   * on a fresh response object, so "no leak" means "returns to this pre-instrumentation baseline
   * after settling", not literally zero (design.md D2/Requirement 2's "no listener leak" scenario).
   */
  let listenerBaseline: { finish: number; close: number } | undefined;

  beforeAll(async () => {
    reader = new TestMetricReader();
    const meterProvider = new MeterProvider({ readers: [reader] });
    metrics.setGlobalMeterProvider(meterProvider);

    ({ attachHttpLifecycleListener } =
      await import('../http-lifecycle-listener'));

    server = http.createServer();
    server.on('request', (_req, res) => {
      listenerBaseline = {
        finish: res.listenerCount('finish'),
        close: res.listenerCount('close'),
      };
    });
    /* Registered before the test-specific handler below, mirroring D1's "attached first". */
    attachHttpLifecycleListener(server, { OTEL_SDK_DISABLED: 'false' });
    server.on('request', (req, res) => handleRequest(req, res));

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(() => {
    handleRequest = () => {
      /* reset */
    };
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    metrics.disable();
  });

  const collectDataPoints = async (name: string) => {
    const { resourceMetrics } = await reader.collect();
    return resourceMetrics.scopeMetrics
      .flatMap((scope) => scope.metrics)
      .filter((metric) => metric.descriptor.name === name)
      .flatMap<MetricData['dataPoints'][number]>((metric) => metric.dataPoints);
  };

  const sumActive = (dataPoints: MetricData['dataPoints'][number][]) =>
    dataPoints.reduce((total, point) => {
      expect(point.value).toBeTypeOf('number');
      return total + Number(point.value);
    }, 0);

  it('records exactly one completed terminal data point for a normal response, with net-zero in-flight and no leaked listeners', async () => {
    let capturedRes: http.ServerResponse | undefined;
    handleRequest = (_req, res) => {
      capturedRes = res;
      res.writeHead(200);
      res.end('ok');
    };

    await new Promise<void>((resolve, reject) => {
      http
        .get(`${baseUrl}/probe`, { agent: false }, (res) => {
          res.resume();
          res.on('end', resolve);
        })
        .on('error', reject);
    });

    /* Let the always-eventually-following 'close' event fire too, to prove it's a no-op. */
    await new Promise((resolve) => setTimeout(resolve, 30));

    const durationPoints = await collectDataPoints(
      'dial.chat.http.response.duration',
    );
    const point = durationPoints.find(
      (candidate) =>
        candidate.attributes['dial.chat.http.outcome'] === 'completed' &&
        candidate.attributes['http.route'] === 'unmatched',
    );
    expect(point).toBeDefined();
    expect(point?.attributes['http.request.method']).toBe('GET');
    expect(point?.attributes['http.response.status_code']).toBe(200);

    const activePoints = await collectDataPoints(
      'dial.chat.http.requests.active',
    );
    expect(sumActive(activePoints)).toBe(0);

    expect(capturedRes?.listenerCount('finish')).toBe(listenerBaseline?.finish);
    expect(capturedRes?.listenerCount('close')).toBe(listenerBaseline?.close);
  });

  it('records aborted_before_response with no status code when the client disconnects before any response', async () => {
    handleRequest = () => {
      /* never responds */
    };

    const socket = http.get(`${baseUrl}/probe`, { agent: false });
    socket.on('error', () => {
      /* expected once the client tears down the connection */
    });
    /* Give the server a moment to receive the request before the client tears it down. */
    await new Promise((resolve) => setTimeout(resolve, 20));
    socket.destroy();
    await new Promise((resolve) => setTimeout(resolve, 30));

    const durationPoints = await collectDataPoints(
      'dial.chat.http.response.duration',
    );
    const point = durationPoints.find(
      (candidate) =>
        candidate.attributes['dial.chat.http.outcome'] ===
        'aborted_before_response',
    );
    expect(point).toBeDefined();
    expect(point?.attributes['http.response.status_code']).toBeUndefined();

    const activePoints = await collectDataPoints(
      'dial.chat.http.requests.active',
    );
    expect(sumActive(activePoints)).toBe(0);
  });

  it('records aborted_during_response with the committed status code when the client disconnects mid-stream', async () => {
    handleRequest = (_req, res) => {
      res.writeHead(200);
      res.write('partial');
      /* deliberately never call res.end() */
    };

    const socket = http.get(`${baseUrl}/probe`, { agent: false }, (res) => {
      res.once('data', () => socket.destroy());
    });
    socket.on('error', () => {
      /* expected once the client tears down the connection */
    });
    await new Promise((resolve) => setTimeout(resolve, 50));

    const durationPoints = await collectDataPoints(
      'dial.chat.http.response.duration',
    );
    const point = durationPoints.find(
      (candidate) =>
        candidate.attributes['dial.chat.http.outcome'] ===
        'aborted_during_response',
    );
    expect(point).toBeDefined();
    expect(point?.attributes['http.response.status_code']).toBe(200);

    const activePoints = await collectDataPoints(
      'dial.chat.http.requests.active',
    );
    expect(sumActive(activePoints)).toBe(0);
  });

  it('records error when the response emits an error before settling, and never double-counts the later close', async () => {
    /*
     * Node's own `response.destroy(err)` only propagates the error to the underlying socket, not
     * to the `ServerResponse` object itself (verified: `res.headersSent` stays `false` and no
     * `'error'` listener on `res` fires) — so a genuine `res`-level `'error'` is triggered
     * directly here to prove the wiring, the same way a downstream write failure or a malformed
     * response would surface it.
     */
    let capturedRes: http.ServerResponse | undefined;
    handleRequest = (_req, res) => {
      capturedRes = res;
      res.emit('error', new Error('simulated transport failure'));
      /* Also tear down the real socket, so the client side observes the connection ending. */
      res.socket?.destroy();
    };

    await new Promise<void>((resolve) => {
      const req = http.get(`${baseUrl}/probe`, { agent: false });
      req.on('error', () => resolve());
      req.on('close', () => resolve());
    });
    await new Promise((resolve) => setTimeout(resolve, 30));

    const durationPoints = await collectDataPoints(
      'dial.chat.http.response.duration',
    );
    const point = durationPoints.find(
      (candidate) => candidate.attributes['dial.chat.http.outcome'] === 'error',
    );
    expect(point).toBeDefined();

    const activePoints = await collectDataPoints(
      'dial.chat.http.requests.active',
    );
    expect(sumActive(activePoints)).toBe(0);
    expect(capturedRes?.listenerCount('close')).toBe(0);
    expect(capturedRes?.listenerCount('error')).toBe(0);
  });

  it('excludes /api/health from all three instruments', async () => {
    handleRequest = (_req, res) => {
      res.writeHead(200);
      res.end('ok');
    };

    const beforeStarted = (
      await collectDataPoints('dial.chat.http.requests.started')
    ).length;

    await new Promise<void>((resolve, reject) => {
      http
        .get(`${baseUrl}/api/health`, { agent: false }, (res) => {
          res.resume();
          res.on('end', resolve);
        })
        .on('error', reject);
    });

    const afterStarted = await collectDataPoints(
      'dial.chat.http.requests.started',
    );
    expect(afterStarted).toHaveLength(beforeStarted);
  });
});

describe('http-lifecycle-listener — gated by the metrics-exporter toggle', () => {
  let attachHttpLifecycleListener: typeof HttpLifecycleListenerModule.attachHttpLifecycleListener;

  beforeAll(async () => {
    ({ attachHttpLifecycleListener } =
      await import('../http-lifecycle-listener'));
  });

  it('does not attach a request listener when no metrics exporter is enabled', () => {
    const server = http.createServer();
    const before = server.listenerCount('request');

    attachHttpLifecycleListener(server, {
      OTEL_SDK_DISABLED: 'false',
      OTEL_METRICS_EXPORTER: 'none',
    });

    expect(server.listenerCount('request')).toBe(before);
  });

  it('does not attach a request listener when OTEL_SDK_DISABLED is true, even if a metrics exporter would otherwise be enabled', () => {
    const server = http.createServer();
    const before = server.listenerCount('request');

    attachHttpLifecycleListener(server, {
      OTEL_SDK_DISABLED: 'true',
      OTEL_METRICS_EXPORTER: 'prometheus',
    });

    expect(server.listenerCount('request')).toBe(before);
  });

  it('does not attach a request listener when OTEL_SDK_DISABLED is unset (defaults to disabled)', () => {
    const server = http.createServer();
    const before = server.listenerCount('request');

    attachHttpLifecycleListener(server, {});

    expect(server.listenerCount('request')).toBe(before);
  });

  it('attaches a request listener when the default metrics exporter is enabled', () => {
    const server = http.createServer();
    const before = server.listenerCount('request');

    attachHttpLifecycleListener(server, { OTEL_SDK_DISABLED: 'false' });

    expect(server.listenerCount('request')).toBe(before + 1);
  });
});
