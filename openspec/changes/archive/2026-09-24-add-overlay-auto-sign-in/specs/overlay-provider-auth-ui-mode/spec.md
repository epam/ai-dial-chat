## ADDED Requirements

### Requirement: `OverlayContext` validates and stores a trusted auto-sign-in provider id

`apps/chat/src/context/overlay/OverlayContext.tsx` SHALL accept an `authAutoSignInProvider` field on a `SET_OVERLAY_OPTIONS` payload and expose the trusted value as `authAutoSignInProvider: string | undefined` in its context value, next to the existing `authProviderUiModes`.

The field SHALL be treated as unset when it is absent, `null`, not a string, or a string that is empty after trimming. A malformed value SHALL NOT break the handshake: the rest of the payload is applied and `SET_OVERLAY_OPTIONS/RESPONSE` is still sent. A trimmed non-empty string SHALL be stored verbatim; the app SHALL NOT infer, correct, or complete a provider id.

State ownership: `authAutoSignInProvider` lives in `OverlayContext` state, set from the same handler that sets `authProviderUiModes`, and is read only through `useOverlay()` / `useOptionalOverlay()`. The context value SHALL stay memoised with `useMemo`, so adding the field does not re-render every consumer on each parent render.

Trust boundary: the field is applied only from a `SET_OVERLAY_OPTIONS` message that already passed the existing origin checks. It carries no credential — a provider id names a provider the backend registers; it never authorises anything by itself.

i18n: none. RTL: none — no rendered surface. FEATURE GATE: not gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES`.

#### Scenario: Missing `authAutoSignInProvider` does not break the handshake

- **WHEN** the app receives `SET_OVERLAY_OPTIONS` without an `authAutoSignInProvider` field
- **THEN** the payload is accepted and `SET_OVERLAY_OPTIONS/RESPONSE` is sent
- **AND** `authAutoSignInProvider` in the context is `undefined`

#### Scenario: Valid provider id is stored in context

- **WHEN** the app receives `SET_OVERLAY_OPTIONS` with `authAutoSignInProvider: 'keycloak'`
- **THEN** the payload is accepted
- **AND** `authAutoSignInProvider` in the context is `'keycloak'`

#### Scenario: Non-string provider id is treated as absent

- **WHEN** the app receives `SET_OVERLAY_OPTIONS` with `authAutoSignInProvider: 42`
- **THEN** the payload is accepted and the response is `{ applied: true }`
- **AND** `authAutoSignInProvider` in the context is `undefined`

#### Scenario: Whitespace-only provider id is treated as absent

- **WHEN** the app receives `SET_OVERLAY_OPTIONS` with `authAutoSignInProvider: '   '`
- **THEN** `authAutoSignInProvider` in the context is `undefined`

---

### Requirement: Overlay login starts automatically for a `SameWindow` auto-sign-in provider

`apps/chat/src/hooks/auth/useOverlayProviderLogin.ts` SHALL start login without user interaction, at most once per mount, when all of the following hold:

1. `authAutoSignInProvider` from `OverlayContext` is a non-empty provider id.
2. Provider discovery has settled (`isLoadingProviders` is false and the provider list is non-null) and the list returned by `GET /api/v1/auth/providers` contains that id.
3. The provider's resolved UI mode is `OverlayAuthUiMode.SameWindow`.
4. No unexpired auto-sign-in attempt is recorded for the current URL.

The automatic start SHALL invoke the same `openProviderLogin(providerId)` path the manual provider button uses, so the navigation, callback URL, and external-login cancellation behave identically whether a user or the effect triggered it.

The hook SHALL guard the effect with a `useRef` latch so it fires at most once per mount, which covers React Strict Mode's double effect invocation and the provider fetch settling after the effect's first run. The effect SHALL read the provider list through the hook's existing state rather than issuing a second fetch, and its async work SHALL follow the repo's cancelled-flag cleanup convention.

Placement: the effect lives in this hook, which already owns provider discovery, mode resolution, and navigation. `OverlayLoginGate` SHALL gain no auto-sign-in logic of its own — it only mounts while the overlay session is unauthenticated, which is what makes an authentication-status check inside the hook unnecessary.

Accessibility: the gate renders no new element, control, or live region for this path. The `SameWindow` start is a document navigation, so there is no in-flight state to announce; the gate keeps its existing `aria-busy` semantics for provider loading and external login.

i18n: none — no new user-visible string. RTL: none. FEATURE GATE: not gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES`. Telemetry: none; the suppression paths log console warnings only.

#### Scenario: Auto sign-in navigates for a SameWindow provider

