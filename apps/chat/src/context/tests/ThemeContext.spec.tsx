import { ThemeConfiguration } from '@epam/ai-dial-chat-shared';
import { act, render, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as useFaviconModule from '../../hooks/favicon/useFavicon';
import * as serverApi from '../../server-api/base';
import * as applyThemeColors from '../../utils/apply-theme-colors';
import * as localStorage from '../../utils/local-storage';
import { ThemeProvider, useTheme } from '../ThemeContext';

// Mock modules
vi.mock('../../server-api/base');
vi.mock('../../utils/local-storage');
vi.mock('../../utils/apply-theme-colors');
vi.mock('../../hooks/favicon/useFavicon');

describe('ThemeContext', () => {
  const mockGet = vi.mocked(serverApi.get);
  const mockGetFromLocalStorage = vi.mocked(localStorage.getFromLocalStorage);
  const mockApplyThemeColors = vi.mocked(applyThemeColors.applyThemeColors);
  const mockUseFavicon = vi.mocked(useFaviconModule.useFavicon);

  const mockThemeConfig: ThemeConfiguration = {
    themes: [
      {
        id: 'dark',
        displayName: 'Dark Theme',
        colors: {
          'primary-color': '#000000',
          'secondary-color': '#ffffff',
        },
        'app-logo': 'https://example.com/logo-dark.svg',
      },
      {
        id: 'light',
        displayName: 'Light Theme',
        colors: {
          'primary-color': '#ffffff',
          'secondary-color': '#000000',
        },
        'app-logo': 'https://example.com/logo-light.svg',
      },
    ],
    images: {
      'default-addon': 'https://example.com/addon.png',
      'default-model': 'https://example.com/model.png',
      favicon: 'https://example.com/default-favicon.ico',
      'chat-logo-dark': 'logo-dark.svg',
      'chat-logo-light': 'logo-light.svg',
      'chat-favicon': 'https://example.com/chat-favicon.png',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue(mockThemeConfig);
    mockGetFromLocalStorage.mockReturnValue(null);
    mockApplyThemeColors.mockImplementation(() => {
      // Intentionally empty for test mocking
    });
    mockUseFavicon.mockImplementation(() => {
      // Intentionally empty for test mocking
    });
  });

  it('should fetch theme config on mount', async () => {
    renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    });

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith(serverApi.ApiEndpoints.THEMES);
    });
  });

  it('should expose loading state while themes are being fetched', async () => {
    let resolveGet: ((value: ThemeConfiguration) => void) | undefined;
    mockGet.mockImplementationOnce(
      () =>
        new Promise<ThemeConfiguration>((resolve) => {
          resolveGet = resolve;
        }),
    );

    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveGet?.(mockThemeConfig);
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  /*
   * The fixture lists `dark` first on purpose: the default must be light
   * whatever order the themes host uses, so a fixture led by `light` could
   * not tell a correct default from one that just took `themes[0]`.
   */
  it('should apply the light theme when no localStorage value', async () => {
    mockGetFromLocalStorage.mockReturnValue(null);

    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    });

    await waitFor(() => {
      expect(result.current.currentTheme).toBe('light');
      expect(result.current.themes).toEqual(mockThemeConfig.themes);
    });

    await waitFor(() => {
      expect(mockApplyThemeColors).toHaveBeenCalledWith(
        document.documentElement,
        mockThemeConfig.themes[1],
      );
    });
  });

  it('should read theme from localStorage on initialization', async () => {
    mockGetFromLocalStorage.mockReturnValue('light');

    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    });

    await waitFor(() => {
      expect(result.current.currentTheme).toBe('light');
    });

    await waitFor(() => {
      expect(mockApplyThemeColors).toHaveBeenCalledWith(
        document.documentElement,
        mockThemeConfig.themes[1],
      );
    });
  });

  it('should update theme when setTheme is called', async () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    });

    await waitFor(() => {
      expect(result.current.currentTheme).toBe('light');
      expect(result.current.themes).toEqual(mockThemeConfig.themes);
    });

    // Clear previous calls
    mockApplyThemeColors.mockClear();

    await act(async () => {
      result.current.setTheme('light');
    });

    await waitFor(() => {
      expect(result.current.currentTheme).toBe('light');
    });

    expect(mockApplyThemeColors).toHaveBeenCalledWith(
      document.documentElement,
      mockThemeConfig.themes[1],
    );
  });

  it('should update logo when theme changes', async () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    });

    await waitFor(() => {
      expect(result.current.currentTheme).toBe('light');
      expect(result.current.currentThemeLogo).toBe('logo-light.svg');
    });

    await act(async () => {
      result.current.setTheme('light');
    });

    await waitFor(() => {
      expect(result.current.currentThemeLogo).toBe('logo-light.svg');
    });
  });

  it('should provide themes list from config', async () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    });

    await waitFor(() => {
      expect(result.current.themes).toEqual(mockThemeConfig.themes);
    });
  });

  /*
   * The stored preference used to be read only as a truthiness gate, so a user
   * who picked a theme got whatever the configuration listed first on their
   * next load. These cover the resolution order that replaced it.
   */
  describe('restoring the stored preference', () => {
    const customThemeConfig: ThemeConfiguration = {
      ...mockThemeConfig,
      themes: [
        ...mockThemeConfig.themes,
        {
          id: 'contoso-night',
          displayName: 'Contoso Night',
          colors: { 'primary-color': '#101010' },
          'app-logo': 'https://example.com/logo-contoso.svg',
        },
      ],
    };

    it('restores a stored theme that the configuration still contains', async () => {
      mockGetFromLocalStorage.mockReturnValue('dark');

      const { result } = renderHook(() => useTheme(), {
        wrapper: ThemeProvider,
      });

      await waitFor(() => {
        expect(result.current.selectedTheme).toBe('dark');
        expect(result.current.currentTheme).toBe('dark');
      });

      expect(mockApplyThemeColors).toHaveBeenCalledWith(
        document.documentElement,
        mockThemeConfig.themes[0],
      );
    });

    it('restores a stored custom theme id', async () => {
      mockGet.mockResolvedValue(customThemeConfig);
      mockGetFromLocalStorage.mockReturnValue('contoso-night');

      const { result } = renderHook(() => useTheme(), {
        wrapper: ThemeProvider,
      });

      await waitFor(() => {
        expect(result.current.selectedTheme).toBe('contoso-night');
        expect(result.current.currentTheme).toBe('contoso-night');
      });

      expect(mockApplyThemeColors).toHaveBeenCalledWith(
        document.documentElement,
        customThemeConfig.themes[2],
      );
    });

    /*
     * These two wait on `themes` rather than on `currentTheme`. `light` is
     * already the initial state, so waiting for it resolves before the
     * configuration has even loaded and the assertion below runs against a
     * provider that has done nothing yet — which is exactly how this test
     * passed in isolation and failed under a full-suite run.
     */
    it('falls back to light when the stored id is gone', async () => {
      mockGetFromLocalStorage.mockReturnValue('contoso-night');

      const { result } = renderHook(() => useTheme(), {
        wrapper: ThemeProvider,
      });

      await waitFor(() => {
        expect(result.current.themes).toEqual(mockThemeConfig.themes);
      });

      expect(result.current.currentTheme).toBe('light');
      expect(mockApplyThemeColors).toHaveBeenCalledWith(
        document.documentElement,
        mockThemeConfig.themes[1],
      );
    });

    it('does not overwrite the stored value when falling back', async () => {
      const mockSetToLocalStorage = vi.mocked(localStorage.setToLocalStorage);
      mockGetFromLocalStorage.mockReturnValue('contoso-night');

      const { result } = renderHook(() => useTheme(), {
        wrapper: ThemeProvider,
      });

      await waitFor(() => {
        expect(result.current.themes).toEqual(mockThemeConfig.themes);
      });

      expect(result.current.currentTheme).toBe('light');
      expect(mockSetToLocalStorage).not.toHaveBeenCalled();
    });

    it('restores system and resolves it against the OS preference', async () => {
      /*
       * `system` is never an entry in the configuration, so it has to be
       * admitted by id rather than by lookup. Both the resolver and the
       * provider's own OS-change subscription read the media query, so both
       * are stubbed here.
       */
      vi.mocked(applyThemeColors.getOsPreferredTheme).mockReturnValue('dark');
      vi.stubGlobal(
        'matchMedia',
        vi.fn(() => ({
          matches: true,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        })),
      );
      mockGetFromLocalStorage.mockReturnValue('system');

      const { result } = renderHook(() => useTheme(), {
        wrapper: ThemeProvider,
      });

      await waitFor(() => {
        expect(result.current.selectedTheme).toBe('system');
        expect(result.current.currentTheme).toBe('dark');
      });

      vi.unstubAllGlobals();
    });

    /*
     * `system` resolves to `light` or `dark` at runtime, so a configuration
     * missing either one cannot honour it. Admitting it regardless meant the
     * provider applied a theme id that was not in the configuration and fell
     * through to no colours at all.
     */
    it('falls back to light when system is stored but dark is not configured', async () => {
      vi.mocked(applyThemeColors.getOsPreferredTheme).mockReturnValue('dark');
      mockGet.mockResolvedValue({
        ...mockThemeConfig,
        themes: [
          mockThemeConfig.themes[1],
          {
            id: 'contoso-night',
            displayName: 'Contoso Night',
            colors: { 'primary-color': '#101010' },
            'app-logo': '',
          },
        ],
      });
      mockGetFromLocalStorage.mockReturnValue('system');

      const { result } = renderHook(() => useTheme(), {
        wrapper: ThemeProvider,
      });

      await waitFor(() => {
        expect(result.current.themes).toHaveLength(2);
      });

      expect(result.current.currentTheme).toBe('light');
      expect(mockApplyThemeColors).toHaveBeenCalledWith(
        document.documentElement,
        mockThemeConfig.themes[1],
      );
    });

    it('applies nothing when the configuration has no themes', async () => {
      mockGet.mockResolvedValue({ ...mockThemeConfig, themes: [] });
      mockGetFromLocalStorage.mockReturnValue(null);

      const { result } = renderHook(() => useTheme(), {
        wrapper: ThemeProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockApplyThemeColors).toHaveBeenCalledWith(
        document.documentElement,
        undefined,
      );
      expect(result.current.currentTheme).toBe('light');
    });
  });

  it('should throw error when useTheme is used outside ThemeProvider', () => {
    // Suppress console.error for this test
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {
      // Intentionally empty to suppress console output during test
    });

    expect(() => {
      renderHook(() => useTheme());
    }).toThrow('useTheme must be used within a ThemeProvider');

    consoleError.mockRestore();
  });

  it('should handle API fetch failure gracefully', async () => {
    mockGet.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    });

    // Should not crash, but themes will be undefined
    await waitFor(() => {
      expect(result.current.themes).toBeUndefined();
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('should select correct logo based on theme', async () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    });

    // Light theme should use light logo
    await waitFor(() => {
      expect(result.current.currentTheme).toBe('light');
      expect(result.current.currentThemeLogo).toBe('logo-light.svg');
    });

    // Light theme should use light logo
    await act(async () => {
      result.current.setTheme('light');
    });

    await waitFor(() => {
      expect(result.current.currentThemeLogo).toBe('logo-light.svg');
    });
  });

  it('should memoize context value to prevent unnecessary rerenders', async () => {
    const TestComponent = () => {
      const theme = useTheme();
      return <div>{theme.currentTheme}</div>;
    };

    const { rerender } = render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    // Rerender shouldn't trigger new fetch
    rerender(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>,
    );

    // Still only one fetch
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('should extract favicon URL from theme config', async () => {
    renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    });

    await waitFor(() => {
      expect(mockUseFavicon).toHaveBeenCalledWith(
        'https://example.com/chat-favicon.png',
      );
    });
  });

  it('should call useFavicon when theme changes', async () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    });

    // Wait for initial theme to load
    await waitFor(() => {
      expect(mockUseFavicon).toHaveBeenCalledWith(
        'https://example.com/chat-favicon.png',
      );
    });

    // Clear previous calls
    mockUseFavicon.mockClear();

    // Change theme
    await act(async () => {
      result.current.setTheme('light');
    });

    // Should call useFavicon again
    await waitFor(() => {
      expect(mockUseFavicon).toHaveBeenCalledWith(
        'https://example.com/chat-favicon.png',
      );
    });
  });

  it('should handle backward compatibility when chat-favicon is missing', async () => {
    const configWithoutFavicon: ThemeConfiguration = {
      ...mockThemeConfig,
      images: {
        'default-addon': 'https://example.com/addon.png',
        'default-model': 'https://example.com/model.png',
        favicon: 'https://example.com/default-favicon.ico',
        'chat-logo-dark': 'logo-dark.svg',
        'chat-logo-light': 'logo-light.svg',
      },
    };

    mockGet.mockResolvedValue(configWithoutFavicon);

    renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    });

    await waitFor(() => {
      expect(mockUseFavicon).toHaveBeenCalledWith(undefined);
    });
  });
});
