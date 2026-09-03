/// <reference types='vitest' />
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import dts from 'vite-plugin-dts';
import * as path from 'path';
import { isExternalPeerImport } from './src/utils/vite-external-matcher';

/*
 * Vite's library-mode `cssCodeSplit` extracts CSS reached only through a
 * dynamically-imported chunk into its own file, but — unlike an application
 * build — it does not emit any statement that loads that file when the
 * chunk's JS runs; that association only happens today because `apps/chat`
 * re-bundles this lib's *source* through its own application-mode Vite
 * build. A consumer that installs the packaged `dist/` output directly would
 * get the on-demand JS chunk but never its CSS. This plugin restores that
 * association in the built artifact itself: for every dynamic-import chunk
 * that has a same-named CSS asset, it prepends a CSS side-effect import. A
 * consuming bundler can then include that stylesheet in its normal dynamic
 * import preload contract and wait for it before resolving the JS chunk,
 * avoiding a flash of unstyled PDF UI without library-owned DOM mutation.
 */
const associateDynamicChunkCss = (): Plugin => ({
  name: 'attachment-canvas-associate-dynamic-chunk-css',
  generateBundle(_options, bundle) {
    for (const chunk of Object.values(bundle)) {
      if (chunk.type !== 'chunk' || !chunk.isDynamicEntry) continue;

      const cssAsset = Object.values(bundle).find(
        (output) =>
          output.type === 'asset' && output.fileName === `${chunk.name}.css`,
      );
      if (!cssAsset) continue;

      const cssImport = `import ${JSON.stringify(`./${cssAsset.fileName}`)};\n`;
      chunk.code = cssImport + chunk.code;
    }
  },
});

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/attachment-canvas',
  plugins: [
    react(),
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(import.meta.dirname, 'tsconfig.lib.json'),
    }),
    associateDynamicChunkCss(),
  ],
  resolve: {
    alias: {
      /*
       * Neither package declares these CSS files in its `exports` map, so
       * strict `exports`-map resolution (this lib's own build, and Vitest)
       * rejects the subpath import `PdfContent.tsx` uses. `apps/chat`
       * carries the same alias for the same reason when it bundles this
       * lib's source directly.
       */
      '@epam/ai-dial-react-pdf-highlighter/styles.css': path.resolve(
        import.meta.dirname,
        '../../node_modules/@epam/ai-dial-react-pdf-highlighter/dist/index.css',
      ),
      '@epam/pdf-highlighter-kit/dist/pdf-highlight-viewer.css': path.resolve(
        import.meta.dirname,
        '../../node_modules/@epam/pdf-highlighter-kit/dist/pdf-highlight-viewer.css',
      ),
    },
  },
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    cssCodeSplit: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    lib: {
      entry: 'src/index.ts',
      name: '@epam/ai-dial-attachment-canvas',
      fileName: 'index',
      formats: ['es' as const],
    },
    rollupOptions: {
      /*
       * A matcher, not a flat list: peer engines that ship deep JS subpaths
       * (`pdfjs-dist`, `@epam/ai-dial-react-pdf-highlighter`,
       * `@epam/pdf-highlighter-kit`, `react-syntax-highlighter`, `@mcp-ui/client`,
       * `@modelcontextprotocol/sdk`) need every such subpath externalized too,
       * while their vendor CSS subpaths (aliased above) must stay locally
       * resolved so Vite can extract them as real stylesheets. See
       * `isExternalPeerImport`.
       */
      external: isExternalPeerImport,
    },
  },
  test: {
    name: '@epam/ai-dial-attachment-canvas',
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
    server: {
      deps: {
        inline: [
          '@epam/pdf-highlighter-kit',
          '@epam/ai-dial-react-pdf-highlighter',
        ],
      },
    },
  },
}));
