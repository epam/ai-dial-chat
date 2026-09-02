## Why

A clean production build of `apps/chat` (`npx nx build chat --skip-nx-cache`, measured 2026-09-01) ships roughly **5.65 MB raw / ~1.65 MB gzip of JavaScript** and **~365 KB raw / ~68 KB gzip of CSS** as part of the *initial* graph referenced directly by `apps/chat/dist/index.html` — the entry script plus its 18 `modulepreload` chunks and 7 stylesheets. Two chunks alone account for 71% of that JS: `ui-kit-*.js` (2.94 MB raw / 878 KB gzip), which bundles `@epam/ai-dial-ui-kit`'s entire dist including Monaco's CDN loader and AG Grid's engine because the package has no per-component subpath exports, and `api-client-*.js` (1.31 MB raw / 360 KB gzip), the generated OpenAPI client. A third chunk (`src-DxE9wM7y.js`, 609 KB raw / 164 KB gzip) carries KaTeX and `react-syntax-highlighter` because `libs/chat-shared`'s `MarkdownRenderer` is rendered eagerly on the default `/` route. `apps/chat/src/main.tsx` also imports and configures `pdfjs-dist` unconditionally at module load (lines 1-9, 40), before routing or auth resolve, regardless of whether the session ever opens a PDF.

None of this is required to render the authenticated shell and composer on `/`. It sits on the critical path of every cold load and is the largest available lever for cutting cold-load latency without touching `apps/chat-api`, API contracts, or any documented library behavior.

## What Changes

- Split `@epam/ai-dial-ui-kit`'s Monaco- and AG-Grid-backed components out of the single eager `ui-kit` manual chunk (`apps/chat/vite.config.mts:158`) so grid/editor engine code loads only when a consuming feature (catalog `ListView`, file manager, editors) actually mounts — via the package's existing/added subpath exports, not private deep imports.
- Move eager `pdfjs-dist` import/worker configuration out of `apps/chat/src/main.tsx:1-9,40` into the attachment/PDF-preview feature boundary that actually needs it, so PDF.js only loads when a PDF is opened.
- Defer `MarkdownRenderer`'s KaTeX and `react-syntax-highlighter` dependencies (`libs/chat-shared/src/components/MarkdownRenderer/MarkdownRenderer.tsx` and `CodeBlock/CodeBlock.tsx`) behind a lazy boundary inside message rendering, so math/code-highlighting engines load only when a message actually contains math or a fenced code block, without deferring plain-text message rendering.
- Verify and, where the graph proves otherwise, strengthen the existing lazy boundaries around `ConversationInput`, `DialFileManagerModal`, `CatalogView`, `DialFileManagerPage`, editor pages, and other routes already wrapped in `React.lazy` in `apps/chat/src/app/app.tsx`, confirming their transitive bytes are actually absent from the `dist/index.html` preload graph (not just wrapped in `lazy()`).
- Reduce render-blocking CSS: investigate and, where duplication or non-critical feature styles are proven (e.g. Tailwind content scanning `@epam/ai-dial-ui-kit`'s and `@epam/ai-dial-react-file-manager`'s built `.js` in `node_modules`, `apps/chat/tailwind.config.js:13-17`), stop shipping non-critical feature CSS from the initial stylesheet set.
- Reduce uncoordinated root-provider network fan-out during the authenticated bootstrap (`apps/chat/src/context/*`) where duplicate or route-irrelevant requests are proven — without changing ownership, caching, error handling, or post-navigation data availability, and without serializing calls that are currently safe in parallel.
- Establish a reproducible, documented lab measurement profile and before/after bundle report so future changes can be judged against the same baseline.

**BREAKING**: None intended. If closing the `@epam/ai-dial-ui-kit` packaging gap requires a new subpath export, the existing root export (`.`) must keep working unchanged; any package change that cannot stay backward-compatible is removed from this change and proposed separately.

## Capabilities

### New Capabilities

- `chat-cold-load-performance`: defines the initial-load byte budgets, the required lazy/deferred boundaries for non-critical heavy dependencies (PDF.js, Monaco, AG Grid, KaTeX, syntax highlighting, generated API-client bulk), and the repeatable lab measurement procedure used to verify cold-load performance for the `/` route without regressing `/conversations/:id`, auth/session behavior, or any documented library contract.

### Modified Capabilities

_None._ No existing `openspec/specs/*` capability was found describing bundle composition, provider bootstrap sequencing, or load performance; this work only touches implementation details behind already-stable user-visible behavior (routing, auth, conversation semantics, attachments, catalog, file manager). No spec-level requirement of an existing capability changes.

## Impact

- **Affected code**: `apps/chat/src/main.tsx`, `apps/chat/src/app/app.tsx`, `apps/chat/vite.config.mts`, `apps/chat/tailwind.config.js`, `apps/chat/src/context/**` (provider bootstrap only, not contracts), `apps/chat/src/components/NewConversationComposer/NewConversationComposer.tsx`, `apps/chat/src/components/ConversationView/ConversationView.tsx`, message-rendering call sites of `libs/chat-shared`'s `MarkdownRenderer`.
- **Affected libraries**: `@epam/ai-dial-ui-kit` (packaging/export surface only, pending confirmation of what's feasible without a breaking change — flagged in design), `libs/chat-shared` (internal lazy boundary around `MarkdownRenderer`'s heavy deps; public exports unchanged), `libs/conversation-input` (verification only, expected no change).
- **Explicitly out of scope**: `apps/chat-api`, generated OpenAPI client contracts, authentication/session/CSRF semantics, streaming behavior, and any BFF delivery-header change (documented as a follow-up if proven material).
- **Dependencies**: no new runtime dependency; no dependency version upgrades unless separately justified and approved.
- **Systems**: production static asset delivery under the existing base path/CSP (verified, not changed); no infrastructure change.
