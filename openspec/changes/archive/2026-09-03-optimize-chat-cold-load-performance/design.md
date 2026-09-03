## Context

### Baseline (measured, not the brief's preliminary numbers)

Reproduced with `npm exec nx build chat -- --skip-nx-cache` on 2026-09-01 (build succeeded in 21.55s; two warnings: `vite-plugin-svgr` plugin-timing notice and Rollup's "chunks larger than 500 kB" warning). `apps/chat/vite.config.mts` does not set `build.manifest`, so no `manifest.json` is emitted; chunk→source attribution below combines `apps/chat/dist/index.html`'s reference list with byte measurement and telltale-string inspection inside the minified output, and is marked where confidence is lower.

`apps/chat/dist/index.html` references 1 entry script + 18 `modulepreload` links + 7 stylesheets. Initial JS+CSS totals:

| | raw bytes | gzip bytes |
|---|---|---|
| JS (19 files) | ~5,647,833 | ~1,650,703 |
| CSS (7 files) | ~364,637 | ~68,096 |
| **Total initial** | **~6,012,470 (~5.9 MB)** | **~1,718,799 (~1.68 MB)** |

This is within ~1% of the brief's preliminary figures (6,059,504 / 1,716,347 total bytes), so the brief's numbers are confirmed as a reasonably fresh baseline, not stale — but this design treats its own freshly reproduced numbers as authoritative going forward.

Largest individual files:

| file | raw | gzip | role (confidence) |
|---|---|---|---|
| `ui-kit-B67R9eSX.js` | 2,939,638 | 877,599 | `@epam/ai-dial-ui-kit` single manual chunk (`apps/chat/vite.config.mts:158`); grep confirms genuine Monaco CDN-loader code (`@monaco-editor/loader` state machine, `cdn.jsdelivr.net/npm/monaco-editor@0.55.1`) and AG Grid engine code (`.ag-cell`, `ag-root-wrapper`, `ag-grid-enterprise`/`community` dynamic-import builder) — **high confidence, verified by content** |
| `api-client-BuHltpZu.js` | 1,306,866 | 359,682 | generated OpenAPI client (`libs/chat-api-client`); string hits for `pdfjs`/`docx`/`xlsx`/`pptx` look like enum/schema literals, not executable libs — **medium confidence**, flagged for follow-up measurement |
| `src-DxE9wM7y.js` | 609,237 | 163,522 | grep confirms real `katex`, `react-syntax-highlighter`, `prismjs`, `hljs` matches; attributed to `libs/chat-shared`'s `MarkdownRenderer`/`CodeBlock` bundle — **high confidence** |
| `index-BAtl3tzN.js` (entry) | 458,816 | 139,982 | app shell/router/context glue — not fully decomposed, no heavy-lib telltales found |
| `src-B1xWAh-p.js` | 121,870 | 35,403 | unidentified lib source chunk, no heavy-lib telltales found |
| `translation-keys-DTz0-zR3.js` | 72,362 | 14,374 | i18n key data |
| `tabler-icons-XCOkwJ7c.js` | 51,875 | 12,486 | manual chunk (`vite.config.mts:157`) |

CSS: `ui-kit-B0jAsjVO.css` (121,783 / 19,279), `index-DBlEiaay.css` (117,942 / 21,490 — app Tailwind output), `src-iwqijnls.css` (91,350 / 19,316), plus 4 smaller lib stylesheets.

**Re-reproduced (task 1.1/1.2)**: a second clean build (`npm exec nx build chat -- --skip-nx-cache`) plus `scripts/measure-initial-bundle.mjs` confirms these numbers within build-hash noise: **20 JS files** totaling **5,697,013 raw / 1,656,352 gzip**, and **7 CSS files** totaling **364,637 raw / 68,287 gzip**. Grand total: **1,724,639 gzip**. Use the script for every subsequent comparison in this change.

### Why each heavy dependency is in the initial graph (file:line citations)

1. **PDF.js** — `apps/chat/src/main.tsx:8` (`import { GlobalWorkerOptions } from 'pdfjs-dist';`), `apps/chat/src/main.tsx:9` (`import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';`), configured unconditionally at `apps/chat/src/main.tsx:40` (`GlobalWorkerOptions.workerSrc = pdfWorkerUrl;`). Root cause: **eager top-level import in the entry module**, unconditional on route or feature use.
2. **Monaco + AG Grid** — no direct source import in `apps/chat/**` or `libs/**`; they enter via `@epam/ai-dial-ui-kit`'s own `dependencies` (`node_modules/@epam/ai-dial-ui-kit/package.json:80-96` lists `ag-grid-community`, `ag-grid-react`, `@monaco-editor/react`, `monaco-editor`). Root cause: **package has no subpath exports** (only `"."` and `"./styles.css"`), so any import from `@epam/ai-dial-ui-kit` (e.g. `Button`) pulls the whole pre-built dist bundle, and `apps/chat/vite.config.mts:158` additionally forces all of it into one **manual chunk**, guaranteeing it is `modulepreload`ed regardless of which components are actually used on the first route.
3. **KaTeX + `react-syntax-highlighter`** — imported by `libs/chat-shared/src/components/MarkdownRenderer/MarkdownRenderer.tsx` (KaTeX/`rehype-katex`) and `libs/chat-shared/src/components/MarkdownRenderer/CodeBlock/CodeBlock.tsx` (`react-syntax-highlighter`). Root cause: **eager render-path import** — `MarkdownRenderer` renders chat messages on the default `/` route (via `ConversationView.tsx`, which is not behind `React.lazy`), so its full transitive graph, including math/syntax-highlighting engines, loads even for a plain-text conversation with no code fence and no math.
4. **Generated API client** (`api-client-*.js`, 1.3 MB raw) — imported broadly and eagerly across root providers (e.g. `PromptsContext.tsx`, `SkillsContext.tsx`, `DeploymentsContext.tsx`) for both types and runtime calls. Root cause: **root-provider import** — every context that needs a single DTO type or one API method pulls from the same client entry point, and nothing in the current graph separates "types used for a call" from "the generated client's full operation surface."
5. **Tailwind CSS duplication risk** — `apps/chat/tailwind.config.js:13-17` includes two `node_modules` content globs (`@epam/ai-dial-ui-kit/**/*.{js,jsx}`, `@epam/ai-dial-react-file-manager/**/*.{js,jsx}`) in addition to `createGlobPatternsForDependencies(__dirname)`, which already covers all aliased lib source. Scanning built `.js` in `node_modules` for Tailwind class name strings is unusual, can match incidental substrings, and duplicates coverage already provided by the source-level glob for libs consumed via alias. Root cause: **redundant/overbroad content glob**, not a Tailwind or PostCSS bug — needs to be measured (diff generated CSS with/without those two globs) before being cut, since `@epam/ai-dial-ui-kit`'s dist may contain class names not present in any aliased-lib source.
6. **Manual chunk config** — `apps/chat/vite.config.mts:154-160` defines exactly three explicit groups (`vendor-utils`, `tabler-icons`, `ui-kit`); everything else falls to Rollup's default heuristic. The `ui-kit` grouping is itself the mechanism forcing Monaco/AG Grid into the eager preload graph (see #2) — a manual chunk name is not evidence of correct code-splitting on its own.

### Confirmed-effective existing lazy boundaries (verified against `dist/index.html`, not assumed from source)

- `NewConversationComposer.tsx:60-68` and `ConversationView.tsx:96-104` both wrap `ConversationInput` (`@epam/ai-dial-conversation-input`) and `DialFileManagerModal` in `lazy(async () => ...)`. Neither module appears among `dist/index.html`'s 18 `modulepreload` entries — **effective**.
- `apps/chat/src/app/app.tsx:64-108` wraps `CatalogView`, `DialFileManagerPage`, `SettingsPage`, scheduled-task pages, `AppsEditorPage`, `ToolsetEditorPage`, `CustomAppEditorPage`, `PromptEditorPage`, `SkillEditorPage`, `ToolsetAuthCallbackPage`, `SigninInterruptDialog`, invitation pages, and `NotFoundPage` in `lazy()`. None of these route chunks appear in the initial preload list — **effective**, confirming AG Grid's *type-only* usage inside `libs/catalog/src/components/ListView/ListView.tsx:3` (`import type { GridApi } from 'ag-grid-community'`) is correctly erased and does not itself force AG Grid into the eager graph; the AG Grid *runtime* only enters eagerly through `@epam/ai-dial-ui-kit`'s own bundle (item 2 above), independent of `ListView.tsx` being lazy.
- **Deliberately eager**: `apps/chat/src/app/app.tsx:110-116` explicitly pre-fetches the conversation page module ahead of the render commit (comment at line 110: "Start loading the module immediately so the Suspense fallback is skipped on first navigation") and `ConversationRoute` (`app.tsx:60`) is imported eagerly because it is mounted at `ROUTES.Root`. This is an intentional trade-off (avoid a Suspense flash on the most common navigation), not a defect, and must be preserved.

### Root-provider bootstrap (static-analysis proxy — no live network capture available)

`apps/chat/src/context/**` — each context fetches independently in its own `useEffect`, concurrently but uncoordinated (no shared `Promise.all` gate): `UserContext.tsx:87,115-121` (`getMe()` on mount, plus revalidation on `visibilitychange`/`focus`, `159-212`, and unauthorized-recovery, `62`); `AppConfigContext.tsx:86,89,133` (`getClientConfig`); `UserConfigContext.tsx:68,71,78` (`getUserConfig`); `DeploymentsContext.tsx:260,271` (`Promise.allSettled` of deployments+toolsets) and a second `Promise.allSettled` at `491-492` for configuration/details; `ConversationsContext.tsx` calls `listConversations()` from three separate effect call sites (`110/115`, `252/255`, and use at `123/134/260`) — this is the one place with a **plausible duplicate-request pattern** worth consolidating, pending confirmation of whether all three call sites are reachable on the same cold-load path or guard different scenarios (initial load vs. focus-revalidate vs. post-mutation refresh). `PromptsContext.tsx`/`SkillsContext.tsx` delegate to `@epam/ai-dial-chat-hooks`'s `usePromptsState`/`useSkillsState`, each independently.

**Limitation, stated explicitly**: this environment has no running server and no browser, so no live network waterfall, no Lighthouse run, and no field RUM were captured for this design. The provider analysis above is a **static-analysis proxy**: it identifies which effects fire fetches and whether calls are structured to run in parallel or are serialized by data dependency, but it cannot measure actual round-trip timing, head-of-line blocking, or backend contention. It is not a substitute for the lab profile defined below, which a human or CI runner with real browser access must execute.

## Goals / Non-Goals

**Goals:**
- Remove Monaco, PDF.js, KaTeX, and `react-syntax-highlighter` from the JS/CSS referenced by `apps/chat/dist/index.html` for the `/` route, while keeping PDF preview, math rendering, and code highlighting fully functional on demand. AG Grid is excluded because its split requires a separate UI-kit package change.
- Reduce the initial graph by at least 30% from the 1,724,639-byte gzip baseline and keep it within **1,100,000 gzip bytes of JS**, **60,000 gzip bytes of CSS**, and **1,160,000 gzip bytes total**. These limits deliberately cover only the app-side and in-repository lazy boundaries implemented here; generated-client and UI-kit packaging are separate follow-ups.
- Keep `/conversations/:id` fully functional and preserve the deliberate eager-prefetch trade-off at `app.tsx:110-116`.
- Preserve backward compatibility for affected libraries. The attachment-canvas PDF runtime callback is additive and optional; its host-owned implementation stays at the application edge.
- Provide a repeatable build-time measurement tool and document a fully specified future lab profile without claiming browser measurements or production RUM that were not executed.

**Non-Goals:**
- Touching `apps/chat-api`, generated OpenAPI contracts, authentication/session/CSRF semantics, or streaming behavior.
- Upgrading Vite, React, `@epam/ai-dial-ui-kit`, `pdfjs-dist`, or any other dependency version to chase bundle size, absent separately-approved evidence.
- Removing or gating any user-visible feature to improve the metric (no artificial LCP placeholder, no feature removal).
- Producing an actual measured Lighthouse/RUM number or adding `chat-ready` instrumentation; only the reusable procedure and milestone definition are specified.
- Changing `@epam/ai-dial-ui-kit` exports or removing its embedded AG Grid engine. That package-level work is owned and planned separately.
- Decomposing the generated API client, changing `@epam/ai-dial-conversation-input` exports, or broadly redesigning the standalone attachment-canvas package.

## Decisions

### Decision 1 — Preserve the UI kit's lazy Monaco boundary in the app bundle

**Problem**: `apps/chat/vite.config.mts:158` used a broad package-path substring matcher. It re-merged the UI kit's dynamically imported Monaco editor chunk into the eager `ui-kit` manual chunk.

**Resolved (task 1.3)**: the UI kit already places Monaco behind `LazyDialJsonEditor` → `JsonEditor-*.js`; Monaco is absent from the library's core entry. The app's matcher was the reason that async seam disappeared from the consumer build. AG Grid is different: it is statically imported by the UI kit entry and cannot be split by an app-only matcher change.

**Decision**: narrow the app matcher so it captures the UI-kit entry but not files reached through the package's own dynamic imports. This removes Monaco from the initial graph without changing the UI-kit package. AG Grid remains in the eager graph and is explicitly deferred to a separate UI-kit change; it is not part of this change's tasks or byte-budget promise.

**Alternatives considered**:
- *Deep-import `@epam/ai-dial-ui-kit`'s internal files directly* — rejected: violates "no private deep imports" constraint and breaks on any internal restructuring of the package.
- *Vendor/fork a slimmer UI kit build* — rejected: out of scope, disproportionate for a first change, and risks drifting from the design system.
- *Delete the manual chunk and rely entirely on Rollup heuristics* — rejected because it would not split the UI kit's statically imported AG Grid code and would make bundle attribution less stable.

### Decision 2 — Move `pdfjs-dist` behind the attachment/PDF-preview feature boundary

**Resolved (task 1.4) — the eager-import problem is bigger than `main.tsx`'s explicit import**: `AttachmentCanvasProvider` itself (`libs/attachment-canvas/src/context/AttachmentCanvasContext.tsx`) does **not** reference `pdfjs-dist`, `pdf.worker`, or `GlobalWorkerOptions` anywhere in its source — confirmed by a repo-wide search: the only file in `apps/**`/`libs/**` that imports `pdfjs-dist` directly is `apps/chat/src/main.tsx`. So the provider's own construction is not the problem.

However, a **second, larger, previously-unidentified static path** pulls `pdfjs-dist` into the initial graph regardless of `main.tsx`'s import, and deleting only `main.tsx:1,8-9,40` (as originally planned) would **not** remove it:
- `apps/chat/src/app/app.tsx:2` statically imports `AttachmentCanvasContainer` from `@epam/ai-dial-attachment-canvas` and renders it unconditionally at `app.tsx:550` (not behind `lazy()`, not gated by `isCanvasOpen` — a conditional *render* doesn't stop the module from being in the static import graph).
- `AttachmentCanvasContainer` → `AttachmentCanvas` → `AttachmentCanvasBody` (`libs/attachment-canvas/src/components/AttachmentCanvasBody/AttachmentCanvasBody.tsx:21`) → `PdfContent` (`libs/attachment-canvas/src/components/PdfContent/PdfContent.tsx:3-6`) is an unbroken chain of **static** imports, ending in `PdfContent.tsx` statically importing runtime values (`DocumentPreview`, `PageThumbnail`, not just types) from `@epam/ai-dial-react-pdf-highlighter`.
- `@epam/ai-dial-react-pdf-highlighter` declares `pdfjs-dist` as a `peerDependency` (resolved via `apps/chat`'s own direct dependency on it) and its sibling package `@epam/pdf-highlighter-kit` imports `pdfjs-dist` directly inside `node_modules/@epam/pdf-highlighter-kit/dist/config.js` — this is the source of the "CDN fallback" that `main.tsx:39`'s comment refers to, confirming these two eager paths are already coupled today.

Net finding: `main.tsx`'s explicit import is a genuine but minor contributor (~1 KB of glue code); the real ~400+ KB `pdfjs-dist` payload is pinned into the initial graph because **`AttachmentCanvasContainer` is mounted unconditionally and eagerly** at the app root, and its own internal component tree has no lazy boundary around the PDF-specific path.

**Decision (revised)**: Two changes, both required — task 2.1/2.2 as originally scoped is necessary but not sufficient:
1. Delete the eager import and worker configuration at `apps/chat/src/main.tsx:1-9,40` (as originally planned) — this removes the redundant/misleading explicit import once (2) below owns worker setup.
2. **New**: add a lazy boundary around the PDF-rendering path inside `@epam/ai-dial-attachment-canvas` itself — either wrap `AttachmentCanvasContainer`'s call to `AttachmentCanvasBody`'s PDF branch in `lazy()`/dynamic `import()` so `PdfContent` (and therefore `pdfjs-dist`/`@epam/ai-dial-react-pdf-highlighter`/`@epam/pdf-highlighter-kit`) only loads the first time `AttachmentContentType` resolves to a PDF, or (if `AttachmentCanvasContainer`'s public contract can't absorb an internal Suspense boundary cleanly) lazy-load `AttachmentCanvasContainer` itself from `app.tsx` gated on `isCanvasOpen` becoming true at least once. Prefer the narrower fix (lazy-load only the PDF branch inside the library) so opening a non-PDF attachment (image, text, HTML) is unaffected. This is a public-behavior-preserving internal change to `@epam/ai-dial-attachment-canvas` (same prop contract), needs a README note per AGENTS.md, and must not change `AttachmentCanvasContainer`'s existing eager-mount contract for non-PDF content types.
3. Worker URL setup (`GlobalWorkerOptions.workerSrc = pdfWorkerUrl`) moves to run once, the first time the lazy PDF branch loads — not at module scope of whichever file replaces `main.tsx`'s current line 40.

**Revised per code review**: the first implementation of (3) had `PdfContent.tsx` itself import `pdfjs-dist` and assign `GlobalWorkerOptions.workerSrc` at module scope. Review feedback correctly flagged this as a library-isolation violation: `GlobalWorkerOptions` is a global shared by every `pdfjs-dist` consumer in the host app, and a lib deciding that value unilaterally could conflict with a different `pdfjs-dist` version/consumer elsewhere in the app. Fixed by adding an optional `configurePdfWorker?: () => void | Promise<void>` callback prop, threaded through `AttachmentCanvasContainer` → `AttachmentCanvas` → `AttachmentCanvasBody` → `PdfContent`; `apps/chat` supplies the implementation (`apps/chat/src/utils/pdf.ts`, dynamically importing `pdfjs-dist` and the worker asset so it stays out of the eager bundle) and passes it in at the `AttachmentCanvasContainer` call site in `app.tsx`. `PdfContent` calls it once (guarded by a module-scope flag, invoked synchronously in the render body — before `DocumentPreview` is created — rather than in a `useEffect`, since child effects run before a parent's own effect and would otherwise race the document fetch). When the host omits the callback, `@epam/pdf-highlighter-kit`'s own CDN-hosted worker fallback is used, so PDF rendering degrades gracefully rather than breaking.

Separately, review feedback also noted that `apps/chat/src/main.tsx` still eagerly imported the PDF viewer's vendor CSS (`@epam/ai-dial-react-pdf-highlighter/styles.css`, `@epam/pdf-highlighter-kit/dist/pdf-highlight-viewer.css`, ~20 KB raw) even though the JS renderer was already lazy. Fixed by moving both imports into `PdfContent.tsx` itself, so they load only inside the same lazy chunk. The same review also flagged the `@uiw/react-md-editor`/`@uiw/react-markdown-preview` editor CSS `main.tsx` imported eagerly for `@epam/ai-dial-ui-kit`'s `LazyMarkdownEditor` (used only inside `libs/skill-editor`, `libs/prompt-editor`, and `libs/scheduled-tasks`, all already behind route-level `lazy()` boundaries in `app.tsx`) — fixed the same way, moving the two CSS imports into the three consuming components (`SkillEditor.tsx`, `PromptEditor.tsx`, `ScheduledTaskCreateForm.tsx`), with `@uiw/react-markdown-preview`/`@uiw/react-md-editor` added to each lib's `peerDependencies` and Rollup `external` list.

**Alternatives considered**:
- *Keep the import but change only the worker URL to a lazy fetch* — rejected: the 400+ KB of `pdfjs-dist`'s own JS entry (not just the worker) is what's eagerly imported and evaluated at `main.tsx:8`; changing only the worker URL doesn't remove that.
- *Only delete `main.tsx`'s import and stop there* — rejected after task 1.4's finding: this would not reduce the initial bundle at all, since `AttachmentCanvasContainer`'s own static import chain (`AttachmentCanvasBody` → `PdfContent` → `@epam/ai-dial-react-pdf-highlighter` → `@epam/pdf-highlighter-kit` → `pdfjs-dist`) pulls in the same dependency independently of `main.tsx`.
- *Make `AttachmentCanvasContainer` itself fully lazy from `app.tsx`* — considered as a fallback if the library-internal lazy boundary proves awkward to implement without changing the provider's public contract; kept as the second-choice implementation, not rejected outright, since it's a coarser but still-correct fix (the whole canvas, not just its PDF branch, would load on first open of *any* attachment type, which is a slightly worse UX for non-PDF attachments than the narrower fix).

### Decision 3 — Lazy boundary around `MarkdownRenderer`'s heavy dependencies

**Decision**: Inside `libs/chat-shared/src/components/MarkdownRenderer/MarkdownRenderer.tsx` and `CodeBlock/CodeBlock.tsx`, replace the eager `katex`/`rehype-katex` and `react-syntax-highlighter` imports with an internal `React.lazy`/dynamic-import boundary that loads those engines only when the message actually contains a math block or a fenced code block (both are detectable from the parsed markdown AST before the heavy renderer is invoked). Plain-text and unformatted messages render immediately with no engine load. This is an **internal implementation change inside the lib** — `MarkdownRenderer`'s public props and rendering output for existing content are unchanged, so it does not require a package-contract-breaking change, but it does need a README note (per AGENTS.md's "update in the same change" rule) since the lib's async loading behavior is now part of its documented behavior, and regression tests confirming both the fast path (no heavy deps loaded) and the math/code path (deps load and render correctly).

**Alternatives considered**: *Move `MarkdownRenderer` usage itself behind a route-level lazy boundary* — rejected: `MarkdownRenderer` is required for the primary chat experience on `/`, so gating the whole component would either delay first-message render (violating "no visible delay to the primary chat experience") or require duplicating a plain-text-only renderer; deferring only the KaTeX/syntax-highlighter sub-dependencies is the narrower, lower-risk cut.

### Decision 4 — Provider/request startup: consolidate `ConversationsContext`'s duplicate `listConversations()` call sites

**Resolved (task 1.5) — not duplicative; no consolidation needed.** `ConversationsContext.tsx` has exactly three call sites, and only one of them fires on the cold-load path:
- `refreshConversations` (defined `:119-130`) — exposed through context, called only from explicit user-triggered mutations: after an import (`ConversationPanelView.tsx:320`), after a discard/delete (`ConversationPanelView.tsx:983`), after a share-derived settle (`ConversationPanelView.tsx:1089`), and from `useConversationListBridge.ts:116` (post-mutation refresh). Never called on mount.
- `silentRefreshConversations` (defined `:132-139`) — called only from inside `watchForDisplayNameUpdate`'s SSE stream handler (`:219`), itself only running after a background conversation-title-update event arrives. Never called on mount.
- The mount/identity-change effect (`:252-275`, `useEffect(..., [userSub])`) — the **only** call site reachable on cold load; it also re-fires if the authenticated identity changes while the provider stays mounted (deliberate, per the comment at `:245-251`), which is a distinct, necessary trigger, not a duplicate of the initial fetch.

**Decision**: No consolidation. The three call sites are not redundant on the same path — they're guarded by three genuinely distinct triggers (initial mount/identity-change, explicit user mutation, background SSE update), exactly the pattern task 6.2 anticipated for the "not proven redundant" outcome. Leave `ConversationsContext.tsx` unchanged; this finding itself is the task 6.1/6.2 deliverable. Do not serialize `AppConfigContext`, `UserConfigContext`, `DeploymentsContext`, `PromptsContext`, and `SkillsContext`'s independent fetches — they are already safe to run in parallel and the brief explicitly prohibits new serialization.

**Alternatives considered**: *Introduce a single top-level bootstrap `Promise.all` gate across all providers* — rejected for this change: it would change provider ownership/sequencing broadly, is higher-risk than the brief's budget for a first change, and duplicate-call evidence so far is isolated to `ConversationsContext`; a repo-wide bootstrap orchestrator is noted as a follow-up if the lab profile shows request fan-out (not just bytes) is still material after the JS/CSS cuts land.

### Decision 5 — CSS critical-path: measure before cutting the Tailwind `node_modules` content globs

**Decision**: Before removing `apps/chat/tailwind.config.js:13-17`'s two `node_modules` content globs, generate the Tailwind output with and without them and diff the resulting CSS. Only remove a glob if the diff proves its matched classes are unused dead weight (not classes actually applied by `@epam/ai-dial-ui-kit`/`@epam/ai-dial-react-file-manager` components that the app renders). This is evaluation-first per the brief's instruction not to blindly apply candidates.

**Resolved (task 5.1/5.2) — both globs stay; no dead weight found.** Built Tailwind's output three ways with the Tailwind v3 CLI (`apps/chat/postcss.config.js`'s exact config, `@tailwind base/components/utilities` input) and diffed the generated selector sets:
- **With both `node_modules` globs** (current config): 639 unique utility classes generated.
- **With both globs removed** (only `apps/chat` source + `createGlobPatternsForDependencies`): 447 classes — **192 fewer**.
- **With only the `@epam/ai-dial-ui-kit` glob** (file-manager glob removed): 635 classes — only 4 fewer than "both", meaning the `@epam/ai-dial-react-file-manager` glob's unique contribution is small (`ml-0`, `p-px`, and fractional `my-*`/`text-violet-100`-family classes) but real, not zero.

The 192 classes matched only by the `ui-kit` glob are not incidental substring noise: they're semantically specific, design-system-token utilities (`bg-control-accent-alpha`, `border-control-disable-primary`, `divide-x-reverse`, `backdrop-blur`, `cursor-grab`, `animate-spin-steps`, `text-warning`/`bg-success`/`border-accent`, etc.) that match the tokens `@epam/ai-dial-ui-kit`'s own theme defines and that the app actually renders (buttons, controls, dialogs throughout the shell). A coincidental substring match producing exactly these compound, hyphenated, theme-specific names across 192 instances is implausible. The file-manager glob's smaller but nonzero contribution is likewise plausible, real usage.

**Conclusion**: keep both globs unchanged. No dead weight to cut — the classes they match are genuinely applied by components the app renders, so removing either glob would risk a silent visual regression (missing spacing/color/cursor utilities) for no byte saving, since these are Tailwind-generated utility classes, not the library's own bundled JS bytes; this decision does not change the JS/CSS byte totals measured elsewhere in this change. Per the alternatives-considered note below, removing them "immediately" without this diff would have been the wrong call.

**Alternatives considered**: *Remove both globs immediately* — rejected: could silently strip Tailwind classes those library components rely on, causing a visual regression that would only surface at runtime, not at build/lint time.

### Decision 6 — Future lab measurement profile (documented, not executed here)

No browser or live server is available in this environment, so this change's acceptance budgets are verified from production build output rather than Lighthouse or RUM. The profile below is documented for a future human or CI runner; executing it and adding instrumentation are explicitly outside this change.

- **Device/CPU**: Lighthouse's default "mobile" CPU throttling profile (4x slowdown) on a mid-tier reference machine; record the exact machine spec (cores, RAM) in the run log since Lighthouse's CPU throttle is relative to the host.
- **Network**: Lighthouse's "Slow 4G" throttling preset (RTT ~150 ms, throughput ~1.6 Mbps down / 750 Kbps up) for the primary comparative run; additionally record one "no throttling" run for a same-region baseline.
- **Browser**: headless Chrome, latest stable, via Lighthouse CLI (not DevTools UI) for repeatability; record the exact Chrome version in the run log.
- **Server location**: run Lighthouse from a client colocated in the same region as the deployed `apps/chat-api` origin (or from the same CI runner region every time) — record the region so run-to-run comparisons aren't confounded by cross-region RTT drift.
- **Compression / cache**: cold load = HTTP cache cleared (`--disable-storage-reset=false` / a fresh Chrome profile per run); verify `Content-Encoding: gzip` or `br` and `Cache-Control: immutable` on hashed assets are actually present in the response headers of the deployed target (not just configured) — if the current environment lacks this, document it as a delivery-layer follow-up per the brief (BFF/server config is out of scope for this change).
- **Auth state**: authenticated session cookie pre-seeded before navigation (per the brief's cold-load definition — empty HTTP cache, already-authenticated session); the interactive OIDC redirect is explicitly excluded from the timed navigation.
- **Runs**: minimum 7 runs per configuration; report median and p95 LCP. Explicitly label results as **lab proxy**, not field RUM.
- **`chat-ready` milestone definition**: the authenticated shell has committed and the composer input is attached and enabled. A future instrumentation change may emit a performance mark at this point; this change does not claim to emit it.
- **Route coverage**: run the profile against `/` and `/conversations/:id` with a representative existing conversation. Record both results without applying an undefined "material regression" threshold.

Lighthouse scores from this procedure remain a **lab diagnostic**, not proof of production p95; they establish a repeatable before/after comparison for this change's bundle-shape work.

## Risks / Trade-offs

- **[Risk] AG Grid remains embedded in the eager UI-kit entry** → Accepted for this change: removing it requires separately owned UI-kit package exports. The current byte budgets retain that known cost and do not depend on unfinished UI-kit work.
- **[Risk] Deferring `pdfjs-dist` could introduce a visible delay the first time a user opens a PDF, or `@epam/ai-dial-attachment-canvas`'s provider may itself eagerly touch PDF.js internals in a way this design can't fully verify without reading that library's source in depth** → Mitigation: verify the provider's actual initialization path during implementation before assuming `main.tsx`'s import is the only entry point; if the provider needs a change, it must be behind the same "load on first PDF" trigger, with a loading state on first open (no silent broken UI).
- **[Risk] Splitting KaTeX/syntax-highlighting behind a lazy boundary inside `MarkdownRenderer` could introduce a flash-of-unstyled-code or a rendering-order bug for messages with math/code, especially during streaming** → Mitigation: dedicated regression tests for streaming messages that start as plain text and later include a code fence or math block; verify no visible layout jump beyond what already happens when `react-markdown` re-renders during streaming today.
- **[Risk] Collapsing `ConversationsContext`'s call sites (Decision 4) without full understanding of why there are three could remove a needed cache-invalidation or race-condition guard** → Mitigation: read and trace all three call sites' triggers exhaustively before touching any of them; if the three are not proven redundant on the same path, leave them and document the finding instead of forcing a consolidation.
- **[Risk] Tailwind content-glob removal could strip classes used by library components** → Mitigation: Decision 5 measured the selector differences and retained both globs, so no runtime styling change was made.
- **[Risk] No live browser/Lighthouse/RUM evidence is available** → Accepted for this bundle-composition change: the committed script verifies byte budgets, while Decision 6 documents how a later instrumentation or performance-validation change can collect browser timings without overstating the present evidence.
- **[Trade-off] Not building a repo-wide bootstrap orchestrator (Decision 4's alternative) leaves some uncoordinated-but-parallel provider fetches in place** → Accepted for this change: bytes-on-the-wire dominate the measured problem; request-fan-out coordination is noted as a candidate follow-up if the lab run shows it still matters after the JS/CSS cuts.

## Migration Plan

1. Land Decision 2 (PDF.js) and Decision 3 (MarkdownRenderer heavy deps) first — narrowest blast radius, no library packaging risk, verifiable by unit/regression tests plus a clean rebuild's byte diff.
2. Land Decision 1's app-side matcher correction, preserving the package's existing lazy Monaco boundary. Do not include UI-kit export changes in this change.
3. Land Decision 5 (Tailwind content globs) only after the diff-before-cut measurement confirms no visual regression.
4. Land Decision 4 (provider dedup) last, since it's the lowest-certainty, lowest-byte-impact item, and depends on tracing that must happen during implementation.
5. Rebuild and run `node scripts/measure-initial-bundle.mjs` after each bundle-affecting slice. Decision 6's browser profile remains a future follow-up.
6. **Rollback**: every slice is a self-contained, revertible commit (no data migration, no API contract, no persisted-state format change); reverting any slice restores the prior eager-import behavior with no cleanup required.

## Resolved Questions

- The UI kit already preserves a Monaco dynamic-import boundary; the app matcher defeated it. AG Grid has no equivalent seam and is out of scope.
- `AttachmentCanvasProvider` does not eagerly touch PDF.js, but the PDF renderer had a static path through `AttachmentCanvasBody`; Decision 2 added the required internal lazy boundary.
- Only one `ConversationsContext` call site is reachable during cold load. The other two serve explicit mutation and SSE triggers, so no consolidation is required.

## Deferred Follow-ups

- **UI-kit AG Grid packaging**: add a supported package boundary that keeps AG Grid-backed components out of the base entry. Owner: `@epam/ai-dial-ui-kit`; regression surface: catalog, file manager, and editors.
- **Conversation-input package boundary**: expose `SendOnEnter` without statically reaching the component barrel. Expected app saving: approximately 15.7 KB gzip.
- **Generated API-client decomposition**: determine how much of the remaining `api-client-*.js` is executable bootstrap code and whether generated entry boundaries can reduce it without hand-editing generated files.
- **Attachment-canvas package optimization**: audit standalone dependency ownership, PDF/code chunk failure handling, version alignment, and package-level CSS splitting in its own OpenSpec change.
- **Delivery headers and browser timings**: verify production gzip/brotli, immutable caching, and the Decision 6 lab profile in an environment with deployment and browser access.
