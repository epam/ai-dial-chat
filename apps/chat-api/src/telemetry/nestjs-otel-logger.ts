import { ConsoleLogger, type LogLevel } from '@nestjs/common';
import { context, type Attributes } from '@opentelemetry/api';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import packageJson from '../../package.json';

type NestLogMethod = 'verbose' | 'debug' | 'log' | 'warn' | 'error' | 'fatal';

const SEVERITY_BY_METHOD: Record<
  NestLogMethod,
  { number: SeverityNumber; text: string }
> = {
  verbose: { number: SeverityNumber.TRACE, text: 'TRACE' },
  debug: { number: SeverityNumber.DEBUG, text: 'DEBUG' },
  log: { number: SeverityNumber.INFO, text: 'INFO' },
  warn: { number: SeverityNumber.WARN, text: 'WARN' },
  error: { number: SeverityNumber.ERROR, text: 'ERROR' },
  fatal: { number: SeverityNumber.FATAL, text: 'FATAL' },
};

const getOtelLogger = () => logs.getLogger('chat-api', packageJson.version);

/*
 * Bridges NestJS `Logger`/`ConsoleLogger` output into the OpenTelemetry Logs API. Console output
 * and `LOG_LEVEL` gating are unchanged — both are inherited from `ConsoleLogger`, which this
 * class subclasses and always calls `super.*()` on first; the OTel side is purely additive.
 *
 * It becomes a zero-cost no-op automatically once telemetry is disabled: `@opentelemetry/api-
 * logs`'s global logger provider defaults to a no-op until `otel-sdk.ts` calls
 * `logs.setGlobalLoggerProvider(...)` (only when the SDK is enabled and logs aren't `none`).
 *
 * This is the only code path in the app that calls `logs.getLogger().emit()`. OTel SDK-internal
 * diagnostics are intentionally never routed through this bridge (no code path calls
 * `diag.setLogger(new NestOtelLogger(...))`), which would otherwise create a feedback loop.
 */
export class NestOtelLogger extends ConsoleLogger {
  constructor(logLevels: LogLevel[]) {
    super({ logLevels });
  }

  private emitLogRecord(
    method: NestLogMethod,
    message: unknown,
    stack: string | undefined,
    contextOverride: string | undefined,
  ): void {
    if (!this.isLevelEnabled(method)) return;

    const severity = SEVERITY_BY_METHOD[method];
    const attributes: Attributes = {
      'logger.name': contextOverride ?? this.context ?? '',
    };

    if (stack) {
      attributes['exception.type'] = 'Error';
      attributes['exception.message'] =
        typeof message === 'string' ? message : String(message);
      attributes['exception.stacktrace'] = stack;
    }

    getOtelLogger().emit({
      body: typeof message === 'string' ? message : String(message),
      severityNumber: severity.number,
      severityText: severity.text,
      attributes,
      context: context.active(),
    });
  }

  override log(message: unknown, contextArg?: string): void {
    super.log(message, contextArg);
    this.emitLogRecord('log', message, undefined, contextArg);
  }

  override warn(message: unknown, contextArg?: string): void {
    super.warn(message, contextArg);
    this.emitLogRecord('warn', message, undefined, contextArg);
  }

  override debug(message: unknown, contextArg?: string): void {
    super.debug(message, contextArg);
    this.emitLogRecord('debug', message, undefined, contextArg);
  }

  override verbose(message: unknown, contextArg?: string): void {
    super.verbose(message, contextArg);
    this.emitLogRecord('verbose', message, undefined, contextArg);
  }

  override fatal(message: unknown, contextArg?: string): void {
    super.fatal(message, contextArg);
    this.emitLogRecord('fatal', message, undefined, contextArg);
  }

  override error(message: unknown, stack?: string, contextArg?: string): void {
    super.error(message, stack, contextArg);
    this.emitLogRecord('error', message, stack, contextArg);
  }
}
