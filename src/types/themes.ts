export interface ThemesConfig {
  themes: {
    colorsPalette: Record<string, string>;
  };
  images: {
    'app-logo': string;
    'app-logo-dark': string;
    'default-model': string;
    'default-addon': string;
    favicon: string;
  };
}
