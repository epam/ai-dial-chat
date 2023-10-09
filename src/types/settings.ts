export const availableThemes: Theme[] = ['dark', 'light'];

export type Theme = 'dark' | 'light';
export interface Settings {
  theme: Theme;
}
