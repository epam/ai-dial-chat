## Problem

A clean production build of `apps/chat` (`npm exec nx build chat -- --skip-nx-cache`, measured 2026-09-01) ships roughly **5.65 MB raw / ~1.65 MB gzip of JavaScript** and **~365 KB raw / ~68 KB gzip of CSS** as part of the initial graph referenced directly by `apps/chat/dist/index.html`. PDF.js, Monaco, KaTeX, `react-syntax-highlighter`, and feature-only vendor styles are loaded before the authenticated shell and composer need them. This adds transfer, parse, and evaluation work to every cold load of `/`.

The generated API client and AG Grid code embedded in `@epam/ai-dial-ui-kit` are also material contributors, but they require separate package-level changes and are not part of this change's implementation scope.

## Solution

- Move PDF.js and its worker configuration out of `apps/chat/src/main.tsx` and load the PDF renderer through an attachment-canvas feature boundary. Keep PDF runtime configuration at the application edge through an additive, optional callback passed to `@epam/ai-dial-attachment-canvas`.
- Defer KaTeX and `react-syntax-highlighter` behind content-sensitive lazy boundaries so plain text does not load either engine.
- Narrow `apps/chat/vite.config.mts`'s UI-kit manual-chunk matcher so it preserves the UI kit's existing lazy Monaco boundary. AG Grid packaging remains a separate follow-up owned by `@epam/ai-dial-ui-kit`.
- Move PDF-viewer and route-only markdown-editor styles out of the app entry module and into the features that consume them.
- Audit existing route/component lazy boundaries and authenticated provider startup. Record package-level or delivery-layer bottlenecks as follow-ups instead of expanding this change.
- Add a repeatable bundle-measurement script and document a lab profile for future browser-based before/after measurements.

The selected approach uses narrow, independently revertible lazy boundaries. A conservative measurement-only change was rejected because it would leave confirmed heavy dependencies on the cold-load path. A repo-wide bootstrap orchestrator, generated-client decomposition, UI-kit AG Grid packaging, and broader attachment-canvas package optimization were rejected for this change because they have different owners and substantially larger regression surfaces.

## Non-goals

- Changing `@epam/ai-dial-ui-kit` package exports or removing its embedded AG Grid engine; that work is tracked separately.
- Optimizing the generated OpenAPI client bundle or changing generated API contracts.
- Broadly optimizing the standalone `@epam/ai-dial-attachment-canvas` package, its dependency ownership, or its package-level CSS output beyond the narrow lazy boundary needed by `apps/chat`.
- Changing `apps/chat-api`, authentication/session/CSRF semantics, streaming behavior, routing semantics, or provider ownership.
- Introducing production RUM or requiring a deployed Lighthouse run in this change.
- Removing or degrading a user-visible feature to improve a metric.

## Acceptance criteria

- The initial graph referenced by `apps/chat/dist/index.html` contains no PDF.js, PDF worker, Monaco, KaTeX, or `react-syntax-highlighter` implementation code. AG Grid is explicitly excluded from this criterion.
- Against the reproduced baseline of 1,724,639 gzip bytes, the initial graph is reduced by at least 30% and stays within **1,100,000 gzip bytes of JS**, **60,000 gzip bytes of CSS**, and **1,160,000 gzip bytes total**.
- PDF attachments, math, fenced code blocks, streaming transitions, and affected lazy routes preserve their existing behavior through automated regression coverage.
- The deliberate conversation-page prefetch remains intact, and the audit of `ConversationInput` records its package-boundary leak as a separate follow-up rather than claiming that boundary is effective.
- `scripts/measure-initial-bundle.mjs` produces repeatable raw/gzip totals, and `design.md` documents the future lab profile without claiming that Lighthouse or production RUM was executed.

## Capabilities

### New Capabilities

- `chat-cold-load-performance`: defines the initial-load byte budgets, the required lazy/deferred boundaries for PDF.js, Monaco, KaTeX, and syntax highlighting, and the repeatable build-time measurement procedure used to verify cold-load bundle composition without regressing stable chat behavior.

### Modified Capabilities

_None._ No existing `openspec/specs/*` capability describes bundle composition, provider bootstrap sequencing, or load performance.

## Impact

- **Affected app code**: `apps/chat/src/main.tsx`, `apps/chat/src/app/app.tsx`, `apps/chat/src/utils/pdf.ts`, `apps/chat/vite.config.mts`, and route-only editor style imports.
- **Affected libraries**: `libs/attachment-canvas` (internal PDF/code lazy boundaries plus an additive optional host callback), `libs/chat-shared` (content-sensitive KaTeX/syntax-highlighter loading), and the prompt/skill/scheduled-task editor libraries (route-only CSS ownership).
- **Library isolation**: PDF runtime configuration remains in `apps/chat/src/utils/pdf.ts` and is supplied to attachment canvas through `configurePdfWorker`; the library does not import or configure the host's `pdfjs-dist` runtime.
- **i18n/RTL**: no new user-visible strings are introduced by this change. Existing labels continue to be supplied by the app, and existing logical/RTL behavior is preserved.
- **Dependencies**: no intentional runtime dependency upgrade. Package-range and standalone attachment-canvas ownership cleanup belongs to the separate attachment-canvas change.
- **Backward compatibility / rollback**: no breaking change is intended. The new callback is optional; existing root exports remain valid. Each implementation slice can be reverted independently to restore the previous eager-loading behavior without data migration or persisted-state cleanup.
