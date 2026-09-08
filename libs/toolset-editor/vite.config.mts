/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import * as path from 'path';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/toolset-editor',
  plugins: [
    react(),
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(import.meta.dirname, 'tsconfig.lib.json'),
    }),
  ],
  resolve: {
    /*
     * Resolve workspace peers from source: their published bundles import
     * `.scss` modules that are not emitted to `dist`, which vitest cannot
     * load. The editor only imports the `@epam/ai-dial-chat-hooks` root
     * barrel, never its dependency-scoped subpaths, so a single alias
     * suffices.
     */
    alias: {
      '@epam/ai-dial-builder-form': path.resolve(
        import.meta.dirname,
        '../builder-form/src/index.ts',
      ),
      '@epam/ai-dial-chat-hooks': path.resolve(
        import.meta.dirname,
        '../chat-hooks/src/index.ts',
      ),
      '@epam/ai-dial-chat-shared': path.resolve(
        import.meta.dirname,
        '../chat-shared/src/index.ts',
      ),
    },
  },
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    lib: {
      entry: 'src/index.ts',
      name: '@epam/ai-dial-toolset-editor',
      fileName: 'index',
      formats: ['es' as const],
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        '@epam/ai-dial-ui-kit',
        '@epam/ai-dial-builder-form',
        '@epam/ai-dial-chat-hooks',
        '@epam/ai-dial-chat-shared',
        '@tabler/icons-react',
      ],
    },
  },
  test: {
    name: '@epam/ai-dial-toolset-editor',
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
