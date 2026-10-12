# Delta: settings-extensions

## ADDED Requirements

### Requirement: Extensions tab registers behind the scheduled-tasks feature flag

The Settings panel SHALL expose an "Extensions" tab (`SettingsTabs.Extensions = 'extensions'`, URL segment `/settings/extensions`) through a `useSettingsTabConfig` entry with the `IconPlugConnected` icon (`aria-hidden`, `DIAL_KIT_ICON_STROKE`), resolved through the existing `SettingsPage`/`SettingsPanel` machinery with no new route-table registration. The entry SHALL render only when `useFeatureFlag('scheduledTasksEnabled')` resolves to `true` for the session; when the flag is off, no Extensions tab item appears in the side column and `/settings/extensions` is not a resolvable tab (the panel defaults to its first configured tab).

#### Scenario: Flag on shows the tab

- **WHEN** `scheduledTasksEnabled` resolves to `true` and the user opens Settings
- **THEN** the side column lists the Extensions item with the plug-connected icon, and navigating to `/settings/extensions` renders the Extensions tab

#### Scenario: Flag off hides the tab

- **WHEN** `scheduledTasksEnabled` resolves to `false`
- **THEN** no Extensions item renders in the side column, and `/settings/extensions` resolves to the panel's default tab like any unconfigured segment

### Requirement: Extensions section renders heading, description, and service table

The Extensions tab SHALL render a page heading "Extensions" (the `dial-h1-text` page-heading pattern used by the Usage tab) and a description "Access additional tools and capabilities through extensions." (the `dial-small-text` pattern), followed by a table listing the connected external services, built with ARIA table semantics (`role="table"`/`role="row"`/`role="columnheader"`/`role="cell"`) on the `ModelLimitsSection` pattern — column headers in the section's caption-style class, the header row hidden below the `desktop:` breakpoint with rows stacking, and grid-template columns Name / Description / trailing action on `desktop:`.

The table SHALL have exactly three columns: **Name**, **Description**, and a visually empty trailing action column whose header carries an `sr-only` localized label (visually empty, still announced to screen readers). While the deployment has the service configured (the gate reports `Available` — configured and disconnected — or `Hidden` — connected), the table SHALL render exactly one row — the external Scheduler auth service. A Spinner SHALL stand in for the whole table while the check is in flight, and no row SHALL render while the deployment reports the service unconfigured (`Unavailable`) or the check errored (`Error`). The section heading and description render in every state.

#### Scenario: Section renders heading, description, and column headers

- **WHEN** the Extensions tab renders
- **THEN** the page shows the "Extensions" heading, the description text, and a table whose header row exposes Name and Description column headers plus the visually empty action column header

#### Scenario: Configured service renders one row

- **WHEN** the gate reports `Available` (configured and disconnected) or `Hidden` (connected)
- **THEN** the table renders exactly one row for the external Scheduler auth service

#### Scenario: Unconfigured or errored check renders no rows

- **WHEN** the gate reports `Unavailable` (the deployment has no configured offline OAuth client) or `Error`
- **THEN** the table renders no service rows, while the section heading and description remain

#### Scenario: In-flight check shows a Spinner in place of the table

- **WHEN** the gate reports the check as in flight (`Checking`)
- **THEN** the section renders a Spinner instead of the table, with the heading and description still present

### Requirement: Service row renders the fixed service with the localized default name

The row's Name cell SHALL render a square `InitialsAvatar` carrying the service's initials beside the service display name. The row is the fixed Dial native service: its display name SHALL be the localized default name (`settings.extensions.service.defaultName`), never derived from the OAuth client id Core happens to report for the connected grant — a client id is a stable technical identifier, not a product name, so it is not shown to the user. The avatar initials derive from that same default display name via `extractInitials`. The Description cell SHALL render the localized service description ("Provides access to built-in apps within the platform.") — Core exposes no per-service description field.

#### Scenario: Avatar and name render from the localized default name

- **WHEN** the service row renders
- **THEN** the Name cell renders a square avatar with the default name's initials beside the localized default display name, in every connection state

#### Scenario: Description cell renders the localized service description

- **WHEN** the service row renders
- **THEN** the Description cell shows the localized service description text

### Requirement: Disconnected row shows a warning badge on the avatar

While the last resolved gate state is disconnected (`available: true && connected: false`), the row's Name cell SHALL render a small warning badge overlaid at the avatar's bottom-**inline-end** corner (a relatively-positioned avatar wrapper with an absolutely-positioned badge), using the login banner's warning glyph (`IconAlertTriangleFilled`) in a warning color. The badge SHALL NOT render while the row reports connected, while the check is in flight, or on check error (no state asserted).

