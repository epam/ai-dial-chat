import { describe, expect, it } from 'vitest';
import { PACKAGE_VERSION, resolveAppVersion } from './app-version';

describe('PACKAGE_VERSION', () => {
  it('is a non-empty string inlined from package.json', () => {
    expect(typeof PACKAGE_VERSION).toBe('string');
    expect(PACKAGE_VERSION.length).toBeGreaterThan(0);
  });
});

describe('resolveAppVersion', () => {
  it('prefers the override when it carries a value', () => {
    expect(resolveAppVersion('2026.08.10-a1b2c3d')).toBe('2026.08.10-a1b2c3d');
  });

  it('trims surrounding whitespace from the override', () => {
    expect(resolveAppVersion('  0.45.0  ')).toBe('0.45.0');
  });

  it('falls back to the package version for undefined, null, empty and blank overrides', () => {
    expect(resolveAppVersion(undefined)).toBe(PACKAGE_VERSION);
    expect(resolveAppVersion(null)).toBe(PACKAGE_VERSION);
    expect(resolveAppVersion('')).toBe(PACKAGE_VERSION);
    expect(resolveAppVersion('   ')).toBe(PACKAGE_VERSION);
  });
});
