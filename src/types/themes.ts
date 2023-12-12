export interface ThemesConfig {
  themes: {
    colors: Record<string, string>;
    'app-logo': string;
    cssClass: string;
  }[];
  images: {
    'default-model': string;
    'default-addon': string;
    favicon: string;
  };
}
