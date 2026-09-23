import { Theme } from '@epam/ai-dial-chat-shared';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyThemeColors } from '../apply-theme-colors';

describe('applyThemeColors', () => {
  let mockElement: HTMLElement;

  beforeEach(() => {
    vi.clearAllMocks();
    mockElement = document.createElement('div');
  });

  it('should apply theme colors to root element', () => {
    const mockTheme: Theme = {
      id: 'dark',
      displayName: 'Dark Theme',
      'app-logo': '',
      colors: {
        'primary-color': '#000000',
        'secondary-color': '#ffffff',
        'accent-color': '#00ff00',
      },
    };

    applyThemeColors(mockElement, mockTheme);

    expect(mockElement.style.getPropertyValue('--primary-color')).toBe(
      '#000000',
    );
    expect(mockElement.style.getPropertyValue('--secondary-color')).toBe(
      '#ffffff',
    );
    expect(mockElement.style.getPropertyValue('--accent-color')).toBe(
      '#00ff00',
    );
  });

  it('should apply theme colors when a theme is provided', () => {
    const mockTheme: Theme = {
      id: 'light',
      displayName: 'Light Theme',
      'app-logo': '',
      colors: {
        'primary-color': '#ffffff',
      },
    };

    applyThemeColors(mockElement, mockTheme);

    expect(mockElement.style.getPropertyValue('--primary-color')).toBe(
      '#ffffff',
    );
  });

  it('should handle undefined theme (no-op)', () => {
    const setPropertySpy = vi.spyOn(mockElement.style, 'setProperty');

    applyThemeColors(mockElement, undefined);

    expect(setPropertySpy).not.toHaveBeenCalled();
  });

  it('should handle empty colors object', () => {
    const mockTheme: Theme = {
      id: 'empty',
      displayName: 'Empty Theme',
      'app-logo': '',
      colors: {},
    };

    applyThemeColors(mockElement, mockTheme);

    expect(mockElement.style.length).toBe(0);
  });

  it('should update CSS custom properties correctly', () => {
    const mockTheme: Theme = {
      id: 'test',
      displayName: 'Test Theme',
      'app-logo': '',
      colors: {
        'bg-color': 'rgb(255, 0, 0)',
        'text-color': 'rgba(0, 0, 0, 0.8)',
      },
    };

    applyThemeColors(mockElement, mockTheme);

    expect(mockElement.style.getPropertyValue('--bg-color')).toBe(
      'rgb(255, 0, 0)',
    );
    expect(mockElement.style.getPropertyValue('--text-color')).toBe(
      'rgba(0, 0, 0, 0.8)',
    );
  });

  it('should handle multiple consecutive theme applications', () => {
    const darkTheme: Theme = {
      id: 'dark',
      displayName: 'Dark',
      'app-logo': '',
      colors: { 'bg-color': '#000000' },
    };

    const lightTheme: Theme = {
      id: 'light',
      displayName: 'Light',
      'app-logo': '',
      colors: { 'bg-color': '#ffffff' },
    };

    applyThemeColors(mockElement, darkTheme);
    expect(mockElement.style.getPropertyValue('--bg-color')).toBe('#000000');

    applyThemeColors(mockElement, lightTheme);
    expect(mockElement.style.getPropertyValue('--bg-color')).toBe('#ffffff');
  });

  /*
   * Themes declaring different key sets are the whole point of supporting more
   * than light/dark: without clearing, switching from a theme that declares a
   * key to one that does not leaves the previous theme's colour in place.
   */
  describe('clearing previously applied properties', () => {
    const richTheme: Theme = {
      id: 'rich',
      displayName: 'Rich',
      'app-logo': '',
      colors: {
        'bg-layer-base': '#ffffff',
        'text-accent-primary': '#0000ff',
        'border-primary': '#cccccc',
      },
    };

    const sparseTheme: Theme = {
      id: 'sparse',
      displayName: 'Sparse',
      'app-logo': '',
      colors: { 'bg-layer-base': '#000000' },
    };

    it('removes keys the next theme does not declare', () => {
      applyThemeColors(mockElement, richTheme);
      applyThemeColors(mockElement, sparseTheme);

      expect(mockElement.style.getPropertyValue('--bg-layer-base')).toBe(
        '#000000',
      );
      expect(mockElement.style.getPropertyValue('--text-accent-primary')).toBe(
        '',
      );
      expect(mockElement.style.getPropertyValue('--border-primary')).toBe('');
    });

    it('clears everything previously written when called with no theme', () => {
      applyThemeColors(mockElement, richTheme);
      applyThemeColors(mockElement, undefined);

      expect(mockElement.style.getPropertyValue('--bg-layer-base')).toBe('');
      expect(mockElement.style.getPropertyValue('--text-accent-primary')).toBe(
        '',
      );
      expect(mockElement.style.getPropertyValue('--border-primary')).toBe('');
      expect(mockElement.style.length).toBe(0);
    });

    it('does not remove properties it never wrote', () => {
      mockElement.style.setProperty('--set-by-someone-else', '#123456');

      applyThemeColors(mockElement, richTheme);
      applyThemeColors(mockElement, undefined);

      expect(mockElement.style.getPropertyValue('--set-by-someone-else')).toBe(
        '#123456',
      );
    });

    it('tracks applied keys per element', () => {
      const otherElement = document.createElement('div');

      applyThemeColors(mockElement, richTheme);
      applyThemeColors(otherElement, sparseTheme);
      applyThemeColors(otherElement, undefined);

      expect(mockElement.style.getPropertyValue('--text-accent-primary')).toBe(
        '#0000ff',
      );
      expect(otherElement.style.getPropertyValue('--bg-layer-base')).toBe('');
    });

    it('is idempotent when the same theme is applied twice', () => {
      applyThemeColors(mockElement, richTheme);
      applyThemeColors(mockElement, richTheme);

      expect(mockElement.style.getPropertyValue('--bg-layer-base')).toBe(
        '#ffffff',
      );
      expect(mockElement.style.getPropertyValue('--text-accent-primary')).toBe(
        '#0000ff',
      );
      expect(mockElement.style.getPropertyValue('--border-primary')).toBe(
        '#cccccc',
      );
    });
  });
});
