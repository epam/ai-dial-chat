# Spec: overlay-provider-auth-ui-mode

## Purpose

Per-provider auth UI modes for the overlay and the provider-picker login gate they drive.

## Requirements

### Requirement: `OverlayAuthUiMode` enum and `auth` option on `ChatOverlayOptions`

`libs/chat-shared/src/types/overlay/overlay-protocol.ts` SHALL export a new string enum `OverlayAuthUiMode` with members `External = 'external'` and `SameWindow = 'sameWindow'`. `ChatOverlayOptions` SHALL gain an optional `auth` field of type `{ providerUiModes?: Record<string, OverlayAuthUiMode> }`. `SetOverlayOptionsPayload` SHALL gain an optional `authProviderUiModes` field of type `Record<string, string>` (opaque strings on the wire). Both new fields are optional; existing callers compile and behave identically when they are absent.

No imports may be added to `libs/chat-shared`; the file contains only enums and interfaces.

FEATURE GATE: This capability is not gated behind `ENABLED_FEATURES`/`ENABLED_FEATURES_ROLES`. It is an overlay integration option.

RTL: not applicable to type definitions.

#### Scenario: Existing ChatOverlayOptions constructors compile without the new field

- **WHEN** a TypeScript caller creates `{ domain: 'https://chat.example.com' }` without an `auth` field
- **THEN** the type check passes without error

#### Scenario: OverlayAuthUiMode enum has exactly two members

- **WHEN** `OverlayAuthUiMode` is inspected
- **THEN** it has `External = 'external'` and `SameWindow = 'sameWindow'` and no other members

#### Scenario: auth field is optional on ChatOverlayOptions

- **WHEN** `ChatOverlayOptions` is inspected
- **THEN** the `auth` field is optional (`auth?: ...`)

#### Scenario: authProviderUiModes is optional on SetOverlayOptionsPayload

- **WHEN** `SetOverlayOptionsPayload` is inspected
- **THEN** the `authProviderUiModes` field is optional (`authProviderUiModes?: Record<string, string>`)

---

### Requirement: `OverlayContext` validates and stores trusted `authProviderUiModes`

`apps/chat/src/context/overlay/OverlayContext.tsx` SHALL extend `hasSetOverlayOptionsPayload` to accept payloads that include an `authProviderUiModes` field. When the field is absent or `null`/`undefined`, the validator SHALL accept the payload and treat the field as unset. When the field is present, the validator SHALL accept it only if it is a plain object with all values being strings; any non-object or object containing a non-string value SHALL cause the validator to reject the field as if it were absent (the rest of the payload is still accepted, and the handshake is not broken). The resulting trusted map SHALL be stored in `OverlayContext` state and exposed through the context value.

`OverlayContext` SHALL expose `authProviderUiModes: Record<string, string> | undefined` in its context type. Consumers MUST use `useOverlay()` or `useOptionalOverlay()` to access it; these hooks must not import from server-api or backend DTOs.

State ownership: `authProviderUiModes` lives in `OverlayContext`. The resolved `OverlayAuthUiMode` for each provider is computed at hook call time from the raw strings, not in `OverlayContext` itself.

Memoization: the `authProviderUiModes` value in the context must be referentially stable across re-renders when its contents have not changed (use `useMemo` on the context value as per the existing pattern).

#### Scenario: Missing authProviderUiModes does not break the handshake

- **WHEN** the app receives `SET_OVERLAY_OPTIONS` without an `authProviderUiModes` field
- **THEN** the payload is accepted and `SET_OVERLAY_OPTIONS/RESPONSE` is sent
- **AND** `authProviderUiModes` in the context is `undefined`

#### Scenario: Valid authProviderUiModes is stored in context

- **WHEN** the app receives `SET_OVERLAY_OPTIONS` with `authProviderUiModes: { 'my-provider': 'sameWindow' }`
- **THEN** the payload is accepted
- **AND** `authProviderUiModes` in the context contains `{ 'my-provider': 'sameWindow' }`

#### Scenario: Non-object authProviderUiModes is silently treated as absent

- **WHEN** the app receives `SET_OVERLAY_OPTIONS` with `authProviderUiModes: 'invalid'`
- **THEN** the payload is accepted (the handshake is not broken)
- **AND** `authProviderUiModes` in the context is `undefined` (or the previous value unchanged)

