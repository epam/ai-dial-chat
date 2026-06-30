import { describe, expect, it } from 'vitest';

import { isAllowedImageUrl, parseAllowedImageHosts } from '../image-security';

describe('image-security utils', () => {
  describe('parseAllowedImageHosts', () => {
    it('returns an empty array for empty/undefined input', () => {
      expect(parseAllowedImageHosts(undefined)).toEqual([]);
      expect(parseAllowedImageHosts('')).toEqual([]);
      expect(parseAllowedImageHosts('   ')).toEqual([]);
    });

    it('parses whitespace-separated origins into bare hosts', () => {
      expect(
        parseAllowedImageHosts('https://cdn.example.com  https://img.test.io'),
      ).toEqual(['cdn.example.com', 'img.test.io']);
    });

    it('accepts bare hosts (no scheme) and preserves ports', () => {
      expect(
        parseAllowedImageHosts('cdn.example.com img.test.io:8080'),
      ).toEqual(['cdn.example.com', 'img.test.io:8080']);
    });

    it('lower-cases hosts', () => {
      expect(parseAllowedImageHosts('https://CDN.Example.COM')).toEqual([
        'cdn.example.com',
      ]);
    });
  });

  describe('isAllowedImageUrl', () => {
    const allowedHosts = ['cdn.example.com'];

    it('blocks falsy src', () => {
      expect(isAllowedImageUrl(undefined, allowedHosts)).toBe(false);
      expect(isAllowedImageUrl('', allowedHosts)).toBe(false);
    });

    it('allows data: URIs (no network egress)', () => {
      expect(
        isAllowedImageUrl('data:image/png;base64,iVBORw0KG', allowedHosts),
      ).toBe(true);
    });

    it('allows same-origin relative URLs', () => {
      expect(isAllowedImageUrl('/api/files/foo.png', allowedHosts)).toBe(true);
      expect(isAllowedImageUrl('api/files/foo.png', allowedHosts)).toBe(true);
      expect(isAllowedImageUrl('images/logo.svg', allowedHosts)).toBe(true);
    });

    it('blocks external http(s) images not in the allowlist', () => {
      expect(
        isAllowedImageUrl(
          'https://attacker.com/p.png?leak=SECRET',
          allowedHosts,
        ),
      ).toBe(false);
      expect(isAllowedImageUrl('http://attacker.com/p.png', allowedHosts)).toBe(
        false,
      );
      expect(isAllowedImageUrl('//attacker.com/p.png', allowedHosts)).toBe(
        false,
      );
    });

    it('allows external images whose host is in the allowlist', () => {
      expect(
        isAllowedImageUrl('https://cdn.example.com/logo.png', allowedHosts),
      ).toBe(true);
      expect(
        isAllowedImageUrl('//cdn.example.com/logo.png', allowedHosts),
      ).toBe(true);
      expect(
        isAllowedImageUrl('https://CDN.EXAMPLE.COM/logo.png', allowedHosts),
      ).toBe(true);
    });

    it('blocks when there is no allowlist', () => {
      expect(isAllowedImageUrl('https://cdn.example.com/logo.png', [])).toBe(
        false,
      );
    });
  });
});
