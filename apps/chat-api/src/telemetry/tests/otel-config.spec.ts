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

  it('parses a single metrics exporter', () => {
    expect(
      parseOtelConfig({ OTEL_METRICS_EXPORTER: 'otlp' }).metricsExporters,
    ).toEqual(['otlp']);
  });

  it('parses a comma-separated list of both metrics exporters', () => {
    expect(
      parseOtelConfig({ OTEL_METRICS_EXPORTER: 'otlp,prometheus' })
        .metricsExporters,
    ).toEqual(['otlp', 'prometheus']);
  });

  it('tolerates whitespace around comma-separated metrics exporters', () => {
    expect(
      parseOtelConfig({ OTEL_METRICS_EXPORTER: ' otlp , prometheus ' })
        .metricsExporters,
    ).toEqual(['otlp', 'prometheus']);
  });

  it('disables metrics entirely when the list includes none, regardless of other entries', () => {
    expect(
      parseOtelConfig({ OTEL_METRICS_EXPORTER: 'otlp,none' }).metricsExporters,
    ).toEqual([]);
  });

  it('defaults to prometheus when OTEL_METRICS_EXPORTER is unset', () => {
    expect(parseOtelConfig({}).metricsExporters).toEqual(['prometheus']);
  });

  it('defaults to prometheus when OTEL_METRICS_EXPORTER is an empty string', () => {
    expect(
      parseOtelConfig({ OTEL_METRICS_EXPORTER: '' }).metricsExporters,
    ).toEqual(['prometheus']);
  });

  it('drops unrecognized tokens from the metrics exporter list', () => {
    expect(
      parseOtelConfig({ OTEL_METRICS_EXPORTER: 'otlp,zipkin' })
        .metricsExporters,
    ).toEqual(['otlp']);
  });

  it('deduplicates repeated metrics exporter tokens', () => {
    expect(
      parseOtelConfig({ OTEL_METRICS_EXPORTER: 'otlp,otlp' }).metricsExporters,
    ).toEqual(['otlp']);
  });
});
