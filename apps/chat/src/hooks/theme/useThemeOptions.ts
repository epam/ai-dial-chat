import { useTheme } from '../../context/ThemeContext';
import { ThemeId } from '../../types/theme-id';

export const useThemeOptions = () => {
  const { themes, selectedTheme, setTheme } = useTheme();
  const hasDark = themes?.some((t) => t.id === ThemeId.Dark) ?? false;
  const hasLight = themes?.some((t) => t.id === ThemeId.Light) ?? false;
  return { hasDark, hasLight, selectedTheme, setTheme, themes };
};
