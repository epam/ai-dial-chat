/// <reference types='vitest' />
import { readFileSync } from 'fs';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import * as path from 'path';
import { createIsExternalPeerImport } from '../../tools/vite-external-matcher.mjs';
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
export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/chat-hooks',
  resolve: {
    alias: {
      '@epam/ai-dial-attachment-canvas': path.resolve(
        import.meta.dirname,
        '../attachment-canvas/src/index.ts',
      ),
      '@epam/ai-dial-mcp-apps': path.resolve(
        import.meta.dirname,
        '../mcp-apps/src/index.ts',
      ),
    },
  },
  plugins: [
    react(),
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(import.meta.dirname, 'tsconfig.lib.json'),
      rollupTypes: true,
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
        'viewport-layout': 'src/entry-points/viewport-layout.ts',
        'scroll-anchoring': 'src/entry-points/scroll-anchoring.ts',
        conversation: 'src/entry-points/conversation.ts',
        'conversation-transfer': 'src/entry-points/conversation-transfer.ts',
        'conversation-sources': 'src/entry-points/conversation-sources.ts',
        'file-manager': 'src/entry-points/file-manager.ts',
        'source-content': 'src/entry-points/source-content.ts',
        catalog: 'src/entry-points/catalog.ts',
        'skills-state': 'src/entry-points/skills-state.ts',
        'skill-editor': 'src/entry-points/skill-editor.ts',
        oauth: 'src/entry-points/oauth.ts',
        'scheduled-tasks': 'src/entry-points/scheduled-tasks.ts',
        sharing: 'src/entry-points/sharing.ts',
        attachments: 'src/entry-points/attachments.ts',
        utils: 'src/entry-points/utils.ts',
        'mcp-apps': 'src/entry-points/mcp-apps.ts',
      },
      name: '@epam/ai-dial-chat-hooks',
      formats: ['es' as const],
    },
    rollupOptions: {
      external: (id: string) =>
        id === 'react-dom' ||
        id === 'react/jsx-runtime' ||
        isExternalPeerImport(id),
      output: {
        preserveModules: true,
        preserveModulesRoot: path.join(import.meta.dirname, 'src'),
      },
    },
  },
  test: {
    name: '@epam/ai-dial-chat-hooks',
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
