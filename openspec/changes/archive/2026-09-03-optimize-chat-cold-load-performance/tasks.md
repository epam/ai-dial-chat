**Slicing strategy:** risk-first, followed by independently verifiable vertical slices. Establish the bundle baseline and prove each import path first; then land PDF, markdown/code, and app chunking changes separately, measuring after every bundle-affecting slice.

## 1. Baseline and dependency-path investigation

- [x] 1.1 Build `apps/chat` cleanly with `npm exec nx build chat -- --skip-nx-cache` and record every script, `modulepreload`, and stylesheet referenced by `apps/chat/dist/index.html`.
- [x] 1.2 Add `scripts/measure-initial-bundle.mjs` to report per-file and aggregate raw/gzip JS and CSS sizes using one repeatable method.
- [x] 1.3 Inspect the UI-kit package output and `apps/chat/vite.config.mts` to distinguish the existing lazy Monaco path from the statically embedded AG Grid path. Record AG Grid packaging outside this change's implementation scope.
- [x] 1.4 Trace attachment canvas from the app root through `AttachmentCanvasBody` to PDF.js and confirm that an internal PDF dynamic-import boundary is required.
- [x] 1.5 Trace all `ConversationsContext.tsx` `listConversations()` call sites and identify which are reachable during cold load.

**Verification:** `npm exec nx build chat -- --skip-nx-cache`; `node scripts/measure-initial-bundle.mjs`. Baseline recorded in `design.md`: 1,656,352 gzip bytes JS, 68,287 gzip bytes CSS, 1,724,639 gzip bytes total.

## 2. Defer PDF.js behind the attachment-canvas PDF boundary

- [x] 2.1 Remove eager PDF.js and worker imports/configuration from `apps/chat/src/main.tsx`.
- [x] 2.2 Lazy-load `libs/attachment-canvas/src/components/PdfContent/PdfContent.tsx` only for `AttachmentContentType.Pdf`, with a `Suspense` loading status.
- [x] 2.3 Keep PDF runtime ownership at the application edge: implement `apps/chat/src/utils/pdf.ts` and pass its optional `configurePdfWorker` callback through the attachment-canvas public props.
- [x] 2.4 Move PDF-only vendor CSS from `apps/chat/src/main.tsx` to the lazy PDF feature.
- [x] 2.5 Cover PDF rendering, the non-PDF fast path, loading state, and callback forwarding in attachment-canvas tests.
- [x] 2.6 Rebuild and confirm that the app's initial graph contains no PDF.js core, worker, or PDF-only lazy chunk.

**Verification:**

- `npm run test:file -- libs/attachment-canvas/src/components/AttachmentCanvasBody/tests/AttachmentCanvasBody.spec.tsx`
- `npm run test:file -- libs/attachment-canvas/src/components/PdfContent/tests/PdfContent.spec.tsx`
- `npm exec nx test @epam/ai-dial-attachment-canvas`
- `npm run verify:changed`
- `npm exec nx build chat -- --skip-nx-cache`
- `node scripts/measure-initial-bundle.mjs`

Measured slice result: 132,305 gzip bytes removed from the initial graph.

## 3. Defer KaTeX and syntax highlighting

- [x] 3.1 In `libs/chat-shared/src/components/MarkdownRenderer/MarkdownRenderer.tsx`, dynamically load `rehype-katex` and KaTeX CSS only when math content is detected.
- [x] 3.2 In `libs/chat-shared/src/components/MarkdownRenderer/CodeBlock/CodeBlock.tsx`, dynamically load `react-syntax-highlighter` only for fenced language code while rendering readable code immediately as the fallback.
- [x] 3.3 In `libs/attachment-canvas/src/components/CodeContent/CodeContent.tsx`, apply the same language-sensitive highlighter boundary so the app root does not retain a second eager highlighter path.
- [x] 3.4 Cover plain-text fast paths, math/code paths, and streaming transitions from plain text to math or fenced code.
- [x] 3.5 Document the asynchronous rendering behavior in `libs/chat-shared/README.md` and `libs/attachment-canvas/README.md`.
- [x] 3.6 Rebuild the affected libraries and app; confirm no KaTeX or syntax-highlighter implementation is referenced by `dist/index.html`.

**Verification:**

- `npm run test:file -- libs/chat-shared/src/components/MarkdownRenderer/tests/MarkdownRenderer.spec.tsx`
- `npm run test:file -- libs/chat-shared/src/components/MarkdownRenderer/tests/MarkdownCodeBlock.spec.tsx`
- `npm run test:file -- libs/attachment-canvas/src/components/CodeContent/tests/CodeContent.spec.tsx`
- `npm exec nx test @epam/ai-dial-chat-shared`
- `npm exec nx test @epam/ai-dial-attachment-canvas`
- `npm exec nx build @epam/ai-dial-chat-shared`
- `npm exec nx build chat -- --skip-nx-cache`
- `npm run verify:changed`

