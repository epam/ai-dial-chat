import pkg from '@/../../package.json';
import { OTLPLogExporter as OTLPLogExporterHTTP } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPMetricExporter as OTLPMetricExporterHTTP } from '@opentelemetry/exporter-metrics-otlp-http';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino';
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK, logs } from '@opentelemetry/sdk-node';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-node';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

//For the opentelemetry debugging uncomment line below
// For troubleshooting, set the log level to DiagLogLevel.DEBUG
// diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

const httpInstrumentation = new HttpInstrumentation({
  ignoreIncomingRequestHook: (req) => {
    return req.url === '/api/health';
  },
});
const pinoInstrumentation = new PinoInstrumentation();

const metricReader = getMetricExporter(process.env.OTEL_METRICS_EXPORTER);
const defaultTraceExporter = new OTLPTraceExporter();
const defaultSpanProcessor = new SimpleSpanProcessor(defaultTraceExporter);

const logExporter = new OTLPLogExporterHTTP();
const logRecordProcessor = new logs.BatchLogRecordProcessor(logExporter);

const sdk = new NodeSDK({
  metricReaders: [metricReader],
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]:
      process.env.OTEL_SERVICE_NAME || pkg.name || 'dial-chat',
    [ATTR_SERVICE_VERSION]: pkg.version,
  }),
  instrumentations: [
    httpInstrumentation,
    new FetchInstrumentation(),
    new UndiciInstrumentation({
      requestHook: (span, request) => {
        span.updateName(`${request.method} ${request.origin}${request.path}`);
      },
    }),
    pinoInstrumentation,
  ],
  spanProcessors: [defaultSpanProcessor],
  logRecordProcessors: [logRecordProcessor],
});
sdk.start();

function getMetricExporter(metricsExporterType: string | undefined) {
  if (!metricsExporterType || metricsExporterType !== 'otlp') {
    return new PrometheusExporter({
      port: 9464,
      endpoint: '/metrics',
    });
  }
  const metricExporterHTTP = new OTLPMetricExporterHTTP();
  return new PeriodicExportingMetricReader({
    exporter: metricExporterHTTP,
  });
}
