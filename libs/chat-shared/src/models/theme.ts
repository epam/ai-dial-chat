export interface ThemeConfiguration {
  themes: Theme[];
  images: ThemeImages;
}

/**
 * Theme-specific images and icons
 */
export interface ThemeImages {
  'default-addon': string;
  'default-model': string;
  favicon: string;
  /** Light theme logo URL */
  'chat-logo-light'?: string;
  /** Dark theme logo URL */
  'chat-logo-dark'?: string;
  /** Dynamic favicon URL (PNG format, 32x32 recommended) */
  'chat-favicon'?: string;
}

export interface Theme {
  id: string;
  displayName: string;
  colors: Record<string, string>;
  'app-logo': string;
}
