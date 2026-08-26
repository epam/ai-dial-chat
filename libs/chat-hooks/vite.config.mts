/// <reference types='vitest' />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import * as path from 'path';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/chat-hooks',
  resolve: {
    /*
     * Resolves to source for tests only (rollupOptions.external keeps the
     * production build from bundling it either way) — the built dist eagerly
     * references browser globals (e.g. DOMMatrix) that jsdom doesn't provide,
     * while the source only touches them when actually invoked.
     */
    alias: {
      '@epam/ai-dial-attachment-canvas': path.resolve(
        import.meta.dirname,
        '../attachment-canvas/src/index.ts',
      ),
    },
  },
  plugins: [
    react(),
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(import.meta.dirname, 'tsconfig.lib.json'),
    }),
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
      name: '@epam/ai-dial-chat-hooks',
      fileName: 'index',
      formats: ['es' as const],
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        '@epam/ai-dial-attachment-canvas',
        '@epam/ai-dial-attachment-input',
        '@epam/ai-dial-chat-api-client',
        '@epam/ai-dial-chat-shared',
        '@epam/ai-dial-quotations',
        '@epam/ai-dial-react-file-manager',
        '@epam/ai-dial-share',
        'fflate',
      ],
    },
  },
  test: {
    name: '@epam/ai-dial-chat-hooks',
    watch: false,
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
