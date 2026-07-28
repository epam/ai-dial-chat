## Why

After a user switches to a different login provider while the SPA tab stays mounted (e.g. logging out and back in as a different identity, or a session change propagating from another tab), `UserContext` and `DeploymentsContext` never re-bootstrap: they only invalidate on an explicit `401` or a full page reload. The tab keeps rendering the previous user's cached deployments/toolsets snapshot, whose `isMy` ownership flags were computed for the old identity. This makes the Catalog "my deployments" filter show other users' items, and lets the user click **Share** on a stale catalog card whose `itemId` belongs to the old session's bucket — DIAL Core then rejects the mismatched resource path with `400 Bad Request` once it's validated against the new session's token. A hard refresh works around both symptoms only because it forces a full re-bootstrap.

## What Changes

- `UserContext` gains a way to detect that the authenticated identity has changed underneath an already-mounted tab (not just a `401`), by re-validating the session (`GET /api/v1/auth/me`) at safe checkpoints (e.g. on tab focus/visibility regain) and comparing the returned identity to the currently held one.
- When an identity change is detected, `UserContext` treats it like the existing 401/reset path: it updates `user`, and downstream consumers relying on `RequireAuth`'s mount/unmount of the protected tree get a fresh mount instead of continuing to render state captured under the old identity.
- `DeploymentsContext` stops treating its deployments/toolsets fetch as mount-once-only: it refetches whenever the resolved identity it was fetched for changes, and does not keep serving `isMy`-flagged items computed for a previous user while the new fetch is in flight.
- No change to the `/share` endpoint contract itself — once stale catalog items can no longer outlive an identity switch, the client cannot submit a stale `itemId` from the old session's bucket, so the `400` from DIAL Core is prevented at the source rather than papered over.
- The Catalog's persisted "From" topic filter and "My Apps" toggle (`localStorage` keys `catalogFilterTopics`/`catalogIsMyAppsActive`, written by `useCatalogSortFilterPreference`) are cleared whenever `UserContext` invalidates the session (explicit logout, an identity mismatch detected by the new revalidation checkpoint, or a `401`) — today they are plain, user-agnostic `localStorage` entries that survive logout and leak into the next identity's session on the same browser. `catalogSortKey` is a pure display preference (not identity-scoped) and is left untouched.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `spa-auth-session`: add a requirement that the SPA re-validates the current session identity at safe checkpoints (not only on a `401`) and treats a changed identity the same as the existing 401/reset invalidation path.
- `deployments-context`: add a requirement that the deployments/toolsets fetch is keyed to the current authenticated identity and refetches (instead of continuing to serve a stale snapshot) when that identity changes.

## Impact

- `apps/chat/src/context/auth/UserContext.tsx` — add identity re-validation checkpoint(s) and comparison logic.
- `apps/chat/src/context/DeploymentsContext.tsx` — key the load effect to the current identity and refetch/reset on change.
- Indirectly fixes the Catalog "my deployments" filter (`apps/chat/src/utils/map-deployment-to-catalog-item.ts`, `apps/chat/src/components/Catalog/CatalogView.tsx`) and the Share `400` (`apps/chat/src/hooks/useShareLink/useShareLink.ts`, `apps/chat/src/server-api/share.api.ts`) by removing the stale snapshot both features read from.
- `apps/chat/src/utils/local-storage.ts` — add a small removal helper used to clear the two identity-scoped Catalog preference keys on session invalidation.
- No backend/API contract changes required.
