/** Root theme configuration loaded from the server at startup. */
export interface ThemeConfiguration {
  /** Available themes the user can switch between. */
  themes: Theme[];
  /** Global image/icon assets shared across all themes. */
  images: ThemeImages;
}

/**
 * Theme-specific images and icons
 */
export interface ThemeImages {
  /** Fallback icon URL used when an add-on has no custom image. */
  'default-addon': string;
  /** Fallback icon URL used when a model has no custom image. */
  'default-model': string;
  /** Browser tab favicon URL. */
  favicon: string;
  /** Light theme logo URL */
  'chat-logo-light'?: string;
  /** Dark theme logo URL */
  'chat-logo-dark'?: string;
  /** Dynamic favicon URL (PNG format, 32x32 recommended) */
  'chat-favicon'?: string;
}

/** A single selectable UI theme. */
export interface Theme {
  /** Unique theme identifier (e.g. `'dark'`, `'light'`). */
  id: string;
  /** Human-readable name shown in the theme picker. */
  displayName: string;
  /** CSS custom-property overrides keyed by variable name (without `--` prefix). */
  colors: Record<string, string>;
  /** URL of the application logo asset for this theme. */
  'app-logo': string;
}
