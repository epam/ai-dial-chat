export type Theme = 'dark' | 'light';
export interface Settings {
  theme: Theme;
}

export const availableThemes: Record<Theme, boolean> = {
  dark: true,
  light: true,
};
