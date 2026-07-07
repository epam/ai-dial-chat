import { describe, expect, it } from 'vitest';
import { safeDecodeURIComponent } from './uri';

describe('safeDecodeURIComponent', () => {
  it('decodes valid URI components', () => {
    expect(safeDecodeURIComponent('Report%202026.pdf')).toBe('Report 2026.pdf');
  });

  it('returns the original value when decoding fails', () => {
    expect(safeDecodeURIComponent('%E0%A4%A')).toBe('%E0%A4%A');
  });
});
