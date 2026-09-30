import { describe, expect, it } from 'vitest';
import { isSyntaxHighlightingAllowed } from '../syntax-highlighting';

describe('isSyntaxHighlightingAllowed', () => {
  it('allows ordinary code and empty text', () => {
    expect(isSyntaxHighlightingAllowed('')).toBe(true);
    expect(isSyntaxHighlightingAllowed('const value = 1;\n')).toBe(true);
  });

  it('allows the inclusive block limit and rejects one code unit more', () => {
    const text = `${'x'.repeat(999)}\n`.repeat(50);
    expect(isSyntaxHighlightingAllowed(text)).toBe(true);
    expect(isSyntaxHighlightingAllowed(`${text}x`)).toBe(false);
  });

  it('allows the inclusive line limit and rejects a longer final line', () => {
    expect(isSyntaxHighlightingAllowed('x'.repeat(2_000))).toBe(true);
    expect(isSyntaxHighlightingAllowed(`short\n${'x'.repeat(2_001)}`)).toBe(
      false,
    );
  });

  it.each(['\n', '\r\n', '\r'])(
    'recognizes %j line endings without hiding an oversized middle line',
    (newline) => {
      const line = 'x'.repeat(2_000);
      expect(isSyntaxHighlightingAllowed([line, line].join(newline))).toBe(
        true,
      );
      expect(
        isSyntaxHighlightingAllowed(
          ['short', `${line}x`, 'short'].join(newline),
        ),
      ).toBe(false);
    },
  );

  it('counts UTF-16 code units consistently with string length', () => {
    expect(isSyntaxHighlightingAllowed('😀'.repeat(1_000))).toBe(true);
    expect(isSyntaxHighlightingAllowed('😀'.repeat(1_001))).toBe(false);
  });

  it('rejects a synthetic tool response containing a large base64 attachment', () => {
    const text = JSON.stringify({ contentBytes: 'A'.repeat(175_052) });
    expect(isSyntaxHighlightingAllowed(text)).toBe(false);
  });
});
