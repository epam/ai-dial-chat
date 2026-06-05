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
import { StorageKey } from '../constants/storage';
import { applyThemeColors } from '../utils/apply-theme-colors';
import { getFromLocalStorage } from '../utils/local-storage';

const DEFAULT_THEME = 'dark';

interface ThemeContextType {
  currentTheme: string;
  currentThemeLogo?: string;
  themes?: Theme[];
  setTheme: (themeId: string) => void;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [config, setConfig] = useState<ThemeConfiguration | null>(null);
  const [currentThemeId, setCurrentThemeId] = useState(DEFAULT_THEME);
  const [currentLogo, setCurrentLogo] = useState<string | undefined>(void 0);
  const [isLoading, setIsLoading] = useState(true);

  const updateTheme = useCallback(
    (themeId: string) => {
      const theme = config?.themes.find((t) => t.id === themeId);
      const root = document.documentElement;
      applyThemeColors(root, theme);
      setCurrentThemeId(themeId);
      const updatedLogo =
        themeId === DEFAULT_THEME
          ? config?.images['chat-logo-dark']
          : config?.images['chat-logo-light'];
      setCurrentLogo(updatedLogo);
    },
    [config],
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
    const configuredTheme = storedTheme || config?.themes?.[0].id;
    if (configuredTheme) {
      updateTheme(configuredTheme);
    }
  }, [config, updateTheme]);

  const setTheme = useCallback(
    (themeId: string) => {
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
          currentThemeLogo: currentLogo,
          setTheme,
          themes: config?.themes,
          isLoading,
        }),
        [currentThemeId, setTheme, config, currentLogo, isLoading],
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
