/// <reference types='vitest' />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import * as path from 'path';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/navigation-panel',
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
      name: '@epam/ai-dial-navigation-panel',
      fileName: 'index',
      formats: ['es' as const],
    },
    rolldownOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        '@epam/ai-dial-chat-shared',
        '@epam/ai-dial-conversation-input',
        '@epam/ai-dial-ui-kit',
        '@tabler/icons-react',
        'classnames',
      ],
    },
  },
  test: {
    name: '@epam/ai-dial-navigation-panel',
    watch: false,
    globals: true,
    environment: 'jsdom',
    /*
     * Resolve workspace peers from source for tests only: their published
     * bundles import `.scss` modules that are not emitted to `dist`, which
     * vitest cannot load. Kept out of the shared `resolve.alias` so it never
     * affects this lib's own production build.
     */
    alias: {
      '@epam/ai-dial-attachment-input': path.resolve(
        import.meta.dirname,
        '../attachment-input/src/index.ts',
      ),
      '@epam/ai-dial-chat-shared': path.resolve(
        import.meta.dirname,
        '../chat-shared/src/index.ts',
      ),
      '@epam/ai-dial-conversation-input': path.resolve(
        import.meta.dirname,
        '../conversation-input/src/index.ts',
      ),
    },
    setupFiles: ['./src/test-setup.ts'],
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
