/// <reference types='vitest' />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import * as path from 'path';
import { createIsExternalPeerImport } from '../../tools/vite-external-matcher.mjs';
import { createVerifyPublishedStyles } from '../../tools/vite-verify-published-styles.mjs';
const REQUIRED_PUBLISHED_STYLE_MARKERS = [
  '.desktop\\:mt-2',
  '.rtl\\:flex-row-reverse',
] as const;
const EXTERNAL_PEER_NAMES = ['@epam/ai-dial-chat-shared'];
const isExternalPeerImport = createIsExternalPeerImport(EXTERNAL_PEER_NAMES);
export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/publish-panel',
  plugins: [
    react(),
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(import.meta.dirname, 'tsconfig.lib.json'),
    }),
    createVerifyPublishedStyles({
      root: import.meta.dirname,
      requiredMarkers: REQUIRED_PUBLISHED_STYLE_MARKERS,
      forbidEmbeddedFonts: true,
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
      name: '@epam/ai-dial-publish-panel',
      fileName: 'index',
      formats: ['es' as const],
    },
    rollupOptions: {
      external: (id) =>
        [
          'react',
          'react-dom',
          'react/jsx-runtime',
          '@epam/ai-dial-ui-kit',
          '@tabler/icons-react',
        ].includes(id) || isExternalPeerImport(id),
    },
  },
  test: {
    name: '@epam/ai-dial-publish-panel',
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
