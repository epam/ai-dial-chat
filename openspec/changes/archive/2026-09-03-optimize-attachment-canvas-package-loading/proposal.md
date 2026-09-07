## Why

`@epam/ai-dial-attachment-canvas`'s standalone package build has real, verified defects that the app-level cold-load change (`archive/2026-09-03-optimize-chat-cold-load-performance`) explicitly left out of scope: `package.json#exports["./styles.css"]` points at `./dist/style.css`, a file the current Vite build never produces (it emits `dist/index.css`) — any consumer following the documented import breaks; the PDF-highlighter vendor CSS (`.pdf-container`, `.pdf-highlight-viewer`, …) is aggregated into that same single base stylesheet instead of loading only when a PDF actually opens, because `vite.config.mts` never sets `build.cssCodeSplit` (its library-mode default is `false`); and `@epam/ai-dial-react-pdf-highlighter`, `@epam/pdf-highlighter-kit`, and `react-syntax-highlighter` are declared `peerDependencies` but are absent from `rollupOptions.external`, so Rollup bundles private copies of all three (confirmed: `pdfjs-dist`'s `GlobalWorkerOptions`/`getDocument` surface is compiled directly into the `PdfContent` lazy chunk) instead of deferring to whatever copy the host app itself resolves. These are package-boundary defects independent of the app-side lazy-import fixes already shipped, and they affect every consumer of the package, not just `apps/chat`.

## What Changes

- Fix `package.json#exports["./styles.css"]` to match the actual built asset path, and split the PDF-highlighter vendor CSS into its own on-demand stylesheet keyed to the lazy `PdfContent` chunk, so importing the base stylesheet and rendering a non-PDF attachment never fetches PDF CSS.
- Externalize `pdfjs-dist`, `@epam/ai-dial-react-pdf-highlighter`, `@epam/pdf-highlighter-kit`, `@mcp-ui/client`, `@modelcontextprotocol/sdk`, and `react-syntax-highlighter` (with their package subpaths) in `vite.config.mts`'s `rollupOptions.external`, matching their `peerDependencies` declaration, so the built package defers to the host's own resolved copies instead of bundling private duplicates.
- Evolve the existing optional `configurePdfWorker` host-adapter contract (backward-compatibly) with precise asynchronous semantics: PDF rendering waits for the adapter's promise to resolve before mounting the viewer, concurrent PDF opens share one in-flight preparation, success is memoized, and rejection clears retryable state instead of being cached forever.
- Add local loading and error boundaries around the PDF and syntax-highlighter dynamic-import/runtime-preparation paths, with an accessible `role="status"` loading state, a `role="alert"` failure state, and a keyboard-accessible retry control (~44×44 CSS px on mobile) that re-attempts the failed import/preparation without stranding a permanent spinner or replacing the whole canvas.
- Align `pdfjs-dist`, `@epam/ai-dial-react-pdf-highlighter`, and `@epam/pdf-highlighter-kit` version ranges to the exact combination exercised by tests, and regenerate `package-lock.json` so a clean install resolves one consistent PDF dependency tree.
- Add automated package-boundary tests that walk the built entry's static import graph (excluding PDF.js/worker/PDF CSS/`react-syntax-highlighter`), plus a built-package consumer fixture that imports the public exports (not `@epam/source`), resolves `./styles.css`, and demonstrates initial-vs-on-demand chunk/CSS behavior.
- Record raw/gzip baselines for the standalone package's entry, base CSS, PDF/code async chunks, and the worker asset, plus the production `@epam/chat` initial graph, and define regression budgets from those measurements.
- **BREAKING (build output only, not the public API)**: consumers that reached into `dist/style.css` directly (bypassing the documented `exports` map) will need to update to the corrected path; the documented `./styles.css` subpath import is unaffected and stays backward-compatible.

## Capabilities

### New Capabilities

- `attachment-canvas-package-loading`: defines the publishable package's export-map integrity, CSS code-splitting (base vs. PDF-only), dependency-externalization policy, PDF worker asset strategy, and the package-boundary/consumer-fixture tests that verify the built artifact independently of workspace source aliases.

### Modified Capabilities

- `canvas`: the `configurePdfWorker` host-adapter contract gains documented async-preparation semantics (await-before-mount, shared in-flight preparation, memoized success, retryable rejection), and `PdfContent`/`CodeContent` gain local accessible loading/error/retry states for their dynamic-import and runtime-preparation failures, in place of the current bare `<Spinner>` fallback with no failure handling.

## Impact

- **Affected library**: `libs/attachment-canvas` — `package.json` (`exports`, `peerDependencies`/`dependencies`), `vite.config.mts` (external list, CSS code splitting, asset naming), `src/components/PdfContent/PdfContent.tsx`, `src/components/CodeContent/CodeContent.tsx`, `src/components/AttachmentCanvasBody/AttachmentCanvasBody.tsx`, README.md, and new package-boundary/consumer-fixture tests.
- **Affected app code**: `apps/chat/src/utils/pdf.ts` and the `AttachmentCanvasContainer` call site in `apps/chat/src/app/app.tsx` only to the extent the evolved `configurePdfWorker` semantics require an updated host implementation; no new host-owned integration surface (routes, REST paths, contexts) is introduced.
- **Library isolation**: no new host/external knowledge enters the lib; the PDF worker asset strategy and dependency externalization keep third-party runtime configuration at the application edge, per `AGENTS.md` §Library isolation.
- **Dependencies**: `pdfjs-dist` becomes an explicit peer of the canvas package, and `package-lock.json` is updated for the aligned `pdfjs-dist`/`@epam/ai-dial-react-pdf-highlighter`/`@epam/pdf-highlighter-kit` range combination; no bundled runtime dependency changes.
- **i18n/RTL**: new loading/error/retry label props default to English and are documented in the README; `apps/chat` supplies them through existing `AttachmentCanvasI18nKeys`-style react-i18next keys. RTL is preserved through inherited direction and logical CSS properties, unchanged.
- **Backward compatibility**: existing public props and behavior are preserved; only additive optional props/labels are introduced. The `./dist/style.css` → correct-path fix and CSS split are build-output changes, not public API changes.
- **Out of scope**: the archived `2026-09-03-optimize-chat-cold-load-performance` change, DOCX/XLSX/PPTX (`@silurus/ooxml`) renderer internals, `@epam/ai-dial-ui-kit` packaging, generated API-client work, and chat provider/backend behavior.
