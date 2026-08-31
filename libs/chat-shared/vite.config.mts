/// <reference types='vitest' />
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import dts from 'vite-plugin-dts';
import * as path from 'path';

const REQUIRED_PUBLISHED_STYLE_MARKERS = [
  '.mobile\\:\\!w-full',
  '.desktop\\:p-4',
  '.rtl\\:scale-x-\\[-1\\]',
  '.text-start',
  ':disabled',
] as const;

const verifyPublishedStyles = (): Plugin => ({
  name: 'verify-published-styles',
  apply: 'build',
  closeBundle: () => {
    const css = readFileSync(
      new URL('./dist/index.css', import.meta.url),
      'utf8',
    );

    for (const marker of REQUIRED_PUBLISHED_STYLE_MARKERS) {
      if (!css.includes(marker)) {
        throw new Error(`Published stylesheet is missing ${marker}`);
      }
    }

    if (/data:font\/[^;]+;base64,/.test(css)) {
      throw new Error('Published stylesheet must not embed font data');
    }
  },
});

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/chat-shared',
  resolve: {
    alias: {
      /* remark-math resolves math delimiters through micromark-extension-math, which only
       * recognizes `$...$`/`$$...$$`. This fork additionally recognizes the `\(...\)`/`\[...\]`
       * delimiters that LLMs commonly emit. */
      'micromark-extension-math': 'micromark-extension-llm-math',
    },
  },
  plugins: [
    react(),
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(import.meta.dirname, 'tsconfig.lib.json'),
    }),
    verifyPublishedStyles(),
  ],
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    lib: {
      entry: 'src/index.ts',
      name: '@epam/ai-dial-chat-shared',
      fileName: 'index',
      formats: ['es' as const],
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        '@epam/ai-dial-ui-kit',
        '@epam/ai-dial-react-file-manager',
        'ag-grid-community',
        /*
         * Vite library mode inlines imported font assets into emitted CSS.
         * Keep KaTeX's stylesheet external so the shared File Manager stylesheet
         * does not embed every math font; the peer package remains responsible
         * for resolving its own font assets when MarkdownRenderer is consumed.
         */
        'katex/dist/katex.min.css',
      ],
    },
  },
  test: {
    name: '@epam/ai-dial-chat-shared',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
