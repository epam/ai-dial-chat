# Spec delta: chat-overlay-library

## MODIFIED Requirements

### Requirement: Public API surface

`libs/chat-overlay/src/index.ts` SHALL preserve its existing public API and additionally export the `OverlayAuthUiMode` enum (re-exported from `@epam/ai-dial-chat-shared`) and the pure protocol types from `@epam/ai-dial-chat-shared` needed by consumers (`ChatOverlayOptions`, the request/event type unions, response payload types for every v1 method). It SHALL NOT export the internal `Task`/`DeferredRequest`-equivalent helper classes.

#### Scenario: Internal transport helpers are not exported

- **WHEN** `libs/chat-overlay/src/index.ts` is inspected
- **THEN** no symbol named `Task` or `DeferredRequest` (or their chosen internal equivalents) appears in the export list

#### Scenario: Consumer can import everything needed from one entry point

- **WHEN** a consumer writes `import { ChatOverlay, ChatOverlayManager, ChatOverlayOptions, OverlayAuthUiMode } from '@epam/ai-dial-chat-overlay'`
- **THEN** the import resolves without needing a separate import from `@epam/ai-dial-chat-shared`

#### Scenario: OverlayAuthUiMode is available from the library entry point

- **WHEN** a consumer imports `OverlayAuthUiMode` from `'@epam/ai-dial-chat-overlay'`
- **THEN** it has members `External` and `SameWindow` without requiring a separate `@epam/ai-dial-chat-shared` import

---

### Requirement: ChatOverlay stores and transmits provider-mode option

`ChatOverlay`'s constructor SHALL accept the new optional `auth` field on `ChatOverlayOptions` and store it alongside the other options. When `sendCurrentOverlayOptions()` serializes the `SET_OVERLAY_OPTIONS` payload, it SHALL include `authProviderUiModes` in the payload if and only if `options.auth?.providerUiModes` is set and non-empty; if the map is absent or empty, the field SHALL be omitted from the payload (matching the pattern used for `theme`, `modelId`, and `overlayConversationId`).

`setOverlayOptions()` SHALL accept an updated `auth` option via the `Partial<Pick<...>>` shape: when `auth` is included in the update, the stored `options.auth` SHALL be replaced. When `auth` is absent from the update, the existing stored `auth` SHALL be preserved. The updated options are re-sent to the iframe via `sendCurrentOverlayOptions()` as before. An in-progress external login attempt (managed by the app side) is NOT affected by this update; the new map takes effect on the next login initiation.

`libs/chat-overlay` MUST NOT fetch providers, construct `/api` URL paths, read auth/session state, inspect cookies, or encode any knowledge of specific IdP brands.

#### Scenario: Constructor without auth option compiles and behaves as before

- **WHEN** `new ChatOverlay('#root', { domain: 'https://chat.example.com' })` is called
- **THEN** the instance is created without error
- **AND** the `SET_OVERLAY_OPTIONS` payload does NOT include `authProviderUiModes`

#### Scenario: Constructor with auth.providerUiModes transmits authProviderUiModes

- **WHEN** `ChatOverlay` is constructed with `auth: { providerUiModes: { 'my-id': OverlayAuthUiMode.SameWindow } }`
- **AND** `sendCurrentOverlayOptions()` is called
- **THEN** the `SET_OVERLAY_OPTIONS` payload includes `authProviderUiModes: { 'my-id': 'sameWindow' }`

#### Scenario: Empty providerUiModes omits authProviderUiModes from payload

- **WHEN** `ChatOverlay` is constructed with `auth: { providerUiModes: {} }`
- **AND** `sendCurrentOverlayOptions()` is called
- **THEN** the `SET_OVERLAY_OPTIONS` payload does NOT include `authProviderUiModes`

#### Scenario: setOverlayOptions replaces stored auth when provided

- **WHEN** `setOverlayOptions({ auth: { providerUiModes: { 'new-id': OverlayAuthUiMode.External } } })` is called
- **THEN** the stored `auth` is updated to the new value
- **AND** the next `SET_OVERLAY_OPTIONS` payload contains `authProviderUiModes: { 'new-id': 'external' }`

#### Scenario: setOverlayOptions preserves stored auth when absent from update

- **WHEN** the instance has `auth: { providerUiModes: { 'my-id': OverlayAuthUiMode.SameWindow } }` stored
- **AND** `setOverlayOptions({ theme: 'dark' })` is called (no `auth` key)
- **THEN** the stored `auth` is unchanged
- **AND** subsequent `SET_OVERLAY_OPTIONS` still includes `authProviderUiModes: { 'my-id': 'sameWindow' }`

---

### Requirement: README usage example for provider-mode option

`libs/chat-overlay/README.md` SHALL include a usage example demonstrating the `auth.providerUiModes` option. The example MUST show at least two providers with different modes and MUST include a comment stating that `SameWindow` requires the host to verify that the provider supports iframe login for their specific configuration.

#### Scenario: README example type-checks

- **WHEN** the README example TypeScript snippet is type-checked in isolation
- **THEN** it produces no TypeScript errors

#### Scenario: README example includes SameWindow disclaimer comment

- **WHEN** the README is inspected
- **THEN** the `auth.providerUiModes` example contains a comment about host responsibility for verifying iframe compatibility
