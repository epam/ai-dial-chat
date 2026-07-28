## Context

PR #8033 (archived change `2026-07-27-invalidate-session-on-provider-switch`) added a `visibilitychange`/`focus` revalidation checkpoint to `UserContext` (`apps/chat/src/context/auth/UserContext.tsx`) that detects a same-tab identity switch (e.g. the user re-authenticates as a different identity in another tab, or any other same-origin flow that swaps the BFF session cookie without this tab ever seeing a `401`) by comparing a freshly-fetched `UserProfile.sub` against the currently held one. It also keyed `DeploymentsContext`'s load effect to `user?.sub` so a `DeploymentsProvider` instance that stays mounted across an identity change refetches instead of serving a stale snapshot.

Issue #7843 is still open — the reporter confirmed "still reproduce" after #8033 merged. Two independent problems remain:

1. **Wrong layer.** `invalidateSession()` clears two `localStorage` keys (`CatalogFilterTopics`, `CatalogIsMyAppsActive`) on every invalidation. These only remember which Catalog filter the user picked; the `isMy` ownership flag on each deployment/toolset is computed server-side and lives in `DeploymentsContext`'s in-memory state. Clearing a filter preference does nothing to refresh the data being filtered — it was never going to fix "my items filter shows other users' items" or the stale `itemId` behind the Share `400`.
2. **Mismatch handling discards the very data it needs.** `revalidate()` fetches the new profile to compare `sub`, and on a mismatch calls `invalidateSession()` — which sets `user = null` and `status = Unauthenticated` — throwing away the profile it just fetched. The browser's BFF session is already validly authenticated as the new identity at this point (that's *why* `getMe()` returned `200` with a different `sub`), so forcing `Unauthenticated` sends an already-signed-in user through a redundant login screen instead of continuing seamlessly.

`RequireAuth` (`apps/chat/src/components/RequireAuth/RequireAuth.tsx`) unmounts its children whenever `status !== Authenticated`. Today that unmount/remount cycle is the *only* reset mechanism for `ConversationsContext`, `UserConfigContext`, and (as defense-in-depth) `DeploymentsContext`. Fixing problem 2 by keeping `status = Authenticated` during an in-place identity swap removes that reset mechanism for this path, so `ConversationsContext` and `UserConfigContext` need their own identity-keyed reset — the same pattern `DeploymentsContext` already has.

## Goals / Non-Goals

**Goals:**
- Stop clearing Catalog filter preferences on session invalidation; rely on the data layer being correctly re-scoped per identity instead.
- On a detected identity mismatch, adopt the new identity in place (no forced logout/re-login screen for an already-valid session).
- Guarantee that `ConversationsContext`, `UserConfigContext`, and `DeploymentsContext` all reset their in-memory state and refetch when the authenticated identity changes, regardless of whether that change arrives via an explicit logout (unmount/remount) or an in-place adoption (no unmount).
- Close the `DeploymentsContext.loadDeployments` gap where `rawDeployments` isn't cleared before a refetch, even though the current `deployments-context` spec already documents that it should be.

**Non-Goals:**
- Changing the `/share` endpoint contract or DIAL Core's `400` validation — unchanged from the archived design; this change keeps removing the stale `itemId` at its source on the client.
- `GenerationContext` and `ClientChannelContext` are excluded: `GenerationContext` is a pure in-memory abort-controller registry with no fetched, identity-scoped data to refetch; `ClientChannelContext` is overlay/embedding host-communication plumbing, orthogonal to the Catalog/Conversations/UserConfig data this issue is about.
- `app/app.tsx`'s local conversation-panel filter tab (`FilterTab`/`panelRequestedFilter`) and `StorageKey.CatalogSortKey` are left untouched — both are pure UI preferences with no ownership semantics; once the underlying conversation/deployment data is correctly scoped to the new identity, an old filter-tab or sort selection carrying over is cosmetic, not a data leak.
- Real-time cross-tab push (`BroadcastChannel`/`storage` events) remains deferred, same as the archived design — this change does not revisit the focus/visibility pull-based detection mechanism itself, only what happens once a mismatch is detected.
- Whether a conversation route pointing at a conversation ID owned by the previous identity should redirect away automatically is not addressed here (see Open Questions) — it is a pre-existing gap (a stale URL can already outlive a relogin today) that this change neither introduces nor worsens.

## Decisions

### 1. Drop the `localStorage` filter-preference clearing entirely

`invalidateSession()` no longer calls `removeFromLocalStorage` for `CatalogFilterTopics`/`CatalogIsMyAppsActive`, and `removeFromLocalStorage` itself is deleted from `apps/chat/src/utils/local-storage.ts` (it has no other call site). Once `DeploymentsContext` correctly refetches per identity (Decision 3), a stale "My Apps" toggle or topic filter just filters the *new* identity's own fresh, correctly-flagged data — the same reasoning already applied to `CatalogSortKey` in the archived design applies now to the other two keys as well.

**Alternative considered — namespace the keys per identity (`catalogFilterTopics:<sub>`) instead of clearing:** unnecessary complexity now that the actual bug is understood to be in the data layer, not the preference layer. Rejected for the same reason clearing is no longer needed at all.

