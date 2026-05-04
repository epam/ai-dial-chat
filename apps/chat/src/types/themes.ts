export interface Theme {
  displayName: string;
  colors: Record<string, string>;
  topicColors: Record<string, string>;
  authColors: Record<string, string>;
  banners?: Record<string, string>;
  'code-editor-theme'?: string;
  'app-logo': string;
  'chat-logo-light'?: string;
  'chat-logo-dark'?: string;
  'chat-favicon'?:string;
  'font-family'?: string;
  'font-codeblock'?: string;
  'border-radius'?: string;
  id: string;
}

export type ThemesImages = Record<string, string>;

export interface ThemesConfig {
  themes: Theme[];
  images: ThemesImages;
}
