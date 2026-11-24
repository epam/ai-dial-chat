import type { Plugin } from 'vite';

export const inlinePublicScript: (
  html: string,
  publicPath: string,
  source: string,
) => string;
export const inlinePublicScriptPlugin: (publicPath: string) => Plugin;
