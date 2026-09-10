/// <reference types='vitest' />
import { readFileSync } from 'fs';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import * as path from 'path';
import { createIsExternalPeerImport } from '../../tools/vite-external-matcher.mjs';
import { createVerifyPublishedStyles } from '../../tools/vite-verify-published-styles.mjs';
const ownPackageJson = JSON.parse(
  readFileSync(path.join(import.meta.dirname, 'package.json'), 'utf8'),
) as {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};
const EXTERNAL_PEER_NAMES = [
  ...Object.keys(ownPackageJson.dependencies ?? {}),
  ...Object.keys(ownPackageJson.peerDependencies ?? {}),
];
const isExternalPeerImport = createIsExternalPeerImport(EXTERNAL_PEER_NAMES);
const REQUIRED_PUBLISHED_STYLE_MARKERS = [
  '.mobile\\:\\!w-full',
  '.desktop\\:p-4',
  '.rtl\\:scale-x-\\[-1\\]',
  '.text-start',
  ':disabled',
] as const;
export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/chat-shared',
  resolve: {
    alias: {
      'micromark-extension-math': 'micromark-extension-llm-math',
    },
  },
  plugins: [
    react(),
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(import.meta.dirname, 'tsconfig.lib.json'),
      rollupTypes: true,
    }),
    createVerifyPublishedStyles({
      root: import.meta.dirname,
      requiredMarkers: REQUIRED_PUBLISHED_STYLE_MARKERS,
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
        'file-manager': 'src/entry-points/file-manager.ts',
        markdown: 'src/entry-points/markdown.ts',
      },
      name: '@epam/ai-dial-chat-shared',
      cssFileName: 'index',
      formats: ['es' as const],
    },
    rollupOptions: {
      external: (id: string) =>
        id === 'react-dom' ||
        id === 'react/jsx-runtime' ||
        id === 'katex/dist/katex.min.css' ||
        isExternalPeerImport(id),
      output: {
        preserveModules: true,
        preserveModulesRoot: path.join(import.meta.dirname, 'src'),
      },
    },
  },
  test: {
    name: '@epam/ai-dial-chat-shared',
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
