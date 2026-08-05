import { describe, expect, it } from 'vitest';
import { isExcludedFromTelemetry } from '../excluded-paths';

describe('isExcludedFromTelemetry', () => {
  it('excludes the health-check path', () => {
    expect(isExcludedFromTelemetry('/api/health')).toBe(true);
  });

  it('excludes the Prometheus scrape path', () => {
    expect(isExcludedFromTelemetry('/metrics')).toBe(true);
  });

  it('does not exclude a business route', () => {
    expect(isExcludedFromTelemetry('/api/v1/themes/:id')).toBe(false);
  });

  it('does not exclude the bounded unmatched-route literal', () => {
    expect(isExcludedFromTelemetry('unmatched')).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(isExcludedFromTelemetry(null)).toBe(false);
    expect(isExcludedFromTelemetry(undefined)).toBe(false);
  });
});
