export interface Theme {
  displayName: string;
  colors: Record<string, string>;
  topicColors: Record<string, string>;
  authColors: Record<string, string>;
  banners?: Record<string, string>;
  'code-editor-theme'?: string;
  'app-logo': string;
  'font-family'?: string;
  'font-codeblock'?: string;
  'border-radius'?: number;
  id: string;
}

export type ThemesImages = Record<string, string>;

export interface ThemesConfig {
  themes: Theme[];
  images: ThemesImages;
}
