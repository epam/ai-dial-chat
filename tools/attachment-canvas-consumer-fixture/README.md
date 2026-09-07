# attachment-canvas-consumer-fixture

A minimal Vite application that proves `@epam/ai-dial-attachment-canvas`'s
published package boundary actually holds, per
`openspec/changes/optimize-attachment-canvas-package-loading/design.md`'s
Decision 6.

## Why this exists

Every in-repo consumer of `@epam/ai-dial-attachment-canvas` (`apps/chat`, this
lib's own Vitest suite) resolves the bare specifier straight to
`libs/attachment-canvas/src/index.ts` through a `resolve.alias` — never
through the package's own `exports` map. That's exactly how the broken
`"./styles.css": "./dist/style.css"` export went unnoticed for so long: no
in-repo consumer ever touched it. This fixture is the one place in the
workspace that installs the package the way a real downstream consumer would
and then builds against it.

## What it does

1. `pack-lib` (`scripts/pack-and-install.mjs`) rewrites
   `libs/attachment-canvas/dist/package.json` into the same publish-ready
   shape `tools/publish-lib.mjs` produces for a real `npm publish` (strips
   `"./dist/"` export prefixes, drops the `"@epam/source"` condition,
   `"private"`, and `"nx"`), runs `npm pack` from inside `dist/`, and installs
   the resulting tarball with a real offline `npm install` into this project's own
   `node_modules/@epam/ai-dial-attachment-canvas` — never the workspace
   root's, which npm workspaces symlinks straight to `libs/attachment-canvas`
   source.
2. `build` (depends on `pack-lib`) builds `src/main.tsx`, which imports only
   `@epam/ai-dial-attachment-canvas` (the public root) and its documented
   `./styles.css` subpath — never a deep `src`/`dist` path.
3. `verify` (depends on `build`, `scripts/verify-build-output.mjs`) reads the
   built `dist/index.html` to find the eager asset graph (the same technique
   `scripts/measure-initial-bundle.mjs` uses) and asserts that neither the
   `pdfjs-dist` engine (`GlobalWorkerOptions`) nor the
   `react-syntax-highlighter` engine (`refractor`) appears in it — both exist
   only in on-demand chunks, reachable only through the PDF/code dynamic
   import boundaries this package's own lazy-loading relies on. It also
   verifies that the generated JavaScript chunk graph references the lazy PDF
   stylesheet, preventing an orphaned CSS artifact or a flash of unstyled PDF
   content.

## Running it

```bash
npm exec nx run attachment-canvas-consumer-fixture:verify
```

This transitively builds `@epam/ai-dial-attachment-canvas` first (via Nx's
project-to-project `dependsOn`), so it always packs the current source.

Peer dependencies (`react`, `@epam/ai-dial-ui-kit`, `@epam/ai-dial-react-pdf-highlighter`,
etc.) are deliberately never installed locally into this fixture — they
resolve through plain Node module resolution up to the workspace root's own
`node_modules`, exactly as they would for a real host application that
already has its own copies of those peers installed.
