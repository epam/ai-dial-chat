## Why

`apps/chat/src/components/CatalogView/CatalogView.tsx` is the largest frontend production file in the repo (1685 lines, 45 `useState`/`useEffect`/`useCallback`/`useMemo` calls) and backs the single largest spec file (5275 lines). Nearly all of that bulk is imperative glue — catalog-item derivation, toolset login/logout, publish/unpublish, share/unshare, edit/delete routing, and create-menu construction — sitting between the data contexts and a comparatively thin JSX return. This makes the component hard to navigate, hard to test in isolation, and risky to touch: any edit to one concern (e.g. publish) requires reasoning about the whole 1685-line file and its 45 interdependent hook calls. The refactoring audit (`refactoring-frontend.md`) flags this as the top P1 frontend item, mirroring the shape of already-completed extractions (`extract-conversation-panel-reusables`, `split-use-dial-file-manager`).

## What Changes

- Extract `CatalogView.tsx`'s internal state/derivation and action-handler logic into dedicated app-owned hooks under `apps/chat/src/hooks/`, following the existing `useCatalogActiveTabPreference` / `useCatalogSortFilterPreference` folder pattern (`useX/useX.ts` + co-located tests).
- Proposed groupings (adjusted during implementation if a cleaner seam emerges):
  - `useCatalogItems` — builds `catalogItems`, `visibleCatalogItems`, `reconciledFilterTopics`, `availableTabIds`, `favorites`, `quickAppSchemaId`/`quickAppDeploymentIds`, and the labels/`catalogDetailsApi` memos feeding `useCatalogItemDetails`.
  - `useCatalogToolsetCredentials` — `getLevelStatus`, `showLoginSuccess`/`showLogoutSuccess`, `handleLogin`, `handleLogout`.
  - `useCatalogPublishing` — `getPublishHistory`, `handlePublish`, `handleUnpublish`, `handlePublishSuccess`, `handlePublishError`, `handleFetchExistingRules`, `isPublishVisible`.
  - `useCatalogSharing` — `isShareVisible`, `isUnshareVisible`, `isRevokeShareVisible`, `handleUnshare`, `handleRevokeShare`, `handleFetchRecipientsCount`.
  - `useCatalogItemActions` — `handleUseInChat`, `handleCardSelect`, `handleDownload`, `isDownloadVisible`, `isPrimaryActionVisible`, `onToggleFavorite`, `fetchPromptDto`.
  - `useCatalogEditNavigation` — `buildEditorUrl`, `handleEdit`, `handleDelete`, `createOptions`.
- `CatalogView.tsx` becomes a thin composition: call the data-source hooks (`useDeployments`, `usePrompts`, `useSkills`, `useFavoriteApplications`, existing preference hooks), call the new extracted hooks in sequence passing their outputs forward, and render the existing JSX unchanged.
- No behavior change: every extracted piece keeps its current inputs, outputs, memoization dependencies, i18n keys, and error/notification handling verbatim — this is a structural move, not a rewrite.
- No new hooks are added to `libs/*` — all logic here depends on app-owned concerns (`server-api`, contexts, routing, i18n), which the library isolation rule (AGENTS.md) forbids inside `libs/*`.

## Capabilities

### New Capabilities

- `catalog-view-hook-decomposition`: The internal contract that `CatalogView.tsx`'s state, derivations, and handlers are owned by a defined set of extracted hooks, with the component's external behavior and rendered output unchanged. This is not a user-facing capability — it exists to make the decomposition itself testable and to guarantee equivalence with pre-refactor behavior, following the same pattern as the archived `dial-file-manager-hook-decomposition` spec.

### Modified Capabilities

None — no user-facing spec-level (external behavior) requirement changes. Existing catalog behavior (browsing, credentials, publish/unpublish, share/unshare, edit/delete, create menu) is preserved exactly; only the internal code organization changes.

## Impact

- **Affected code**: `apps/chat/src/components/CatalogView/CatalogView.tsx` and its test suite `apps/chat/src/components/CatalogView/tests/CatalogView.spec.tsx` (5275 lines — will be split alongside the hooks, with hook-level tests co-located under each new `useX/tests/useX.spec.ts(x)`).
- **New files**: several `apps/chat/src/hooks/useCatalogXxx/useCatalogXxx.ts` (+ tests) per the groupings above.
- **No dependency changes**: no new packages; no changes to `@epam/ai-dial-chat-hooks`, `libs/catalog`, or any other lib's public API.
- **No API/contract changes**: server-api wrappers (`server-api/*.api.ts`, `server-api/toolsets.ts`, etc.) are called with the same arguments as today, just from a different file.
- **Risk**: `CatalogView` is a central, frequently-touched surface (catalog browsing). Implementation must proceed in small, independently-verifiable slices (one hook group at a time, with `npm run verify:changed` after each), matching the discipline used in the already-successful `extract-conversation-panel-reusables` change, rather than one large rewrite.
