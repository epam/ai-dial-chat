Slicing strategy: **risk-first, then vertical.**

- Slice 1 proves the highest-risk part: a new published subpath that a second lib consumes lazily.
- Slices 2–4 each move one group of overlays off the critical path and are verifiable on their own.
- Slice 5 measures and documents.

Every slice keeps the app working.

## 0. Baseline

- [x] 0.1 Record the baseline on a clean `origin/development` checkout:
  - Build `apps/chat` with source maps (`npx vite build --sourcemap` in `apps/chat`).
  - Save `node scripts/measure-initial-bundle.mjs` output.
  - Record the conversation route closure size and its chunk list, using the procedure from `design.md` D5.

  **Verification:** the numbers are written into this change's PR description draft.

  Recorded: initial graph JS 475,795 B gzip, CSS 35,363 B gzip; conversation route closure 24 chunks, 289.0 KB gzip, with `zod`, `@mcp-ui/client`, `@modelcontextprotocol/sdk` and `@modelcontextprotocol/ext-apps` reachable.

## 1. Renderer subpath and lazy inline preview (risk-first)

- [x] 1.1 Add the renderer entry:
  - Add `libs/attachment-canvas/src/mcp-app-renderer.ts`, re-exporting `McpAppCanvasRenderer` and the `McpAppCanvasRendererProps` type from `./components/McpAppCanvasRenderer/McpAppCanvasRenderer`.
  - Add it as a second `build.lib.entry` in `libs/attachment-canvas/vite.config.mts`, keeping `index` as the first entry.
  - Add `./mcp-app-renderer` to `libs/attachment-canvas/package.json` `exports`, with `@epam/source`, `types`, `import` and `default` conditions pointing at the files the build emits.
  - Keep the root export of `McpAppCanvasRenderer` unchanged.
  - Extend `associateDynamicChunkCss` in `libs/attachment-canvas/vite.config.mts` to every non-entry chunk. With two entries the renderer becomes a shared chunk whose CSS leaves `index.css`; the chunk must import it itself.
  - Add the subpath alias, before the root alias, wherever a Vite config aliases `@epam/ai-dial-attachment-canvas` to its source: `apps/chat/vite.config.mts`, `libs/chat-hooks/vite.config.mts`, `libs/toolset-editor/vite.config.mts`, `libs/mcp-apps/vite.config.mts`. A string alias also matches every subpath of its key.

  **Verification:**
  - The library build emits the entry (`npx vite build` in `libs/attachment-canvas` where the nx graph is unavailable). Its JS imports the renderer stylesheet; check the emitted file.
  - `npm run validate:docs` passes.
- [x] 1.2 Add `'@epam/ai-dial-attachment-canvas/mcp-app-renderer'` to `rolldownOptions.external` in `libs/mcp-apps/vite.config.mts`.
- [x] 1.3 Make `libs/mcp-apps/src/components/McpAppInlinePreview/McpAppInlinePreview.tsx` load the renderer lazily (`design.md` D1, D2):
  - Use a module-scope async `lazy` loader that imports `@epam/ai-dial-attachment-canvas/mcp-app-renderer`.
  - Start the same loader in a mount effect.
  - Put a `Suspense` around the renderer whose fallback is the existing `Spinner` with `loadingAriaLabel`.
  - Add an error boundary that maps an import failure to the existing error state, and reset it together with `attemptId` on reload.
  - Remove the static root import.

  **Architecture guard:** the lib gains no host-owned knowledge — no `/api` path, app context, flag, storage or routing. It imports only its declared dependency's public subpath.
- [x] 1.4 Unit tests in `libs/mcp-apps/src/components/McpAppInlinePreview/tests/McpAppInlinePreview.spec.tsx` and `McpAppInlinePreview.load-error.spec.tsx` (a module mock is per file). They query by role and label:
  - the spinner stays visible until the renderer module resolves;
  - the app renders after it resolves;
  - an import rejection shows the error label;
  - reload retries the import.

  **Verification:** `npm run test:file -- libs/mcp-apps/src/components/McpAppInlinePreview/tests/McpAppInlinePreview.spec.tsx libs/mcp-apps/src/components/McpAppInlinePreview/tests/McpAppInlinePreview.load-error.spec.tsx`; the existing classes and header specs mock the subpath instead of the root.
