## 1. Fix `DeploymentsContext`'s `rawDeployments` reset gap

- [x] 1.1 In `apps/chat/src/context/DeploymentsContext.tsx`, add `setRawDeployments([])` alongside the existing `setSchemas([])`/`setToolsets([])` calls at the start of `loadDeployments`, so an identity-triggered refetch can never keep serving deployments computed for the previous identity while the new fetch is in flight.
- [x] 1.2 In `apps/chat/src/context/tests/DeploymentsContext.spec.tsx`, extend the existing "identity-keyed refetch" tests to assert `items`/`rawDeployments` are empty *while* a `sub`-triggered refetch is in flight, not only after it resolves.
- [x] 1.3 Verify: `npm exec nx test chat`, `npm exec nx lint chat`.

## 2. `ConversationsContext`: reset and refetch on identity change

- [x] 2.1 In `apps/chat/src/context/ConversationsContext.tsx`, import `useUser` from `./auth/UserContext` and add `useUser().user?.sub` to the conversation-list load effect's dependency array (alongside its existing mount-time trigger), resetting `conversations` to `[]` and `error` to `null` and setting `isLoading` to `true` before re-invoking `listConversations()` — mirroring `DeploymentsContext`'s existing `userSub`-keyed pattern.
- [x] 2.2 In `apps/chat/src/context/tests/ConversationsContext.spec.tsx`, add tests per the new `conversations-context` spec: refetches and resets on `sub` change; does not refetch when `user` is replaced in place with an unchanged `sub`.
- [x] 2.3 Verify: `npm exec nx test chat`, `npm exec nx lint chat`.

## 3. `UserConfigContext`: reset and refetch on identity change

- [x] 3.1 In `apps/chat/src/context/UserConfigContext.tsx`, import `useUser` and add `useUser().user?.sub` to the config load effect's dependencies, resetting `pinnedConversationIds`/`installedToolsetIds`/`installedDeploymentIds`/`selectedDeploymentId` to their empty/`null` defaults and `status` to `Loading` before re-invoking `getUserConfig()`.
- [x] 3.2 In `apps/chat/src/context/tests/UserConfigContext.spec.tsx`, add tests per the modified `user-config-frontend-init` spec: refetches and resets on `sub` change; does not refetch when `user` is replaced in place with an unchanged `sub`.
- [x] 3.3 Verify: `npm exec nx test chat`, `npm exec nx lint chat`.

## 4. `UserContext`: adopt identity in place, drop `localStorage` filter clearing

- [x] 4.1 In `apps/chat/src/context/auth/UserContext.tsx`, change the `revalidate()` mismatch branch: instead of calling `invalidateSession()`, clear the CSRF token (`clearCsrfToken()`) and call `setUser(newProfile)`, leaving `status` unchanged (`Authenticated`). Leave the `401` branch of `revalidate()` and the `onUnauthorized`/`reset()` paths calling `invalidateSession()` exactly as they are today.
- [x] 4.2 Remove the two `removeFromLocalStorage(StorageKey.CatalogFilterTopics)` / `removeFromLocalStorage(StorageKey.CatalogIsMyAppsActive)` calls from `invalidateSession()`, and remove the now-unused `removeFromLocalStorage`/`StorageKey` imports if nothing else in the file needs them.
- [x] 4.3 Confirm `removeFromLocalStorage` has no remaining call sites (`grep -rn "removeFromLocalStorage" apps/chat/src`) and delete it from `apps/chat/src/utils/local-storage.ts`.
- [x] 4.4 In `apps/chat/src/context/auth/UserContext.spec.tsx`, update the "identity revalidation on focus/visibility regain" describe block: the mismatch scenario now asserts `user` becomes the newly-fetched profile, `status` remains `Authenticated`, and CSRF is cleared (not `Unauthenticated`); remove/replace any assertions expecting `localStorage` keys to be cleared by `invalidateSession()`.
- [x] 4.5 Verify: `npm exec nx test chat`, `npm exec nx lint chat`.

## 5. Full verification

- [x] 5.1 `npm exec nx test chat`
- [x] 5.2 `npm exec nx lint chat`
- [x] 5.3 `npm exec nx build chat`
- [x] 5.4 Manually reproduce issue #7843's steps (authenticate, switch to a different login provider while the tab stays open, revisit the tab to trigger the focus/visibility revalidation) and confirm the Catalog "My Apps"/topic filter reflects only the new identity's own items with no stale entries, and that Share succeeds with no `400`. **Not run in this session** — requires a live multi-provider OIDC backend to genuinely reproduce a cross-identity session switch; needs manual QA in an environment with real auth providers configured.
