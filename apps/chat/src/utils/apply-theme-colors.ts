import { Theme } from '@epam/chat-shared';
import { setToLocalStorage } from './local-storage';

export const applyThemeColors = (div: HTMLElement, theme?: Theme) => {
  if (theme) {
    const themeColors = theme.colors;

    Object.entries(themeColors).forEach(([key, value]) => {
      div.style.setProperty(`--${key}`, value);
    });

    setToLocalStorage('theme', theme.id); // Persist the theme
  }
};
