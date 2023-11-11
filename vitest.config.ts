import path from 'path';
import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setupTests.ts'],
    exclude: [...configDefaults.exclude, 'e2e/**'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      all: true
   },
  },
});
