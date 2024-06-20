// // import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
// // import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
// // import {
// //   BasicTracerProvider,
// //   SimpleSpanProcessor,
// // } from '@opentelemetry/sdk-trace-base';
// // // For troubleshooting, set the log level to DiagLogLevel.DEBUG
// // diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
// // const collectorOptions = {
// //   // url is optional and can be omitted - default is http://localhost:4317
// //   // Unix domain sockets are also supported: 'unix:///path/to/socket.sock'
// //   url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
// // };
// // const provider = new BasicTracerProvider();
// // const exporter = new OTLPTraceExporter(collectorOptions);
// // provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
// // provider.register();
// // ['SIGINT', 'SIGTERM'].forEach((signal) => {
// //   process.on(signal, () => provider.shutdown().catch(console.error));
// // });
// 'use strict';

// import { meterProvider } from './opentelemetryMetricsProvider';

// import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
// import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
// import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
// import { OTLPTraceExporter as OTLPTraceExporterGRPC } from '@opentelemetry/exporter-trace-otlp-grpc';
// import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
// // import { OTLPTraceExporter as OTLPTraceExporterHTTP } from '@opentelemetry/exporter-trace-otlp-http';
// import { registerInstrumentations } from '@opentelemetry/instrumentation';
// import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
// // import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
// // import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino';
// // import { Resource } from '@opentelemetry/resources';
// import {
//   BasicTracerProvider, //   ConsoleSpanExporter,
//   SimpleSpanProcessor,
// } from '@opentelemetry/sdk-trace-base';

// // import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
// // import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
// // import {
// //   BasicTracerProvider,
// //   SimpleSpanProcessor,
// // } from '@opentelemetry/sdk-trace-base';
// // // For troubleshooting, set the log level to DiagLogLevel.DEBUG
// // diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
// // const collectorOptions = {
// //   // url is optional and can be omitted - default is http://localhost:4317
// //   // Unix domain sockets are also supported: 'unix:///path/to/socket.sock'
// //   url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
// // };
// // const provider = new BasicTracerProvider();
// // const exporter = new OTLPTraceExporter(collectorOptions);
// // provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
// // provider.register();
// // ['SIGINT', 'SIGTERM'].forEach((signal) => {
// //   process.on(signal, () => provider.shutdown().catch(console.error));
// // });

// // import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
// // import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
// // import {
// //   BasicTracerProvider,
// //   SimpleSpanProcessor,
// // } from '@opentelemetry/sdk-trace-base';
// // // For troubleshooting, set the log level to DiagLogLevel.DEBUG
// // diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
// // const collectorOptions = {
// //   // url is optional and can be omitted - default is http://localhost:4317
// //   // Unix domain sockets are also supported: 'unix:///path/to/socket.sock'
// //   url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
// // };
// // const provider = new BasicTracerProvider();
// // const exporter = new OTLPTraceExporter(collectorOptions);
// // provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
// // provider.register();
// // ['SIGINT', 'SIGTERM'].forEach((signal) => {
// //   process.on(signal, () => provider.shutdown().catch(console.error));
// // });

// // import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
// // import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
// // import {
// //   BasicTracerProvider,
// //   SimpleSpanProcessor,
// // } from '@opentelemetry/sdk-trace-base';
// // // For troubleshooting, set the log level to DiagLogLevel.DEBUG
// // diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
// // const collectorOptions = {
// //   // url is optional and can be omitted - default is http://localhost:4317
// //   // Unix domain sockets are also supported: 'unix:///path/to/socket.sock'
// //   url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
// // };
// // const provider = new BasicTracerProvider();
// // const exporter = new OTLPTraceExporter(collectorOptions);
// // provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
// // provider.register();
// // ['SIGINT', 'SIGTERM'].forEach((signal) => {
// //   process.on(signal, () => provider.shutdown().catch(console.error));
// // });

// // import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
// // import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
// // import {
// //   BasicTracerProvider,
// //   SimpleSpanProcessor,
// // } from '@opentelemetry/sdk-trace-base';
// // // For troubleshooting, set the log level to DiagLogLevel.DEBUG
// // diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
// // const collectorOptions = {
// //   // url is optional and can be omitted - default is http://localhost:4317
// //   // Unix domain sockets are also supported: 'unix:///path/to/socket.sock'
// //   url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
// // };
// // const provider = new BasicTracerProvider();
// // const exporter = new OTLPTraceExporter(collectorOptions);
// // provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
// // provider.register();
// // ['SIGINT', 'SIGTERM'].forEach((signal) => {
// //   process.on(signal, () => provider.shutdown().catch(console.error));
// // });

