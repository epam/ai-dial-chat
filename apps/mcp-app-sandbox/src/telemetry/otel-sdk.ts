import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import type { Instrumentation } from '@opentelemetry/instrumentation';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import {
  resourceFromAttributes,
  type Resource,
} from '@opentelemetry/resources';
import type { LogRecordProcessor } from '@opentelemetry/sdk-logs';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import type { IMetricReader } from '@opentelemetry/sdk-metrics';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import type { SpanProcessor } from '@opentelemetry/sdk-trace-base';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import * as packageJson from '../../package.json';
import { isExcludedFromTelemetry } from './excluded-paths';
import {
  MetricsExporter,
  parseOtelConfig,
  SingleSignalExporter,
} from './otel-config';

/*
 * `main.ts` imports this module first so `HttpInstrumentation` patches Node's `http` module
 * before Nest or Express can `require()` it. Do not reorder that import, and do not flip
 * `webpack.config.js`'s `optimization: false` without re-verifying this invariant.
 */

/**
 * Builds the OTel resource; `service.name` is `OTEL_SERVICE_NAME` or the package name.
 * @param env - process environment
 */
export const buildResource = (env: NodeJS.ProcessEnv): Resource => {
  const name = packageJson?.name ?? 'mcp-app-sandbox';
  const version = packageJson?.version ?? 'unknown';
  return resourceFromAttributes({
    [ATTR_SERVICE_NAME]: env.OTEL_SERVICE_NAME || name,
    [ATTR_SERVICE_VERSION]: version,
  });
};

/** Builds the generic HTTP server instrumentation; the sandbox makes no outbound requests. */
export const buildInstrumentations = (): Instrumentation[] => [
  new HttpInstrumentation({
    ignoreIncomingRequestHook: (req) => isExcludedFromTelemetry(req.url),
  }),
];

/**
 * Builds span processors for the selected traces exporter.
 * @param tracesExporter - selected exporter
 */
export const buildSpanProcessors = (
  tracesExporter: SingleSignalExporter,
): SpanProcessor[] =>
  tracesExporter === SingleSignalExporter.None
    ? []
    : [new BatchSpanProcessor(new OTLPTraceExporter())];

/**
 * Builds log record processors for the selected logs exporter.
 * @param logsExporter - selected exporter
 */
export const buildLogRecordProcessors = (
  logsExporter: SingleSignalExporter,
): LogRecordProcessor[] =>
  logsExporter === SingleSignalExporter.None
    ? []
    : [new BatchLogRecordProcessor({ exporter: new OTLPLogExporter() })];

/**
 * Builds metric readers. The Prometheus listener binds to loopback unless
 * `OTEL_EXPORTER_PROMETHEUS_HOST` opts in, because the scrape port is unauthenticated.
 * @param metricsExporters - selected exporters
 * @param env - process environment
 */
export const buildMetricReaders = (
  metricsExporters: MetricsExporter[],
  env: NodeJS.ProcessEnv,
): IMetricReader[] =>
  metricsExporters.map((exporter) =>
    exporter === MetricsExporter.Prometheus
      ? new PrometheusExporter({
          host: env.OTEL_EXPORTER_PROMETHEUS_HOST || '127.0.0.1',
          port: Number(env.OTEL_EXPORTER_PROMETHEUS_PORT) || 9464,
          endpoint: '/metrics',
        })
      : new PeriodicExportingMetricReader({
          exporter: new OTLPMetricExporter(),
        }),
  );

let sdk: NodeSDK | undefined;

/**
 * Starts the OTel SDK unless `OTEL_SDK_DISABLED` is true (the default). A startup failure is
 * logged and swallowed so telemetry can never crash the app.
 * @param env - process environment
 */
export const initializeOpenTelemetry = (
  env: NodeJS.ProcessEnv = process.env,
): void => {
  const config = parseOtelConfig(env);
  if (config.disabled) return;

  try {
    sdk = new NodeSDK({
      resource: buildResource(env),
      instrumentations: buildInstrumentations(),
      spanProcessors: buildSpanProcessors(config.tracesExporter),
      logRecordProcessors: buildLogRecordProcessors(config.logsExporter),
      metricReaders: buildMetricReaders(config.metricsExporters, env),
    });
    sdk.start();
  } catch (error) {
    sdk = undefined;
    console.error(
      'OpenTelemetry failed to start; continuing without it',
      error,
    );
  }
};

/**
 * Races the SDK shutdown against a timeout so an unreachable collector cannot block container
 * termination past the orchestrator's grace period.
 * @param timeoutMs - maximum wait
 * @param shutdownFn - overridable for tests
 */
export const shutdownOpenTelemetry = async (
  timeoutMs = 5000,
  shutdownFn: () => Promise<void> = () => sdk?.shutdown() ?? Promise.resolve(),
): Promise<void> => {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      shutdownFn(),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

initializeOpenTelemetry();
