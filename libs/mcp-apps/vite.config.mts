/// <reference types='vitest' />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import * as path from 'path';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/mcp-apps',
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
      /*
       * `constants` is a separate entry so the package's `./constants`
       * subpath exports a React-free module backend consumers can import
       * (apps/chat-api's MCP proxy) without pulling the React-peered barrel.
       */
      entry: {
        index: 'src/index.ts',
        constants: 'src/constants/mcp-protocol.ts',
      },
      name: '@epam/ai-dial-mcp-apps',
      formats: ['es' as const],
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        '@epam/ai-dial-attachment-canvas',
        '@epam/ai-dial-chat-shared',
        '@epam/ai-dial-ui-kit',
        '@tabler/icons-react',
      ],
    },
  },
  test: {
    name: '@epam/ai-dial-mcp-apps',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
