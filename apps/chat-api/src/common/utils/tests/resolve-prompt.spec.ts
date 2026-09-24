import { describe, expect, it } from 'vitest';
import { resolvePrompt } from '../resolve-prompt';

describe('resolvePrompt', () => {
  it.each([undefined, '', ' ', '\t\r\n '])(
    'retains the exact default for a blank override (%j)',
    (override) => {
      expect(resolvePrompt(override, ' Default\n')).toBe(' Default\n');
    },
  );

  it('preserves formatting, Unicode and placeholders without interpolation', () => {
    const override =
      '  ## تعليمات\nUse {{name}} and $VALUE; keep \\n literal.\n';
    expect(resolvePrompt(override, 'Default')).toBe(override);
  });
});
