## 1. DeploymentsContext: add restoreDefaultSelection

- [x] 1.1 Add `restoreDefaultSelection: () => void` to `DeploymentsContextType` in `apps/chat/src/context/DeploymentsContext.tsx`, with a doc comment distinguishing it from `setSelectedItemId` (persists) and `restoreSelectedItemId` (transient, conversation-scoped).
- [x] 1.2 Implement `restoreDefaultSelection` using `resolveInitialSelection(items, null, userConfigSelectedId, appConfig.defaultDeploymentId)`, wrapped in `useCallback`; only call `setSelectedItemIdState` when the resolved value is non-null.
- [x] 1.3 Add `restoreDefaultSelection` to the memoized `contextValue` object and its `useMemo` dependency array.
- [x] 1.4 Add unit tests (co-located `tests/` folder for the context, or existing `DeploymentsContext` test file) covering: persisted-preference resolution overriding a stale in-memory value; fallback to operator default when no persisted preference exists; no call to `setSelectedDeployment`/persistence during `restoreDefaultSelection`.

## 2. ConversationRoute: re-resolve default deployment on mount

- [x] 2.1 Destructure `restoreDefaultSelection` from `useDeployments()` in `apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx`.
- [x] 2.2 Extend the existing mount effect (currently only handling `routeDeploymentId`) to call `restoreDefaultSelection()` when there is no `routeDeploymentId` and no `overlay?.pendingModelId`; update the effect's dependency array accordingly.
- [x] 2.3 Add/update `ConversationRoute` tests (`apps/chat/src/pages/ConversationRoute/tests/` if present, else co-located per repo convention) covering the three mount scenarios from the `conversation-deployment-selection` spec delta: no router state / no pending overlay model → `restoreDefaultSelection` called; explicit `routeDeploymentId` → `restoreSelectedItemId` called and `restoreDefaultSelection` NOT called; pending `overlay.pendingModelId` → neither `restoreDefaultSelection` nor a premature selection change occurs from this effect.

## 3. Regression coverage for the reported bug

- [x] 3.1 Add a test (context + route integration level, e.g. rendering `DeploymentsProvider` + `ConversationRoute` + a stubbed conversation load) reproducing the exact issue #8150 Case 3 steps: select "opus" via `setSelectedItemId`, simulate opening a conversation via `restoreSelectedItemId("whisper")`, remount/re-render `ConversationRoute`, assert `selectedItemId` (and the `deploymentId` passed to `apiCreateConversation` on send) is `"opus"`, not `"whisper"`.

## 4. Verification

- [x] 4.1 `npm exec nx test chat` (or the narrower affected project) — all new and existing tests pass.
- [x] 4.2 `npm exec nx lint chat` — no new lint errors.
- [x] 4.3 Manually verify in the running app (`npm start` + `npm run start:api`): select a model on New Chat, open a conversation with a different model, click "New chat" again, confirm the originally selected model is shown and used.
- [x] 4.4 Confirm no regression in overlay mode: `overlay.pendingModelId` preselection still applies correctly when opening the composer from the overlay conversation-list bridge.