- [x] 1.5 Update the READMEs:
  - `libs/attachment-canvas/README.md`: document the `./mcp-app-renderer` subpath, and that the root export remains.
  - `libs/mcp-apps/README.md`: state that the preview loads the renderer on demand.

  **Verification:** `npm run validate:docs`.
- [x] 1.6 Add `scripts/check-route-graph.mjs` (`design.md` D5).
  - It walks the static closure of a named chunk in a source-mapped build, skipping chunks held by the entry.
  - It fails when a listed package is reachable.
  - Add unit tests at `scripts/check-route-graph.spec.mjs`, next to the script as the other script specs are, writing a small `dist` into a temp directory.

  **Verification:**
  - `node --test scripts/check-route-graph.spec.mjs`.
  - Against a source-mapped `apps/chat` build, the conversation route chunk reports no forbidden package (measured: 23 chunks, 186.8 KB gzip, down from 289.0 KB) — no `zod`, `@mcp-ui/client` or `@modelcontextprotocol/*`.
- [x] 1.7 Run `npm run verify:changed` and `npm run build:quiet`.

  Done in an isolated worktree, where the shared `node_modules` links `@epam/*` to the main checkout. Under `CI=true` (so nx skips its sync check) and with `npx vite build`:
  - Tests pass. Three 5 s timeouts under the parallel run (`ConversationMessageItem.spec.tsx`, `customAppDefinition.spec.tsx`) pass in isolation.
  - The app builds, and the route graph is as recorded in 1.6.
  - The remaining lint and typecheck failures are environment-only:
    - `@nx/dependency-checks` reports "package is not used" for every `@epam/*` dependency.
    - `chat-shared` references `destinationFolderPopupOptions`, which the locally installed `@epam/ai-dial-react-file-manager` 0.5.0-dev.5 lacks; the repo pins 0.4.3.
    - The subpath resolves through the main checkout's manifest. Mapped to the worktree source, `libs/mcp-apps` typechecks clean.
  - `npx eslint` on every changed file is clean.

## 2. Mount primitives

- [x] 2.1 Add `useHasBeenTrue` and its unit tests:
  - Source: `libs/chat-shared/src/hooks/useHasBeenTrue.ts`, with JSDoc explaining why the latch exists. It is state updated during render when `value` first turns true, never reset.
  - Export it from `libs/chat-shared/src/index.ts` and document it in `libs/chat-shared/README.md`.
  - Tests in `libs/chat-shared/src/hooks/tests/useHasBeenTrue.spec.ts`: false until the first true; true in that same render; stays true after the value returns to false.

  **Verification:**
  - `npm run test:file -- libs/chat-shared/src/hooks/tests/useHasBeenTrue.spec.ts`.
  - `npm run validate:docs`.
- [x] 2.2 Add `scheduleAfterLoadIdle` and its unit tests (`design.md` D4):
  - Source: `apps/chat/src/utils/load-idle.ts`, arrow-function exports.
  - Tests in `apps/chat/src/utils/tests/load-idle.spec.ts`:
    - it waits for `load` while the document is still loading;
    - it runs at idle once the document is complete;
    - it falls back to a 2000 ms `setTimeout` without `requestIdleCallback`;
    - it runs at once after the point was reached;
    - a cancelled callback never runs.

  The first plan's `preloadAfterLoad` was dropped once mounting the overlay became what loads its chunk (`design.md` D3).

  **Verification:** `npm run test:file -- apps/chat/src/utils/tests/load-idle.spec.ts`.
