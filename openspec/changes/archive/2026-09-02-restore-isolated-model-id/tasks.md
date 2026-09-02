## 1. UiFeaturesContext: isolated-view override slot

- [x] 1.1 Add `applyIsolatedViewOverride(features: Set<OverlayFeature> | null)` to `UiFeaturesContextType` and `UiFeaturesProvider` (`apps/chat/src/context/UiFeaturesContext.tsx`), backed by its own `useState<Set<OverlayFeature> | null>(null)`, with a `// TODO: remove in next release` comment on the new state/function.
- [x] 1.2 Update the `enabledFeatures` `useMemo` priority chain to check the isolated-view override first, before the existing overlay-override/server-baseline/compiled-defaults chain.
- [x] 1.3 Add/extend unit tests in `apps/chat/src/context/tests/UiFeaturesContext.spec.tsx` (or equivalent) covering: isolated-view override beats overlay override, isolated-view override beats server baseline, `null` restores the prior chain.

## 2. IsolatedModelViewContext

- [x] 2.1 Create `apps/chat/src/context/IsolatedModelViewContext.tsx` with a `// TODO: remove in next release` file header, following the `ThemeContext` provider pattern (`createContext<T | undefined>(undefined)`, memoized value, guard hook).
- [x] 2.2 Read `isolated-model-id` from `useLocation().search`; resolve it against `useDeployments().items` via `findDeploymentByIdOrReference`; derive `isActive`/`isNotFound`/`resolvedDeploymentId` per the `isolated-model-view` spec's pending/not-found semantics.
- [x] 2.3 On resolution, call `UiFeaturesContext.applyIsolatedViewOverride` with the fixed forced set (`disallow-change-agent`, `hide-change-agent`, `hide-empty-chat-change-agent`, `hide-new-conversation`, `hide-navigation-menu`), exactly once per resolved id.
- [x] 2.4 Export `useIsolatedModelView(): { isActive: boolean; isNotFound: boolean; resolvedDeploymentId: string | null }`.
- [x] 2.5 Mount `IsolatedModelViewProvider` in `apps/chat/src/main.tsx`, inside `BrowserRouter` and `DeploymentsProvider`, alongside `UiFeaturesProvider`, marked `// TODO: remove in next release`.
- [x] 2.6 Unit test the provider (mocking `useLocation`/`useDeployments`) for: param absent, param present + resolves (override applied once), param present + not found, param present + deployments still loading.

## 3. ConversationRoute wiring

- [x] 3.1 Consume `useIsolatedModelView()` in `apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx`, marked `// TODO: remove in next release`.
- [x] 3.2 Extend the existing deployment-selection effect (`routeDeploymentId` / `overlay?.pendingModelId` / `restoreDefaultSelection()`) with a third source: when `isActive && resolvedDeploymentId`, call `restoreSelectedItemId(resolvedDeploymentId)` once (own guard ref) and skip `restoreDefaultSelection()`.
- [x] 3.3 When `isActive && isNotFound`, render the UI kit's `NoDataContent` (with new i18n keys for title/description) instead of `NewConversationComposer`.
- [x] 3.4 Add a small pure helper (co-located or in an existing app utils file) that sanitizes a model id for the generated conversation name by stripping characters outside `[A-Za-z0-9_-]`.
- [x] 3.5 In `handleCreateConversation` and `handleStarterSelect`, when isolated view is active, call `renameConversation(getConversationPath(conversation.id), `isolated_${sanitizedModelId}`)` before navigating.
- [x] 3.6 Add the new i18n keys to `translation-keys.ts` and every locale file in `apps/chat/src/i18n/locales/` (only `en.json` exists in this repo — no other locale files to update).
- [x] 3.7 Component tests for `ConversationRoute` covering: deployment preselection without persisting it, not-found screen, rename-after-create for both creation call sites, and no regression when the param is absent.

## 4. Fixes found in manual testing

- [x] 4.1 `hide-navigation-menu` only hides the mobile hamburger/sheet (`ui-feature-toggles`'s own requirement excludes the desktop rail) — the desktop `NavigationPanel` was still visible during manual verification. Skip rendering `<Navigation />` entirely in `apps/chat/src/app/app.tsx` whenever `useIsolatedModelView().isActive` is `true`, marked `// TODO: remove in next release`.
- [x] 4.2 The conversations panel briefly flashed open on page load: `applyIsolatedViewOverride` was gated on `resolvedDeployment` (async, waits on `useDeployments()`), letting `app.tsx`'s default-open-panel effect run first. Changed the trigger to `modelId` presence alone (synchronous, matches the old SSR feature's `params?.has(...)` timing) in `IsolatedModelViewContext.tsx`.

## 5. Verification

- [x] 5.1 Run `npm run test:file` for every new/changed spec file from tasks 1–3.
- [x] 5.2 Run `npm run verify:changed`.
- [x] 5.3a Manually verified the resolved-deployment path in the browser: navigation hidden (after fixing task 4.1), model pinned. Confirmed by the requester via screenshot.
- [x] 5.3b Manually verified: sending a first message renames the conversation to `isolated_<id>`, and the not-found state for an invalid id. Confirmed by the requester.
- [x] 5.4 Grep the repo for `remove in next release` tied to this change and confirm every added file/branch is covered, as a removal checklist for the next release.
