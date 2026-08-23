## MODIFIED Requirements

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
