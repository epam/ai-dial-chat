import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import {
  BasicTracerProvider,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';

const collectorOptions = {
  // url is optional and can be omitted - default is http://localhost:4317
  // Unix domain sockets are also supported: 'unix:///path/to/socket.sock'
  url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
};

const provider = new BasicTracerProvider();
const exporter = new OTLPTraceExporter(collectorOptions);
provider.addSpanProcessor(new SimpleSpanProcessor(exporter));

provider.register();
['SIGINT', 'SIGTERM'].forEach((signal) => {
  process.on(signal, () => provider.shutdown().catch(console.error));
});