// // import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
// // import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
// // import {
// //   BasicTracerProvider,
// //   SimpleSpanProcessor,
// // } from '@opentelemetry/sdk-trace-base';
// // // For troubleshooting, set the log level to DiagLogLevel.DEBUG
// // diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
// // const collectorOptions = {
// //   // url is optional and can be omitted - default is http://localhost:4317
// //   // Unix domain sockets are also supported: 'unix:///path/to/socket.sock'
// //   url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
// // };
// // const provider = new BasicTracerProvider();
// // const exporter = new OTLPTraceExporter(collectorOptions);
// // provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
// // provider.register();
// // ['SIGINT', 'SIGTERM'].forEach((signal) => {
// //   process.on(signal, () => provider.shutdown().catch(console.error));
// // });

// diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

// // const exporterHTTP = new OTLPTraceExporterHTTP({
// //   // headers: {
// //   //   foo: 'bar'
// //   // },
// // });

// const exporterGRPC = new OTLPTraceExporterGRPC({
//   // headers: {y
//   //   foo: 'bar'
//   // },
// });

// const traceExporter = new OTLPTraceExporter();

// const provider = new BasicTracerProvider({
//   // resource: Resource.default().merge(
//   //   new Resource({
//   //     [SemanticResourceAttributes.SERVICE_NAME]: pkg.name,
//   //     [SemanticResourceAttributes.SERVICE_VERSION]: pkg.version,
//   //   }),
//   // ),
// });
// provider.addSpanProcessor(new SimpleSpanProcessor(traceExporter));
// provider.addSpanProcessor(new SimpleSpanProcessor(exporterGRPC));
// // provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));
// provider.register();

// registerInstrumentations({
//   tracerProvider: provider,
//   meterProvider: meterProvider,
//   instrumentations: [
//     getNodeAutoInstrumentations({
//       //disable fs instrumentation to reduce noise
//       '@opentelemetry/instrumentation-fs': {
//         enabled: false,
//       },
//     }),
//     // new HttpInstrumentation(),
//   ],
// });

// // import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
// // import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
// // import {
// //   BasicTracerProvider,
// //   SimpleSpanProcessor,
// // } from '@opentelemetry/sdk-trace-base';
// // // For troubleshooting, set the log level to DiagLogLevel.DEBUG
// // diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
// // const collectorOptions = {
// //   // url is optional and can be omitted - default is http://localhost:4317
// //   // Unix domain sockets are also supported: 'unix:///path/to/socket.sock'
// //   url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
// // };
// // const provider = new BasicTracerProvider();
// // const exporter = new OTLPTraceExporter(collectorOptions);
// // provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
// // provider.register();
// // ['SIGINT', 'SIGTERM'].forEach((signal) => {
// //   process.on(signal, () => provider.shutdown().catch(console.error));
// // });

// // import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
// // import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
// // import {
// //   BasicTracerProvider,
// //   SimpleSpanProcessor,
// // } from '@opentelemetry/sdk-trace-base';
// // // For troubleshooting, set the log level to DiagLogLevel.DEBUG
// // diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
// // const collectorOptions = {
// //   // url is optional and can be omitted - default is http://localhost:4317
// //   // Unix domain sockets are also supported: 'unix:///path/to/socket.sock'
// //   url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
// // };
// // const provider = new BasicTracerProvider();
// // const exporter = new OTLPTraceExporter(collectorOptions);
// // provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
// // provider.register();
// // ['SIGINT', 'SIGTERM'].forEach((signal) => {
// //   process.on(signal, () => provider.shutdown().catch(console.error));
// // });

