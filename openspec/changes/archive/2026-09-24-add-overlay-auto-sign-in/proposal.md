## Why

The legacy chat let an embedding host start login without user interaction through `signInOptions.autoSignIn` + `signInProvider`, which relied on the user already holding an IdP session: the iframe navigated to the provider and the provider redirected straight back. The 2.0 rewrite dropped the whole `signInOptions` protocol — `2026-07-27-overlay-external-login/design.md` records "Reintroducing the old chat's `signInOptions` protocol" as an explicit non-goal, and the migration guide lists `autoSignIn` among the options with no successor. A host embedding the chat inside an already-authenticated portal therefore shows its users a **Log in** button for a session they effectively already have. This change reverses that one non-goal for the case that is actually safe today: a provider the host has verified renders inside an iframe.

## What Changes

- `ChatOverlayOptions.auth` gains `autoSignInProvider?: string`. Its presence enables auto sign-in and names the provider in one field; there is no separate boolean, because the legacy pair could be half-specified — legacy fix #3409 had to start requiring both `autoSignIn` and `signInProvider`.
- `SetOverlayOptionsPayload` gains `authAutoSignInProvider?: string` (opaque on the wire), emitted alongside the existing `authProviderUiModes` and updatable through `setOverlayOptions({ auth })`.
- `OverlayContext` validates and stores the new wire field the same way it treats `authProviderUiModes`: a non-string value is dropped without breaking the handshake.
- While the overlay login gate is mounted, `useOverlayProviderLogin` starts login automatically when the named provider is registered by the backend **and** is mapped to `OverlayAuthUiMode.SameWindow`. That path is an in-iframe `window.location.assign` to the BFF login endpoint, so it needs no user gesture.
- Auto sign-in is suppressed — with one console warning, leaving today's gate untouched — when the provider resolves to `External` (a `window.open` the browser would block without a gesture), when it is absent from `GET /api/v1/auth/providers`, and when a recent attempt for the same URL is still recorded. The suppression is a visible fallback, not a failure.
- A session-storage attempt record with a 60 second TTL, shaped after `useAuthRedirect`'s existing redirect guard, stops an IdP that returns the user still unauthenticated from looping the iframe. Legacy had no such guard.
- Not included, deliberately: `logInHint` (needs a validated `login_hint` query parameter on the BFF login endpoint, which today accepts only `callbackUrl`), `validationUserEmail` logout-on-mismatch, and `explicitToken` (dead by design under the BFF's encrypted-cookie session — the access token never reaches the browser).

No breaking changes: every new field is optional, and an overlay that sends none behaves exactly as it does today.

## Capabilities

### New Capabilities

None. The behavior extends the existing per-provider auth UI mode capability rather than introducing a parallel one; keeping it there is what makes `SameWindow` the precondition instead of a second, independent switch.

### Modified Capabilities

- `chat-overlay-protocol`: `ChatOverlayOptions.auth` and `SetOverlayOptionsPayload` each gain one optional field.
- `chat-overlay-library`: `sendCurrentOverlayOptions()` serializes `authAutoSignInProvider` when set and non-empty, and omits it otherwise.
- `overlay-provider-auth-ui-mode`: `OverlayContext` stores the trusted provider id, and the login gate gains the auto-start rule, its three suppression conditions, and the loop guard.

## Impact

- `libs/chat-overlay/src/protocol/overlay-protocol.ts`, `libs/chat-overlay/src/lib/ChatOverlay.ts` — new optional field, new payload entry.
- `apps/chat/src/context/overlay/OverlayContext.tsx` — payload validation, state, context value.
- `apps/chat/src/hooks/auth/useOverlayProviderLogin.ts` — the auto-start effect and its guards; a new session-storage helper for the attempt record.
- Docs in the same change: `docs/chat-overlay-migration-guide.md` (`autoSignIn` and `signInProvider` move from "no successor" to a documented replacement; the other four stay unsupported), `libs/chat-overlay/README.md`, and the root `README.md` line that says authentication "removed `signInOptions`".
- No backend change, no new endpoint, no DTO change. `GET /api/v1/auth/providers` and `GET /api/v1/auth/login/:providerId` are used exactly as the manual gate already uses them.
- Security posture is unchanged: the host names a provider it has already verified, the app never trusts a host-supplied token, and an unknown or unmapped provider id is dropped rather than followed.
