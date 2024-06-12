import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';

const collectorOptions = {
  // url is optional and can be omitted - default is http://localhost:4317
  // Unix domain sockets are also supported: 'unix:///path/to/socket.sock'
  url: process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT,
  exportIntervalMillis: 1000,
};

const metricExporter = new OTLPMetricExporter(collectorOptions);
const meterProvider = new MeterProvider({
  readers: [
    new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: 1000,
    }),
  ],
});

['SIGINT', 'SIGTERM'].forEach((signal) => {
  process.on(signal, () => meterProvider.shutdown().catch(console.error));
});