// // import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
// // import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
// // import {
// //   BasicTracerProvider,
// //   SimpleSpanProcessor,
// // } from '@opentelemetry/sdk-trace-base';
// // // For troubleshooting, set the log level to DiagLogLevel.DEBUG
// // diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
// // const collectorOptions = {
// //   // url is optional and can be omitted - default is http://localhost:4317
// //   // Unix domain sockets are also supported: 'unix:///path/to/socket.sock'
// //   url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
// // };
// // const provider = new BasicTracerProvider();
// // const exporter = new OTLPTraceExporter(collectorOptions);
// // provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
// // provider.register();
// // ['SIGINT', 'SIGTERM'].forEach((signal) => {
// //   process.on(signal, () => provider.shutdown().catch(console.error));
// // });

// // import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

// // import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
// // import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
// // import {
// //   BasicTracerProvider,
// //   SimpleSpanProcessor,
// // } from '@opentelemetry/sdk-trace-base';
// // // For troubleshooting, set the log level to DiagLogLevel.DEBUG
// // diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
// // const collectorOptions = {
// //   // url is optional and can be omitted - default is http://localhost:4317
// //   // Unix domain sockets are also supported: 'unix:///path/to/socket.sock'
// //   url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
// // };
// // const provider = new BasicTracerProvider();
// // const exporter = new OTLPTraceExporter(collectorOptions);
// // provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
// // provider.register();
// // ['SIGINT', 'SIGTERM'].forEach((signal) => {
// //   process.on(signal, () => provider.shutdown().catch(console.error));
// // });

// // import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
// // import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
// // import {
// //   BasicTracerProvider,
// //   SimpleSpanProcessor,
// // } from '@opentelemetry/sdk-trace-base';
// // // For troubleshooting, set the log level to DiagLogLevel.DEBUG
// // diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
// // const collectorOptions = {
// //   // url is optional and can be omitted - default is http://localhost:4317
// //   // Unix domain sockets are also supported: 'unix:///path/to/socket.sock'
// //   url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
// // };
// // const provider = new BasicTracerProvider();
// // const exporter = new OTLPTraceExporter(collectorOptions);
// // provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
// // provider.register();
// // ['SIGINT', 'SIGTERM'].forEach((signal) => {
// //   process.on(signal, () => provider.shutdown().catch(console.error));
// // });

// // import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
// // import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
// // import {
// //   BasicTracerProvider,
// //   SimpleSpanProcessor,
// // } from '@opentelemetry/sdk-trace-base';
// // // For troubleshooting, set the log level to DiagLogLevel.DEBUG
// // diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
// // const collectorOptions = {
// //   // url is optional and can be omitted - default is http://localhost:4317
// //   // Unix domain sockets are also supported: 'unix:///path/to/socket.sock'
// //   url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
// // };
// // const provider = new BasicTracerProvider();
// // const exporter = new OTLPTraceExporter(collectorOptions);
// // provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
// // provider.register();
// // ['SIGINT', 'SIGTERM'].forEach((signal) => {
// //   process.on(signal, () => provider.shutdown().catch(console.error));
// // });

// // import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
// // import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
// // import {
// //   BasicTracerProvider,
// //   SimpleSpanProcessor,
// // } from '@opentelemetry/sdk-trace-base';
// // // For troubleshooting, set the log level to DiagLogLevel.DEBUG
// // diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
// // const collectorOptions = {
// //   // url is optional and can be omitted - default is http://localhost:4317
// //   // Unix domain sockets are also supported: 'unix:///path/to/socket.sock'
// //   url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
// // };
// // const provider = new BasicTracerProvider();
// // const exporter = new OTLPTraceExporter(collectorOptions);
// // provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
// // provider.register();
// // ['SIGINT', 'SIGTERM'].forEach((signal) => {
// //   process.on(signal, () => provider.shutdown().catch(console.error));
// // });

// // import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
// // import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
// // import {
// //   BasicTracerProvider,
// //   SimpleSpanProcessor,
// // } from '@opentelemetry/sdk-trace-base';
// // // For troubleshooting, set the log level to DiagLogLevel.DEBUG
// // diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
// // const collectorOptions = {
// //   // url is optional and can be omitted - default is http://localhost:4317
// //   // Unix domain sockets are also supported: 'unix:///path/to/socket.sock'
// //   url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
// // };
// // const provider = new BasicTracerProvider();
// // const exporter = new OTLPTraceExporter(collectorOptions);
// // provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
// // provider.register();
// // ['SIGINT', 'SIGTERM'].forEach((signal) => {
// //   process.on(signal, () => provider.shutdown().catch(console.error));
// // });

