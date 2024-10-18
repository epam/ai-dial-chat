export interface Theme {
  displayName: string;
  colors: Record<string, string>;
  topicColors: Record<string, string>;
  'app-logo': string;
  'font-family'?: string;
  'font-codeblock'?: string;
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
