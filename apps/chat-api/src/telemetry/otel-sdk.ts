import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import type { Instrumentation } from '@opentelemetry/instrumentation';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici';
import {
  resourceFromAttributes,
  type Resource,
} from '@opentelemetry/resources';
import type {
  LogRecordExporter,
  LogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import type { IMetricReader } from '@opentelemetry/sdk-metrics';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import type {
  SpanExporter,
  SpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import packageJson from '../../package.json';
import { isExcludedFromTelemetry } from './excluded-paths';
import type { MetricsExporter, SingleSignalExporter } from './otel-config';
import { parseOtelConfig } from './otel-config';

/*
 * `main.ts` imports this module first, before `reflect-metadata`, Nest, Express, or any DIAL
 * SDK client — so `HttpInstrumentation`/`UndiciInstrumentation` patch Node's `http`/`https`/
 * `undici` modules before anything else can `require()` them. Do not reorder that import, and
 * do not flip `apps/chat-api/webpack.config.js`'s `optimization: false` without re-verifying
 * this invariant (see design.md Risks).
 */

export const buildResource = (env: NodeJS.ProcessEnv): Resource => {
  const serviceName = env.OTEL_SERVICE_NAME || packageJson.name || 'chat-api';

  return resourceFromAttributes({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: packageJson.version,
  });
};

export const buildInstrumentations = (): Instrumentation[] => [
  new HttpInstrumentation({
    ignoreIncomingRequestHook: (req) => isExcludedFromTelemetry(req.url),
  }),
  new UndiciInstrumentation(),
];

export const buildSpanProcessors = (
  tracesExporter: SingleSignalExporter,
  exporterOverride?: SpanExporter,
): SpanProcessor[] => {
  if (tracesExporter === 'none') return [];
  return [new BatchSpanProcessor(exporterOverride ?? new OTLPTraceExporter())];
};

export const buildLogRecordProcessors = (
  logsExporter: SingleSignalExporter,
  exporterOverride?: LogRecordExporter,
): LogRecordProcessor[] => {
  if (logsExporter === 'none') return [];
  return [
    new BatchLogRecordProcessor({
      exporter: exporterOverride ?? new OTLPLogExporter(),
    }),
  ];
};

export const buildMetricReaders = (
  metricsExporters: MetricsExporter[],
  env: NodeJS.ProcessEnv,
): IMetricReader[] =>
  metricsExporters.map((exporter) => {
    if (exporter === 'prometheus') {
      return new PrometheusExporter({
        /*
         * Default to loopback-only: the scrape port has no authentication, so
         * binding to all interfaces would expose request rates, route
         * templates, and status codes to anything reachable on the
         * container's network. Operators that run a scrape agent outside the
         * pod/container network namespace must explicitly opt in via
         * OTEL_EXPORTER_PROMETHEUS_HOST.
         */
        host: env.OTEL_EXPORTER_PROMETHEUS_HOST ?? '127.0.0.1',
        port: Number(env.OTEL_EXPORTER_PROMETHEUS_PORT) || 9464,
        endpoint: '/metrics',
      });
    }
    return new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter(),
    });
  });

let sdk: NodeSDK | undefined;

export const initializeOpenTelemetry = (
  env: NodeJS.ProcessEnv = process.env,
): void => {
  const config = parseOtelConfig(env);
  if (config.disabled) return;

  sdk = new NodeSDK({
    resource: buildResource(env),
    instrumentations: buildInstrumentations(),
    spanProcessors: buildSpanProcessors(config.tracesExporter),
    logRecordProcessors: buildLogRecordProcessors(config.logsExporter),
    metricReaders: buildMetricReaders(config.metricsExporters, env),
  });
  sdk.start();
};

/*
 * Races the SDK's own `shutdown()` against a bounded internal timeout so a hung exporter or
 * unreachable collector can never block container termination past the orchestrator's grace
 * period. `shutdownFn` defaults to the real singleton but is overridable so tests can exercise
 * the timeout behavior with a deliberately slow/fast fake, without constructing a real SDK.
 */
export const shutdownOpenTelemetry = async (
  timeoutMs = 5000,
  shutdownFn: () => Promise<void> = () => sdk?.shutdown() ?? Promise.resolve(),
): Promise<void> => {
  await Promise.race([
    shutdownFn(),
    new Promise<void>((resolve) => {
      setTimeout(resolve, timeoutMs);
    }),
  ]);
};

initializeOpenTelemetry();
