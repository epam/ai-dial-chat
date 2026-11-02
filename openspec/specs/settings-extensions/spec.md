# Spec: settings-extensions

## Purpose

Defines the Settings panel's Extensions section: the feature-flag-gated tab (`/settings/extensions`) that lists the connected external Scheduler auth service, derives the service row's identity from the Core-reported client identity, marks the disconnected state with a warning badge and tooltip, and switches the row's action between Log in and Log out with the confirmed, refetch-authoritative revoke and the announced login outcomes. The signout contract details live in `scheduled-tasks-offline-credentials-signout`; the BFF endpoints live in `offline-credentials`.

## Requirements

### Requirement: Extensions tab registers behind the scheduled-tasks feature flag

The Settings panel SHALL expose an "Extensions" tab (`SettingsTabs.Extensions = 'extensions'`, URL segment `/settings/extensions`) through a `useSettingsTabConfig` entry with the `IconPlugConnected` icon (`aria-hidden`, `DIAL_KIT_ICON_STROKE`), resolved through the existing `SettingsPage`/`SettingsPanel` machinery with no new route-table registration. The entry SHALL render only when `useFeatureFlag('scheduledTasksEnabled')` resolves to `true` for the session; when the flag is off, no Extensions tab item appears in the side column and `/settings/extensions` is not a resolvable tab (the panel defaults to its first configured tab).

#### Scenario: Flag on shows the tab

- **WHEN** `scheduledTasksEnabled` resolves to `true` and the user opens Settings
- **THEN** the side column lists the Extensions item with the plug-connected icon, and navigating to `/settings/extensions` renders the Extensions tab

#### Scenario: Flag off hides the tab

- **WHEN** `scheduledTasksEnabled` resolves to `false`
- **THEN** no Extensions item renders in the side column, and `/settings/extensions` resolves to the panel's default tab like any unconfigured segment

### Requirement: Extensions section renders heading, description, and service table

The Extensions tab SHALL render a page heading "Extensions" (the `dial-h1-text` page-heading pattern used by the Usage tab) and a description "Access additional tools and capabilities through extensions." (the `dial-small-text` pattern), followed by a table listing the connected external services, built with ARIA table semantics (`role="table"`/`role="row"`/`role="columnheader"`/`role="cell"`). The table shell — the `role="table"` container, the header row, and the shared desktop grid template — SHALL render through the presentational `ExtensionsSection` component from `@epam/ai-dial-settings-panel` (the `ModelLimitsSection` pattern in `libs/usage-dashboard`), with the tab passing labels, the service row, the warning flag, and the trailing action as props: column headers in the section's caption-style class, the header row hidden below the `desktop:` breakpoint with rows stacking, and grid-template columns Name / Description / trailing action on `desktop:`.

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

While the last resolved gate state is disconnected (`available: true && connected: false`) **and** `schedulerServiceConsent` is not `signed_out`, the row's Name cell SHALL render a small warning badge overlaid at the avatar's bottom-**inline-end** corner (a relatively-positioned avatar wrapper with an absolutely-positioned badge), using the login banner's warning glyph (`IconAlertTriangleFilled`) in a warning color. The badge SHALL also render while `schedulerServiceConsent` is `signed_out` (regardless of the login state — consent is evaluated before the login state), where it is joined by the red limited-access badge on the action side (see the "Row action switches between Log in and Log out with the connection state" requirement). The badge SHALL NOT render while the row reports connected with a consent that is not `signed_out`, while the check is in flight, or on check error (no state asserted).

