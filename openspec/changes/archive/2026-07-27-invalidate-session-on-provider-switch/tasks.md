## 1. UserContext identity revalidation

- [x] 1.1 Add a `focus`/`visibilitychange` listener in `UserProvider` (`apps/chat/src/context/auth/UserContext.tsx`) that calls the existing `bootstrap` path only while `status === AuthStatus.Authenticated`, guarded so a revalidation already in flight is not duplicated.
- [x] 1.2 On a successful revalidation response, compare the returned profile's `sub` to the currently held `user.sub`; if unchanged, update `user` in place without touching `status`.
- [x] 1.3 On a `sub` mismatch or a `401` from the revalidation call, run the same invalidation as `onUnauthorized`: clear the CSRF token, set `user` to `null`, set `status` to `Unauthenticated`.
- [x] 1.4 Clean up both listeners on unmount alongside the existing `onUnauthorized` cleanup.

## 2. DeploymentsContext identity-keyed fetch

- [x] 2.1 In `DeploymentsProvider` (`apps/chat/src/context/DeploymentsContext.tsx`), read `user?.sub` from `useUser()` and add it as a dependency of the load `useEffect` alongside `loadDeployments`.
- [x] 2.2 Verify `loadDeployments` already resets `rawDeployments`/`schemas`/`toolsets` to empty and `isLoading` to `true` at the start of each run (it does — confirm no additional state needs resetting) so a `sub` change re-triggers the same reset-then-fetch behavior as initial mount.
- [x] 2.3 Confirm the effect does NOT re-run when `user` is replaced with an unchanged `sub` (e.g. from task 1.2's in-place update) — `sub` is a primitive dependency, so this should hold without extra guards, but verify via the test in 4.2.

## 6. Clear identity-scoped Catalog localStorage preferences on session invalidation

- [x] 6.1 Add a `removeFromLocalStorage(key: string)` helper to `apps/chat/src/utils/local-storage.ts`.
- [x] 6.2 In `UserContext.tsx`, extract a single `invalidateSession()` helper that clears CSRF, sets `user` to `null`, sets `status` to `Unauthenticated`, and removes `StorageKey.CatalogFilterTopics`/`StorageKey.CatalogIsMyAppsActive` via the new helper; do NOT touch `StorageKey.CatalogSortKey`.
- [x] 6.3 Route `reset()`, the `onUnauthorized` listener, and the `revalidate()` mismatch/`401` branch through `invalidateSession()` instead of each duplicating the same four statements. (Also routed bootstrap's own 401 branch through it for consistency — same class of session invalidation.)
- [x] 6.4 Add test cases to `UserContext.spec.tsx` asserting `catalogFilterTopics`/`catalogIsMyAppsActive` are removed from `localStorage` on `reset()`, on `onUnauthorized`, and on a revalidation mismatch, while `catalogSortKey` is left untouched.

## 3. Manual verification

- [x] 3.1 Reproduce the original repro (switch login providers across two tabs sharing the same origin/session, or via logout+login in one tab while a second stays open) and confirm the Catalog "my deployments" filter reflects the new identity after refocusing the stale tab, without a manual page refresh.
- [x] 3.2 Confirm Share on a Catalog item succeeds after the identity switch and refocus, with no `400 Bad Request` from `POST /share`.
- [x] 3.3 Confirm a tab that stays in the background (never regains focus/visibility) is unaffected until it is refocused — no unexpected mid-session remount for tabs that never lost and regained focus.

## 4. Automated tests

- [x] 4.1 `apps/chat/src/context/auth/tests/UserContext.spec.tsx` (or equivalent existing test file): add cases for focus/visibility-triggered revalidation with unchanged `sub` (in-place update, `status` stays `Authenticated`) and changed `sub` (invalidation path fires, matching the existing `onUnauthorized` test's assertions).
- [x] 4.2 Add a case confirming no revalidation request fires while `status` is `Loading` or `Unauthenticated`, and that overlapping focus/visibility triggers do not issue a duplicate in-flight request.
- [x] 4.3 `apps/chat/src/context/tests/DeploymentsContext.spec.tsx` (or equivalent existing test file): add a case asserting the load effect re-runs (resets state, refetches) when the identity (`user?.sub`) passed through `useUser()` changes, and does NOT re-run when `user` changes with the same `sub`.

## 5. Quality gate

- [x] 5.1 `npm exec nx test chat` for the touched contexts.
- [x] 5.2 `npm exec nx lint chat`.
- [x] 5.3 Run the `code-review-and-quality` skill's five-axis review before merge.
