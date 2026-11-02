# chat-hooks-offline-credentials Specification

## Purpose
Specifies the host-agnostic offline-credentials hooks in `@epam/ai-dial-chat-hooks` (`useOfflineCredentialsGate`, `useOfflineCredentialsLogin`, `useOfflineCredentialsAuth`): every host coupling — the configured generated client and the OAuth callback path — arrives as a parameter, and terminal login/logout outcomes are reported for the host to announce in its own wording.

## Requirements

### Requirement: Shared offline-credentials hooks in libs/chat-hooks

The system SHALL export the offline-credentials hooks — `useOfflineCredentialsGate`, `useOfflineCredentialsLogin`, and `useOfflineCredentialsAuth` — from `@epam/ai-dial-chat-hooks`, with every host coupling arriving as a parameter: each hook that calls the BFF accepts an already-configured generated-client pick (`offlineCredentialsClient: Pick<OfflineCredentialsApi, …>`, the `useApplicationCredentials` pattern), and the login flow accepts the OAuth `callbackPath` (the host route the popup posts its result back to) instead of importing app routing. The hooks SHALL import no `react-i18next`, no `apps/chat/src/server-api/*`, and no router; `apps/chat` keeps one-line wrappers in `apps/chat/src/hooks/offlineCredentials/` that pre-wire the app's configured client and `ROUTES.ToolsetSignIn`.

The gate drops the app-side pathname-keyed re-fetch: the check fires on mount and aborts in flight on unmount, and each consumer surface is a route component that remounts per route entry, so the per-entry re-check behavior is preserved without the hook reading routing state.

#### Scenario: No forbidden imports

- **WHEN** the lib's offline-credentials hook sources are scanned
- **THEN** they contain no import of `react-i18next`, app routing (`react-router`), `apps/chat/src/server-api/*`, or any client construction/configuration — the configured client arrives as a parameter

#### Scenario: The consuming app pre-wires the host couplings

- **WHEN** `apps/chat` renders a surface behind the hooks (the Scheduled Tasks banner, the Settings Extensions tab, the task detail page, the create/edit save-failure path)
- **THEN** the app wrapper passes the app's configured `offlineCredentialsApi` and `ROUTES.ToolsetSignIn` once, and every consumer keeps importing the hooks from the app wrapper paths unchanged


### Requirement: Outcome-based auth orchestration with host-owned announcements

`useOfflineCredentialsAuth` SHALL expose terminal outcomes instead of translated strings: the existing `loginOutcome` (`OfflineCredentialsLoginOutcomeType`), and `logOut` resolving an `OfflineCredentialsLogoutOutcomeType` (`Disconnected` — a fresh status refetch confirmed `connected: false`; `NotDisconnected` — the revoke request succeeded but the refetch did not confirm; `Failed` — the revoke request itself failed) instead of a boolean, with no `liveAnnouncement` on its result. The host SHALL map outcomes onto its own announcement text (`apps/chat/src/utils/offline-credentials-announcements.ts` holds the shared login-outcome key map and the logout-outcome key resolver); the lib holds no wording.

#### Scenario: The dialog closes only on a confirmed disconnection

- **WHEN** `logOut` resolves
- **THEN** the caller's confirmation dialog closes only on `Disconnected`; `NotDisconnected` and `Failed` keep it open with the failed presentation

#### Scenario: Announcements are host-owned

- **WHEN** a login attempt reaches a terminal outcome or a logout resolves
- **THEN** the lib hook reports the outcome only — the consuming surface resolves the announcement text from its own i18n keys, and no translation happens inside the lib

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
