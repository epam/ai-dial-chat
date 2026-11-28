import { describe, expect, it } from 'vitest';
import { parseOtelConfig } from '../otel-config';

describe('parseOtelConfig', () => {
  it('defaults to fully disabled when no OTEL_* variables are set', () => {
    expect(parseOtelConfig({})).toEqual({
      disabled: true,
      tracesExporter: 'otlp',
      logsExporter: 'otlp',
      metricsExporters: ['prometheus'],
    });
  });

  it('treats an explicit OTEL_SDK_DISABLED=true the same as unset', () => {
    expect(parseOtelConfig({ OTEL_SDK_DISABLED: 'true' }).disabled).toBe(true);
  });

  it.each(['false', '0', 'no', 'FALSE'])(
    'enables the SDK when OTEL_SDK_DISABLED=%s',
    (value) => {
      expect(parseOtelConfig({ OTEL_SDK_DISABLED: value }).disabled).toBe(
        false,
      );
    },
  );

  it('disables only traces via OTEL_TRACES_EXPORTER=none, leaving logs at their default', () => {
    const config = parseOtelConfig({
      OTEL_SDK_DISABLED: 'false',
      OTEL_TRACES_EXPORTER: 'none',
    });

    expect(config.tracesExporter).toBe('none');
    expect(config.logsExporter).toBe('otlp');
  });

  it('disables only logs via OTEL_LOGS_EXPORTER=none, leaving traces at their default', () => {
    const config = parseOtelConfig({
      OTEL_SDK_DISABLED: 'false',
      OTEL_LOGS_EXPORTER: 'none',
    });

    expect(config.logsExporter).toBe('none');
    expect(config.tracesExporter).toBe('otlp');
  });

  it('falls back to otlp for an unrecognized OTEL_TRACES_EXPORTER value', () => {
    expect(
      parseOtelConfig({ OTEL_TRACES_EXPORTER: 'zipkin' }).tracesExporter,
    ).toBe('otlp');
  });

  it.each([
    ['parses a single metrics exporter', { value: 'otlp', expected: ['otlp'] }],
    [
      'parses a comma-separated list of both metrics exporters',
      { value: 'otlp,prometheus', expected: ['otlp', 'prometheus'] },
    ],
    [
      'tolerates whitespace around comma-separated metrics exporters',
      { value: ' otlp , prometheus ', expected: ['otlp', 'prometheus'] },
    ],
    [
      'disables metrics entirely when the list includes none, regardless of other entries',
      { value: 'otlp,none', expected: [] },
    ],
    [
      'defaults to prometheus when OTEL_METRICS_EXPORTER is an empty string',
      { value: '', expected: ['prometheus'] },
    ],
    [
      'drops unrecognized tokens from the metrics exporter list',
      { value: 'otlp,zipkin', expected: ['otlp'] },
    ],
    [
      'deduplicates repeated metrics exporter tokens',
      { value: 'otlp,otlp', expected: ['otlp'] },
    ],
  ])('%s', (_name, { value, expected }) => {
    expect(
      parseOtelConfig({ OTEL_METRICS_EXPORTER: value }).metricsExporters,
    ).toEqual(expected);
  });

  it('defaults to prometheus when OTEL_METRICS_EXPORTER is unset', () => {
    expect(parseOtelConfig({}).metricsExporters).toEqual(['prometheus']);
  });
});
