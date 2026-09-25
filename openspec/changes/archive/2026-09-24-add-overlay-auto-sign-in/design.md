## Context

Overlay mode has one login surface: `OverlayLoginGate`, mounted by `RequireAuth` when the session is unauthenticated inside the iframe. `useAuthRedirect` — the app's normal unauthenticated redirect policy — is deliberately switched off there (`disabled: Boolean(overlay)`), because an automatic iframe redirect to a provider that refuses framing renders a blank frame. Login is therefore always user-initiated today.

`useOverlayProviderLogin` already owns everything an automatic start would need: it fetches `GET /api/v1/auth/providers` when the host sent a non-empty `auth.providerUiModes`, resolves each provider's mode from that map (anything not exactly `sameWindow` resolves to `External`), and performs the navigation. The two paths differ in a way that decides this whole design:

- `SameWindow` → `window.location.assign('/api/v1/auth/login/<id>?callbackUrl=' + window.location.href)`. A navigation of the iframe itself. No user gesture required.
- `External` → `useOverlayExternalLogin`, which calls `window.open(...)` and then polls `GET /api/v1/auth/me` until the cookie set by that window is visible from the iframe. `window.open` without a user gesture is blocked by every current browser.

The legacy implementation this restores lived in `apps/chat/src/store/overlay/overlay.epics.ts` (`signInOptionsSet`, last seen at `2b6d8a23d`). It required both `autoSignIn` and `signInProvider`, defaulted to an in-iframe `signIn(provider)`, and offered `signInInNewWindow` for the case its own README described as "provider page couldn't be open in iframe" — so framing was already treated there as a per-provider, per-configuration property, not a universal block. Its `autoSignIn` was documented as signing in "without user interaction (provided there is an active provider session)": the value is the silent round-trip, not rendering a login form inside the frame.

## Goals / Non-Goals

**Goals:**

- Let a host that has verified iframe compatibility for one provider have the embedded chat start login with no user interaction.
- Keep every existing overlay auth behaviour byte-identical when the new field is absent.
- Fail visibly into today's manual gate — never into a blank frame, a blocked popup, or a redirect loop.
- Keep the host contract impossible to half-specify.

**Non-Goals:**

- `logInHint`: the BFF's `GET /api/v1/auth/login/:providerId` accepts only `callbackUrl` (`LoginQueryDto`) and assembles `authorizationParams` server-side, so an OIDC `login_hint` needs a validated backend query parameter. Out of scope here.
- `validationUserEmail` (sign out when the host's user differs from the session's) and `explicitToken` (dead by design: the BFF keeps the access token in an encrypted `HttpOnly` cookie and it never reaches the browser).
- Making any provider render inside an iframe. That is the provider's own `X-Frame-Options`/`frame-ancestors` decision; this change only automates the path a host has already verified.
- Auto sign-in outside overlay mode. Top-level app flow keeps `useAuthRedirect` unchanged.

## Decisions

### D1: One field, `auth.autoSignInProvider`, instead of a boolean plus a provider

`ChatOverlayOptions.auth` gains `autoSignInProvider?: string`. Presence enables the behaviour; the value names the provider.

The alternative is the legacy shape — `autoSignIn: boolean` next to `signInProvider?: string`. That shape has a dead state (`autoSignIn: true` with no provider), and legacy shipped exactly that bug: auto sign-in silently did nothing until #3409 added `&& signInOptions?.signInProvider` to the condition. One required-together field cannot be half-specified, so the failure mode disappears from the API instead of being validated back out of it.

A second rejected alternative was inferring the provider when `GET /api/v1/auth/providers` returns exactly one entry (what `useAuthRedirect` does for the top-level app). In overlay mode the host, not the deployment, decides which provider is frameable; inferring it would auto-navigate to whatever the backend happens to register, including a provider the host never verified.

### D2: `SameWindow` is a precondition, not an implication

Auto sign-in runs only when `providerUiModes[autoSignInProvider]` resolves to `SameWindow`. An `External` or unmapped provider is skipped with one console warning and the ordinary gate stays.

Making `autoSignInProvider` imply `SameWindow` would be shorter to configure and is the trap legacy fell into: the in-iframe path was the default, so a host pointing it at a framing-hostile provider got a blank frame and had to discover `signInInNewWindow`. Requiring the explicit mapping keeps the existing "the host asserts it verified iframe compatibility" contract as the single place that assertion is made.

Auto-starting the `External` path was considered and rejected: `window.open` outside a user gesture is blocked, and the hook would then sit in its `Waiting` state polling `/auth/me` for a window that does not exist — worse than the button it replaced.

### D3: Wire it exactly like `authProviderUiModes`

