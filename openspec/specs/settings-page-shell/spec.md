# settings-page-shell Specification

## Purpose

Defines the Settings page shell: the entry point in the `UserMenu` dropdown, the `/settings` route
and its lazy loading, the extensible tab container that hosts settings sub-pages, and the RTL/i18n
contract for the shell.

## Requirements

### Requirement: Settings entry point
The system SHALL provide a "Settings" item, marked with the `IconSettings` icon from
`@tabler/icons-react`, inside the existing `UserMenu` dropdown
(`apps/chat/src/components/Navigation/UserMenu.tsx`). Selecting it SHALL navigate to `ROUTES.SETTINGS`
(`/settings`) via `useNavigate()`. The item's accessible name SHALL come from an i18n key (not a
hardcoded string).

The item SHALL only be included in the `UserMenu` items list when the `SettingsPageEnabled` feature
flag (`useFeatureFlag('settingsPageEnabled')`) resolves to `true`. When the flag is `false` (its
default), the item SHALL be omitted from the rendered menu entirely — not rendered disabled or
hidden via CSS.

#### Scenario: Opening Settings from the user menu
- **WHEN** a signed-in user opens the `UserMenu` dropdown and clicks/activates the "Settings" item
- **THEN** the application navigates to `/settings` and renders the Settings page shell

#### Scenario: Keyboard activation
- **WHEN** a keyboard-only user tabs to the "Settings" item inside the open `UserMenu` and presses
  Enter or Space
- **THEN** the application navigates to `/settings`, identically to a mouse click

#### Scenario: Gear icon hidden when the feature flag is disabled
- **WHEN** `SettingsPageEnabled` resolves to `false` and a signed-in user opens the `UserMenu`
  dropdown
- **THEN** no "Settings" item (gear icon) is present in the rendered menu

#### Scenario: Gear icon shown when the feature flag is enabled
- **WHEN** `SettingsPageEnabled` resolves to `true` and a signed-in user opens the `UserMenu`
  dropdown
- **THEN** the "Settings" item is present, in the same position as before this change

---

### Requirement: Settings page route and lazy loading
The system SHALL register a `/settings` route in `apps/chat/src/app/app.tsx` rendering a lazily-loaded
`SettingsPage` component, wrapped in `RouteErrorBoundary` and `Suspense` with a `RouteFallback`,
following the existing `ScheduledTasksPage` route registration pattern.

When the `SettingsPageEnabled` feature flag resolves to `false`, the route's `element` SHALL instead
render `<Navigate to={ROUTES.Root} replace />`, matching the existing `FileManager` route-gating
pattern, so that neither `SettingsPage` nor its lazy chunk ever mounts while the feature is disabled.

#### Scenario: Direct navigation to /settings with the feature enabled
- **WHEN** `SettingsPageEnabled` resolves to `true` and a signed-in user navigates directly to
  `/settings` (e.g. via URL bar or bookmark)
- **THEN** the `SettingsPage` component loads (showing `RouteFallback` while its chunk downloads) and
  renders without error

#### Scenario: Direct navigation to /settings with the feature disabled
- **WHEN** `SettingsPageEnabled` resolves to `false` and a signed-in user navigates directly to
  `/settings` (e.g. via URL bar or bookmark)
- **THEN** the application redirects (replacing history) to `ROUTES.Root` and `SettingsPage` is not
  rendered

---

### Requirement: Extensible tab container
`SettingsPage` SHALL render its sub-pages through a `SettingsTabs` enum, an associated tab-config
hook (`useSettingsTabConfig`), and the presentational `SettingsPanel` component from
`@epam/ai-dial-settings-panel` (a vertical icon + label list, replacing the earlier horizontal
`Tabs` (2.0) placeholder). Each tab entry declares an id, an i18n label key, an icon, and the
component to render. The enum SHALL contain exactly one member, `Usage`, unchanged from before
this change — `General` and `Preferences` were evaluated as placeholder rows during this change
but were removed entirely (no enum member, no config entry, no i18n keys) before shipping, since
only `Usage` is available. Adding a future tab SHALL require only a new enum member and a new
config entry, with no changes to `SettingsPage`'s rendering logic or to the `/settings` route
registration. The `SettingsPanel` component itself supports per-item `disabled` rows as a general
capability (see `settings-panel-lib`), even though no current tab entry uses it.

#### Scenario: Only the Usage tab is visible today
- **WHEN** `SettingsPage` renders
- **THEN** the panel shows exactly one row, `Usage`, labeled via an i18n key, and it is selected by
  default

#### Scenario: Panel is keyboard- and screen-reader-navigable
- **WHEN** the tab container renders
- **THEN** it delegates to `SettingsPanel`'s vertical ARIA tablist behavior (`role="tablist"`,
  `aria-orientation="vertical"`, `role="tab"` + `aria-selected` per row)

---

### Requirement: RTL and localization compliance for the Settings shell
All layout in `SettingsPage` and its tab container SHALL use CSS logical properties / Tailwind logical
utilities (e.g. `ps-*`, `pe-*`, `text-start`) instead of physical-direction utilities, and all
user-visible strings SHALL go through `react-i18next` under a `settingsPage` namespace distinct from
the existing `settings` namespace owned by `UserMenu`.

#### Scenario: Rendering under an RTL locale
- **WHEN** the active language is Arabic (`dir="rtl"` on `<html>`)
- **THEN** the Settings page shell and tab container lay out mirrored correctly with no visual
  breakage, using only logical-property-driven styles
