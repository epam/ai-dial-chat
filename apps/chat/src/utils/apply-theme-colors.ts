import { Theme } from '@epam/ai-dial-chat-shared';
import { StorageKey } from '../constants/storage';
import { setToLocalStorage } from './local-storage';

export const applyThemeColors = (div: HTMLElement, theme?: Theme) => {
  if (theme) {
    const themeColors = theme.colors;

    Object.entries(themeColors).forEach(([key, value]) => {
      div.style.setProperty(`--${key}`, value);
    });

    setToLocalStorage(StorageKey.Theme, theme.id); // Persist the theme
  }
};
