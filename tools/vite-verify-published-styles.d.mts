import type { Plugin } from 'vite';
export declare const createVerifyPublishedStyles: (options: {
  root: string;
  requiredMarkers: readonly string[];
  forbidEmbeddedFonts?: boolean;
  cssFileName?: string;
}) => Plugin;
