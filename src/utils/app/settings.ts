import { availableThemes } from '@/src/types/settings';

export const validateTheme = (theme: string) => {
  return theme in availableThemes;
};