### 2. Identity mismatch adopts the new profile in place

`revalidate()`'s mismatch branch becomes `setUser(newProfile)` instead of `invalidateSession()`. `status` is left as `Authenticated` (it was already `Authenticated` for this branch to run at all — see the existing `statusRef.current !== AuthStatus.Authenticated` guard). A `401` from the revalidation call is unchanged and still calls `invalidateSession()` — that case has no valid session to adopt.

**Alternative considered — keep forcing `Unauthenticated` and redirect to `/login`:** this is the status quo and was confirmed with the user to be the wrong UX: the BFF session is already valid for the new identity, so bouncing through a login screen is pure friction with no security benefit. Rejected.

**Alternative considered — silently swap `user` in place without patching downstream contexts (rely on nothing):** would leave `ConversationsContext`/`UserConfigContext`/`DeploymentsContext` serving the old identity's data indefinitely once `RequireAuth` no longer unmounts them for this path — this is exactly the class of bug #7843 reports. Rejected; superseded by Decision 3.

### 3. Every identity-scoped context keys its load effect to `useUser().user?.sub`

`ConversationsContext` and `UserConfigContext` each gain an effect dependency on the current `sub`, mirroring `DeploymentsContext`'s existing pattern: when `sub` changes while the provider stays mounted, the provider resets its own state (`conversations: []` / `error: null` for Conversations; `pinnedConversationIds`/`installedToolsetIds`/`installedDeploymentIds`/`selectedDeploymentId` back to empty/`null` and `status: Loading` for UserConfig) and re-issues its fetch. Providers still also reset via the ordinary `RequireAuth` unmount/remount path for explicit logout and `401`s — the two mechanisms are independent and both correct; a provider that is freshly mounted simply runs its effect once with the current `sub`, so there is no special-casing needed to avoid a double reset.

This is the direct generalization of the pattern `DeploymentsContext` already applied in the archived change, now required because Decision 2 removes the unmount/remount safety net for the in-place-adoption path specifically.

**Alternative considered — harden/guarantee that `RequireAuth` always unmounts on any identity change, including in-place adoption:** would keep a single reset mechanism (simpler mental model) but directly conflicts with Decision 2 — the entire point of adopting the new identity in place is to avoid the unmount-triggered login-screen detour. Rejected.

**Alternative considered — a shared `useResetOnIdentityChange(reset: () => void)` hook instead of duplicating the same `useEffect` shape three times:** would reduce duplication, but each context resets a different, provider-specific shape of state and none of the three effects share logic beyond "depend on `sub`, clear some `useState`s, call the existing loader" — introducing a shared hook now would be an abstraction for three call sites that don't otherwise vary in a reusable way. Revisit only if a fourth context needs the same treatment.

### 4. Fix `DeploymentsContext.loadDeployments` to clear `rawDeployments`

`loadDeployments` already resets `schemas`/`toolsets` to `[]` at the start of every run but never calls `setRawDeployments([])` — the existing `deployments-context` spec's "Deployments/toolsets fetch is keyed to the authenticated identity" requirement already documents that `rawDeployments` SHALL be cleared; the implementation just doesn't do it. This is a bug fix against an already-agreed requirement, not a requirement change, so no spec delta is needed for this item — only an implementation task.

## Risks / Trade-offs

- **[Risk]** Between the moment `user.sub` changes and the moment each context's refetch resolves, a consumer could theoretically render a frame mixing old-identity and new-identity data. → **Mitigation**: every affected context already exposes `isLoading`/`status`, and the surfaces that read them (Catalog's full-screen spinner via `isLoading`, `UserConfigProvider`'s own loading branch) already gate rendering on that flag — no new loading-state plumbing is required, only ensuring the identity-keyed effects set it the same way the initial-mount path already does.
- **[Risk]** Removing the `localStorage` clear could look like a regression of the exact symptom #8033 targeted (a "My Apps" toggle staying checked across identities). → **Mitigation**: intentional — once the underlying data is correctly re-scoped per identity, "My Apps" checked just means "the new identity's own items," which is correct, not stale.
- **[Risk]** Adopting the new identity in place means the SPA never re-runs the BFF login handshake for a same-browser identity switch. → **Mitigation**: no new trust boundary is crossed — the BFF/IdP already performed and validated that handshake (that's the only way `getMe()` could return a `200` with a different `sub`); the SPA is reflecting an already-authenticated session, not making an authorization decision of its own.
- **[Risk]** A user mid-conversation when an in-place identity swap lands could be left on a conversation route ID that belongs to the previous identity. → **Mitigation**: out of scope for this change (see Open Questions); not a new regression, since a stale conversation URL can already outlive a relogin today via a hard refresh.

## Migration Plan

No data migration. Purely client-side behavior change shipped as a normal frontend release. Rollback is reverting the commit — no persisted schema or API contract changes are involved.

## Open Questions

- Should `ConversationRoute` proactively redirect (e.g. to `/`) when the currently-open conversation id is absent from a freshly-reset `ConversationsContext` after an identity swap, versus today's implicit "not found" handling? Left open / out of scope for this change; worth a follow-up issue if it turns out to be user-visible in practice.
