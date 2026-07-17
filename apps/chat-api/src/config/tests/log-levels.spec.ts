import { describe, expect, it } from 'vitest';
import { resolveLogLevels } from '../log-levels';

describe('resolveLogLevels', () => {
  it('uses log level by default in production', () => {
    expect(resolveLogLevels('production', undefined)).toEqual([
      'log',
      'error',
      'warn',
    ]);
  });

  it('uses debug level by default outside production', () => {
    expect(resolveLogLevels('development', undefined)).toEqual([
      'log',
      'error',
      'warn',
      'debug',
    ]);
  });

  it('enables debug logging in production when configured', () => {
    expect(resolveLogLevels('production', 'debug')).toContain('debug');
  });

  it('limits development logging to warnings and errors when configured', () => {
    expect(resolveLogLevels('development', 'warn')).toEqual(['error', 'warn']);
  });
});
