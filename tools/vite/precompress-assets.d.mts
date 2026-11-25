import type { Plugin } from 'vite';

export const PRECOMPRESSED_EXTENSIONS: ReadonlySet<string>;
export const PRECOMPRESS_MIN_BYTES: number;
export const PrecompressedEncoding: Readonly<{ Brotli: 'br'; Gzip: 'gz' }>;
export const precompressDirectory: (outDir: string) => Promise<{
  variants: number;
  originalBytes: number;
  brotliBytes: number;
}>;
export const precompressAssetsPlugin: () => Plugin;
