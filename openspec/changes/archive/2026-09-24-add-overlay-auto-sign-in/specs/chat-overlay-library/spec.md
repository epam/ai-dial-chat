## ADDED Requirements

### Requirement: `ChatOverlay` transmits `authAutoSignInProvider`

`libs/chat-overlay/src/lib/ChatOverlay.ts` SHALL store `options.auth.autoSignInProvider` with the rest of the `auth` object it already keeps, and `sendCurrentOverlayOptions()` SHALL include `authAutoSignInProvider` in the `SET_OVERLAY_OPTIONS` payload if and only if `options.auth?.autoSignInProvider` is a non-empty string. An absent, empty, or whitespace-only value SHALL be omitted from the payload, matching the existing treatment of `authProviderUiModes` and of `theme` / `modelId` / `overlayConversationId`.

`setOverlayOptions()` already replaces the whole `auth` object when the caller passes `auth`, so a host SHALL be able to add, change, or drop `autoSignInProvider` after construction with no new parameter: the next payload reflects the new value, and dropping it omits the field.

The iframe's `allow` permissions attribute and `sandbox` tokens SHALL be unchanged by this option.

State ownership: the value lives in `ChatOverlay`'s own `options`, the same place `auth.providerUiModes` lives. The library SHALL NOT resolve the provider, call any auth endpoint, or decide whether auto sign-in is possible — that is the app's decision, per `overlay-provider-auth-ui-mode`.

i18n: none. RTL: none — no rendered surface changes.

FEATURE GATE: not gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES`.

#### Scenario: Constructor with `auth.autoSignInProvider` transmits the field

- **WHEN** a `ChatOverlay` is constructed with `auth: { providerUiModes: { keycloak: OverlayAuthUiMode.SameWindow }, autoSignInProvider: 'keycloak' }`
- **THEN** the `SET_OVERLAY_OPTIONS` payload includes `authAutoSignInProvider: 'keycloak'`
- **AND** it still includes `authProviderUiModes: { keycloak: 'sameWindow' }`

#### Scenario: No `auth` option omits the field

- **WHEN** a `ChatOverlay` is constructed with no `auth` option
- **THEN** the `SET_OVERLAY_OPTIONS` payload does not include `authAutoSignInProvider`

#### Scenario: Empty provider id omits the field

- **WHEN** a `ChatOverlay` is constructed with `auth: { autoSignInProvider: '   ' }`
- **THEN** the `SET_OVERLAY_OPTIONS` payload does not include `authAutoSignInProvider`

#### Scenario: `setOverlayOptions` updates the transmitted provider id

- **WHEN** `setOverlayOptions({ auth: { providerUiModes: { keycloak: OverlayAuthUiMode.SameWindow }, autoSignInProvider: 'keycloak' } })` is called on an overlay constructed without `auth`
- **THEN** the resulting `SET_OVERLAY_OPTIONS` payload includes `authAutoSignInProvider: 'keycloak'`

#### Scenario: `setOverlayOptions` can drop the provider id

- **WHEN** `setOverlayOptions({ auth: { providerUiModes: { keycloak: OverlayAuthUiMode.SameWindow } } })` is called on an overlay that previously sent `authAutoSignInProvider`
- **THEN** the next `SET_OVERLAY_OPTIONS` payload does not include `authAutoSignInProvider`
