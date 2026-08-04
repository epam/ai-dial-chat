import net from 'net';
import { metrics } from '@opentelemetry/api';
import type { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { MeterProvider } from '@opentelemetry/sdk-metrics';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildMetricReaders } from '../otel-sdk';

/*
 * `PrometheusExporter`'s own `port` option treats `0` as "not provided" (`config.port ||
 * Number(process.env.OTEL_EXPORTER_PROMETHEUS_PORT) || DEFAULT_PORT`, and `0` is falsy in JS) —
 * it does not support asking the OS for a free port directly. Ask a throwaway server for one
 * instead, close it, then bind the real exporter to that specific port number.
 */
const getFreePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, () => {
      const { port } = probe.address() as net.AddressInfo;
      probe.close(() => resolve(port));
    });
  });

describe('Prometheus scrape endpoint', () => {
  let exporter: PrometheusExporter;
  let port: number;

  beforeAll(async () => {
    port = await getFreePort();

    [exporter] = buildMetricReaders(['prometheus'], {
      OTEL_EXPORTER_PROMETHEUS_HOST: '127.0.0.1',
      OTEL_EXPORTER_PROMETHEUS_PORT: String(port),
    }) as [PrometheusExporter];

    const meterProvider = new MeterProvider({ readers: [exporter] });
    metrics.setGlobalMeterProvider(meterProvider);

    await exporter.startServer();

    const meter = metrics.getMeter('prometheus-endpoint-test');
    meter
      .createHistogram('http.server.request.duration', { unit: 's' })
      .record(0.1, { 'http.request.method': 'GET' });
  });

  afterAll(async () => {
    await exporter.shutdown();
    /*
     * Deregister the global MeterProvider this spec installed — see `http-metrics.spec.ts` for
     * why every OTel-global-mutating spec cleans up after itself.
     */
    metrics.disable();
  });

  it('serves the recorded metric over a loopback GET /metrics with the Prometheus content type', async () => {
    const response = await fetch(`http://127.0.0.1:${port}/metrics`);

    expect(response.status).toBe(200);
    /*
     * Verified against the installed `@opentelemetry/exporter-prometheus@0.221.0`: it
     * unconditionally sets `content-type: text/plain` (see PrometheusExporter.js's
     * `_exportMetrics`), not the `text/plain; version=0.0.4; charset=utf-8` Prometheus exposition
     * format string design.md assumed — that suffix was true of older versions of this package.
     */
    expect(response.headers.get('content-type')).toBe('text/plain');

    const body = await response.text();
    expect(body).toContain('http_server_request_duration');
  });
});