The badge is informational, not an affordance: a ui-kit `Tooltip` on the badge shows the localized "Authorize to use this extension" text on hover, with the tooltip's own trigger carrying the badge position (so the hover reference has the glyph's real size); the badge is not a focusable control, so the tooltip opens on hover only. The disconnected state SHALL NOT be communicated by color alone: the badge span exposes `role="img"` with the localized accessible name (the same text the tooltip shows) — that accessible name and the action cell's Log in button label carry the state to assistive tech, and the underlying svg glyph stays `aria-hidden`.

#### Scenario: Disconnected avatar carries the warning badge

- **WHEN** the gate reports `available: true` and `connected: false`
- **THEN** the avatar renders the warning badge at its bottom-inline-end corner

#### Scenario: Connected avatar carries no badge

- **WHEN** the gate reports `connected: true`, the check is in flight, or the check errored
- **THEN** the avatar renders no warning badge

#### Scenario: Tooltip shows the localized authorize text on hover

- **WHEN** the pointer hovers over the warning badge
- **THEN** the tooltip shows the localized "Authorize to use this extension" text; on pointer-leave the tooltip hides

#### Scenario: The badge's accessible name carries the state

- **WHEN** the warning badge renders
- **THEN** its span exposes `role="img"` with the localized accessible name (the authorize text), the svg glyph is `aria-hidden`, and the tooltip is a hover enhancement — the disconnected state is never communicated by color alone

### Requirement: Row action switches between Log in and Log out with the connection state

