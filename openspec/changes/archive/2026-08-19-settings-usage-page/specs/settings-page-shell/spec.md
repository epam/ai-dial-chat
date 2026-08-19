## ADDED Requirements

### Requirement: Settings entry point
The system SHALL provide a "Settings" item, marked with the `IconSettings` icon from
`@tabler/icons-react`, inside the existing `UserMenu` dropdown
(`apps/chat/src/components/Navigation/UserMenu.tsx`). Selecting it SHALL navigate to `ROUTES.SETTINGS`
(`/settings`) via `useNavigate()`. The item's accessible name SHALL come from an i18n key (not a
hardcoded string).

#### Scenario: Opening Settings from the user menu
- **WHEN** a signed-in user opens the `UserMenu` dropdown and clicks/activates the "Settings" item
- **THEN** the application navigates to `/settings` and renders the Settings page shell

#### Scenario: Keyboard activation
- **WHEN** a keyboard-only user tabs to the "Settings" item inside the open `UserMenu` and presses
  Enter or Space
- **THEN** the application navigates to `/settings`, identically to a mouse click

### Requirement: Settings page route and lazy loading
The system SHALL register a `/settings` route in `apps/chat/src/app/app.tsx` rendering a lazily-loaded
`SettingsPage` component, wrapped in `RouteErrorBoundary` and `Suspense` with a `RouteFallback`,
following the existing `ScheduledTasksPage` route registration pattern.

#### Scenario: Direct navigation to /settings
- **WHEN** a signed-in user navigates directly to `/settings` (e.g. via URL bar or bookmark)
- **THEN** the `SettingsPage` component loads (showing `RouteFallback` while its chunk downloads) and
  renders without error

### Requirement: Extensible tab container
`SettingsPage` SHALL render its sub-pages through a `SettingsTabs` enum and an associated tab-config
hook (analogous to `DialFileManagerTabs` / `useDialFileManagerTabConfig` in
`apps/chat/src/pages/DialFileManagerPage/DialFileManagerPage.tsx`), where each tab entry declares an
id, an i18n label key, and the component to render. The enum SHALL contain exactly one member, `Usage`,
for this change. Adding a future tab SHALL require only a new enum member and a new config entry, with
no changes to `SettingsPage`'s rendering logic or to the `/settings` route registration.

#### Scenario: Only the Usage tab is visible today
- **WHEN** `SettingsPage` renders
- **THEN** the tab list shows exactly one tab, labeled via an i18n key, and it is selected by default

#### Scenario: Tab list is keyboard- and screen-reader-navigable
- **WHEN** the tab container renders
- **THEN** it exposes `role="tablist"` on the tab list and `role="tab"` with `aria-selected` on each
  tab (or an equivalent ARIA-compliant pattern already implemented by the `@epam/ai-dial-ui-kit` `Tabs`
  component, if used)

### Requirement: RTL and localization compliance for the Settings shell
All layout in `SettingsPage` and its tab container SHALL use CSS logical properties / Tailwind logical
utilities (e.g. `ps-*`, `pe-*`, `text-start`) instead of physical-direction utilities, and all
user-visible strings SHALL go through `react-i18next` under a `settingsPage` namespace distinct from
the existing `settings` namespace owned by `UserMenu`.

#### Scenario: Rendering under an RTL locale
- **WHEN** the active language is Arabic (`dir="rtl"` on `<html>`)
- **THEN** the Settings page shell and tab container lay out mirrored correctly with no visual
  breakage, using only logical-property-driven styles
