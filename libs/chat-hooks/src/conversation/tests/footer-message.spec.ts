import { describe, expect, it } from 'vitest';
import { formatAppVersion } from '../footer-message';

describe('formatAppVersion', () => {
  it('prefixes a bare version with v', () => {
    expect(formatAppVersion('0.45.0')).toBe('v0.45.0');
  });

  it('leaves an already-prefixed version unchanged', () => {
    expect(formatAppVersion('v0.45.0')).toBe('v0.45.0');
  });

  it('leaves an uppercase-prefixed version unchanged', () => {
    expect(formatAppVersion('V0.45.0')).toBe('V0.45.0');
  });

  it('trims surrounding whitespace', () => {
    expect(formatAppVersion('  0.45.0  ')).toBe('v0.45.0');
  });

  it('passes build-stamped pre-release versions through without parsing', () => {
    expect(formatAppVersion('2026.08.10-a1b2c3d')).toBe('v2026.08.10-a1b2c3d');
  });
});