#### Scenario: Object with non-string values is treated as absent

- **WHEN** the app receives `SET_OVERLAY_OPTIONS` with `authProviderUiModes: { 'my-provider': 42 }`
- **THEN** the payload is accepted (the handshake is not broken)
- **AND** `authProviderUiModes` in the context is `undefined` (or the previous value unchanged)

#### Scenario: Origin validation still rejects untrusted hosts

- **WHEN** `SET_OVERLAY_OPTIONS` with `authProviderUiModes` arrives from an origin not in `overlayAllowedOrigins`
- **THEN** the message is rejected and the context state is not updated

#### Scenario: setOverlayOptions update affects next login attempt only

- **WHEN** `setOverlayOptions()` is called with a new `auth.providerUiModes` map while an external login attempt is in `waiting` state
- **THEN** the in-progress external attempt continues to completion without interruption
- **AND** the updated map is available for the next login initiation

---

### Requirement: `useOverlayProviderLogin` — provider-aware login orchestration

A new hook `apps/chat/src/hooks/auth/useOverlayProviderLogin.ts` SHALL orchestrate the provider-aware overlay login flow. It SHALL:

1. Fetch providers via `getProviders()` (from `apps/chat/src/server-api/auth.api.ts`) once on mount, using a cancellation flag in `useEffect` to prevent setState-on-unmount.
2. Read `authProviderUiModes` from `useOptionalOverlay()`.
3. Resolve the mode for each provider: look up the provider ID in `authProviderUiModes`; if absent or if the mapped string does not equal `'sameWindow'`, use `External`.
4. Expose: `providers: ProviderInfoDto[] | null`, `isLoadingProviders: boolean`, `hasProviderError: boolean`, `retryLoadProviders: () => void`, `openProviderLogin: (providerId: string) => void`, `openLogin: () => void`, `externalLoginStatus: OverlayExternalLoginStatus` (delegated from `useOverlayExternalLogin` when the resolved mode is `External`).
5. `openProviderLogin(providerId)` SHALL:
   - Resolve the mode for that provider ID.
   - For `External`: call `openLogin()` from `useOverlayExternalLogin` logic with a BFF URL targeting that specific provider: `/api/v1/auth/login/${encodeURIComponent(providerId)}?callbackUrl=${encodeURIComponent(`${window.location.origin}/overlay-close`)}`. `window.open` MUST be called synchronously in the event handler, not after any `await`.
   - For `SameWindow`: call `window.location.assign` with the BFF provider login URL using the current same-origin overlay URL as `callbackUrl`: `/api/v1/auth/login/${encodeURIComponent(providerId)}?callbackUrl=${encodeURIComponent(window.location.href)}`.
   - Unknown provider IDs are treated as `External`.

Provider IDs MUST be encoded with `encodeURIComponent` when embedded in URL paths. `callbackUrl` values MUST be encoded with `encodeURIComponent`. No token, session ID, or credential MAY appear in any URL.

State ownership: `useOverlayProviderLogin` owns provider-fetch state. External attempt state is delegated to `useOverlayExternalLogin` (called unconditionally to respect React hook rules).

Accessibility: the hook's exposed state drives `aria-busy` and `disabled` on the login gate container and buttons.

i18n keys: see the UI requirement below.

RTL: not applicable to hook logic.

#### Scenario: Providers are fetched on mount

- **WHEN** `useOverlayProviderLogin` mounts
- **THEN** it calls `getProviders()` once
- **AND** `isLoadingProviders` is `true` during the fetch and `false` after

#### Scenario: Provider with sameWindow mode triggers iframe navigation

- **WHEN** `openProviderLogin('my-provider')` is called and `authProviderUiModes` maps `'my-provider'` to `'sameWindow'`
- **THEN** `window.location.assign` is called with a URL starting with `/api/v1/auth/login/my-provider`
- **AND** the `callbackUrl` parameter equals `encodeURIComponent(window.location.href)`
- **AND** `window.open` is NOT called

#### Scenario: Provider with External mode triggers external window

