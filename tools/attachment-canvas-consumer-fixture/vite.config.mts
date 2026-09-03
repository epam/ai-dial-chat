import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/*
 * Deliberately no `resolve.alias` and no `tsconfig.base.json` extension:
 * every other in-repo consumer of `@epam/ai-dial-attachment-canvas` aliases
 * the bare specifier straight to `libs/attachment-canvas/src/index.ts`
 * (see `apps/chat/vite.config.mts`), which is exactly how the broken
 * `./styles.css` export (design.md Context #1) went unnoticed for so long.
 * This fixture resolves the specifier through plain Node module resolution
 * instead, walking up to whatever `pack-lib` installed in this project's own
 * `node_modules/@epam/ai-dial-attachment-canvas` — the real published
 * package shape, not the workspace source alias.
 */
export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/tools/attachment-canvas-consumer-fixture',
  plugins: [react()],
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
  },
}));