- [x] 2.3 Add `useIsAfterLoadIdle` and `useDeferredOverlayMount`, with unit tests:
  - Sources: `apps/chat/src/hooks/useIsAfterLoadIdle.ts` and `apps/chat/src/hooks/useDeferredOverlayMount.ts`, with JSDoc.
  - Tests in `apps/chat/src/hooks/tests/useIsAfterLoadIdle.spec.ts` and `apps/chat/src/hooks/tests/useDeferredOverlayMount.spec.ts`.

  **Verification:** `npm run test:file -- apps/chat/src/hooks/tests/useIsAfterLoadIdle.spec.ts apps/chat/src/hooks/tests/useDeferredOverlayMount.spec.ts`.

## 3. App-level overlays

- [x] 3.1 Gate the sources panel and the canvas in `apps/chat/src/app/app.tsx` with `useDeferredOverlayMount`, next to their existing route conditions. `App` already reads both contexts, so no separate gate component is needed (`design.md` D3).
  - Rewrite the comments above their `lazy()` declarations.
  - Tests in `apps/chat/src/app/tests/app.spec.tsx`:
    - nothing is mounted while the page loads;
    - each overlay mounts on an early open;
    - all of them mount once the page has loaded.
  - The existing canvas-route tests run after the load point.

  **Verification:** `npm run test:file -- apps/chat/src/app/tests/app.spec.tsx apps/chat/src/app/tests/appNavigation.spec.tsx apps/chat/src/tests/main-router.spec.tsx`.
- [x] 3.2 Add `apps/chat/src/components/SigninInterruptGate/SigninInterruptGate.tsx` for `SigninInterruptDialog`, mounted through `useDeferredOverlayMount(pendingEvents.length > 0)`. It owns the dialog's `lazy()` declaration and replaces the former `Suspense` block in `app.tsx`; `appNavigation.spec.tsx` mocks the gate instead of the dialog.
  - Tests in `apps/chat/src/components/SigninInterruptGate/tests/SigninInterruptGate.spec.tsx`:
    - nothing while loading with no events;
    - the dialog after the load point;
    - the dialog at once for an early event;
    - it stays mounted after the last event resolves.

  **Verification:** `npm run test:file -- apps/chat/src/components/SigninInterruptGate/tests/SigninInterruptGate.spec.tsx`.
- [x] 3.3 In `apps/chat/src/app/app.tsx`, render `OnboardingHints` only once `useIsAfterLoadIdle()` is true. This costs `App` one re-render at the load point. It is covered by `app.spec.tsx`.
- [x] 3.4 Run `npm run verify:changed` and `npm run build:quiet`, with the same environment limits as 1.7.

## 4. Catalog modals

- [x] 4.1 Gate the deployment catalog modal:
  - In `apps/chat/src/components/DeploymentSelector/useDeploymentSelectorOverlay.tsx` and `apps/chat/src/components/DeploymentSelector/useDeploymentSelectorFieldOverlay.tsx`, return `catalogModal` only once `useDeferredOverlayMount(isCatalogOpen)` is true; otherwise return `null`.
  - Tests in `apps/chat/src/components/DeploymentSelector/tests/useDeploymentSelectorOverlay.catalog.spec.tsx`, run for both hooks:
    - not mounted while loading and closed;
    - mounted when browsed;
    - mounted closed after the load point.

  **Verification:** `npm run test:file -- apps/chat/src/components/DeploymentSelector/tests/useDeploymentSelectorOverlay.catalog.spec.tsx`, plus the existing `useDeploymentSelectorOverlay.spec.tsx`, `useDeploymentSelectorFieldOverlay.spec.tsx` and `DeploymentSelectorFieldTrigger.spec.tsx`.