- **WHEN** `openProviderLogin('my-provider')` is called and `authProviderUiModes` maps `'my-provider'` to `'external'`
- **THEN** `window.open` is called with a URL starting with `/api/v1/auth/login/my-provider`
- **AND** the `callbackUrl` parameter equals `encodeURIComponent(`${window.location.origin}/overlay-close`)`
- **AND** `window.location.assign` is NOT called

#### Scenario: Unconfigured provider falls back to External

- **WHEN** `openProviderLogin('unknown-provider')` is called and `authProviderUiModes` does not contain `'unknown-provider'`
- **THEN** `window.open` is called (External behavior)
- **AND** `window.location.assign` is NOT called

#### Scenario: Unknown string mode value falls back to External

- **WHEN** `openProviderLogin('my-provider')` is called and `authProviderUiModes` maps `'my-provider'` to `'futureMode'` (unrecognized string)
- **THEN** `window.open` is called (External behavior)

#### Scenario: Provider fetch error shows error state

- **WHEN** `getProviders()` throws during the fetch
- **THEN** `hasProviderError` is `true` and `isLoadingProviders` is `false`

#### Scenario: Retry clears error and re-fetches

- **WHEN** `retryLoadProviders()` is called while `hasProviderError` is `true`
- **THEN** `isLoadingProviders` becomes `true` and a new `getProviders()` call is made

#### Scenario: Unmount cancels in-flight provider fetch

- **WHEN** `useOverlayProviderLogin` unmounts while `getProviders()` is still pending
- **THEN** the fetch result is discarded and no state update occurs

---

### Requirement: `OverlayLoginGate` — provider-picker UI

`apps/chat/src/components/OverlayLoginGate/OverlayLoginGate.tsx` SHALL call `useOverlayProviderLogin` instead of `useOverlayExternalLogin` directly.

**Branch A — no provider-mode configuration** (context `authProviderUiModes` is `undefined` or empty AND no providers have been fetched in this session because the config-absent path skips the fetch): render the existing single "Log in" button. No provider picker UI is shown. Behavior is identical to the current implementation.

**Branch B — provider-mode configuration present**: render a provider picker:

- While `isLoadingProviders` is `true`: show loading text (i18n key `auth.overlayProviderPickerLoading`), disable the container, set `aria-busy="true"`.
- On error: show error text (i18n key `auth.overlayProvidersError`) and a retry button (label from `buttons.retry`). The retry button calls `retryLoadProviders()`.
- Empty provider list: render the same single "Log in" button fallback as Branch A.
- Populated provider list: render one button per provider. Each button shows the provider's `label` and an icon (`src` from `https://authjs.dev/img/providers/${providerId.replace(/[1-9]\d*$/, '')}.svg`, hidden on error, `aria-hidden="true"`). Each button's `onClick` calls `openProviderLogin(provider.id)` synchronously.

External attempt status feedback (blocked, taking-longer messages) from `externalLoginStatus` is displayed below the provider list, matching the existing logic in `OverlayLoginGate`.

Accessibility:
- Login and provider buttons are keyboard-focusable and reachable by Tab.
- Login controls are disabled only during the brief synchronous `opening` transition. During `waiting` and `takingLonger`, they remain enabled so selecting one replaces the current attempt.
- The section container carries `aria-busy="true"` while `isLoadingProviders` or `externalLoginStatus` is `opening`, `waiting`, or `takingLonger`.
- The blocked-popup message uses `role="alert"`. The taking-longer message uses `aria-live="polite"`.
- The error message uses `role="alert"`.

i18n keys (all new):
- `auth.overlayProviderPickerLoading` — loading text shown while providers are fetching
- `auth.overlayProvidersError` — error text when provider fetch fails

RTL: all layout uses logical Tailwind spacing utilities (`ms-*`, `me-*`, `ps-*`, `pe-*`, `gap-*`, `items-center`). Provider icons are conceptual and must NOT be mirrored with `rtl:scale-x-[-1]`.

#### Scenario: No-configuration branch renders single Log In button

- **WHEN** `OverlayLoginGate` renders and context `authProviderUiModes` is `undefined`
- **THEN** a single "Log in" button is rendered, not a provider list
- **AND** no provider fetch is triggered

#### Scenario: Loading state shows loading text and disables container

