// eslint-disable-next-line @nx/enforce-module-boundaries
import pkg from '../../../package.json';

import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
// import { OTLPMetricExporter as OTLPMetricExporterHTTP } from '@opentelemetry/exporter-metrics-otlp-http';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { OTLPTraceExporter as OTLPTraceExporterGRPC } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
// import { GrpcInstrumentation } from '@opentelemetry/instrumentation-grpc';
// import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
// import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino';
import { Resource } from '@opentelemetry/resources';
import {
  MetricReader,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
// import { SpanExporter } from '@opentelemetry/sdk-trace-base';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

interface Exporters {
  spanProcessor: SimpleSpanProcessor;
  metricReader: MetricReader | PrometheusExporter | undefined;
}

const instrumentation = getNodeAutoInstrumentations({
  //disable fs instrumentation to reduce noise
  '@opentelemetry/instrumentation-fs': {
    enabled: false,
  },
});
// For troubleshooting, set the log level to DiagLogLevel.DEBUG
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

const { spanProcessor, metricReader } = getExporters(
  process.env.OTEL_METRICS_EXPORTER,
);

const sdk = new NodeSDK({
  metricReader: metricReader,
  resource: Resource.default().merge(
    new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]:
        process.env.OTEL_SERVICE_NAME || pkg.name || 'dial-chat',
      [SemanticResourceAttributes.SERVICE_VERSION]: pkg.version,
    }),
  ),
  instrumentations: [instrumentation],
  // spanProcessor,
  spanProcessors: [spanProcessor],
});
sdk.start();

function getExporters(metricsExporterType: string | undefined): Exporters {
  if (!metricsExporterType || metricsExporterType !== 'otlp') {
    const traceExporter = new OTLPTraceExporter();
    const defaultMetricExporter = new PrometheusExporter({
      port: 9464,
      endpoint: '/metrics',
    });
    return {
      spanProcessor: new SimpleSpanProcessor(traceExporter),
      metricReader: defaultMetricExporter,
    };
  }

  const metricExporterGRPC = new OTLPMetricExporter();
  const periodicMetricReaderGRPC = new PeriodicExportingMetricReader({
    exporter: metricExporterGRPC,
  });
  const traceExporterGRPC = new OTLPTraceExporterGRPC({});
  return {
    spanProcessor: new SimpleSpanProcessor(traceExporterGRPC),
    metricReader: periodicMetricReaderGRPC,
  };
}

// const periodicMetricReaderHTTP = new PeriodicExportingMetricReader({
//   exporter: metricExporterHTTP,
// });

// let spanProcessor: SimpleSpanProcessor | undefined;
// let metricReader: MetricReader | PrometheusExporter | undefined;
// let traceExporter: SpanExporter | undefined;
// if (process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT) {
//   traceExporter = new OTLPTraceExporter({
//     url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
//     headers: {},
//   });
//   spanProcessor = new SimpleSpanProcessor(traceExporter);
// }

// if (
//   process.env.OTEL_METRICS_EXPORTER &&
//   process.env.TELEMETRY_PROTOCOL === 'otlp'
// ) {
//   spanProcessor = new SimpleSpanProcessor(traceExporterGRPC);
//   metricReader = periodicMetricReaderGRPC;
// } else {
//   spanProcessor = new SimpleSpanProcessor(traceExporter);
//   const defaultMetricExporter = new PrometheusExporter({
//     port: 9464,
//     endpoint: '/metrics',
//   });
//   metricReader = defaultMetricExporter;
// }

// const instrumentations = [
//   ,
//   // new HttpInstrumentation(),
//   // new PinoInstrumentation(),
//   // new GrpcInstrumentation(),
// ];
