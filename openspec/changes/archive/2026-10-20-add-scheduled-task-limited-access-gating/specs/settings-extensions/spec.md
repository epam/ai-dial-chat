# settings-extensions delta

## ADDED Requirements

### Requirement: Service avatar colour is pinned by the host

The Extensions row's avatar SHALL render with the colour pair supplied by the host app through `ExtensionServiceItem.avatarColor` (an `AVATAR_PALETTE` entry from `@epam/ai-dial-ui-kit`), forwarded through `InitialsAvatar`'s `color` prop — the app (`ExtensionsTab`) pins `AVATAR_PALETTE[AvatarColor.Violet1]` for the fixed Dial native service so its colour stays stable regardless of the localized display name. When the field is omitted, the avatar keeps the deterministic name-derived colour. The lib decides no colour of its own.

#### Scenario: The host-pinned colour reaches the avatar

- **WHEN** the Extensions tab renders the service row with `avatarColor: AVATAR_PALETTE[AvatarColor.Violet1]`
- **THEN** the avatar's background carries the palette entry's background class (`bg-violet-1`) and its initials the foreground class (`text-violet-2`)

#### Scenario: An omitted colour keeps the deterministic pick

- **WHEN** the row renders without `avatarColor`
- **THEN** the avatar's colour stays the deterministic pick derived from its `name`

---

## MODIFIED Requirements

### Requirement: Disconnected row shows a warning badge on the avatar

While the last resolved gate state is disconnected (`available: true && connected: false`) **and** `schedulerServiceConsent` is not `signed_out`, the row's Name cell SHALL render a small warning badge overlaid at the avatar's bottom-**inline-end** corner (a relatively-positioned avatar wrapper with an absolutely-positioned badge), using the login banner's warning glyph (`IconAlertTriangleFilled`) in a warning color. The badge SHALL also render while `schedulerServiceConsent` is `signed_out` (regardless of the login state — consent is evaluated before the login state), where it is joined by the red limited-access badge on the action side (see the "Row action switches between Log in and Log out with the connection state" requirement). The badge SHALL NOT render while the row reports connected with a consent that is not `signed_out`, while the check is in flight, or on check error (no state asserted).

The badge is informational, not an affordance, and carries **no tooltip in any state** — the previously shown localized "Authorize to use this extension" tooltip on the disconnected state is removed by product decision (the row's Log in button already carries the state), and under `signed_out` the same warning glyph also renders without a tooltip. Neither state SHALL be communicated by color alone: the avatar's warning glyph is decorative (its svg is `aria-hidden`; it carries no accessible name, because the state is carried by adjacent text — the Log in button's label while logged out, the red Badge's own label text under `signed_out`), and the red limited-access `Badge` (`BadgeVariant.Filled`, `BadgeColor.Red`) that replaces the action under `signed_out` renders the localized "Limited access" text as its own accessible name. While `schedulerServiceConsent` is `signed_out`, the Badge's hover tooltip renders two lines: the **bold** localized "Limited access." title (reusing the banner-title key `scheduledTasks.limitedAccessBanner.title` in `apps/chat/src/i18n/locales/en.json`, declared via `ScheduledTasksI18nKeys`) and the **normal-weight** localized description "Contact your administrator for more details." (key `extensions.service.limitedAccessTooltipDescription`, declared via `ExtensionsI18nKeys`) below it — the tooltip content is a composed ReactNode inside the kit `Tooltip`'s `tooltip` prop. The tooltip opens on hover only — the badge is not a focusable control — with the tooltip's own trigger carrying the badge position so the hover reference has the badge's real size.

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

### Requirement: Extensions strings flow through react-i18next

All user-visible strings on the Extensions tab (tab label, section heading, section description, column headers including the action column's `sr-only` label, service default name, service description, the limited-access badge label "Limited access", its bold tooltip title "Limited access." and its tooltip description "Contact your administrator for more details.", Log in/Log out button labels and accessible names, login in-flight label, login outcome messages, confirm title/description/failed message, success announcement) SHALL resolve via `useTranslation().t()` with keys under the settings namespace in `apps/chat/src/i18n/locales/en.json`, referenced through typed enum members in `apps/chat/src/constants/translation-keys.ts`, except the tooltip title, which reuses `ScheduledTasksI18nKeys.LimitedAccessBannerTitle` (`scheduledTasks.limitedAccessBanner.title`) because its value is the exact same string (the app already imports `ScheduledTasksI18nKeys` on this tab). Generic values that already exist (dialog Cancel, a generic "Log out" label, the login label `ButtonsI18nKeys.LogIn`) SHALL be reused from `ButtonsI18nKeys` rather than duplicated; the login flow's outcome messages reuse the banner's existing keys where the wording fits. The removed authorize-tooltip key `extensions.service.authorizeTooltip` is deleted from `en.json` and from `ExtensionsI18nKeys` in the same change, and the new `extensions.service.limitedAccessLabel` and `extensions.service.limitedAccessTooltipDescription` keys are added with it.

#### Scenario: Keys are declared and generic values reused

- **WHEN** the Extensions tab renders
- **THEN** every string resolves from a declared i18n enum member whose value exists in `en.json`, no generic value already present in `en.json` is re-declared under a settings key, and no key remains that no longer has a rendered surface (the removed authorize tooltip)
