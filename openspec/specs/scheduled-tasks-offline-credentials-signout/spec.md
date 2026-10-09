# Spec: scheduled-tasks-offline-credentials-signout

## Purpose

Defines the app-level signout flow for the Scheduled Tasks list page's offline-credentials grant: the gate-exposed `connected` state that drives the disconnect affordance, the confirmation dialog, the refetch-authoritative signout handler, the login banner's reappearance after a revoke, and the flow's i18n, RTL, and accessibility requirements. Sibling capability of `scheduled-tasks-offline-credentials-login` (which owns the login side); the BFF endpoint contract lives in the `offline-credentials` capability.

## Requirements

### Requirement: Gate result exposes the resolved connected state

The route-scoped offline-credentials status check (`useOfflineCredentialsGate`, state owner) SHALL additionally expose the last resolved `connected` boolean on its result alongside `status`, updated from the same Core response in the same `fetchStatus` pass (including inside `refetch`), defaulting to `false` before the first resolution. A failed check SHALL NOT flip `connected` to `false` from a previously resolved `true` unless a later successful check reports it — mirroring the login flow's "a failed check must not falsely report disconnected" rule. No new React context is introduced; the state stays in the existing hook.

#### Scenario: Connected user reads the boolean

- **WHEN** the status check resolves `{ available: true, connected: true }`
- **THEN** the gate result reports `connected: true` while the same route entry lasts

#### Scenario: Failed check does not flip a known-connected state

- **WHEN** a previously resolved `connected: true` gate re-fetches and the request fails
- **THEN** the gate does not report `connected: false` from that failure (the error status governs the banner; `connected` keeps the last resolved value until a successful check reports otherwise)

### Requirement: Disconnect affordance renders only for a connected user

The Scheduled Tasks list page (`ScheduledTasksPage`) SHALL render the lib's optional disconnect header action only when the gate reports `connected: true`, by passing `onDisconnectClick` (plus its label fields) to `ScheduledTasks` only in that state. The page SHALL NOT render the disconnect action while the gate is `Checking`, on `Error`, or when `connected: false`. All host knowledge (gate state, the signout call, the confirmation flow) stays in the page; the lib receives only the callback and strings.

#### Scenario: Connected user sees the Disconnect button

- **WHEN** the gate reports `connected: true` on the Scheduled Tasks list page
- **THEN** the header shows the Disconnect button beside "+ New task"

#### Scenario: Disconnected or checking user sees no Disconnect button

- **WHEN** the gate is `Checking`, `Error`, or reports `connected: false`
- **THEN** no disconnect action renders, with no layout shift when the button appears or disappears

### Requirement: Signout requires an explicit confirmation

The page SHALL require an explicit confirmation before revoking the grant: activating Disconnect opens a ui-kit 2.0 `ConfirmationPopup` (mirroring `LogoutConfirmationModal`) whose description states the consequence — future scheduled tasks will fail until the user logs in again. Cancel (or dismiss) SHALL close the dialog without any request. Confirm SHALL be blocked while a signout is already in flight; the confirm handler SHALL be re-entry-guarded (`isDisconnecting`). The dialog SHALL use the repo's standard open/close state pattern (`useState` boolean), with the page owning all dialog state.

#### Scenario: Confirm performs the revoke

- **WHEN** the user activates Disconnect and confirms in the dialog
- **THEN** `signOutOfflineCredentials()` is called exactly once per confirmation

#### Scenario: Cancel performs no request

- **WHEN** the user activates Disconnect and then cancels (or dismisses) the dialog
- **THEN** no signout request is made and the dialog closes

#### Scenario: Repeated confirms do not duplicate the request

- **WHEN** the confirm action is activated again while a signout is in flight
- **THEN** no second `signOutOfflineCredentials()` call is made

### Requirement: A fresh gate refetch is authoritative for the signout outcome

