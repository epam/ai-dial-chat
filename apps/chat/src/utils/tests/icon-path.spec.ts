import { describe, it, expect } from 'vitest';
import { ApiEndpoints } from '../../server-api/base';
import {
  resolveDialFileDownloadUrl,
  resolveRelativeDialFilePath,
} from '../dial-file';
import { getIconPath } from '../icon-path';

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

describe('resolveRelativeDialFilePath', () => {
  it('strips the files/{bucket}/ prefix from a DIAL file ID', () => {
    expect(
      resolveRelativeDialFilePath(
        'files/my-bucket/reports/q1.pdf',
        'my-bucket',
      ),
    ).toBe('reports/q1.pdf');
  });

  it('decodes percent-encoded path segments', () => {
    expect(
      resolveRelativeDialFilePath(
        'files/my-bucket/folder%2Fname.pdf',
        'my-bucket',
      ),
    ).toBe('folder/name.pdf');
  });

  it('returns relative paths unchanged', () => {
    expect(resolveRelativeDialFilePath('reports/q1.pdf', 'my-bucket')).toBe(
      'reports/q1.pdf',
    );
  });
});