// // import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
// // import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
// // import {
// //   BasicTracerProvider,
// //   SimpleSpanProcessor,
// // } from '@opentelemetry/sdk-trace-base';
// // // For troubleshooting, set the log level to DiagLogLevel.DEBUG
// // diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
// // const collectorOptions = {
// //   // url is optional and can be omitted - default is http://localhost:4317
// //   // Unix domain sockets are also supported: 'unix:///path/to/socket.sock'
// //   url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
// // };
// // const provider = new BasicTracerProvider();
// // const exporter = new OTLPTraceExporter(collectorOptions);
// // provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
// // provider.register();
// // ['SIGINT', 'SIGTERM'].forEach((signal) => {
// //   process.on(signal, () => provider.shutdown().catch(console.error));
// // });

// // import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
// // import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
// // import {
// //   BasicTracerProvider,
// //   SimpleSpanProcessor,
// // } from '@opentelemetry/sdk-trace-base';
// // // For troubleshooting, set the log level to DiagLogLevel.DEBUG
// // diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
// // const collectorOptions = {
// //   // url is optional and can be omitted - default is http://localhost:4317
// //   // Unix domain sockets are also supported: 'unix:///path/to/socket.sock'
// //   url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
// // };
// // const provider = new BasicTracerProvider();
// // const exporter = new OTLPTraceExporter(collectorOptions);
// // provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
// // provider.register();
// // ['SIGINT', 'SIGTERM'].forEach((signal) => {
// //   process.on(signal, () => provider.shutdown().catch(console.error));
// // });

// // import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
// // import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
// // import {
// //   BasicTracerProvider,
// //   SimpleSpanProcessor,
// // } from '@opentelemetry/sdk-trace-base';
// // // For troubleshooting, set the log level to DiagLogLevel.DEBUG
// // diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
// // const collectorOptions = {
// //   // url is optional and can be omitted - default is http://localhost:4317
// //   // Unix domain sockets are also supported: 'unix:///path/to/socket.sock'
// //   url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
// // };
// // const provider = new BasicTracerProvider();
// // const exporter = new OTLPTraceExporter(collectorOptions);
// // provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
// // provider.register();
// // ['SIGINT', 'SIGTERM'].forEach((signal) => {
// //   process.on(signal, () => provider.shutdown().catch(console.error));
// // });

// // import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
// // import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
// // import {
// //   BasicTracerProvider,
// //   SimpleSpanProcessor,
// // } from '@opentelemetry/sdk-trace-base';
// // // For troubleshooting, set the log level to DiagLogLevel.DEBUG
// // diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
// // const collectorOptions = {
// //   // url is optional and can be omitted - default is http://localhost:4317
// //   // Unix domain sockets are also supported: 'unix:///path/to/socket.sock'
// //   url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
// // };
// // const provider = new BasicTracerProvider();
// // const exporter = new OTLPTraceExporter(collectorOptions);
// // provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
// // provider.register();
// // ['SIGINT', 'SIGTERM'].forEach((signal) => {
// //   process.on(signal, () => provider.shutdown().catch(console.error));
// // });

// // import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
// // import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
// // import {
// //   BasicTracerProvider,
// //   SimpleSpanProcessor,
// // } from '@opentelemetry/sdk-trace-base';
// // // For troubleshooting, set the log level to DiagLogLevel.DEBUG
// // diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
// // const collectorOptions = {
// //   // url is optional and can be omitted - default is http://localhost:4317
// //   // Unix domain sockets are also supported: 'unix:///path/to/socket.sock'
// //   url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
// // };
// // const provider = new BasicTracerProvider();
// // const exporter = new OTLPTraceExporter(collectorOptions);
// // provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
// // provider.register();
// // ['SIGINT', 'SIGTERM'].forEach((signal) => {
// //   process.on(signal, () => provider.shutdown().catch(console.error));
// // });

