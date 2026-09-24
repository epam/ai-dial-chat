/// <reference types='vitest' />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { createLibTailwindUtilities } from '../../tools/vite-lib-tailwind-utilities.mjs';
import * as path from 'path';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/prompts',
  plugins: [
    createLibTailwindUtilities({ root: import.meta.dirname }),
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
      entry: {
        index: 'src/index.ts',
        'parameters-popup': 'src/entry-points/parameters-popup.ts',
      },
      name: '@epam/ai-dial-prompts',
      formats: ['es' as const],
      cssFileName: 'index',
    },
    rolldownOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        '@epam/ai-dial-ui-kit',
        '@epam/ai-dial-chat-shared',
        '@epam/ai-dial-catalog',
        '@tabler/icons-react',
      ],
    },
  },
  test: {
    name: '@epam/ai-dial-prompts',
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
      '@epam/ai-dial-chat-shared': path.resolve(
        import.meta.dirname,
        '../chat-shared/src/index.ts',
      ),
      '@epam/ai-dial-catalog': path.resolve(
        import.meta.dirname,
        '../catalog/src/index.ts',
      ),
      '@epam/ai-dial-publish-panel': path.resolve(
        import.meta.dirname,
        '../publish-panel/src/index.ts',
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