- [x] 4.2 Gate the prompt catalog modal:
  - Add `apps/chat/src/components/PromptSelector/PromptCatalogGate.tsx`, which takes `isOpen` and children.
  - Wrap the output of `usePromptSelectorOverlay`'s render callback with it.
  - Tests in `apps/chat/src/components/PromptSelector/tests/PromptCatalogGate.spec.tsx`.

  **Verification:** `npm run test:file -- apps/chat/src/components/PromptSelector/tests/PromptCatalogGate.spec.tsx apps/chat/src/components/PromptSelector/tests/usePromptSelectorOverlay.spec.tsx`.
- [x] 4.3 Run `npm run verify:changed`, with the same environment limits as 1.7.

## 5. Measurement and documentation

- [x] 5.1 Re-measure on the change branch with the procedure from 0.1.
  - The initial graph is 476,287 B JS gzip and 35,363 B CSS gzip, within the budgets.
  - `check-route-graph.mjs` passes.
  - The lab LCP comparison over 7 alternating runs: median 5020 → 4632 ms, p95 5948 → 4860 ms.
  - The overlay chunks start after LCP in every run, except the shared `AttachmentCanvasBody` dependency, which starts ~350 ms before LCP when the deferred wave begins.
  - Results are in `design.md` "Results (lab proxy)".
- [x] 5.2 Update `.claude/rules/bundle-performance.md` "Lazy-load what is not on screen at first paint":
  - A mounted `lazy` component downloads even when it renders nothing.
  - Gate closed overlays with `useDeferredOverlayMount`.
  - Never `import()` another lib's root barrel; use a subpath export.
- [x] 5.3 Update `docs/architecture.md` where it lists lazy boundaries or the attachment-canvas exports.

  **Verification:** `npm run validate:docs` and `npm run validate:specs`.
- [x] 5.4 Close the change with one `npm run verify:full`.

  With the environment limits of 1.7: the full test suites of `chat`, `mcp-apps`, `attachment-canvas`, `chat-shared`, `chat-hooks` and `toolset-editor` ran 4,702 tests and 313 files; two `chat` files that failed under the parallel run (`CelebrationHost.integration.spec.tsx`, `quickAppDefinition.spec.tsx`) pass in isolation (55/55). ESLint and Prettier pass on every changed file; `validate:docs` and `validate:specs` pass.

## 6. Second round (`design.md` D4 revision, D6, D7)

- [x] 6.1 Load messages outside the home route's graph (`design.md` D6):
  - Add `apps/chat/src/utils/conversation-message-loader.ts` and `apps/chat/src/components/ConversationMessageItemLoader/ConversationMessageItemLoader.tsx`, and render messages through the loader in `ConversationView`.
  - In `app.tsx`, start the load at once except on `/`, where it waits for the post-load idle point.
  - Tests: `ConversationMessageItemLoader.spec.tsx`; the message-memo and message-timestamps specs preload the module, as a conversation route does.
  - `check-route-graph.mjs` with the markdown packages forbidden: 13 chunks, 45.1 KB gzip, none reachable.
- [x] 6.2 Gate the skill details panel with `apps/chat/src/components/SkillSelector/SkillDetailsPanelGate.tsx` (`design.md` D7). Tests: `SkillDetailsPanelGate.spec.tsx`.
- [x] 6.3 Make the post-load idle point wait for the first screen (`design.md` D4):
  - Add `markFirstScreenRendered` in `apps/chat/src/utils/load-idle.ts`, called from `ConversationView`'s first commit, with a 3000 ms fallback after `load`.
  - Extend `apps/chat/src/utils/tests/load-idle.spec.ts` with the first-screen wait and its fallback.
- [x] 6.4 Re-measure against the first-round build: median LCP 6588 → 5872 ms, and lazy JS before LCP 732 → 136 KB (`design.md` "Results").
- [x] 6.5 `EllipsisTooltip` `use-truncation` is not a real cost. A trace with layout stacks shows it forces no layout; the 113 ms in the first CPU profile was a source-map misattribution in the minified vendor chunk. The forced layouts before LCP (~92 ms of 95 ms) come from `react-window`'s layout effect in `libs/conversation-panel`'s `ConversationList`, handled separately.