Measured combined PDF/markdown/code result: 224,116 gzip bytes removed from the original initial graph.

## 4. Preserve the UI kit's lazy Monaco boundary

- [x] 4.1 Narrow `apps/chat/vite.config.mts`'s `manualChunks` matcher so it groups the UI-kit entry without re-merging files reached through the package's dynamic imports.
- [x] 4.2 Rebuild and confirm Monaco implementation code is absent from the initial graph while affected editor routes retain their existing lazy chunks.

**Verification:** `npm exec nx build chat -- --skip-nx-cache`; `node scripts/measure-initial-bundle.mjs`; inspect initial assets for Monaco loader/runtime signatures. No UI-kit package export or AG Grid implementation task belongs to this change.

## 5. Evaluate CSS critical-path candidates

- [x] 5.1 Generate Tailwind output with and without the two `node_modules` content globs in `apps/chat/tailwind.config.js` and compare the generated selector sets.
- [x] 5.2 Retain both globs after the comparison proves that they contribute real UI-kit and file-manager utilities rather than dead CSS.
- [x] 5.3 Record that no Tailwind configuration change or visual-regression surface was introduced by this investigation.

**Verification:** rebuild `apps/chat` and remeasure with `node scripts/measure-initial-bundle.mjs`. The retained config produces no separate byte delta for this slice.

## 6. Audit provider startup requests

- [x] 6.1 Confirm only the identity/mount effect calls `listConversations()` during cold load; mutation refresh and SSE refresh have distinct triggers.
- [x] 6.2 Leave `ConversationsContext.tsx` unchanged because no duplicate cold-load request was proven.
- [x] 6.3 Confirm no other root provider was serialized or otherwise changed.
- [x] 6.4 Run existing conversation-context regression coverage for initial load, identity changes, post-mutation refresh, and SSE refresh.

**Verification:** `npm run test:file -- apps/chat/src/context/tests/ConversationsContext.spec.tsx`; `npm run verify:changed`.

## 7. Audit existing lazy boundaries

- [x] 7.1 Rebuild and inspect the initial graph for route/component boundaries covering file manager, catalog, settings, editors, invitation pages, and not-found handling.
- [x] 7.2 Record the `ConversationInput` package-barrel leak discovered through eager `SendOnEnter` imports as a separate package-boundary follow-up; do not claim that boundary is effective and do not add an unsafe app-only cast.
- [x] 7.3 Confirm the deliberate eager conversation-page prefetch in `apps/chat/src/app/app.tsx` remains unchanged.
- [x] 7.4 Run existing integration suites for the affected lazy routes and components.

**Verification:** affected catalog, file-manager, settings, scheduled-task, editor, sharing, not-found, conversation-route, attachment-canvas, and chat-shared Vitest suites passed during implementation. No e2e project or live browser was available, so no browser result is claimed.

## 8. Final budgets and documented lab procedure

- [x] 8.1 Produce the final raw/gzip table from a clean build using `scripts/measure-initial-bundle.mjs`.
- [x] 8.2 Confirm the scoped budgets: at least 30% reduction, JS ≤1,100,000 gzip bytes, CSS ≤60,000 gzip bytes, total ≤1,160,000 gzip bytes.
- [x] 8.3 Document the future browser lab profile in `design.md`, including CPU/network/browser/cache/auth conditions, run count, LCP reporting, and the definition of the `chat-ready` milestone. Do not claim that the profile, instrumentation, or production RUM was executed.
- [x] 8.4 Verify statically that changed chunks use the existing hashed asset path and do not introduce a new CSP origin or asset-serving path.

Final measured result:

| | raw bytes | gzip bytes | baseline → final |
|---|---:|---:|---:|
| JS | 3,895,371 | 1,082,371 | 1,656,352 → 1,082,371 (−34.7%) |
| CSS | 301,683 | 54,137 | 68,287 → 54,137 (−20.7%) |
| **Total** | **4,197,054** | **1,136,508** | **1,724,639 → 1,136,508 (−34.1%)** |

All scoped budgets are met. AG Grid, generated API-client bulk, conversation-input packaging, attachment-canvas package hardening, and delivery/browser measurement are documented as separate follow-ups in `design.md`.

## 9. Final verification record

- [x] 9.1 Run `npm run build:quiet`; affected builds passed at implementation time.
- [x] 9.2 Run `npm run validate:docs`; record the unrelated pre-existing `libs/chat-hooks/README.md` export mismatch rather than changing it in this performance slice.
- [x] 9.3 Run exactly one `npm run verify:full`; full tests and lint passed, while pre-existing unrelated typecheck/format failures were recorded in the implementation review.
- [x] 9.4 Confirm affected-scope typecheck, lint, tests, and builds passed for the implementation baseline used by the final bundle report.
- [x] 9.5 Re-read `proposal.md`, `design.md`, and the delta spec and confirm that incomplete package-level work is described only as a follow-up, not as a completed requirement.
