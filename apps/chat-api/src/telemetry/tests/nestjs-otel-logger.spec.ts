import { context, trace } from '@opentelemetry/api';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import { AsyncHooksContextManager } from '@opentelemetry/context-async-hooks';
import {
  InMemoryLogRecordExporter,
  LoggerProvider,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { NestOtelLogger } from '../nestjs-otel-logger';

describe('NestOtelLogger', () => {
  let logExporter: InMemoryLogRecordExporter;
  let tracer: ReturnType<BasicTracerProvider['getTracer']>;

  beforeAll(() => {
    context.setGlobalContextManager(new AsyncHooksContextManager().enable());

    logExporter = new InMemoryLogRecordExporter();
    const loggerProvider = new LoggerProvider({
      processors: [new SimpleLogRecordProcessor({ exporter: logExporter })],
    });
    logs.setGlobalLoggerProvider(loggerProvider);

    const spanExporter = new InMemorySpanExporter();
    const tracerProvider = new BasicTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(spanExporter)],
    });
    tracer = tracerProvider.getTracer('test');
  });

  /*
   * Deregister the global context manager and logger provider this spec installed — see
   * `http-metrics.spec.ts` for why every OTel-global-mutating spec cleans up after itself.
   */
  afterAll(() => {
    context.disable();
    logs.disable();
  });

  afterEach(() => {
    logExporter.reset();
    vi.restoreAllMocks();
  });

  const silenceConsole = () => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  };

  it.each([
    ['verbose', SeverityNumber.TRACE, 'TRACE'],
    ['debug', SeverityNumber.DEBUG, 'DEBUG'],
    ['log', SeverityNumber.INFO, 'INFO'],
    ['warn', SeverityNumber.WARN, 'WARN'],
    ['error', SeverityNumber.ERROR, 'ERROR'],
    ['fatal', SeverityNumber.FATAL, 'FATAL'],
  ] as const)(
    'maps logger.%s(...) to severity %s',
    (method, expectedNumber, expectedText) => {
      silenceConsole();
      const logger = new NestOtelLogger([
        'verbose',
        'debug',
        'log',
        'warn',
        'error',
        'fatal',
      ]);

      logger[method]('a message');

      const [record] = logExporter.getFinishedLogRecords();
      expect(record.severityNumber).toBe(expectedNumber);
      expect(record.severityText).toBe(expectedText);
    },
  );

  it('still writes console output for an enabled level', () => {
    const writeSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const logger = new NestOtelLogger(['log', 'error', 'warn']);

    logger.log('hello from the bridge');

    expect(writeSpy).toHaveBeenCalled();
    expect(logExporter.getFinishedLogRecords()).toHaveLength(1);
  });

  it('suppresses both console output and the exported record for a disabled level', () => {
    silenceConsole();
    const logger = new NestOtelLogger(['log', 'error', 'warn']);

    // eslint-disable-next-line testing-library/no-debugging-utils -- this is NestOtelLogger.debug() under test, not a Testing Library debug util
    logger.debug('should be suppressed');

    expect(process.stdout.write).not.toHaveBeenCalled();
    expect(logExporter.getFinishedLogRecords()).toHaveLength(0);
  });

  it('includes trace_id/span_id when emitted inside an active span', () => {
    silenceConsole();
    const logger = new NestOtelLogger(['log', 'error', 'warn']);
    const span = tracer.startSpan('test-span');

    context.with(trace.setSpan(context.active(), span), () => {
      logger.log('within a span');
    });
    span.end();

    const [record] = logExporter.getFinishedLogRecords();
    expect(record.spanContext?.traceId).toBe(span.spanContext().traceId);
    expect(record.spanContext?.spanId).toBe(span.spanContext().spanId);
  });

  it('has no trace_id/span_id when no span is active', () => {
    silenceConsole();
    const logger = new NestOtelLogger(['log', 'error', 'warn']);

    logger.log('outside any span');

    const [record] = logExporter.getFinishedLogRecords();
    expect(record.spanContext).toBeUndefined();
  });

  it('populates exception attributes for an error(message, stack) call', () => {
    silenceConsole();
    const logger = new NestOtelLogger(['log', 'error', 'warn']);

    logger.error('something failed', 'Error: boom\n    at somewhere.ts:1:1');

    const [record] = logExporter.getFinishedLogRecords();
    expect(record.attributes['exception.type']).toBe('Error');
    expect(record.attributes['exception.message']).toBe('something failed');
    expect(record.attributes['exception.stacktrace']).toBe(
      'Error: boom\n    at somewhere.ts:1:1',
    );
  });

  it('sets logger.name from the Nest logger context', () => {
    silenceConsole();
    const logger = new NestOtelLogger(['log', 'error', 'warn']);

    logger.log('scoped message', 'ThemeService');

    const [record] = logExporter.getFinishedLogRecords();
    expect(record.attributes['logger.name']).toBe('ThemeService');
  });
});
