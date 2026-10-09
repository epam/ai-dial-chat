# Delta: scheduled-tasks-offline-credentials-signout

## Purpose

Relocates the user-facing half of the signout capability from the Scheduled Tasks page header to the new Extensions section in Settings (`settings-extensions` capability): the disconnect affordance, its confirmation, and its strings move; the gate's `connected` exposure and the BFF endpoint contract are untouched. The Scheduled Tasks page keeps the login side (banner + login flow) of the sibling `scheduled-tasks-offline-credentials-login` capability.

## MODIFIED Requirements

### Requirement: Gate result exposes the resolved connected state

The route-scoped offline-credentials status check (`useOfflineCredentialsGate`, state owner) SHALL additionally expose on its result, alongside `status`: the last resolved `connected` boolean (updated from the same Core response in the same `fetchStatus` pass, including inside `refetch`, defaulting to `false` before the first resolution) and the Core OAuth client id from the same response (`serviceClientId`, set whenever Core returns a complete `connect` object — regardless of connection state, since the login-only `connect` settings are derived only while a login is possible; `undefined` when Core returns none). A failed check SHALL NOT flip `connected` to `false` from a previously resolved `true`, nor change `serviceClientId`, unless a later successful check reports otherwise — mirroring the login flow's "a failed check must not falsely report disconnected" rule. No new React context is introduced; the state stays in the existing hook. The Extensions settings section consumes `serviceClientId` for the service row's display-name derivation (see the `settings-extensions` capability).

#### Scenario: Connected user reads the boolean and the client id

- **WHEN** the status check resolves `{ available: true, connected: true, connect: { client_id: 'dial-apps', … } }`
- **THEN** the gate result reports `connected: true` and `serviceClientId: 'dial-apps'` while the same route entry lasts

#### Scenario: Failed check does not flip a known-connected state

- **WHEN** a previously resolved `connected: true` gate re-fetches and the request fails
- **THEN** the gate does not report `connected: false` from that failure (the error status governs the banner; `connected` and `serviceClientId` keep the last resolved values until a successful check reports otherwise)

### Requirement: Disconnect affordance renders only for a connected user

The Extensions settings section (`/settings/extensions`, see the `settings-extensions` capability) SHALL render the external Scheduler auth service row's logout action only when the gate reports `connected: true` (and the status check itself has not errored). The Scheduled Tasks list page (`ScheduledTasksPage`) SHALL NOT render any disconnect/logout affordance in any gate state; the lib's `ScheduledTasks` component exports no disconnect props. All host knowledge (gate state, the signout call, the confirmation flow) stays in the Extensions tab; the table row receives only callbacks and strings.

#### Scenario: Connected user sees the row's logout button in Settings

- **WHEN** the gate reports `connected: true` on the Extensions tab
- **THEN** the service row's action cell shows the logout button

#### Scenario: Scheduled Tasks page shows no logout affordance

- **WHEN** the user opens `/scheduled-tasks` in any gate state (`Checking`, `Available`, `Unavailable`, `Hidden`, `Error`)
- **THEN** no disconnect or logout action renders anywhere on the page — the header carries only the create action

### Requirement: Signout requires an explicit confirmation

The Extensions tab SHALL require an explicit confirmation before revoking the grant: activating the row's logout button opens a ui-kit 2.0 `ConfirmationPopup` (mirroring `LogoutConfirmationModal`) whose description states the consequence — future scheduled tasks will fail until the user logs in again. Cancel (or dismiss) SHALL close the dialog without any request. Confirm SHALL be blocked while a signout is already in flight; the confirm handler SHALL be re-entry-guarded. The dialog SHALL use the repo's standard open/close state pattern (`useState` boolean), with the Extensions tab owning all dialog state.

#### Scenario: Confirm performs the revoke

- **WHEN** the user activates the row's logout button and confirms in the dialog
- **THEN** `signOutOfflineCredentials()` is called exactly once per confirmation

#### Scenario: Cancel performs no request

- **WHEN** the user activates logout and then cancels (or dismisses) the dialog
- **THEN** no signout request is made and the dialog closes

#### Scenario: Repeated confirms do not duplicate the request

- **WHEN** the confirm action is activated again while a signout is in flight
- **THEN** no second `signOutOfflineCredentials()` call is made

