import { Theme, ThemeConfiguration } from '@epam/ai-dial-chat-shared';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useFavicon } from '../hooks/favicon/useFavicon';
import { ApiEndpoints, get } from '../server-api/base';
import { StorageKey } from '../types/storage-key';
import { ThemeId } from '../types/theme-id';
import {
  applyThemeColors,
  getOsPreferredTheme,
} from '../utils/apply-theme-colors';
import { getFromLocalStorage, setToLocalStorage } from '../utils/local-storage';

interface ThemeContextType {
  currentTheme: string;
  selectedTheme: string;
  currentThemeLogo?: string;
  currentThemeFavicon?: string;
  themes?: Theme[];
  setTheme: (themeId: string) => void;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [config, setConfig] = useState<ThemeConfiguration | null>(null);
  const [currentThemeId, setCurrentThemeId] = useState<string>(ThemeId.Light);
  const [selectedThemeId, setSelectedThemeId] = useState<string>(
    () => getFromLocalStorage(StorageKey.Theme) ?? ThemeId.Light,
  );
  const [currentLogo, setCurrentLogo] = useState<string | undefined>(void 0);
  const [isLoading, setIsLoading] = useState(true);

  const applyResolvedTheme = useCallback(
    (resolvedId: string) => {
      const theme = config?.themes.find((t) => t.id === resolvedId);
      const root = document.documentElement;
      applyThemeColors(root, theme);
      setCurrentThemeId(resolvedId);
      const updatedLogo =
        resolvedId === ThemeId.Dark
          ? config?.images['chat-logo-dark']
          : config?.images['chat-logo-light'];
      setCurrentLogo(updatedLogo);
    },
    [config],
  );

  const updateTheme = useCallback(
    (themeId: string) => {
      if (themeId === ThemeId.System) {
        applyResolvedTheme(getOsPreferredTheme());
      } else {
        applyResolvedTheme(themeId);
      }
    },
    [applyResolvedTheme],
  );

  useEffect(() => {
    if (!config) {
      let cancelled = false;

      const loadThemeConfiguration = async () => {
        setIsLoading(true);

        try {
          const data = await get<ThemeConfiguration>(ApiEndpoints.THEMES);
          if (cancelled) return;
          setConfig(data);
        } catch (err) {
          console.error('Failed to fetch theme configuration:', err);
        } finally {
          if (!cancelled) {
            setIsLoading(false);
          }
        }
      };

      loadThemeConfiguration();

      return () => {
        cancelled = true;
      };
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const storedTheme =
      typeof window !== 'undefined'
        ? getFromLocalStorage(StorageKey.Theme)
        : null;
    const defaultTheme = config?.themes?.[0].id;
    const configuredTheme =
      storedTheme && defaultTheme !== ThemeId.Dark
        ? defaultTheme
        : ThemeId.Light;
    if (configuredTheme) {
      setSelectedThemeId(configuredTheme);
      updateTheme(configuredTheme);
    }
  }, [config, updateTheme]);

  // Subscribe to OS color scheme changes when the stored preference is 'system'
  useEffect(() => {
    const storedTheme = getFromLocalStorage(StorageKey.Theme);
    if (storedTheme !== ThemeId.System) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => applyResolvedTheme(getOsPreferredTheme());
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [applyResolvedTheme]);

  const setTheme = useCallback(
    (themeId: string) => {
      setToLocalStorage(StorageKey.Theme, themeId);
      setSelectedThemeId(themeId);
      updateTheme(themeId);
    },
    [updateTheme],
  );

  // Extract favicon URL from theme configuration and apply it
  const faviconUrl = config?.images?.['chat-favicon'];
  useFavicon(faviconUrl);

  return (
    <ThemeContext.Provider
      value={useMemo(
        () => ({
          currentTheme: currentThemeId,
          selectedTheme: selectedThemeId,
          currentThemeLogo: currentLogo,
          currentThemeFavicon: config?.images?.['chat-favicon'],
          setTheme,
          themes: config?.themes,
          isLoading,
        }),
        [
          currentThemeId,
          selectedThemeId,
          setTheme,
          config,
          currentLogo,
          isLoading,
        ],
      )}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
