import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** No source aliases: imports must resolve through packed node_modules. */
export default defineConfig(() => ({
  root: import.meta.dirname,
  plugins: [react()],
  build: { outDir: './dist', emptyOutDir: true },
  test: { environment: 'jsdom', include: ['tests/**/*.spec.ts'] },
}));