The page's signout handler SHALL treat a fresh gate refetch — not the POST's own `200` — as authoritative for what the UI shows next, mirroring the login flow's refetch-authoritative rule. On refetch reporting `connected: false`, the dialog SHALL close, the existing login-required banner SHALL reappear through the existing `resolveBannerState` machinery (no bespoke reappearance logic), and a success announcement SHALL be emitted through a polite `aria-live` region. On signout or refetch failure, the dialog SHALL remain open with an error state and the banner SHALL NOT falsely appear. The handler SHALL be memoised with `useCallback` (dependencies: gate refetch, signout wrapper, `t`), matching `handleLogIn`'s shape.

#### Scenario: Successful signout reappears the login banner

- **WHEN** the signout POST succeeds and the refetch reports `{ available: true, connected: false }`
- **THEN** the dialog closes, the login-required banner renders with its "Log in" action, and the success announcement is spoken by the polite live region

#### Scenario: Signout failure keeps the dialog open

- **WHEN** the signout POST fails (non-2xx or network error)
- **THEN** the dialog stays open with an error state, no banner appears, and the user can retry or cancel

#### Scenario: POST succeeds but refetch fails

- **WHEN** the signout POST returns `200` but the authoritative refetch errors
- **THEN** the dialog stays open with an error state and the banner does not falsely appear

### Requirement: Signout strings flow through react-i18next

All new user-visible strings SHALL resolve via `useTranslation().t()` in `ScheduledTasksPage` and pass into the lib/dialog as plain strings, with keys under the `scheduledTasks` namespace in `apps/chat/src/i18n/locales/en.json`, referenced through new members of the typed `ScheduledTasksI18nKeys` enum in `apps/chat/src/constants/translation-keys.ts`:

- `scheduledTasks.disconnect.buttonLabel` — header button label
- `scheduledTasks.disconnect.ariaLabel` — header button accessible name
- `scheduledTasks.disconnect.confirmTitle` — dialog title
- `scheduledTasks.disconnect.confirmDescription` — dialog description stating the consequence
- `scheduledTasks.disconnect.failedMessage` — dialog failure state
- `scheduledTasks.disconnect.successAnnouncement` — polite live-region announcement after a successful signout

The dialog cancel label SHALL reuse the existing generic `ButtonsI18nKeys.Cancel` (duplicate-value rule); no generic value already present in `en.json` may be re-declared under these keys.

#### Scenario: Keys are declared and reused

- **WHEN** the signout UI renders
- **THEN** every string resolves from a `ScheduledTasksI18nKeys` member (plus `ButtonsI18nKeys.Cancel` for the dialog cancel), each new member's value existing in `en.json`

### Requirement: Signout UI meets RTL and AAA accessibility defaults

The disconnect affordance SHALL use logical Tailwind/CSS properties only (no `ml-`/`mr-`/`left-`/`right-` directional classes) and SHALL NOT mirror its icon in RTL — `IconLogout` is symmetric. The button SHALL meet the AAA tap target in both its expanded form and its collapsed 40px-pill form — the kit's `dial-kit-enhanced-target` overlay (`min-height: 44px; min-width: 44px` centered on the button) guarantees the 44×44 hit area regardless of the visible pill size — carry an accessible name at all viewport widths (its icon stays `aria-hidden`), and remain fully keyboard-operable. The success and failure feedback SHALL be announced through polite `aria-live` regions, with no state communicated by color alone. No new observability/telemetry events are introduced; the BFF follows the domain's existing debug-logging discipline (status only, never tokens).

#### Scenario: RTL layout flips without icon mirroring

- **WHEN** the document direction is `rtl`
- **THEN** the header action group, dialog, and announcements follow the writing direction via logical properties, and the logout icon is not mirrored

#### Scenario: Keyboard-only operation

- **WHEN** a keyboard-only user reaches the Disconnect button, opens the dialog, and confirms or cancels
- **THEN** every step is reachable and operable by keyboard, focus is trapped within the open dialog, and the outcome is announced
