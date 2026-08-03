# Spec: overlay-provider-auth-ui-mode

## ADDED Requirements

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
