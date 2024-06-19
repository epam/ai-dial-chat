import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';

const collectorOptions = {
  // url is optional and can be omitted - default is http://localhost:4317
  // Unix domain sockets are also supported: 'unix:///path/to/socket.sock'
  url: process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT,
};
const metricExporterPrometheus = new PrometheusExporter({
  port: 9464,
  endpoint: '/metrics',
});

const metricExporterGRPC = new OTLPMetricExporter(collectorOptions);
const periodicMetricReaderGRPC = new PeriodicExportingMetricReader({
  exporter: metricExporterGRPC,
});

const meterProvider = new MeterProvider({
  readers: [periodicMetricReaderGRPC, metricExporterPrometheus],
});

// meterProvider.addMetricReader(
//   new PeriodicExportingMetricReader({
//     exporter: metricExporter,
//   }),
// );

['SIGINT', 'SIGTERM'].forEach((signal) => {
  process.on(signal, () => meterProvider.shutdown().catch(console.error));
});
