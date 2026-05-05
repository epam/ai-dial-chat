/// <reference types='vitest' />
import { configDefaults, defineConfig } from 'vitest/config';

import react from '@vitejs/plugin-react';

import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import path from 'path';

export default defineConfig({
  root: __dirname,
  plugins: [nxViteTsPaths(), react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      'micromark-extension-math': 'micromark-extension-llm-math',
    },
  },

  test: {
    cache: false,
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setupTests.ts'],
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: [...configDefaults.exclude],
    coverage: {
      reportsDirectory: '../../coverage/chat',
      reporter: ['text', 'json', 'html'],
      provider: 'v8',
    },
    reporters: 'verbose',
    css: true,
  },
});
