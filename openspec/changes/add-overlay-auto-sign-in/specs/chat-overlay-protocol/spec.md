## ADDED Requirements

### Requirement: `auth.autoSignInProvider` option and `authAutoSignInProvider` wire field

`libs/chat-overlay/src/protocol/overlay-protocol.ts` SHALL extend the existing `auth` object on `ChatOverlayOptions` with an optional `autoSignInProvider?: string` field, and SHALL extend `SetOverlayOptionsPayload` with an optional `authAutoSignInProvider?: string` field carrying an opaque string on the wire.

The host-facing field SHALL NOT be accompanied by a separate enable/disable boolean: its presence enables overlay auto sign-in and its value names the provider, so the option cannot be half-specified.

Both fields are optional. Existing callers SHALL compile and behave identically when they are absent. The module SHALL remain import-free, containing only enums and interfaces, consistent with its existing "pure types only" requirement.

No new endpoint, DTO, or generated-client operation is introduced: the app uses the existing `GET /api/v1/auth/providers` and `GET /api/v1/auth/login/:providerId` exactly as the manual login gate already does.

i18n: none — the fields carry no user-visible strings.

RTL: none — type definitions have no direction impact.

FEATURE GATE: not gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES`, and not an `OverlayFeature` key. It is an overlay integration option, like `auth.providerUiModes`.

#### Scenario: `autoSignInProvider` is optional on `ChatOverlayOptions.auth`

- **WHEN** a TypeScript caller constructs `{ domain: 'https://chat.example.com', auth: { providerUiModes: { keycloak: OverlayAuthUiMode.SameWindow } } }` with no `autoSignInProvider`
- **THEN** the type check passes without error

#### Scenario: `autoSignInProvider` accepts a provider id alongside `providerUiModes`

- **WHEN** a caller constructs `auth: { providerUiModes: { keycloak: OverlayAuthUiMode.SameWindow }, autoSignInProvider: 'keycloak' }`
- **THEN** the type check passes without error

#### Scenario: `authAutoSignInProvider` is an optional string on `SetOverlayOptionsPayload`

- **WHEN** `SetOverlayOptionsPayload` is inspected
- **THEN** the `authAutoSignInProvider` field is optional and typed `string`

#### Scenario: The protocol module stays import-free

- **WHEN** `libs/chat-overlay/src/protocol/overlay-protocol.ts` is inspected after the change
- **THEN** it imports nothing from `apps/*`, `libs/chat-api-client`, or any other lib or app