### Requirement: A fresh gate refetch is authoritative for the signout outcome

The Extensions tab's signout handler SHALL treat a fresh gate refetch — not the POST's own `200` — as authoritative for what the UI shows next, mirroring the login flow's refetch-authoritative rule. On refetch reporting `connected: false`, the dialog SHALL close, the row SHALL switch to its disconnected presentation (Log in action, warning badge — see the `settings-extensions` capability), a success announcement SHALL be emitted through a polite `aria-live` region, and the existing login-required banner SHALL reappear on the Scheduled Tasks page on its next route entry through the existing per-route-entry gate check (no bespoke reappearance logic). On signout or refetch failure, the dialog SHALL remain open with an error state and the row SHALL NOT falsely show a disconnected state. The handler SHALL be memoised with `useCallback` (dependencies: gate refetch, signout wrapper, `t`).

#### Scenario: Successful signout clears the row and re-enables the login banner route-side

- **WHEN** the signout POST succeeds and the refetch reports `{ available: true, connected: false }`
- **THEN** the dialog closes, the row switches to the Log in action with the warning badge, the success announcement is spoken by the polite live region, and a later navigation to `/scheduled-tasks` renders the login-required banner (the gate re-checks on route entry)

#### Scenario: Signout failure keeps the dialog open

- **WHEN** the signout POST fails (non-2xx or network error)
- **THEN** the dialog stays open with an error state, the row keeps its logout button, and the user can retry or cancel

#### Scenario: POST succeeds but refetch fails

- **WHEN** the signout POST returns `200` but the authoritative refetch errors
- **THEN** the dialog stays open with an error state and the row does not falsely show a disconnected state

### Requirement: Signout strings flow through react-i18next

All user-visible strings of the relocated flow SHALL resolve via `useTranslation().t()` in the Extensions tab, with keys under the settings namespace in `apps/chat/src/i18n/locales/en.json`, referenced through typed enum members in `apps/chat/src/constants/translation-keys.ts` (see the `settings-extensions` capability's strings requirement for the key set). The dialog cancel label SHALL reuse the existing generic `ButtonsI18nKeys.Cancel`; no generic value already present in `en.json` may be re-declared under these keys. The logout dialog's `confirmTitle`/`confirmDescription`/`failedMessage`/`successAnnouncement` SHALL reuse the existing `scheduledTasks.disconnect.*` keys verbatim (same operation, same wording — the duplicate-value rule), while the two keys that lost their consumer with the header button — `scheduledTasks.disconnect.buttonLabel`/`ariaLabel` — SHALL be removed together with their `ScheduledTasksI18nKeys` members and the last consumer.

#### Scenario: Keys are declared, reused, and the dead set removed

- **WHEN** the signout UI renders from the Extensions tab
- **THEN** every string resolves from a declared enum member (settings-namespace members, reused `ButtonsI18nKeys` values, and the reused `scheduledTasks.disconnect.confirmTitle`/`confirmDescription`/`failedMessage`/`successAnnouncement` keys), each member's value existing in `en.json`, and `scheduledTasks.disconnect.buttonLabel`/`ariaLabel` no longer exist in `en.json`

### Requirement: Signout UI meets RTL and AAA accessibility defaults

The relocated affordance SHALL use logical Tailwind/CSS properties only (no `ml-`/`mr-`/`left-`/`right-` directional classes) and SHALL NOT mirror its icons in RTL — `IconLogout` is symmetric. The row's logout button SHALL meet the AAA tap target, carry a localized accessible name at all viewport widths (its icon stays `aria-hidden`), and remain fully keyboard-operable. The success and failure feedback SHALL be announced through polite `aria-live` regions, with no state communicated by color alone. No new observability/telemetry events are introduced; the BFF keeps the domain's existing debug-logging discipline (status only, never tokens).

#### Scenario: RTL layout flips without icon mirroring

- **WHEN** the document direction is `rtl`
- **THEN** the table, row, dialog, and announcements follow the writing direction via logical properties, and the logout icon is not mirrored

#### Scenario: Keyboard-only operation

- **WHEN** a keyboard-only user reaches the row's logout button, opens the dialog, and confirms or cancels
- **THEN** every step is reachable and operable by keyboard, focus is trapped within the open dialog, and the outcome is announced
