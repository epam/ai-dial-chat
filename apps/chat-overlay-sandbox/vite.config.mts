/// <reference types='vitest' />
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

const OVERLAY_SANDBOX_BASE_PATH = '/overlay-sandbox/';

export default defineConfig(({ command }) => ({
  root: import.meta.dirname,
  base: command === 'serve' ? '/' : OVERLAY_SANDBOX_BASE_PATH,
  cacheDir: '../../node_modules/.vite/apps/chat-overlay-sandbox',
  server: {
    port: 4300,
    host: 'localhost',
  },
  preview: {
    port: 4300,
    host: 'localhost',
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@epam/ai-dial-chat-overlay': path.resolve(
        import.meta.dirname,
        '../../libs/chat-overlay/src/index.ts',
      ),
      '@epam/ai-dial-chat-shared': path.resolve(
        import.meta.dirname,
        '../../libs/chat-shared/src/index.ts',
      ),
    },
  },
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [],
  // },
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  test: {
    name: 'chat-overlay-sandbox',
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