- **WHEN** `authProviderUiModes` has entries and providers are still loading
- **THEN** loading text (`auth.overlayProviderPickerLoading`) is visible
- **AND** the section has `aria-busy="true"`

#### Scenario: Error state shows alert and retry button

- **WHEN** `hasProviderError` is `true`
- **THEN** an element with `role="alert"` containing `auth.overlayProvidersError` text is rendered
- **AND** a retry button is rendered

#### Scenario: Provider picker renders one button per provider

- **WHEN** providers are loaded with two entries
- **THEN** two buttons are rendered, each with the provider's label

#### Scenario: Waiting external attempt can be replaced

- **WHEN** `externalLoginStatus` is `waiting`
- **THEN** login controls remain enabled
- **AND** selecting one starts a replacement attempt

#### Scenario: External attempt blocked message uses role="alert"

- **WHEN** `externalLoginStatus` is `blocked`
- **THEN** an element with `role="alert"` containing the blocked message is rendered

#### Scenario: Taking-longer message uses aria-live polite

- **WHEN** `externalLoginStatus` is `takingLonger`
- **THEN** an element with `aria-live="polite"` containing the taking-longer message is rendered

---

### Requirement: Same-window callback restores overlay handshake

A completed `SameWindow` provider login SHALL be finished by re-running the overlay handshake, and SHALL NOT reload the host page.

When a `SameWindow` provider login completes, the BFF redirects the iframe back to the overlay URL (the same protected route). The `OverlayProvider` re-initializes and emits `INIT_READY`. The library, which is still running in the host page with its stored options, responds to `READY` by re-sending `SET_OVERLAY_OPTIONS` including `authProviderUiModes`. The `OverlayContext` applies the options and the authenticated user state resolves through `RequireAuth`, rendering protected content.

No reload of the host page occurs. The host's `ChatOverlay` instance is preserved throughout.

#### Scenario: Fresh handshake runs after same-window callback

- **WHEN** the iframe returns to the overlay URL after a same-window login
- **THEN** the library sends `SET_OVERLAY_OPTIONS` again with the stored options
- **AND** `OverlayContext` applies the options including `authProviderUiModes`

#### Scenario: Authenticated user skips the login gate

- **WHEN** the iframe returns to the overlay URL with a valid session cookie
- **THEN** `RequireAuth` does not render `OverlayLoginGate`
- **AND** protected content renders

---

### Requirement: Credentials and tokens never cross the overlay protocol

No token, session ID, cookie value, or credential SHALL appear in any `postMessage` payload, URL query parameter, or URL path segment generated by this feature. Provider IDs are opaque configuration strings. `callbackUrl` values are always same-origin URLs validated by the existing BFF `resolveCallbackUrl` guard.

#### Scenario: authProviderUiModes contains no credentials

- **WHEN** `SET_OVERLAY_OPTIONS` is inspected after a host passes `auth.providerUiModes`
- **THEN** the `authProviderUiModes` payload contains only opaque provider ID strings mapped to mode strings

#### Scenario: BFF login URL contains no session data

- **WHEN** `openProviderLogin` constructs a BFF login URL for either mode
- **THEN** the URL contains only the provider path segment and a same-origin `callbackUrl` parameter

---

### Requirement: Sandbox and integration examples

The `libs/chat-overlay` sandbox (`libs/chat-overlay/sandbox/` or README) SHALL include an example demonstrating two providers with different modes:

```ts
const overlay = new ChatOverlay('#chat-root', {
  domain: 'https://chat.example.com',
  auth: {
    providerUiModes: {
      'azure-ad': OverlayAuthUiMode.External,
      'my-oidc': OverlayAuthUiMode.SameWindow,
    },
  },
});
```

The example MUST include a comment clarifying that `SameWindow` is explicit opt-in and that the host is responsible for verifying the provider's iframe compatibility before using it.

#### Scenario: Example compiles without error

- **WHEN** the sandbox or README TypeScript example is type-checked
- **THEN** it produces no TypeScript errors

#### Scenario: Example comment states iframe compatibility is not guaranteed

- **WHEN** the sandbox or README example is inspected
- **THEN** it contains a comment explaining that SameWindow requires the host to verify iframe compatibility for the configured provider

---

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
