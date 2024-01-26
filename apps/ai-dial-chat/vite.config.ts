/// <reference types='vitest' />
import { configDefaults } from 'vitest/config';

import react from '@vitejs/plugin-react';

import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/ai-dial-chat',
  plugins: [nxViteTsPaths(), react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },

  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },

  test: {
    globals: true,
    environment: 'jsdom',
    cache: {
      dir: '../../node_modules/.vitest',
    },
    setupFiles: ['./tests/setupTests.ts'],
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: [...configDefaults.exclude],
    coverage: {
      reportsDirectory: '../../coverage/apps/ai-dial-chat',
      reporter: ['text', 'json', 'html'],
      provider: 'v8',
    },
    reporters: 'verbose',
    css: true,
  },
});
