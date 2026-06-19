export interface ThemeImages {
  'default-addon': string;
  'default-model': string;
  favicon: string;
  'chat-logo-light'?: string;
  'chat-logo-dark'?: string;
  'chat-favicon'?: string;
}

export interface Theme {
  id: string;
  displayName: string;
  colors: Record<string, string>;
  'app-logo': string;
}

export interface ThemeConfiguration {
  themes: Theme[];
  images: ThemeImages;
}
