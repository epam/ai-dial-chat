# chat-hooks-offline-credentials delta

## ADDED Requirements

### Requirement: Gate result carries the scheduler service consent

`mapOfflineCredentialsResponse` (`libs/chat-hooks/src/offline-credentials/map-offline-credentials-response.ts`) SHALL pass the response's `schedulerServiceConsent` through into `OfflineCredentialsStatusResult`, defaulting an absent or non-enum value to `unknown`, and `useOfflineCredentialsGate` SHALL expose it on its result alongside `status`/`connect`/`connected`. The lib SHALL NOT interpret the field into UI states — which banner, badge, or button renders stays with each consuming surface; the lib parses and exposes only. The field SHALL NOT change the gate's `status` resolution, which stays driven by `available`/`connected` alone.

The host boundary is unchanged: the hook keeps receiving the already-configured generated client as a parameter and imports no app routing, i18n, or client construction; the field is one more value on the same response the hook already maps.

#### Scenario: Consent value passes through with the status result

- **WHEN** `mapOfflineCredentialsResponse` receives `{ available: true, connected: true, schedulerServiceConsent: 'signed_out' }`
- **THEN** the mapped result carries `schedulerServiceConsent: 'signed_out'` and the gate exposes it on its result

#### Scenario: Absent or unexpected value defaults to unknown

- **WHEN** the response omits `schedulerServiceConsent` (older BFF) or carries a value outside the generated enum
- **THEN** the mapped result and the gate result carry `unknown`, and the gate's `status` resolution is unaffected

#### Scenario: The lib adds no UI interpretation

- **WHEN** the lib's offline-credentials sources are scanned
- **THEN** no source branches on `schedulerServiceConsent` to render, hide, or label any UI, and no forbidden imports (app routing, `react-i18next`, `apps/chat/src/server-api/*`) appear
