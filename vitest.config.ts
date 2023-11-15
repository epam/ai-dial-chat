import react from '@vitejs/plugin-react';

import path from 'path';
import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setupTests.ts'],
    exclude: [...configDefaults.exclude, 'e2e/**'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      // TODO: in future enable this validation with 80% coverage
      // statements: 80,
      // lines: 80,
      // branches: 80,
      // functions: 80,
    },
    reporters: 'verbose',
  },
});
