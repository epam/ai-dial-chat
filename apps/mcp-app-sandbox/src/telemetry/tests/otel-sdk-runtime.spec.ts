import { describe, expect, it } from 'vitest';
import { buildMetricReaders, buildResource } from '../otel-sdk';

describe('buildResource', () => {
  it('prefers OTEL_SERVICE_NAME', () => {
    expect(
      buildResource({ OTEL_SERVICE_NAME: 'custom' }).attributes['service.name'],
    ).toBe('custom');
  });

  it('falls back to the package name', () => {
    expect(buildResource({}).attributes['service.name']).toBe(
      'mcp-app-sandbox',
    );
  });
});

describe('buildMetricReaders', () => {
  it('creates no readers when metrics are disabled', () => {
    expect(buildMetricReaders([], {})).toEqual([]);
  });
});
