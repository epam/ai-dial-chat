## Context

`@epam/ai-dial-attachment-canvas` (`libs/attachment-canvas`) is a publishable, host-agnostic package (`nx.tags: ["publishable"]`). The predecessor change (`archive/2026-09-03-optimize-chat-cold-load-performance`) fixed `apps/chat`'s own eager-import problem by adding source-level lazy boundaries inside this lib (`PdfContent`, `CodeContent`) and an optional `configurePdfWorker` host callback, but explicitly deferred "broadly optimizing the standalone `@epam/ai-dial-attachment-canvas` package, its dependency ownership, or its package-level CSS output" (that change's proposal.md, Non-goals). This change picks that up.

**Verified against a fresh build** (`npm exec nx build "@epam/ai-dial-attachment-canvas" -- --skip-nx-cache`, 2026-09-03; the run failed at the very end only because its `@epam/ai-dial-chat-shared` build dependency's `typecheck` step hits a pre-existing, unrelated environment drift — installed `@epam/ai-dial-ui-kit@0.14.0-dev.9` does not satisfy the declared `^0.14.0-dev.15` range and lacks `DIAL_KIT_ICON_STROKE` — the attachment-canvas Vite build itself completed and emitted `libs/attachment-canvas/dist/` before that failure was reported):

1. **Broken export**: `libs/attachment-canvas/package.json:13` declares `"./styles.css": "./dist/style.css"`. The actual Vite output is `dist/index.css` (`build.lib.fileName: 'index'`). `dist/style.css` does not exist. Any consumer following the documented subpath import 404s.
2. **PDF CSS is not split out**: `dist/index.css` (17,682 bytes) contains `.pdf-container`, `.pdf-highlight-viewer`, `.pdf-canvas`, `.pdf-context-menu*`, `.pdf-page-container`, `.pdf-tooltip` selectors — the vendor CSS `PdfContent.tsx:36-37` imports (`@epam/ai-dial-react-pdf-highlighter/styles.css`, `@epam/pdf-highlighter-kit/dist/pdf-highlight-viewer.css`) — merged into the one base stylesheet every consumer loads unconditionally. Root cause: `vite.config.mts` never sets `build.cssCodeSplit`, whose documented default in library (`build.lib`) mode is `false` — Vite intentionally bundles all CSS reached from any entry or dynamic import into a single file unless told otherwise.
3. **Peer engines are bundled as private duplicates despite being declared peers**: `vite.config.mts:50-61`'s `rollupOptions.external` omits `@epam/ai-dial-react-pdf-highlighter`, `@epam/pdf-highlighter-kit`, `react-syntax-highlighter`, `@mcp-ui/client`, and `@modelcontextprotocol/sdk`, even though all five are declared `peerDependencies` (`package.json:21-34`). Confirmed by content: `dist/PdfContent-3uZniPG7.js` (577 KB, the lazy PDF chunk) contains 66 matches for `GlobalWorkerOptions`/`getDocument`/`PDFDocument` — `pdfjs-dist`'s own API surface, pulled in transitively through the un-externalized `@epam/pdf-highlighter-kit`/`@epam/ai-dial-react-pdf-highlighter` — and `dist/esm-bFpgu8Tl.js` (730 KB) contains the bundled `react-syntax-highlighter`/Prism implementation reached via `index.js`'s `lazy(async () => { const { Prism } = await import("./esm-bFpgu8Tl.js") ...})`. Each of these duplicates whatever copy the host app itself already resolves (`apps/chat/src/utils/pdf.ts` dynamically imports its own `pdfjs-dist`).
4. **The existing lazy boundaries themselves are sound and must be preserved as-is**: `dist/index.js` (509 KB, the eager entry) contains no `Prism`/`react-syntax-highlighter`/pdfjs-dist literal — only the two `lazy()` wrapper closures with their `import("./PdfContent-....js")` / `import("./esm-....js")` calls. `@silurus/ooxml`'s three format entry points (`docx-*.js` 3.0 MB, `pptx-*.js` 2.2 MB, `xlsx-*.js` 2.2 MB, plus shared `render-worker-host-*.js`/`renderer-module-contract-*.js` chunks) are likewise correctly split per-format and are unaffected by this change — the proposal explicitly preserves this intentional on-demand OOXML bundling.
5. `configurePdfWorker` (`PdfContent.tsx:141-144`) is invoked fire-and-forget (`void configurePdfWorker()`), gated only by a module-scope boolean (`hasConfiguredPdfWorker`) that is set to `true` *before* the call resolves and is never reset on rejection. `DocumentPreview` mounts unconditionally in the same render, without waiting for the promise. A first failed preparation is silently cached forever with no user-visible error and no retry path.

## Goals / Non-Goals

**Goals:**
- Make the package's `exports` map and CSS output internally consistent, and split PDF-only CSS out of the base stylesheet.
- Externalize the declared PDF/highlighter peer engines (and their JS subpaths) so the built package never bundles a private duplicate of a dependency the host app also resolves, without breaking the existing CSS-subpath resolution workaround those same peers need.
- Give `configurePdfWorker` well-defined async semantics (await-before-mount, shared in-flight preparation, memoized success, retryable rejection) while keeping the callback optional and backward-compatible.
- Add local, accessible loading/error/retry UI for the PDF and code dynamic-import/runtime-preparation paths.
- Prove all of the above against the *built* package (not the `@epam/source` workspace alias) with automated tests, and record real before/after byte measurements.

**Non-Goals:**
- Reopening or re-measuring `apps/chat`'s own initial-graph budgets (owned by the archived change).
- Redesigning `@silurus/ooxml` bundling, `AttachmentCanvasBody`'s content-type dispatch, or any UI-kit/generated-client/backend work.
- Renaming or removing any existing public prop; only additive optional props/labels are introduced.
- Fixing the pre-existing `@epam/ai-dial-ui-kit` install-version drift noted in Context — that blocks local `nx build`/`typecheck` today independently of this change and must be resolved (`npm install` refresh to satisfy `^0.14.0-dev.15`) before this change's build-based verification tasks can run, but resolving it is environment maintenance, not a task of this change.

## Decisions

### Decision 1 — Fix the `./styles.css` export path and enable CSS code splitting together

**Decision**: Change `package.json:13` to `"./styles.css": "./dist/index.css"` (matching `build.lib.fileName: 'index'`, unchanged), and add `build.cssCodeSplit: true` to `vite.config.mts`. With code splitting on, CSS reached only through a dynamically-imported chunk (PDF vendor CSS, reached only via the `PdfContent` `lazy()` boundary) is extracted into its own chunk-associated CSS file instead of being merged into the entry's `index.css`.
**Correction found during implementation**: Vite library mode extracts `PdfContent.css` but does not emit a load-triggering reference from the corresponding JS chunk. A local Rollup plugin (`associateDynamicChunkCss` in `vite.config.mts`) therefore prepends a static `import "./PdfContent.css"` side effect to the built dynamic chunk. When a downstream application bundles the published package, that import becomes part of the consumer bundler's chunk dependency map, so it preloads the stylesheet before resolving the PDF dynamic import. This avoids a flash of unstyled PDF content without making the library mutate the host DOM or race a runtime-created `<link>` element.
**Verification**: after the change, rebuild and confirm by content inspection that `dist/index.css` contains no PDF-vendor selectors, `PdfContent.css` contains them, `dist/index.js` has no static edge to that stylesheet, and the `PdfContent` dynamic chunk starts with `import "./PdfContent.css";`. The packed-package consumer fixture must additionally prove its application build keeps the PDF CSS on demand and references that CSS from the generated JavaScript chunk graph rather than leaving it orphaned.
**Alternatives considered**:
- *Manually split CSS by writing two separate entry stylesheets* — rejected: Vite's per-chunk CSS extraction already does this correctly once `cssCodeSplit` is enabled; a hand-rolled second entry would duplicate Vite's own mechanism and risk drifting from the actual JS lazy boundary it must track.
- *Leave `./styles.css` pointing at a hand-authored re-export shim* — rejected: adds an indirection layer for no benefit over fixing the one-line path to match the real build output.

### Decision 2 — Externalize peer engines by specifier, not by bare package name, and never externalize their CSS subpaths

**Decision**: Replace the flat `rollupOptions.external` array with a matcher function that externalizes an import specifier when it equals or is prefixed by one of the six currently-un-externalized peers (`pdfjs-dist`, `@epam/ai-dial-react-pdf-highlighter`, `@epam/pdf-highlighter-kit`, `react-syntax-highlighter`, `@mcp-ui/client`, `@modelcontextprotocol/sdk`) **and does not end in `.css`**. The existing `resolve.alias` entries (`vite.config.mts:18-34`) that redirect the two vendor CSS subpath imports to their real `dist` files stay unchanged and are resolved locally, then extracted by Decision 1's CSS splitting — externalizing a `.css` specifier would leave a raw, unresolvable `import "@pkg/foo.css"` statement in the output JS instead of an actual processed stylesheet, since Rollup's `external` mechanism only applies to JS/ESM import resolution, not to asset extraction.
**Verification**: unit-test the matcher function directly against the known specifier set (bare package, a representative deep JS subpath, and both existing `.css` subpaths) so the split behavior doesn't regress silently on a future peer addition.
**Alternatives considered**:
- *Move these six packages from `peerDependencies` to `dependencies` and bundle them intentionally* — rejected: they are large (multi-hundred-KB) engines the host app plausibly already resolves its own copy of (`apps/chat`'s own `pdfjs-dist` dependency for `configurePdfWorker`); bundling a second copy is exactly the private-duplicate problem this change exists to remove, and would silently re-inflate the PDF/code chunks this change is measuring.
- *Externalize by bare package name only (`external: [...names]`)* — rejected: Rollup's array form only matches exact specifiers, so any deep subpath import a peer's own code resolves at build time (none currently observed, but the packages' internal structure isn't a contract this lib controls) would still be bundled; the prefix-matching function closes that gap without extra externals to maintain by hand.

### Decision 3 — Align PDF dependency ranges and regenerate the lockfile for that subtree

**Decision**: Set `pdfjs-dist`, `@epam/ai-dial-react-pdf-highlighter`, and `@epam/pdf-highlighter-kit` version ranges (in `package.json` `peerDependencies` here, and cross-checked against `apps/chat/package.json`'s own `pdfjs-dist` dependency) to the exact combination this change's tests exercise, then regenerate `package-lock.json` and run `npm ls pdfjs-dist` to confirm a single resolved version with no `invalid`/`UNMET DEPENDENCY` entries. This is necessary precisely because Decision 2 stops bundling a private `pdfjs-dist` copy — the host's own resolved version becomes the *only* copy loaded at runtime, so its range must actually be compatible with what `@epam/ai-dial-react-pdf-highlighter`/`@epam/pdf-highlighter-kit` expect.
**Alternatives considered**:
- *Leave ranges as open-ended `*`/`>=` and rely on npm's resolver* — rejected: `package.json:23,28` already has `"@epam/ai-dial-react-pdf-highlighter": "*"` and `"@epam/pdf-highlighter-kit": ">=0.0.14"` today, which is exactly how the currently-unverified combination arose; an open range doesn't prevent a future host install from resolving an incompatible trio, and this change's own tests need one pinned combination to assert against.

### Decision 4 — `configurePdfWorker` becomes an awaited, shared, retryable preparation step

**Decision**: Extract the module-scope preparation logic out of the fire-and-forget call at `PdfContent.tsx:141-144` into a small internal helper (co-located with `PdfContent`, not exported) that:
- Holds a module-scope `preparationPromise: Promise<void> | null`, reused across `PdfContent` mounts so **concurrent opens share one in-flight preparation** (matches the existing precedent of a module-scope flag, but now promise-based instead of boolean).
- On success, the resolved promise itself is the memoization — later mounts see the same fulfilled promise and resolve immediately.
- On rejection, clears `preparationPromise` back to `null` before rethrowing, so the **next** attempt (an explicit retry, or a later independent PDF open) calls `configurePdfWorker()` again instead of being permanently stuck.
- `PdfContent` renders a local state machine (`'preparing' | 'ready' | 'error'`) driven by this helper and **does not mount `DocumentPreview` until the promise resolves** (closing today's gap where `DocumentPreview` mounts in the same render that fires the fire-and-forget call). When `configurePdfWorker` is omitted, state goes straight to `'ready'` — preserving the documented CDN-fallback behavior.
- The preparation state itself uses the same accessible local pending/error/retry presentation as lazy module loading. Retrying increments a preparation key and calls the helper again; the app adapter also clears its own cached promise on rejection, so neither layer can retain a permanently rejected promise.
**Backward compatibility**: the prop's type (`() => void | Promise<void>`) and call timing (once, before the viewer mounts) are unchanged; only the internal gating around it changes. No consumer-visible signature change.
**Alternatives considered**:
- *Add a second, more expressive callback (e.g. returning a status object) alongside the existing one* — rejected per the proposal's explicit preference to evolve the existing contract rather than add a competing one; the existing signature already supports everything needed once its *caller-side* handling is corrected.
- *Cache rejections too (fail once, fail forever)* — rejected: this is the exact defect being fixed; a transient network failure preparing the worker must not permanently disable PDF preview for the rest of the session.

### Decision 5 — Local loading/error/retry boundaries, with `lazy()`'s cached-rejection gotcha handled explicitly

**Decision**: Wrap the `PdfContent` and `CodeContent` `Suspense` boundaries (`AttachmentCanvasBody.tsx:305` and `CodeContent.tsx:56`) in a small local class-based error boundary (function components cannot catch render/import errors) that renders `role="alert"` plus a labeled, keyboard-focusable retry control (≥44×44 CSS px on mobile) on failure, and `role="status"`/`aria-live="polite"` while pending — replacing the bare `<Spinner fallback>` with no failure path. Because React's `lazy(factory)` calls `factory` at most once and caches a **rejected** promise forever (a documented React behavior, not a bug to work around locally), retry cannot just reset the error boundary's caught-error flag — it must produce a **new** `lazy()` reference so the dynamic `import()` is re-attempted. Both `PdfContent`'s and `CodeContent`'s lazy factories move from a module-scope `const` into a small retry-counter-keyed factory (e.g., recreated in a `useMemo`/`useState` keyed by a `retryCount` that the boundary's retry button increments), so each retry genuinely re-issues the network request instead of re-throwing the same cached rejection.
**Verification**: a regression test simulates a rejected dynamic import, asserts the `role="alert"` + retry control render, asserts clicking retry issues a **new** import call (not the same rejected promise), and asserts a subsequent successful import renders the real content.
**Alternatives considered**:
- *Reset only the Suspense boundary's key on retry* — rejected once `lazy()`'s single-call contract was confirmed: remounting `Suspense` around the *same* `lazy()` reference re-renders the cached rejected promise instantly, producing an error boundary that never recovers no matter how many times the user clicks retry.
- *Use a third-party retry-on-lazy-failure library* — rejected: the fix is a few lines given the existing `lazy(async () => ...)` pattern already used twice in this lib; adding a dependency for it is disproportionate.

### Decision 6 — Package-boundary tests walk the built artifact; a consumer fixture exercises the real `exports` map

**Decision**: Add two independent test surfaces, both operating on `dist/`, never on `@epam/source`:
1. A Vitest test recursively walks relative static JS imports starting at `dist/index.js`, asserts the entire eager closure excludes PDF/syntax-engine implementation telltales, validates every non-source package export target and declaration file exists, and verifies the expected dynamic-import boundaries and split CSS association.
2. A minimal consumer fixture runs `npm pack`, performs a real offline `npm install` of that tarball into an isolated fixture project, imports only from the package's public root and `./styles.css` (never a deep `src` path), and builds. It proves the `exports` map, peer resolution, split CSS association, and initial-versus-on-demand graph against the same surface a downstream consumer uses. The library's `publish` target depends on its own typecheck/test/build and this fixture, so missing declarations or export targets fail before publication.
**Alternatives considered**:
- *Only assert against `dist/` from within the workspace* — rejected: this is precisely how the `./styles.css` defect (Context #1) went unnoticed — every in-repo consumer resolves the workspace alias to source and never touches the published `exports` map at all.

## Risks / Trade-offs

- **[Risk] `build.cssCodeSplit: true` could split CSS more granularly than intended** (e.g. per-component `.module.scss` files each becoming their own chunk-tied output) → **Mitigation**: verify post-build that only the PDF vendor CSS — reached exclusively through the `PdfContent` dynamic import — ends up in a separate file; every other component's styles are imported statically from the eager entry and so remain merged into `dist/index.css` regardless of the flag.
- **[Risk] The externalization matcher accidentally catches the wrong specifiers** (e.g. `@silurus/ooxml`, which must stay bundled per the proposal's non-goal) → **Mitigation**: Decision 2's matcher is an explicit six-name prefix allowlist, not a broad heuristic, and is unit-tested directly against the known specifier set including the two `.css` subpaths that must stay un-externalized.
- **[Risk] `pdfjs-dist` version drift between the host app's own dependency and what `@epam/ai-dial-react-pdf-highlighter`/`@epam/pdf-highlighter-kit` expect, now that this lib no longer bundles its own copy** → **Mitigation**: Decision 3's range alignment plus a clean-install `npm ls pdfjs-dist` check as part of verification; existing PDF rendering regression tests exercise the aligned combination.
- **[Risk] React's `lazy()` cached-rejection behavior is easy to miss and could ship a "retry" button that silently does nothing** → **Mitigation**: Decision 5 calls this out explicitly and its regression test asserts a new import attempt actually occurs on retry, not just that the UI re-renders.
- **[Risk] Regenerating `package-lock.json` shifts unrelated transitive versions repo-wide** → **Mitigation**: scope the regeneration to the affected dependency subtree where possible, review the resulting diff before committing, and run `npm run verify:full` once at the end of the change regardless.
- **[Risk] The pre-existing `@epam/ai-dial-ui-kit` install-version drift (Context) blocks any build-based verification task until resolved** → **Mitigation**: treat a local `npm install`/version re-sync as a precondition check at the start of implementation, called out explicitly as environment maintenance rather than a change task, so it isn't silently skipped or mistaken for a regression this change introduced.

## Migration Plan

1. Decision 1 (exports path fix + `cssCodeSplit`) — pure build-config change, independently revertible, verified by rebuilding and inspecting `dist/`.
2. Decision 2 (externalization matcher) + Decision 3 (range alignment + lockfile regen) — together, since externalizing the peers is what makes their resolved version at install time actually matter; verified by a clean install plus the existing PDF/code rendering tests.
3. Decision 4 (`configurePdfWorker` async semantics) — internal to `PdfContent`, additive/backward-compatible, verified by new unit tests for concurrent-open sharing, memoized success, and rejection-clears-retry.
4. Decision 5 (loading/error/retry boundaries) — builds on Decision 4's state machine for PDF and mirrors it for `CodeContent`; verified by the dedicated retry regression tests.
5. Decision 6 (package-boundary tests + consumer fixture) — last, since it verifies the cumulative effect of 1–4 against the real built artifact; this is also where raw/gzip baselines are captured and turned into regression budgets, per the proposal's acceptance criteria.
6. README updates land in the same commit as whichever decision changes the documented behavior (per `AGENTS.md` §Docs), not batched at the end.
7. **Rollback**: every decision is an independently revertible commit; reverting any one restores the prior build/behavior with no data migration or persisted-state cleanup, since all changes are build configuration, internal component logic, or additive optional props.

## Open Questions — resolved

- **Consumer fixture placement**: `tools/attachment-canvas-consumer-fixture/`, declared via its own `project.json` (Nx's package.json-based custom-target authoring only applies to projects inside the root `package.json`'s `"workspaces"` globs — `libs/*`/`apps/*`/`packages/*` — which `tools/*` is not; a plain `package.json` `"nx"` field there was silently ignored). Chained Nx targets: `pack-lib` → `build` → `verify`, documented in the fixture's own `README.md`.
- **Raw/gzip regression budgets**, resolved from this change's final build measurements and encoded as assertions in `libs/attachment-canvas/tests/package-boundary/bundle-budgets.spec.ts` (headroom is roughly 24–75% over the measured byte count — tight enough that re-bundling a private peer copy, which adds hundreds of KB, trips it immediately, loose enough to absorb ordinary code growth):

  | Artifact                    | Raw (measured → budget) | Gzip (measured → budget) |
  | ---------------------------- | ------------------------ | ------------------------- |
  | Entry static JS closure | 36,353 B → ≤ 45,000 B | 10,630 B → ≤ 13,000 B |
  | `dist/index.css` (base sheet) | 4,015 B → ≤ 6,000 B      | 1,265 B → ≤ 2,000 B       |
  | `dist/PdfContent-*.js` (lazy) | 7,012 B → ≤ 12,000 B | 2,824 B → ≤ 5,000 B |
  | `dist/PdfContent.css` (lazy)   | 16,398 B → ≤ 24,000 B    | 4,540 B → ≤ 7,000 B       |

  `apps/chat`'s own initial-graph totals are a Non-Goal (owned by the archived
  cold-load change) and are not turned into a persisted budget — they were
  measured once, for regression confirmation only (task 6.2): a clean build
  of the pre-group-1 baseline (`git stash`, rebuild, `scripts/measure-initial-bundle.mjs`)
  totaled 4,204,402 B raw / 1,139,673 B gzip; the same measurement after
  groups 1–5 totaled 4,204,553 B raw / 1,139,777 B gzip — a +151 B raw / +104 B
  gzip difference, consistent with `apps/chat` resolving this lib through the
  `@epam/source` workspace alias (raw `src/`, never `dist/`): only the small,
  additive `LazyContentBoundary` component and its new labels/i18n keys reach
  `apps/chat`'s own bundle at all; Decisions 1–3 (CSS split, externalization,
  dependency alignment) are `dist/`-only and never touch it.