The badge is informational, not an affordance, and carries **no tooltip in any state** — the previously shown localized "Authorize to use this extension" tooltip on the disconnected state is removed by product decision (the row's Log in button already carries the state), and under `signed_out` the same warning glyph also renders without a tooltip. Neither state SHALL be communicated by color alone: the avatar's warning glyph is decorative (its svg is `aria-hidden`; it carries no accessible name, because the state is carried by adjacent text — the Log in button's label while logged out, the red Badge's own label text under `signed_out`), and the red limited-access `Badge` (`BadgeVariant.Filled`, `BadgeColor.Red`) that replaces the action under `signed_out` renders the localized "Limited access" text as its own accessible name. While `schedulerServiceConsent` is `signed_out`, the Badge's hover tooltip renders two lines: the **bold** localized "Limited access." title (key `extensions.service.limitedAccessTooltipTitle`, declared via `ExtensionsI18nKeys` — a dedicated key, so an edit to the list-page banner copy cannot silently change the tooltip) and the **normal-weight** localized description "Contact your administrator for more details." (key `extensions.service.limitedAccessTooltipDescription`, declared via `ExtensionsI18nKeys`) below it — the tooltip content is a composed ReactNode inside the kit `Tooltip`'s `tooltip` prop. The tooltip opens on hover only — the badge is not a focusable control — with the tooltip's own trigger carrying the badge position so the hover reference has the badge's real size. The same description text SHALL remain visibly rendered below the Badge at every breakpoint, aligned to the inline end and wrapping within the action cell, so keyboard and touch users can read the explanation without opening the tooltip. The `Badge` SHALL reference that visible description through `aria-describedby` for screen-reader users; the tooltip is an optional hover enhancement.

`ExtensionServiceItem` (`libs/settings-panel`, `libs/settings-panel/src/models/extensions-props.ts`) loses its `authorizeLabel` field (the tooltip it fed no longer renders) and gains optional `limitedAccessLabel`, `limitedAccessTooltipTitle`, and `limitedAccessTooltipDescription` fields: the app supplies the localized badge label and tooltip strings; the lib imports no i18n and decides no state. The lib's README is updated in the same change (`npm run validate:docs`).

#### Scenario: Disconnected avatar carries the warning badge

- **WHEN** the gate reports `available: true` and `connected: false` and `schedulerServiceConsent` is `signed_in` or `unknown`
- **THEN** the avatar renders the warning badge at its bottom-inline-end corner

#### Scenario: Connected avatar with consent present carries no badge

- **WHEN** the gate reports `connected: true` and `schedulerServiceConsent` is `signed_in` or `unknown`, the check is in flight, or the check errored
- **THEN** the avatar renders no warning badge

#### Scenario: Revoked consent shows the warning badge regardless of the login state

- **WHEN** the gate reports `schedulerServiceConsent: 'signed_out'`
- **THEN** the avatar renders the warning badge whether `connected` is `true` or `false`

#### Scenario: The disconnected badge carries no tooltip

- **WHEN** the pointer hovers over the warning badge while `schedulerServiceConsent` is not `signed_out`
- **THEN** no tooltip renders — the removed authorize tooltip does not return, and the Log in button in the action cell carries the disconnected state

#### Scenario: The warning badge carries no tooltip in the signed-out state either

- **WHEN** the pointer hovers over the warning badge at the avatar in the Name column while `schedulerServiceConsent` is `signed_out`
- **THEN** no tooltip renders for the warning badge — only the red limited-access Badge in the action cell has a tooltip

#### Scenario: The limited-access tooltip shows a bold title and a normal description

- **WHEN** the pointer hovers over the red limited-access Badge while `schedulerServiceConsent` is `signed_out`
- **THEN** the tooltip renders the bold localized "Limited access." title line and the normal-weight localized "Contact your administrator for more details." description below it; on pointer-leave the tooltip hides

#### Scenario: The limited-access reason is visible without hovering

- **WHEN** the red limited-access Badge renders under `signed_out` on desktop or mobile, including for keyboard-only and touch users
- **THEN** the localized description remains visibly rendered below the Badge without requiring hover or focus, and wraps within the action cell

#### Scenario: The limited-access reason is associated with the Badge for screen readers

- **WHEN** a screen reader reaches the red limited-access Badge
- **THEN** its `aria-describedby` references the visible localized description, so the explanation is available without the tooltip

#### Scenario: The badges' states are carried by text, never color alone

- **WHEN** either badge renders
- **THEN** the avatar's warning glyph stays `aria-hidden` decoration with no accessible name, the red Badge's own label text is its accessible name, and the tooltip is a hover enhancement — the state is never communicated by color alone (the Log in button's label while logged out, the Badge's label text under `signed_out`)
### Requirement: Row action switches between Log in and Log out with the connection state

The row's action cell SHALL render a state-dependent action: **Log out** while the gate reports `connected: true` and `schedulerServiceConsent` is not `signed_out`, **Log in** while a login is possible (the gate's `connect` settings present and `schedulerServiceConsent` is not `signed_out`), the kit `Badge` (`@epam/ai-dial-ui-kit`, `BadgeVariant.Filled`, `BadgeColor.Red`) with the localized "Limited access" text while `schedulerServiceConsent` is `signed_out` — replacing the action button entirely, because neither logging in nor logging out can restore the missing administrator consent — and an empty cell when the row renders but Core sent no usable `connect` settings — while the check is in flight the section shows a Spinner with no table at all, and while the check errored no row renders. Consent is evaluated before the login state: `signed_out` wins regardless of `connected`. The Log out button SHALL carry the `IconLogout` glyph (icon-before, `aria-hidden`, the kit's stroke token; the button label is the accessible name). The Log in action SHALL be the existing offline-credentials login flow (`useOfflineCredentialsLogin`) driven with the gate's `connect` settings — the same flow the Scheduled Tasks page banner drives; the button SHALL be disabled (with an in-flight label) while a login is in flight. The Log in flow itself is unchanged — its outcome handling, announcements, and failure presentation stay as specified.

#### Scenario: Connected row shows the Log out button

- **WHEN** the gate reports `connected: true` and `schedulerServiceConsent` is `signed_in` or `unknown`
- **THEN** the row's action cell renders the Log out button with a localized accessible name and the logout icon (`aria-hidden`)

#### Scenario: Disconnected row shows the Log in button

- **WHEN** the gate reports `available: true` and `connected: false` and `schedulerServiceConsent` is `signed_in` or `unknown`
- **THEN** the row's action cell renders the Log in button, and activating it starts the OAuth popup login flow

#### Scenario: Revoked consent replaces the action with the red badge

- **WHEN** the gate reports `schedulerServiceConsent: 'signed_out'`
- **THEN** the row's action cell renders the red filled `Badge` with the localized "Limited access" text instead of any Log in or Log out button, whether `connected` is `true` or `false`

#### Scenario: Row without usable connect settings renders an empty action cell

- **WHEN** the row renders (the service is configured) but the check carried no usable `connect` object and `schedulerServiceConsent` is not `signed_out`
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

All user-visible strings on the Extensions tab (tab label, section heading, section description, column headers including the action column's `sr-only` label, service default name, service description, the limited-access badge label "Limited access", its bold tooltip title "Limited access." and its tooltip description "Contact your administrator for more details.", Log in/Log out button labels and accessible names, login in-flight label, login outcome messages, confirm title/description/failed message, success announcement) SHALL resolve via `useTranslation().t()` with keys under the settings namespace in `apps/chat/src/i18n/locales/en.json`, referenced through typed enum members in `apps/chat/src/constants/translation-keys.ts`. The tooltip title SHALL use `ExtensionsI18nKeys.ServiceLimitedAccessTooltipTitle` (`extensions.service.limitedAccessTooltipTitle`), independently of the Scheduled Tasks list-page banner title. Generic values that already exist (dialog Cancel, a generic "Log out" label, the login label `ButtonsI18nKeys.LogIn`) SHALL be reused from `ButtonsI18nKeys` rather than duplicated; the login flow's outcome messages reuse the banner's existing keys where the wording fits. The removed authorize-tooltip key `extensions.service.authorizeTooltip` is deleted from `en.json` and from `ExtensionsI18nKeys` in the same change, and the new `extensions.service.limitedAccessLabel`, `extensions.service.limitedAccessTooltipTitle`, and `extensions.service.limitedAccessTooltipDescription` keys are added with it.

#### Scenario: Keys are declared and generic values reused

- **WHEN** the Extensions tab renders
- **THEN** every string resolves from a declared i18n enum member whose value exists in `en.json`, no generic value already present in `en.json` is re-declared under a settings key, and no key remains that no longer has a rendered surface (the removed authorize tooltip)
### Requirement: Extensions section supports RTL and meets AAA accessibility defaults

The Extensions tab SHALL use logical Tailwind/CSS properties only (no physical-direction classes for directional layout) — including the warning badge's bottom-**inline-end** corner placement, which mirrors with the writing direction — and SHALL NOT mirror its symmetric icons (`IconPlugConnected`, `IconLogout`, the filled warning glyph) in RTL. The table SHALL stay keyboard-operable: both row action buttons are real focusable controls with localized accessible names, the avatar's warning glyph is decorative (`aria-hidden`) and its state is conveyed by the adjacent Log in or Limited access text, the confirm dialog traps focus while open, the visually empty action column header carries its `sr-only` localized label, and dynamic outcomes (successful login/revoke, failure, login retry outcomes) are announced through polite `aria-live` regions with no state communicated by color alone.

#### Scenario: RTL layout mirrors without icon mirroring

- **WHEN** the document direction is `rtl`
- **THEN** the table, rows, warning badge (at the bottom-inline-end corner), and dialog lay out mirrored via logical properties, and the icons are not mirrored

#### Scenario: Keyboard-only login and logout flows

- **WHEN** a keyboard-only user reaches the row's Log in or Log out button, opens the dialog, and confirms or cancels
- **THEN** every step is reachable and operable by keyboard, focus is trapped within the open dialog, the outcome is announced, and the warning state is readable through the adjacent text rather than a duplicate accessible name on the decorative glyph

### Requirement: Service avatar colour is pinned by the host

The Extensions row's avatar SHALL render with the colour pair supplied by the host app through `ExtensionServiceItem.avatarColor` (an `AVATAR_PALETTE` entry from `@epam/ai-dial-ui-kit`), forwarded through `InitialsAvatar`'s `color` prop — the app (`ExtensionsTab`) pins `AVATAR_PALETTE[AvatarColor.Violet1]` for the fixed Dial native service so its colour stays stable regardless of the localized display name. When the field is omitted, the avatar keeps the deterministic name-derived colour. The lib decides no colour of its own.

#### Scenario: The host-pinned colour reaches the avatar

- **WHEN** the Extensions tab renders the service row with `avatarColor: AVATAR_PALETTE[AvatarColor.Violet1]`
- **THEN** the avatar's background carries the palette entry's background class (`bg-violet-1`) and its initials the foreground class (`text-violet-2`)

#### Scenario: An omitted colour keeps the deterministic pick

- **WHEN** the row renders without `avatarColor`
- **THEN** the avatar's colour stays the deterministic pick derived from its `name`


