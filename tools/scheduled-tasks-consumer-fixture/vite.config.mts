import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { nxReadySignal } from '@nx/vite/plugins/nx-ready-signal.plugin';

/** No source aliases: imports must resolve through packed node_modules. */
export default defineConfig(() => ({
  root: import.meta.dirname,
  plugins: [react(), nxReadySignal()],
  build: { outDir: './dist', emptyOutDir: true },
  test: { environment: 'jsdom', include: ['tests/**/*.spec.ts'] },
}));
