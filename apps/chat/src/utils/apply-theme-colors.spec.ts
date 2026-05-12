import { Theme } from '@epam/chat-shared';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyThemeColors } from './apply-theme-colors';
import * as localStorage from './local-storage';

// Mock localStorage utilities
vi.mock('./local-storage');

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
      name: 'Dark Theme',
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
      name: 'Light Theme',
      colors: {
        'primary-color': '#ffffff',
      },
    };

    applyThemeColors(mockElement, mockTheme);

    expect(mockSetToLocalStorage).toHaveBeenCalledWith('theme', 'light');
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
      name: 'Empty Theme',
      colors: {},
    };

    applyThemeColors(mockElement, mockTheme);

    expect(mockSetToLocalStorage).toHaveBeenCalledWith('theme', 'empty');
  });

  it('should update CSS custom properties correctly', () => {
    const mockTheme: Theme = {
      id: 'test',
      name: 'Test Theme',
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
      name: 'Dark',
      colors: { 'bg-color': '#000000' },
    };

    const lightTheme: Theme = {
      id: 'light',
      name: 'Light',
      colors: { 'bg-color': '#ffffff' },
    };

    applyThemeColors(mockElement, darkTheme);
    expect(mockElement.style.getPropertyValue('--bg-color')).toBe('#000000');

    applyThemeColors(mockElement, lightTheme);
    expect(mockElement.style.getPropertyValue('--bg-color')).toBe('#ffffff');

    expect(mockSetToLocalStorage).toHaveBeenCalledTimes(2);
    expect(mockSetToLocalStorage).toHaveBeenLastCalledWith('theme', 'light');
  });
});
