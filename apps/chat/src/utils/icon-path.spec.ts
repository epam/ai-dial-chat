import { describe, it, expect } from 'vitest';
import { ApiEndpoints } from '../server-api/base';
import { getIconPath } from './icon-path';

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
