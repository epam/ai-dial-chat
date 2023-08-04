import pkg from './package.json';

import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { Resource } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { SpanExporter } from '@opentelemetry/sdk-trace-base';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

const exporter = new PrometheusExporter({
  port: 9464,
  endpoint: '/metrics',
});

let traceExporter: SpanExporter | undefined;
if (process.env.TRACES_URL) {
  traceExporter = new OTLPTraceExporter({
    url: 'http://localhost:4318/v1/traces',
    headers: {},
  }) as SpanExporter;
}

const sdk = new NodeSDK({
  traceExporter,
  metricReader: exporter,
  resource: Resource.default().merge(
    new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: pkg.name,
      [SemanticResourceAttributes.SERVICE_VERSION]: pkg.version,
    }),
  ),
  instrumentations: [new HttpInstrumentation()],
});
sdk.start();
