export interface Theme {
  displayName: string;
  colors: Record<string, string>;
  'app-logo': string;
  fontFamily: string;
  id: string;
}

export interface ThemesConfig {
  themes: Theme[];
  images: {
    'default-model': string;
    'default-addon': string;
    favicon: string;
  };
}
