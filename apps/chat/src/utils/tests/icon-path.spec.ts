import { describe, it, expect } from 'vitest';
import { ApiEndpoints } from '../../server-api/base';
import { resolveDialFileDownloadUrl, resolveMarkdownUrl } from '../dial-file';
import { getIconMimeType, getIconPath } from '../icon-path';

describe('getIconMimeType', () => {
  it('returns image/svg+xml for an SVG icon regardless of extension case', () => {
    expect(getIconMimeType('chat-favicon.svg')).toBe('image/svg+xml');
    expect(getIconMimeType('CHAT-FAVICON.SVG')).toBe('image/svg+xml');
  });

  it('returns the raster MIME type for PNG and ICO icons', () => {
    expect(getIconMimeType('favicon.png')).toBe('image/png');
    expect(getIconMimeType('favicon.ico')).toBe('image/x-icon');
  });

  it('ignores a query string or fragment after the extension', () => {
    expect(getIconMimeType('https://cdn.example.com/logo.svg?v=2')).toBe(
      'image/svg+xml',
    );
    expect(getIconMimeType('logo.svg#brand')).toBe('image/svg+xml');
  });

  it('returns undefined for a missing or unknown extension', () => {
    expect(getIconMimeType(undefined)).toBeUndefined();
    expect(getIconMimeType('favicon')).toBeUndefined();
    expect(getIconMimeType('favicon.bmpx')).toBeUndefined();
  });

  it('reads the extension from the file name, not a dotted directory', () => {
    expect(getIconMimeType('https://cdn.example.com/assets.svg/logo')).toBe(
      undefined,
    );
    expect(getIconMimeType('https://cdn.example.com/v2.0/logo.png')).toBe(
      'image/png',
    );
  });
});

describe('getIconPath', () => {
  it('should return correct URL format for icon name', () => {
    const iconName = 'chat-logo-dark.svg';
    const result = getIconPath(iconName);

    expect(result).toBe(
      `${ApiEndpoints.THEME_ICON}?iconName=chat-logo-dark.svg`,
    );
  });

  it('should handle special characters in icon name', () => {
    const iconName = 'icon with spaces.svg';
    const result = getIconPath(iconName);

    expect(result).toContain('iconName=icon%20with%20spaces.svg');
  });

  it('should encode URL special characters', () => {
    const iconName = 'icon&name=test.svg';
    const result = getIconPath(iconName);

    expect(result).toContain('iconName=icon%26name%3Dtest.svg');
  });

  it('should handle undefined icon name', () => {
    const result = getIconPath(undefined);

    expect(result).toBe(`${ApiEndpoints.THEME_ICON}?iconName=`);
  });

  it('should handle empty string icon name', () => {
    const result = getIconPath('');

    expect(result).toBe(`${ApiEndpoints.THEME_ICON}?iconName=`);
  });

  it('should handle icon names with dots and dashes', () => {
    const iconName = 'icon-name.test.svg';
    const result = getIconPath(iconName);

    expect(result).toBe(
      `${ApiEndpoints.THEME_ICON}?iconName=icon-name.test.svg`,
    );
  });

  it('should handle icon names with unicode characters', () => {
    const iconName = 'icon-ñ-test.svg';
    const result = getIconPath(iconName);

    expect(result).toContain('iconName=icon-%C3%B1-test.svg');
  });
});

describe('resolveDialFileDownloadUrl', () => {
  it('converts a valid DIAL file ID to a BFF download URL', () => {
    const result = resolveDialFileDownloadUrl('files/my-bucket/reports/q1.pdf');
    expect(result).toBe(
      '/api/v1/files/download?bucket=my-bucket&path=reports%2Fq1.pdf',
    );
  });

  it('decodes a percent-encoded path segment before passing as query param', () => {
    const result = resolveDialFileDownloadUrl(
      'files/my-bucket/folder%2Fname.pdf',
    );
    expect(result).toContain('path=folder%2Fname.pdf');
  });

  it('returns undefined for a non-DIAL URL', () => {
    expect(
      resolveDialFileDownloadUrl('https://external.com/file.pdf'),
    ).toBeUndefined();
  });

  it('returns undefined when there is no path segment after the bucket', () => {
    expect(resolveDialFileDownloadUrl('files/only-bucket')).toBeUndefined();
  });
});

describe('resolveMarkdownUrl', () => {
  it('rewrites a DIAL file ID to the BFF download URL', () => {
    expect(
      resolveMarkdownUrl(
        'files/9gRuhxHb/appdata/applications/public/pg/chart.png',
      ),
    ).toBe(
      '/api/v1/files/download?bucket=9gRuhxHb&path=appdata%2Fapplications%2Fpublic%2Fpg%2Fchart.png',
    );
  });

  it('leaves http(s) URLs unchanged', () => {
    expect(resolveMarkdownUrl('https://example.com/chart.png')).toBe(
      'https://example.com/chart.png',
    );
  });

  it('leaves an incomplete files/ id unchanged', () => {
    expect(resolveMarkdownUrl('files/only-bucket')).toBe('files/only-bucket');
  });

  it('strips a #page=N anchor before resolving so it is not percent-encoded into path', () => {
    expect(resolveMarkdownUrl('files/bucket/report.pdf#page=3')).toBe(
      '/api/v1/files/download?bucket=bucket&path=report.pdf',
    );
  });
});