- **WHEN** the overlay login gate mounts with `authAutoSignInProvider: 'keycloak'`, `providerUiModes: { keycloak: 'sameWindow' }`, and `GET /api/v1/auth/providers` returning an entry with id `keycloak`
- **THEN** the iframe navigates to `/api/v1/auth/login/keycloak?callbackUrl=<current href>` with no user interaction

#### Scenario: Auto sign-in fires once per mount

- **WHEN** the same gate re-renders after the provider fetch settles and again on an unrelated state change
- **THEN** exactly one navigation is performed

#### Scenario: No auto-sign-in provider leaves today's behaviour untouched

- **WHEN** the gate mounts with no `authAutoSignInProvider`
- **THEN** no navigation happens and the gate renders its provider buttons or single **Log in** button exactly as before

---

### Requirement: Auto sign-in is suppressed rather than attempted when it cannot succeed

The hook SHALL NOT start login automatically, and SHALL leave the existing login gate rendered and usable, in each of these cases, logging exactly one console warning that names the reason:

1. The named provider resolves to `OverlayAuthUiMode.External` — including a provider absent from `providerUiModes`, which resolves to `External` by the existing rule. The `External` path calls `window.open`, which a browser blocks outside a user gesture, so an automatic attempt would leave the hook waiting on a window that does not exist.
2. The named provider is not present in the list returned by `GET /api/v1/auth/providers`, so the app never navigates to an unknown-provider endpoint.
3. An unexpired attempt is already recorded for the current URL (see the loop-guard requirement).

A suppression SHALL NOT surface an error state to the end user: a host misconfiguration is developer-facing, and the manual gate is already a complete fallback. This matches the app's existing handling of an unrecognised `enabledFeatures` key.

#### Scenario: External-mode provider does not auto-start

- **WHEN** the gate mounts with `authAutoSignInProvider: 'azure-ad'` and `providerUiModes: { 'azure-ad': 'external' }`
- **THEN** no navigation and no `window.open` happen
- **AND** one console warning naming the provider and the mode is logged
- **AND** the gate renders its provider buttons unchanged

#### Scenario: Provider omitted from providerUiModes does not auto-start

- **WHEN** the gate mounts with `authAutoSignInProvider: 'keycloak'` and `providerUiModes: { 'azure-ad': 'external' }`
- **THEN** no navigation happens and one console warning is logged

#### Scenario: Unknown provider id does not auto-start

- **WHEN** the gate mounts with `authAutoSignInProvider: 'not-registered'`, mapped to `sameWindow`, and the provider list does not contain that id
- **THEN** no navigation happens and one console warning naming the id is logged

#### Scenario: Failed provider discovery does not auto-start

- **WHEN** `GET /api/v1/auth/providers` fails and the hook reports a provider error
- **THEN** no navigation happens and the gate renders its existing retry affordance

---

### Requirement: A session-storage attempt record bounds automatic sign-in to one navigation per URL

Before navigating automatically, the hook SHALL record the attempt in `window.sessionStorage` as `{ href, createdAt }` under a dedicated key, and SHALL suppress the automatic start when a record already exists whose `href` equals the current URL and whose `createdAt` is newer than a 60 second TTL. The TTL and the shape mirror `useAuthRedirect`'s existing `chat.auth.redirectAttempt` guard, so both auth paths fail the same way.

Without the record, a provider that returns the user still unauthenticated — an expired IdP session, a consent prompt, a rejected silent authentication — would loop the iframe between the app and the provider indefinitely.

Storage access SHALL be defensive: a read that throws or returns unparsable content SHALL be treated as "no record", and a write that throws SHALL NOT prevent the navigation, because the record is a safety net rather than the feature. `sessionStorage` SHALL be used rather than `localStorage`, so the record is per-tab and does not outlive it. No explicit clear-on-success step is required — the gate unmounts once the session resolves and the record expires on its own.

#### Scenario: Second mount within the TTL does not navigate again

- **WHEN** auto sign-in has navigated for the current URL and the gate mounts again within 60 seconds with the same configuration
- **THEN** no navigation happens, one console warning is logged, and the gate renders its buttons

#### Scenario: Attempt older than the TTL allows a fresh navigation

- **WHEN** the recorded attempt for the current URL is older than 60 seconds
- **THEN** the automatic navigation proceeds and the record is replaced

#### Scenario: Record for a different URL does not suppress

- **WHEN** a record exists for a different `href` than the current URL
- **THEN** the automatic navigation proceeds

#### Scenario: Unavailable session storage still allows sign-in

- **WHEN** reading or writing `window.sessionStorage` throws, for example in a storage-blocked iframe
- **THEN** the automatic navigation still proceeds and no error surfaces to the user
