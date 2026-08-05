/*
 * Pure, dependency-free parsing of `OTEL_*` environment variables into a typed
 * exporter-selection result. No SDK, network, or NestJS imports here — this module must be
 * safely unit-testable and callable before Nest's DI container exists (see otel-sdk.ts, which
 * runs at the top of main.ts, ahead of NestFactory.create()).
 */

export type SingleSignalExporter = 'otlp' | 'none';
export type MetricsExporter = 'otlp' | 'prometheus';

export interface OtelConfig {
  disabled: boolean;
  tracesExporter: SingleSignalExporter;
  logsExporter: SingleSignalExporter;
  /* Resolved list of active metrics exporters; empty means metrics are effectively disabled
   * (mirrors `@opentelemetry/sdk-node`'s own env-based resolution: a `none` anywhere in the
   * comma-separated list disables metrics entirely, regardless of what else is listed). */
  metricsExporters: MetricsExporter[];
}

const FALSY_VALUES = new Set(['false', '0', 'no']);

const parseBooleanEnv = (
  raw: string | undefined,
  defaultValue: boolean,
): boolean => {
  if (raw == null || raw.trim() === '') return defaultValue;
  return !FALSY_VALUES.has(raw.trim().toLowerCase());
};

const parseSingleSignalExporter = (
  raw: string | undefined,
): SingleSignalExporter =>
  raw?.trim().toLowerCase() === 'none' ? 'none' : 'otlp';

const parseMetricsExporters = (raw: string | undefined): MetricsExporter[] => {
  const tokens = (raw ?? '')
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length > 0);

  if (tokens.length === 0) return ['prometheus'];
  if (tokens.includes('none')) return [];

  const isMetricsExporter = (token: string): token is MetricsExporter =>
    token === 'otlp' || token === 'prometheus';

  return Array.from(new Set(tokens.filter(isMetricsExporter)));
};

export const parseOtelConfig = (env: NodeJS.ProcessEnv): OtelConfig => {
  const disabled = parseBooleanEnv(env.OTEL_SDK_DISABLED, true);

  return {
    disabled,
    tracesExporter: parseSingleSignalExporter(env.OTEL_TRACES_EXPORTER),
    logsExporter: parseSingleSignalExporter(env.OTEL_LOGS_EXPORTER),
    metricsExporters: parseMetricsExporters(env.OTEL_METRICS_EXPORTER),
  };
};
