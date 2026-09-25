## MODIFIED Requirements

### Requirement: Settings entry point
The system SHALL provide a "Settings" item, marked with the `IconSettings` icon from
`@tabler/icons-react`, inside the existing `UserMenu` dropdown
(`libs/navigation-panel/src/components/UserMenu/UserMenu.tsx`, driven by the host's `onSettings`
and `labels.settings` props from `apps/chat/src/components/Navigation/Navigation.tsx`). Selecting
it SHALL navigate to `ROUTES.Settings` (`/settings`) via `useNavigate()`. The item's accessible
name SHALL come from an i18n key (not a hardcoded string).

The item SHALL be included unconditionally for every authenticated user. The `SettingsPageEnabled`
feature flag that previously gated it is **removed** — there is no flag, no `SETTINGS_PAGE_ENABLED`
environment variable, and no `features.settingsPageEnabled` config-registry entry. The host SHALL
always pass `onSettings` and `labels.settings`, so `UserMenu`'s existing "omit the item when the
host passes no `onSettings`" behaviour is never exercised by this app.

`UserMenu` remains suppressed as a whole by `OverlayFeature.HideUserMenu` and for unauthenticated
users; those are unrelated to the removed flag.

#### Scenario: Opening Settings from the user menu
- **WHEN** a signed-in user opens the `UserMenu` dropdown and clicks/activates the "Settings" item
- **THEN** the application navigates to `/settings` and renders the Settings page shell

#### Scenario: Keyboard activation
- **WHEN** a keyboard-only user tabs to the "Settings" item inside the open `UserMenu` and presses
  Enter or Space
- **THEN** the application navigates to `/settings`, identically to a mouse click

#### Scenario: Gear icon is always present for an authenticated user
- **WHEN** a signed-in user opens the `UserMenu` dropdown in any deployment
- **THEN** the "Settings" item is present — no configuration can remove it

---

### Requirement: Settings page route and lazy loading
The system SHALL register a `/settings` route in `apps/chat/src/app/app.tsx` rendering a lazily-loaded
`SettingsPage` component, wrapped in `RouteErrorBoundary` and `Suspense` with a `RouteFallback`,
following the existing `ScheduledTasksPage` route registration pattern.

The route SHALL render `SettingsPage` unconditionally. The previous
`isSettingsPageEnabled ? <SettingsPage/> : <Navigate to={ROUTES.Root} replace />` guard is
**removed** along with the flag, so a direct `/settings` URL always resolves to the page.

#### Scenario: Direct navigation to /settings
- **WHEN** a signed-in user navigates directly to `/settings` (e.g. via URL bar or bookmark)
- **THEN** the `SettingsPage` component loads (showing `RouteFallback` while its chunk downloads) and
  renders without error

#### Scenario: No configuration redirects the route away
- **WHEN** any combination of environment configuration is applied and a signed-in user opens
  `/settings`
- **THEN** the page renders — no redirect to `ROUTES.Root` occurs

---

### Requirement: Extensible tab container
`SettingsPage` SHALL render its sub-pages through a `SettingsTabs` enum, an associated tab-config
hook (`useSettingsTabConfig`), and the presentational `SettingsPanel` component from
`@epam/ai-dial-settings-panel` (a vertical icon + label list, replacing the earlier horizontal
`Tabs` (2.0) placeholder). Each tab entry declares an id, an i18n label key, an icon, and the
component to render. The enum SHALL contain exactly two members, `Preferences` and `Usage`, in that
order, and `useSettingsTabConfig`'s `entries` array SHALL list them in the same order — the rail
renders `Preferences` above `Usage`. `SettingsPage`'s `useState` initial value SHALL be
`SettingsTabs.Preferences`, matching the first entry, so the selected row on mount is the top one.

A consequence worth stating: `UsageTab` no longer mounts on arrival at `/settings`, so
`GET /api/v1/user/usage` is not requested until the user opens the `Usage` row.

`General` was evaluated as a placeholder row during the shell's introduction and was removed
entirely (no enum member, no config entry, no i18n keys); `Preferences` was removed at that time for
the same reason and is reinstated by `settings-preferences-tab`, which owns the requirements for the
tab's own content. Adding a further tab SHALL require only a new enum member and a new config entry,
with no changes to `SettingsPage`'s rendering logic or to the `/settings` route registration. The
`SettingsPanel` component itself supports per-item `disabled` rows as a general capability (see
`settings-panel-lib`), even though no current tab entry uses it.

With two entries in the list, `SettingsPanel`'s `isVisuallyActive = isActive && items.length > 1`
guard (`libs/settings-panel/src/components/SettingsPanel/SettingsPanel.tsx:120`) resolves `true` for
the selected row, so the rail renders an active-row highlight. This is pre-existing lib behaviour
that no shipping build exercised while only `Usage` existed; it requires no change to
`libs/settings-panel`.

#### Scenario: Preferences and Usage are the visible tabs
- **WHEN** `SettingsPage` renders
- **THEN** the panel shows exactly two rows, `Preferences` then `Usage`, each labeled via an i18n
  key, and `Preferences` is selected by default

#### Scenario: The Preferences pane is rendered on arrival
- **WHEN** a user opens `/settings`
- **THEN** the right-hand pane renders `PreferencesTab`, and no request is made to
  `GET /api/v1/user/usage`

#### Scenario: Opening Usage renders its pane and fetches its data
- **WHEN** the user activates the `Usage` row
- **THEN** `UsageTab` mounts and `GET /api/v1/user/usage` is requested

#### Scenario: Selected row is visually highlighted
- **WHEN** the panel renders its two rows
- **THEN** the selected row is visually highlighted, because `items.length > 1` satisfies
  `SettingsPanel`'s `isVisuallyActive` guard

#### Scenario: Panel is keyboard- and screen-reader-navigable
- **WHEN** the tab container renders
- **THEN** it delegates to `SettingsPanel`'s vertical ARIA tablist behavior (`role="tablist"`,
  `aria-orientation="vertical"`, `role="tab"` + `aria-selected` per row)

#### Scenario: Arrow keys move between the two tabs
- **WHEN** the user focuses the `Usage` row and presses `ArrowDown`
- **THEN** focus and selection move to the `Preferences` row and the pane renders `PreferencesTab`
