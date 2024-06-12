// eslint-disable-next-line @nx/enforce-module-boundaries
import pkg from '../../../package.json';

import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino';
import { Resource } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { SpanExporter } from '@opentelemetry/sdk-trace-base';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

const exporter = new PrometheusExporter({
  port: 9464,
  endpoint: '/metrics',
});

let spanProcessor: SimpleSpanProcessor | undefined;
let traceExporter: SpanExporter | undefined;
if (process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT) {
  traceExporter = new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
    headers: {},
  });
  spanProcessor = new SimpleSpanProcessor(traceExporter);
}

const sdk = new NodeSDK({
  metricReader: exporter,
  resource: Resource.default().merge(
    new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: pkg.name,
      [SemanticResourceAttributes.SERVICE_VERSION]: pkg.version,
    }),
  ),
  instrumentations: [new HttpInstrumentation(), new PinoInstrumentation()],
  spanProcessor,
});
sdk.start();