The row's action cell SHALL render a state-dependent action: **Log out** while the gate reports `connected: true`, **Log in** while a login is possible (the gate's `connect` settings present), and an empty cell when the row renders but Core sent no usable `connect` settings — while the check is in flight the section shows a Spinner with no table at all, and while the check errored no row renders. The Log out button SHALL carry the `IconLogout` glyph (icon-before, `aria-hidden`, the kit's stroke token — the same glyph the removed Scheduled Tasks header Disconnect action used; the button label is the accessible name). The Log in action SHALL be the existing offline-credentials login flow (`useOfflineCredentialsLogin`) driven with the gate's `connect` settings — the same flow the Scheduled Tasks page banner drives; the button SHALL be disabled (with an in-flight label) while a login is in flight.

#### Scenario: Connected row shows the Log out button

- **WHEN** the gate reports `connected: true`
- **THEN** the row's action cell renders the Log out button with a localized accessible name and the logout icon (`aria-hidden`)

#### Scenario: Disconnected row shows the Log in button

- **WHEN** the gate reports `available: true` and `connected: false`
- **THEN** the row's action cell renders the Log in button, and activating it starts the OAuth popup login flow

#### Scenario: Row without usable connect settings renders an empty action cell

- **WHEN** the row renders (the service is configured) but the check carried no usable `connect` object
- **THEN** the row's action cell renders no button

#### Scenario: Log in button is disabled while the flow is in flight

- **WHEN** a login flow started from the row is in flight
- **THEN** the Log in button is disabled with its in-flight label, and repeated activations do not start a second flow

### Requirement: Row logout requires an explicit confirmation

Activating the row's Log out button SHALL open the ui-kit 2.0 `ConfirmationPopup` (`Danger` variant) whose description states the consequence of revoking. Cancel or dismiss SHALL close the dialog with no request. Confirm SHALL call `signOutOfflineCredentials()` exactly once per confirmation, SHALL be re-entry-guarded while a signout is in flight, and SHALL NOT be treated as success on the POST's own `200`.

#### Scenario: Confirm performs the revoke exactly once

- **WHEN** the user confirms the dialog
- **THEN** `signOutOfflineCredentials()` is called exactly once

#### Scenario: Cancel performs no request

- **WHEN** the user cancels or dismisses the dialog
- **THEN** no signout request is made and the dialog closes

#### Scenario: Repeated confirms do not duplicate the request

- **WHEN** the confirm action is activated again while a signout is in flight
- **THEN** no second `signOutOfflineCredentials()` call is made

### Requirement: A fresh status refetch is authoritative for the logout outcome

The tab's signout handler SHALL treat a fresh offline-credentials status refetch — not the POST's own `200` — as authoritative for the row's next state. On the refetch reporting `connected: false`, the dialog SHALL close, the row's action cell and avatar SHALL switch to the disconnected presentation (Log in action, warning badge), and a success announcement SHALL be emitted through a polite `aria-live` region. On signout or refetch failure, the dialog SHALL remain open with an error state and the row SHALL NOT falsely show a disconnected state.

#### Scenario: Successful signout clears the connected row state

- **WHEN** the signout POST succeeds and the refetch reports `connected: false`
- **THEN** the dialog closes, the action cell switches to the Log in button, the warning badge appears on the avatar, and the success announcement is spoken by the polite live region

#### Scenario: Signout failure keeps the dialog open

- **WHEN** the signout POST fails
- **THEN** the dialog stays open with an error state, the row keeps its logout button, and the user can retry or cancel

#### Scenario: POST succeeds but refetch fails

- **WHEN** the signout POST returns `200` but the authoritative refetch errors
- **THEN** the dialog stays open with an error state and the row does not falsely show a disconnected state

### Requirement: Login outcome is refetch-authoritative and announced

The tab's login handler SHALL drive the existing `useOfflineCredentialsLogin` flow with the gate's `connect` settings and SHALL treat a fresh offline-credentials status refetch — not the popup's own completion — as authoritative for the row's next state. On success (refetch reporting `connected: true`), the action cell SHALL switch to the Log out button and a success announcement SHALL be emitted through a polite `aria-live` region. Popup-blocked, cancelled, timed-out, and failed outcomes SHALL be announced through the polite live region with localized outcome messages; the row SHALL keep its Log in state in every non-success outcome.

#### Scenario: Successful login switches the row to Log out

- **WHEN** the OAuth popup flow completes and the authoritative refetch reports `connected: true`
- **THEN** the action cell renders the Log out button, the warning badge is gone, and the success announcement is spoken by the polite live region

#### Scenario: Popup blocked is announced and the row keeps Log in

- **WHEN** the login popup is blocked by the browser
- **THEN** the blocked outcome is announced through the polite live region and the row keeps its Log in action

#### Scenario: Cancelled or timed-out login keeps the row's Log in state

- **WHEN** the user closes the popup or the flow times out
- **THEN** the respective outcome is announced and the row keeps its Log in action

#### Scenario: Failed login keeps the row's Log in state

- **WHEN** the login flow fails (non-2xx or network error)
- **THEN** the failure is announced and the row keeps its Log in action

### Requirement: Extensions strings flow through react-i18next

All user-visible strings on the Extensions tab (tab label, section heading, section description, column headers including the action column's `sr-only` label, service default name, service description, warning-badge tooltip text "Authorize to use this extension", Log in/Log out button labels and accessible names, login in-flight label, login outcome messages, confirm title/description/failed message, success announcement) SHALL resolve via `useTranslation().t()` with keys under the settings namespace in `apps/chat/src/i18n/locales/en.json`, referenced through typed enum members in `apps/chat/src/constants/translation-keys.ts`. Generic values that already exist (dialog Cancel, a generic "Log out" label, the login label `ButtonsI18nKeys.LogIn`) SHALL be reused from `ButtonsI18nKeys` rather than duplicated; the login flow's outcome messages reuse the banner's existing keys where the wording fits.

#### Scenario: Keys are declared and generic values reused

- **WHEN** the Extensions tab renders
- **THEN** every string resolves from a declared i18n enum member whose value exists in `en.json`, and no generic value already present in `en.json` is re-declared under a settings key

### Requirement: Extensions section supports RTL and meets AAA accessibility defaults

The Extensions tab SHALL use logical Tailwind/CSS properties only (no physical-direction classes for directional layout) — including the warning badge's bottom-**inline-end** corner placement, which mirrors with the writing direction — and SHALL NOT mirror its symmetric icons (`IconPlugConnected`, `IconLogout`, the filled warning glyph) in RTL. The table SHALL stay keyboard-operable: both row action buttons are real focusable controls with localized accessible names, the warning badge carries its localized accessible name (the state is announced, not color-only; the tooltip remains a hover enhancement), the confirm dialog traps focus while open, the visually empty action column header carries its `sr-only` localized label, and dynamic outcomes (successful login/revoke, failure, login retry outcomes) are announced through polite `aria-live` regions with no state communicated by color alone.

#### Scenario: RTL layout mirrors without icon mirroring

- **WHEN** the document direction is `rtl`
- **THEN** the table, rows, warning badge (at the bottom-inline-end corner), and dialog lay out mirrored via logical properties, and the icons are not mirrored

#### Scenario: Keyboard-only login and logout flows

- **WHEN** a keyboard-only user reaches the row's Log in or Log out button, opens the dialog, and confirms or cancels
- **THEN** every step is reachable and operable by keyboard, focus is trapped within the open dialog, the outcome is announced, and the warning state is readable through the badge's accessible name