// // import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
// // import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
// // import {
// //   BasicTracerProvider,
// //   SimpleSpanProcessor,
// // } from '@opentelemetry/sdk-trace-base';
// // // For troubleshooting, set the log level to DiagLogLevel.DEBUG
// // diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
// // const collectorOptions = {
// //   // url is optional and can be omitted - default is http://localhost:4317
// //   // Unix domain sockets are also supported: 'unix:///path/to/socket.sock'
// //   url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
// // };
// // const provider = new BasicTracerProvider();
// // const exporter = new OTLPTraceExporter(collectorOptions);
// // provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
// // provider.register();
// // ['SIGINT', 'SIGTERM'].forEach((signal) => {
// //   process.on(signal, () => provider.shutdown().catch(console.error));
// // });

// // import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
// // import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
// // import {
// //   BasicTracerProvider,
// //   SimpleSpanProcessor,
// // } from '@opentelemetry/sdk-trace-base';
// // // For troubleshooting, set the log level to DiagLogLevel.DEBUG
// // diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
// // const collectorOptions = {
// //   // url is optional and can be omitted - default is http://localhost:4317
// //   // Unix domain sockets are also supported: 'unix:///path/to/socket.sock'
// //   url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
// // };
// // const provider = new BasicTracerProvider();
// // const exporter = new OTLPTraceExporter(collectorOptions);
// // provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
// // provider.register();
// // ['SIGINT', 'SIGTERM'].forEach((signal) => {
// //   process.on(signal, () => provider.shutdown().catch(console.error));
// // });

// // import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
// // import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
// // import {
// //   BasicTracerProvider,
// //   SimpleSpanProcessor,
// // } from '@opentelemetry/sdk-trace-base';
// // // For troubleshooting, set the log level to DiagLogLevel.DEBUG
// // diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
// // const collectorOptions = {
// //   // url is optional and can be omitted - default is http://localhost:4317
// //   // Unix domain sockets are also supported: 'unix:///path/to/socket.sock'
// //   url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
// // };
// // const provider = new BasicTracerProvider();
// // const exporter = new OTLPTraceExporter(collectorOptions);
// // provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
// // provider.register();
// // ['SIGINT', 'SIGTERM'].forEach((signal) => {
// //   process.on(signal, () => provider.shutdown().catch(console.error));
// // });

// // import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
// // import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
// // import {
// //   BasicTracerProvider,
// //   SimpleSpanProcessor,
// // } from '@opentelemetry/sdk-trace-base';

// // // For troubleshooting, set the log level to DiagLogLevel.DEBUG
// // diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
// // const collectorOptions = {
// //   // url is optional and can be omitted - default is http://localhost:4317
// //   // Unix domain sockets are also supported: 'unix:///path/to/socket.sock'
// //   url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
// // };

// // const provider = new BasicTracerProvider();
// // const exporter = new OTLPTraceExporter(collectorOptions);
// // provider.addSpanProcessor(new SimpleSpanProcessor(exporter));

// // provider.register();
// // ['SIGINT', 'SIGTERM'].forEach((signal) => {
// //   process.on(signal, () => provider.shutdown().catch(console.error));
// // });

// // const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-grpc');
// // const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-proto');

// // const tracer = trace.getTracer('example-otlp-exporter-node');

// // // Create a span. A span must be closed.
// // const parentSpan = tracer.startSpan('main');
// // for (let i = 0; i < 10; i += 1) {
// //   doWork(parentSpan);
// // }
// // // Be sure to end the span.
// // parentSpan.end();

// // // give some time before it is closed
// // setTimeout(() => {
// //   // flush and close the connection.
// //   exporter.shutdown();
// // }, 2000);

// // function doWork(parent) {
// //   // Start another span. In this example, the main method already started a
// //   // span, so that'll be the parent span, and this will be a child span.
// //   const ctx = trace.setSpan(context.active(), parent);
// //   const span = tracer.startSpan('doWork', undefined, ctx);

// //   // simulate some random work.
// //   for (let i = 0; i <= Math.floor(Math.random() * 40000000); i += 1) {
// //     // empty
// //   }
// //   // Set attributes to the span.
// //   span.setAttribute('key', 'value');

// //   span.setAttribute('mapAndArrayValue', [
// //     0,
// //     1,
// //     2.25,
// //     'otel',
// //     {
// //       foo: 'bar',
// //       baz: 'json',
// //       array: [1, 2, 'boom'],
// //     },
// //   ] as string | number | any[]);

// //   // Annotate our span to capture metadata about our operation
// //   span.addEvent('invoking doWork');

// //   // end span
// //   span.end();
// // }
