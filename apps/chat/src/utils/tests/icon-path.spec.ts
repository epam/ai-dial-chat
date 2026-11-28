import { describe, it, expect } from 'vitest';
import { ApiEndpoints } from '../../server-api/base';
import { resolveDialFileDownloadUrl, resolveMarkdownUrl } from '../dial-file';
import {
  getIconMimeType,
  getIconPath,
  resolveCatalogIconUrl,
} from '../icon-path';

describe('getIconMimeType', () => {
  it.each([
    [
      'returns image/svg+xml for an SVG icon regardless of extension case',
      {
        cases: [
          ['chat-favicon.svg', 'image/svg+xml'],
          ['CHAT-FAVICON.SVG', 'image/svg+xml'],
        ],
      },
    ],
    [
      'returns the raster MIME type for PNG and ICO icons',
      {
        cases: [
          ['favicon.png', 'image/png'],
          ['favicon.ico', 'image/x-icon'],
        ],
      },
    ],
    [
      'ignores a query string or fragment after the extension',
      {
        cases: [
          ['https://cdn.example.com/logo.svg?v=2', 'image/svg+xml'],
          ['logo.svg#brand', 'image/svg+xml'],
        ],
      },
    ],
  ])('%s', (_name, { cases: [[first, firstType], [second, secondType]] }) => {
    expect(getIconMimeType(first)).toBe(firstType);
    expect(getIconMimeType(second)).toBe(secondType);
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

  it.each([
    [
      'should handle special characters in icon name',
      {
        iconName: 'icon with spaces.svg',
        expected: 'iconName=icon%20with%20spaces.svg',
      },
    ],
    [
      'should encode URL special characters',
      {
        iconName: 'icon&name=test.svg',
        expected: 'iconName=icon%26name%3Dtest.svg',
      },
    ],
    [
      'should handle icon names with unicode characters',
      {
        iconName: 'icon-ñ-test.svg',
        expected: 'iconName=icon-%C3%B1-test.svg',
      },
    ],
  ])('%s', (_name, { iconName, expected }) => {
    const result = getIconPath(iconName);

    expect(result).toContain(expected);
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
  it.each([
    [
      'rewrites a DIAL file ID to the BFF download URL',
      {
        url: 'files/9gRuhxHb/appdata/applications/public/demo/chart.png',
        expected:
          '/api/v1/files/download?bucket=9gRuhxHb&path=appdata%2Fapplications%2Fpublic%2Fdemo%2Fchart.png',
      },
    ],
    [
      'leaves http(s) URLs unchanged',
      {
        url: 'https://example.com/chart.png',
        expected: 'https://example.com/chart.png',
      },
    ],
    [
      'rewrites a project file id to the BFF project artifact URL',
      {
        url: 'projects/b/Q4%20launch/files/artifacts/chart.png',
        expected:
          '/api/v1/projects/projects%2Fb%2FQ4%20launch/artifacts/chart.png',
      },
    ],
    [
      'leaves an incomplete files/ id unchanged',
      { url: 'files/only-bucket', expected: 'files/only-bucket' },
    ],
    [
      'strips a #page=N anchor before resolving so it is not percent-encoded into path',
      {
        url: 'files/bucket/report.pdf#page=3',
        expected: '/api/v1/files/download?bucket=bucket&path=report.pdf',
      },
    ],
  ])('%s', (_name, { url, expected }) => {
    expect(resolveMarkdownUrl(url)).toBe(expected);
  });
});

describe('resolveCatalogIconUrl', () => {
  const THEMES = 'https://themes.example.com';

  it('maps a theme-relative name to the icon proxy', () => {
    expect(resolveCatalogIconUrl('gpt4.svg')).toBe(
      '/api/themes/icon?iconName=gpt4.svg',
    );
  });

  it('maps an absolute URL of a file under the themes host to the same proxy URL as its relative name', () => {
    expect(resolveCatalogIconUrl(`${THEMES}/gpt4.svg`, THEMES)).toBe(
      resolveCatalogIconUrl('gpt4.svg', THEMES),
    );
  });

  it('keeps an absolute themes-host URL as is when no themes base URL is known', () => {
    expect(resolveCatalogIconUrl(`${THEMES}/gpt4.svg`)).toBe(
      `${THEMES}/gpt4.svg`,
    );
    expect(resolveCatalogIconUrl(`${THEMES}/gpt4.svg`, null)).toBe(
      `${THEMES}/gpt4.svg`,
    );
  });

  it.each([
    'https://cdn.example.com/gpt4.svg',
    'https://themes.example.com.evil.test/gpt4.svg',
    `${THEMES}/nested/gpt4.svg`,
    `${THEMES}/gpt4.svg?v=2`,
    `${THEMES}/`,
  ])('keeps %s as is because the proxy cannot serve it', (url) => {
    expect(resolveCatalogIconUrl(url, THEMES)).toBe(url);
  });

  it('proxies a DIAL file ID through the download endpoint', () => {
    expect(resolveCatalogIconUrl('files/bucket/icon.png', THEMES)).toBe(
      '/api/v1/files/download?bucket=bucket&path=icon.png',
    );
  });

  it('resolves a generated project image through the project artifact endpoint', () => {
    expect(
      resolveCatalogIconUrl('projects/a1b2c3/q4/files/artifacts/chart.png'),
    ).toBe('/api/v1/projects/projects%2Fa1b2c3%2Fq4/artifacts/chart.png');
  });

  it('does not treat a project file outside context and artifacts as a theme icon', () => {
    expect(
      resolveCatalogIconUrl('projects/a1b2c3/q4/files/tmp/chart.png'),
    ).toBeUndefined();
  });

  it('returns undefined for a missing icon', () => {
    expect(resolveCatalogIconUrl(undefined, THEMES)).toBeUndefined();
    expect(resolveCatalogIconUrl('', THEMES)).toBeUndefined();
  });
});
