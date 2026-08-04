## Context

`ToolsetEditor.tsx:164-201` defines `handleAuthChange`, the callback `AuthSection` invokes via
`onAuthChange` for every auth-related patch (type changes, login result, logout result). Its
tail end:

```ts
/*
 * AuthSection only reports isLoggedIn=true after the login request has
 * succeeded (or a successful OAuth login has been recovered).
 * Keep the shared toolset list in sync with that confirmed status so
 * returning to the Catalog does not expose the pre-auth snapshot.
 */
if (patch.isLoggedIn === true) {
  void refetchToolsets();
}
```

`AuthSection.tsx`'s `handleConfirmLogout` calls `onAuthChange({ isLoggedIn: false })` on a
successful logout (`AuthSection.tsx:312`), which reaches this same `handleAuthChange` — but the
`=== true` guard means the logout patch never triggers `refetchToolsets()`. The shared toolset
list (consumed by `useDeployments()`, which feeds the Catalog's cards via
`map-deployment-to-catalog-item.ts`) keeps its pre-logout snapshot until something else happens
to refetch it (a manual page refresh, or logging into a *different* toolset).

The second reported symptom — "reopening the Editor for a previously-authenticated toolset
always re-prompts login" — does not have a matching defect found by inspection:

- `toolsets.service.ts`'s `loginToolset` and `logoutToolset` both call
  `invalidateCaches(userSub, toolsetName)` (lines 1038, 1100), which evicts the single-toolset
  cache (`toolsets:single:{userSub}:{toolsetName}`), the list cache, and the separate deployment
  details cache (`invalidateDetailsCache`) — so a `GET /api/v1/toolsets/{id}` right after a
  login/logout should never serve a stale cached response.
- `mapAuthSettings` (`toolsets.service.ts:370-391`) copies Core's `user_level_auth_status`
  through as `userLevelAuthStatus` unchanged; `authSettingsDtoToForm`
  (`apps/chat/src/utils/toolsets.ts:470-517`) derives `isLoggedIn` via
  `isSignedIn(authSettings?.userLevelAuthStatus)`, comparing against
  `ToolsetAuthStatus.SignedIn = 'SIGNED_IN'` — both ends agree on the field name and the sentinel
  value (confirmed against `toolsets.service.spec.ts`'s existing fixtures).
- `AuthSection.tsx`'s `renderLoginStatus()` already branches on `auth.isLoggedIn` and renders the
  logged-in state (Log Out button) whenever it's `true` — there is no separate "ignore loaded
  auth status" path.

Given the plumbing checks out end-to-end on inspection, this design does not commit to a
client-side fix for the second symptom without first reproducing it against the current
codebase — a stale Catalog badge (the first, confirmed bug) can *look like* "the toolset isn't
authenticated" to someone re-reading the issue's repro steps, without the Editor itself actually
re-prompting login.

## Goals / Non-Goals

**Goals:**

- Refresh the shared toolset list after a successful logout from the Toolset Editor, exactly as
  it already does after a successful login, so the Catalog badge never shows stale credential
  status.
- Reproduce the "Editor re-prompts login" symptom against current code before deciding whether
  it needs a fix, and where.

**Non-Goals:**

- Speculative changes to the DIAL Core signin/signout contract, or to chat-api's cache TTLs —
  nothing in this investigation points at either.
- Fixing Quick Apps login, popup-close timing, or the no-auth 502 — tracked as separate changes
  (`quickapps-toolset-login`, `toolset-oauth-popup-close-delay`,
  `toolset-skip-auth-when-not-configured`).

## Decisions

**Refetch on any confirmed `isLoggedIn` change, not just `true`.** Change the guard in
`handleAuthChange` from `if (patch.isLoggedIn === true)` to `if ('isLoggedIn' in patch)`. This
covers both directions with one condition, and matches how `AuthSection` already only ever sends
`isLoggedIn` in a patch after a request has actually resolved (never speculatively) — see
`AuthSection.tsx:160` (login success), `:180` (recovered success), `:312` (logout success). There
is no code path that sends an unconfirmed/optimistic `isLoggedIn` patch, so widening the guard
doesn't risk refetching on a failed attempt.

*Alternative considered:* add a second, symmetrical `if (patch.isLoggedIn === false)` branch.
Rejected as needless duplication — `'isLoggedIn' in patch` already selects both values, and a
future third state would need to fall into the refetch just as much as `true`/`false` do.

**Reproduce before fixing the second symptom.** Since inspection shows no defect, the first
implementation task is a live reproduction against issue #8096's exact repro steps (log in,
close the Editor without logging out, reopen it) using a real DIAL Core-backed toolset. Two
outcomes are anticipated:

1. The Editor correctly restores the logged-in state once the badge-refresh fix (above) is in
   place — the reported symptom was an artifact of the stale badge, not an independent bug. In
   that case, this change documents the finding and no additional code changes are made.
2. The Editor still re-prompts login even though the stored `user_level_auth_status` is
   `SIGNED_IN` server-side (verified via a direct `GET /api/v1/toolsets/{id}` call or backend
   logs). In that case, the discrepancy is between Core's actual returned status and what the
   client displays, and further investigation (likely a DIAL Core status-propagation delay, or a
   request timing issue specific to the reproduction) is needed before any fix can be scoped —
   out of this change's ability to resolve blind.

## Risks / Trade-offs

- [Risk] Widening the refetch guard to any `isLoggedIn` patch could cause an extra
  `refetchToolsets()` call on transitions that don't need it → Mitigation: confirmed via code
  reading that `isLoggedIn` is only ever included in a patch after a real, resolved login or
  logout — there is no "unconfirmed" or intermediate state that would cause spurious refetches.
- [Risk] The second symptom may turn out to require a DIAL Core-side fix outside this
  repository's control → Mitigation: the design explicitly allows "no code change, documented
  finding" as a valid outcome rather than forcing a speculative client-side patch.
