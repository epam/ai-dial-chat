import { describe, expect, it } from 'vitest';
import { isExcludedFromTelemetry } from '../excluded-paths';

describe('isExcludedFromTelemetry', () => {
  it('excludes the Prometheus scrape path', () => {
    expect(isExcludedFromTelemetry('/metrics')).toBe(true);
  });

  it('ignores the query string', () => {
    expect(isExcludedFromTelemetry('/metrics?x=y')).toBe(true);
  });

  it('does not exclude the sandbox page', () => {
    expect(isExcludedFromTelemetry('/')).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(isExcludedFromTelemetry(null)).toBe(false);
    expect(isExcludedFromTelemetry(undefined)).toBe(false);
  });
});
