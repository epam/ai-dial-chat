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

The table SHALL have exactly three columns: **Name**, **Description**, and a visually empty trailing action column whose header carries an `sr-only` localized label (visually empty, still announced to screen readers). While the offline-credentials status check reports the service as available, the table SHALL render exactly one row — the external Scheduler auth service; the row SHALL NOT render while the check reports the service unavailable, and the section heading and description render in every state.

#### Scenario: Section renders heading, description, and column headers

- **WHEN** the Extensions tab renders
- **THEN** the page shows the "Extensions" heading, the description text, and a table whose header row exposes Name and Description column headers plus the visually empty action column header

#### Scenario: Available service renders one row

- **WHEN** the status check reports the service as available
- **THEN** the table renders exactly one row for the external Scheduler auth service

#### Scenario: Unavailable service renders no rows

- **WHEN** the status check reports the service as unavailable
- **THEN** the table renders no service rows, while the section heading and description remain

### Requirement: Service row derives its identity from the Core-reported client identity

The row's Name cell SHALL render a square `InitialsAvatar` carrying the service's initials beside the service display name. The display name SHALL derive from the Core-reported client identity (`connect.clientId` from the offline-credentials status response, humanized to title case — e.g. `dial-apps` → `Dial Apps`, avatar initials `DA` via `extractInitials`); when Core omits the `connect` object, the row SHALL fall back to a localized default display name. The Description cell SHALL render the localized service description ("Provides access to built-in apps within the platform.") — Core exposes no per-service description field.

#### Scenario: Avatar and name derive from clientId

- **WHEN** the status check resolves with `connect.clientId = 'dial-apps'`
- **THEN** the Name cell renders a square avatar with the initials `DA` beside the display name `Dial Apps`

#### Scenario: Missing connect falls back to the default name

- **WHEN** the status check resolves with no usable `connect` object
- **THEN** the row renders with the localized default display name (and its initials) instead of failing to render

#### Scenario: Description cell renders the localized service description

- **WHEN** the service row renders
- **THEN** the Description cell shows the localized service description text

### Requirement: Disconnected row shows a warning badge with a tooltip on the avatar

While the last resolved gate state is disconnected (`available: true && connected: false`), the row's Name cell SHALL render a small warning badge overlaid at the avatar's bottom-inline-start corner (a relatively-positioned avatar wrapper with an absolutely-positioned badge), using the login banner's warning glyph (`IconAlertTriangleFilled`) in a warning color. The badge SHALL NOT render while the row reports connected, while the check is in flight, or on check error (no state asserted). The badge SHALL be a ui-kit `Tooltip` trigger: hover **and keyboard focus** on the badge show the localized tooltip text "Authorize to use this extension"; the icon itself stays `aria-hidden` — the tooltip text and the action cell's Log in button carry the state, so the disconnected state is never communicated by color alone. The badge's hover/focus target SHALL meet the AAA tap-target size (a padded hit area around the small glyph).

#### Scenario: Disconnected avatar carries the warning badge

- **WHEN** the gate reports `available: true` and `connected: false`
- **THEN** the avatar renders the warning badge at its bottom-inline-start corner

#### Scenario: Connected avatar carries no badge

- **WHEN** the gate reports `connected: true`, the check is in flight, or the check errored
- **THEN** the avatar renders no warning badge

#### Scenario: Tooltip shows on hover and on keyboard focus

- **WHEN** the pointer hovers over, or keyboard focus reaches, the warning badge
- **THEN** the tooltip shows the localized "Authorize to use this extension" text; on blur/pointer-leave the tooltip hides

#### Scenario: The warning icon itself is not announced

- **WHEN** the warning badge renders
- **THEN** its icon is `aria-hidden` and the disconnected state is carried by the tooltip text and the action cell's Log in button label

### Requirement: Row action switches between Log in and Log out with the connection state

The row's action cell SHALL render a state-dependent action: **Log out** while the gate reports `connected: true` (and the check itself has not errored), **Log in** while the gate reports `available: true && connected: false`, and an empty cell while the check is in flight or errored. The Log out button SHALL carry the `IconLogout` glyph (icon-before, `aria-hidden`, the kit's stroke token — the same glyph the removed Scheduled Tasks header Disconnect action used; the button label is the accessible name). The Log in action SHALL be the existing offline-credentials login flow (`useOfflineCredentialsLogin`) driven with the gate's `connect` settings — the same flow the Scheduled Tasks page banner drives; the button SHALL be disabled (with an in-flight label) while a login is in flight.

#### Scenario: Connected row shows the Log out button

- **WHEN** the gate reports `connected: true`
- **THEN** the row's action cell renders the Log out button with a localized accessible name and the logout icon (`aria-hidden`)

#### Scenario: Disconnected row shows the Log in button

- **WHEN** the gate reports `available: true` and `connected: false`
- **THEN** the row's action cell renders the Log in button, and activating it starts the OAuth popup login flow

#### Scenario: In-flight or errored check renders an empty action cell

- **WHEN** the check is in flight or errored
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

The Extensions tab SHALL use logical Tailwind/CSS properties only (no physical-direction classes for directional layout) — including the warning badge's bottom-**inline-start** corner placement, which mirrors with the writing direction — and SHALL NOT mirror its symmetric icons (`IconPlugConnected`, `IconLogout`, the filled warning glyph) in RTL. The table SHALL stay keyboard-operable: both row action buttons are real focusable controls with localized accessible names, the warning badge's tooltip opens on keyboard focus (not hover only) with a padded hit area meeting the AAA tap target, the confirm dialog traps focus while open, the visually empty action column header carries its `sr-only` localized label, and dynamic outcomes (successful login/revoke, failure, login retry outcomes) are announced through polite `aria-live` regions with no state communicated by color alone.

#### Scenario: RTL layout mirrors without icon mirroring

- **WHEN** the document direction is `rtl`
- **THEN** the table, rows, warning badge (at the bottom-inline-start corner), and dialog lay out mirrored via logical properties, and the icons are not mirrored

#### Scenario: Keyboard-only login and logout flows

- **WHEN** a keyboard-only user focuses the warning badge (tooltip opens), reaches the row's Log in or Log out button, opens the dialog, and confirms or cancels
- **THEN** every step is reachable and operable by keyboard, focus is trapped within the open dialog, and the outcome is announced
