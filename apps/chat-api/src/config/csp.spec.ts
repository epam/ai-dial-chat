import { describe, expect, it } from 'vitest';
import { buildFrameSrcDirective } from './csp';

describe('buildFrameSrcDirective', () => {
  it('returns only self when no origins are configured', () => {
    expect(buildFrameSrcDirective([])).toEqual(["'self'"]);
  });

  it('appends configured origins after self', () => {
    expect(
      buildFrameSrcDirective([
        'https://quickapps.test',
        'http://localhost:4300',
      ]),
    ).toEqual(["'self'", 'https://quickapps.test', 'http://localhost:4300']);
  });
});
