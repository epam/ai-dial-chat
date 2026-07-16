## 1. Fix icon flicker (`deployments-context`, `deployment-icon-preload-swap`, `deployment-icon-failed-state-scoping`)

- [x] 1.1 In `apps/chat/src/context/DeploymentsContext.tsx`, add `userConfigSelectedIdRef`/`defaultDeploymentIdRef`, synced via dedicated `useEffect`s (not direct render-time mutation, per `react-hooks/refs`), and read them inside `loadDeployments` instead of depending on `userConfigSelectedId`/`appConfig.defaultDeploymentId` directly. Make `loadDeployments` a stable `useCallback` with an empty dependency array so the mount effect only runs once.
- [x] 1.2 Add a secondary effect that recomputes the initial selection (no network call) when `userConfigSelectedId`/`appConfig.defaultDeploymentId`/`rawDeployments` change, guarded to a no-op unless `selectedItemId` is still `null` and `rawDeployments` is non-empty.
- [x] 1.3 Add regression tests in `apps/chat/src/context/tests/DeploymentsContext.spec.tsx`: selecting a deployment does not call `getDeployments`/`getApplicationSchemas`/`listToolsets` a second time and `isLoading` stays `false`; a late-arriving user config value resolves selection from an already-loaded (or later-repopulated) list without an extra fetch beyond the explicit `refetchDeployments` call.
- [x] 1.4 Keep the `DeploymentIcon` preload-before-swap fix from the prior round (`libs/chat-shared/src/components/DeploymentIcon/DeploymentIcon.tsx` + its tests) — still valid, addresses the smaller native `<img src>` blank-frame gap on top of the real fix above.
- [x] 1.5 Manually verify against GitHub #7757: in the running app, switch between models and confirm the icon updates immediately with no multi-second wait, and that the server no longer logs a repeated `GET /api/v1/deployments` / `GET /api/v1/toolsets` on every selection. Verified by the user directly in their local dev environment.

## 2. Popover-collapse-on-open — dropped from this change

- [x] 2.1 Removed all height-transition-skip code from `DeploymentSelectorPanel.tsx` and its tests (see prior round) — confirmed via user's direct observation that the entire popover box, not the inner list, is what collapses, and that lives in vendor `@epam/ai-dial-ui-kit` (`DialDropdown`), out of this repo's fix scope. Not part of this change per explicit user direction.

## 3. Verification

- [x] 3.1 `npm exec nx lint @epam/chat` — 0 errors (pre-existing unrelated warnings only)
- [x] 3.2 `npm exec nx test @epam/chat` — 124 files, 1328 passed / 2 skipped (includes 32 `DeploymentsContext` tests)
- [x] 3.3 `npm exec nx lint @epam/ai-dial-chat-shared` — 0 errors, 0 warnings
- [x] 3.4 `npm exec nx test @epam/ai-dial-chat-shared` — 131/131 passed
- [x] 3.5 `npm exec nx -- affected -t lint test build --base=origin/development-1.0` — 15 affected projects, all green
