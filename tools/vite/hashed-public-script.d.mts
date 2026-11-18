import type { Plugin } from 'vite';

export const rewritePublicScriptSrc: (
  html: string,
  publicPath: string,
  fileName: string,
) => string;
export const hashedPublicScriptPlugin: (publicPath: string) => Plugin;
