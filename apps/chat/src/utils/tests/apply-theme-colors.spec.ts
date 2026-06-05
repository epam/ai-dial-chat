import { Theme } from '@epam/ai-dial-chat-shared';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StorageKey } from '../../constants/storage';
import { applyThemeColors } from '../apply-theme-colors';
import * as localStorage from '../local-storage';

// Mock localStorage utilities
vi.mock('../local-storage');

describe('applyThemeColors', () => {
  const mockSetToLocalStorage = vi.mocked(localStorage.setToLocalStorage);

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

  it('should persist theme to localStorage', () => {
    const mockTheme: Theme = {
      id: 'light',
      displayName: 'Light Theme',
      'app-logo': '',
      colors: {
        'primary-color': '#ffffff',
      },
    };

    applyThemeColors(mockElement, mockTheme);

    expect(mockSetToLocalStorage).toHaveBeenCalledWith(
      StorageKey.Theme,
      'light',
    );
  });

  it('should handle undefined theme (no-op)', () => {
    const setPropertySpy = vi.spyOn(mockElement.style, 'setProperty');

    applyThemeColors(mockElement, undefined);

    expect(setPropertySpy).not.toHaveBeenCalled();
    expect(mockSetToLocalStorage).not.toHaveBeenCalled();
  });

  it('should handle empty colors object', () => {
    const mockTheme: Theme = {
      id: 'empty',
      displayName: 'Empty Theme',
      'app-logo': '',
      colors: {},
    };

    applyThemeColors(mockElement, mockTheme);

    expect(mockSetToLocalStorage).toHaveBeenCalledWith(
      StorageKey.Theme,
      'empty',
    );
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

    expect(mockSetToLocalStorage).toHaveBeenCalledTimes(2);
    expect(mockSetToLocalStorage).toHaveBeenLastCalledWith(
      StorageKey.Theme,
      'light',
    );
  });
});
