# Delta: chat-hooks-offline-credentials

## ADDED Requirements

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