The new wire field is `SetOverlayOptionsPayload.authAutoSignInProvider?: string`, serialized by `sendCurrentOverlayOptions()` when set and non-empty, dropped when absent, and validated app-side as "a string or treat as unset" so a malformed value never breaks the handshake. `setOverlayOptions({ auth })` already replaces the whole `auth` object, so dynamic updates need no new plumbing.

Nesting the host-facing field under the existing `auth` object while flattening it on the wire is not an inconsistency: the payload is the trust boundary and stays a flat record of opaque strings, which is what keeps `OverlayContext`'s validator a set of independent field checks.

### D4: Session-storage attempt record with a 60 second TTL

Before navigating, the hook records `{ href, createdAt }` under a new session-storage key; a fresh record for the same href suppresses the auto-start. This mirrors `useAuthRedirect`'s `chat.auth.redirectAttempt` guard, including its 60 second TTL, so the two auth paths fail the same way.

Without it, a provider that bounces the user back still unauthenticated — expired IdP session, consent needed, a rejected silent authentication — produces an infinite navigate/return loop that also burns IdP rate limits. Legacy's only protection was a 30 second `Promise.race` on the polling path, which the in-iframe path did not use at all.

`sessionStorage` over `localStorage`: the record is per-tab and must not outlive the tab. No clear-on-success step is needed — the gate unmounts the moment the session resolves, and the record expires on its own; a second attempt inside the TTL costs the user one click on the gate that is already there.

Session storage can throw (a partitioned or storage-blocked iframe). Reads are wrapped and treated as "no record"; a write that throws must not stop the navigation, since the guard is a safety net and not the feature.

### D5: The effect lives in `useOverlayProviderLogin`, keyed off a ref

The auto-start is a `useEffect` in the hook that already holds provider discovery, mode resolution and navigation, so the gate component gains no new logic and nothing is duplicated between the automatic and manual paths — the effect calls the same `openProviderLogin(providerId)`.

A `useRef` latch makes it fire at most once per mount. Two independent things would otherwise double-fire it: React Strict Mode's double effect invocation in development, and the provider fetch settling after the effect's first run. The effect waits for `providers !== null` and for `isLoadingProviders` to be false, so it evaluates against the real provider list rather than racing it.

The gate only mounts while unauthenticated in overlay mode, so no authentication-status check is needed inside the hook — the same reason the manual buttons do not check it either.

### D6: Console warnings, not UI

Each suppression path logs one warning naming the reason (unknown provider id, provider not mapped to `SameWindow`, recent attempt suppressed) and renders the existing gate unchanged. A host misconfiguration is a developer-facing problem, and the gate is already a complete, accessible fallback; adding an error surface for it would show end users a message about a configuration they cannot act on. This matches how an unknown `enabledFeatures` key is handled today.

## Risks / Trade-offs

- **The host maps a framing-hostile provider to `SameWindow` and enables auto sign-in → the iframe navigates and the provider refuses to render, now without a click to blame.** Mitigation: the loop guard bounds it to a single navigation per URL per 60 seconds, after which the manual gate returns; the mapping already carries an explicit "verified iframe compatibility" meaning in the docs, and this change's docs repeat it at the new field.
- **No IdP session → the user is sent to a full login page inside the iframe instead of seeing the chat's own gate.** Mitigation: documented as the expected behaviour of the feature (it is what legacy did), the provider mapping is the host's assertion that its login page renders framed, and the guard prevents repetition.
- **A third-party-cookie-partitioned iframe may lose the session between the return navigation and the next load, making the guard the only thing between the user and a loop.** Mitigation: the guard is keyed on href and TTL-bounded, so the worst case is one wasted round-trip followed by the manual gate.
- **Reversing a recorded non-goal.** `2026-07-27-overlay-external-login/design.md` ruled out reintroducing `signInOptions`. This change reintroduces one field of it, for one mode, with a guard legacy lacked; that doc stays the historical record and this one is the reversal's rationale.
- **Trade-off: the feature is unavailable for the most common enterprise IdP.** Azure sends `X-Frame-Options: deny`, so an Azure-only deployment cannot use auto sign-in at all and keeps the button. Accepted: the alternative is a popup that browsers block.

## Migration Plan

Additive and default-off. No migration for existing hosts: absent `autoSignInProvider` means the gate behaves exactly as today. A host adopts it by adding one field next to the `providerUiModes` entry it already has. Rollback is removing the field — no data, no persisted state beyond a session-storage key that expires in 60 seconds.

## Open Questions

None blocking. Two deferred items, both recorded as non-goals above: `logInHint` needs a backend query parameter before it can be offered, and `validationUserEmail` needs a decision on what sign-out inside an iframe should do to the host's own session.
