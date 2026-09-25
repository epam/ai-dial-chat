## MODIFIED Requirements

### Requirement: Settings page route and lazy loading

The system SHALL register two routes in `apps/chat/src/app/app.tsx`, both rendering the lazily-loaded
`SettingsPage` component wrapped in `RouteErrorBoundary` and `Suspense` with a `RouteFallback`,
following the existing `ScheduledTasksPage` route registration pattern:

- `ROUTES.SettingsTab` (`/settings/:tab`) — the canonical location of a settings tab. The segment is
  the tab's `SettingsTabs` value, which is already URL-shaped.
- `ROUTES.Settings` (`/settings`) — retained so existing links and bookmarks keep resolving, and
  rendering `<Navigate replace />` to the default tab's path rather than a tab of its own, so each
  tab has exactly one canonical URL.

A single dynamic segment SHALL be used rather than one registered route per tab, so that adding a
tab stays a matter of an enum member and a config entry alone.

`apps/chat/src/types/routes.ts` SHALL gain `SettingsTab` as a route **pattern**, matching the
existing `ScheduledTaskDetail = '/scheduled-tasks/:scheduleId'` precedent, and SHALL NOT gain one
member per tab. The concrete path SHALL be built by `getSettingsTabRoute` in
`apps/chat/src/constants/routes.ts`, beside the other route builders and following their
`` `${ROUTES.Parent}/${segment}` `` shape, so no call site substitutes into the `:tab` pattern
itself.

Both registrations SHALL be generated from one gated expression in
`apps/chat/src/app/settings-routes.tsx`, which `app.tsx` spreads into its `<Routes>` and which owns
the lazy `SettingsPage` import. Generating them together is what makes a settings path that bypasses
the gate structurally impossible, and it gives the gate a test seam: `app.tsx` itself has no route
test, and mounting it would drag in its whole provider tree.

No **environment** configuration redirects these routes away; that guard was removed along with the
`isSettingsPageEnabled` flag. The host-driven overlay toggle is a separate axis and does gate them:
when `OverlayFeature.HideSettingsPage` resolves to `true`, **both** routes' `element` SHALL instead
render `<Navigate to={ROUTES.Root} replace />`, so that neither `SettingsPage` nor its lazy chunk
ever mounts through any settings path while the host hides the page.

#### Scenario: Direct navigation to a tab path

- **WHEN** a signed-in user navigates directly to `/settings/usage` (e.g. via URL bar or bookmark)
  and the host does not hide the Settings page
- **THEN** the `SettingsPage` component loads (showing `RouteFallback` while its chunk downloads) and
  renders with the Usage tab active

#### Scenario: Direct navigation to /settings

- **WHEN** a signed-in user navigates directly to `/settings` and the host does not hide the
  Settings page
- **THEN** the application redirects, replacing history, to the default tab's path

#### Scenario: No environment configuration redirects the routes away

- **WHEN** any combination of environment configuration is applied and a signed-in user opens
  `/settings` or `/settings/usage`
- **THEN** the page renders — no redirect to `ROUTES.Root` occurs on that account

#### Scenario: The host hides the Settings page

- **WHEN** `OverlayFeature.HideSettingsPage` resolves to `true` and a signed-in user navigates
  directly to `/settings` or to `/settings/usage`
- **THEN** the application redirects (replacing history) to `ROUTES.Root` and `SettingsPage` is not
  rendered

#### Scenario: Reload keeps the tab

- **WHEN** a user on `/settings/usage` reloads the page
- **THEN** Settings reopens with the Usage tab active

---

### Requirement: Extensible tab container

`SettingsPage` SHALL render its sub-pages through a `SettingsTabs` enum, an associated tab-config
hook (`useSettingsTabConfig`), and the presentational `SettingsPanel` component from
`@epam/ai-dial-settings-panel` (a vertical icon + label list). Each tab entry declares an id, an
i18n label key, an icon, and the component to render.

**The active tab SHALL be read from the route, not from component state.** `SettingsPage` SHALL
resolve the `:tab` segment against the ids `useSettingsTabConfig` actually returned — not against
the enum, since a tab may exist in the enum while its config entry is withheld — and SHALL hold no
`useState` for the selection, so the URL is the single source of truth and needs no synchronising
effect.

Selecting a tab SHALL navigate to that tab's path with a normal history push, so the browser's Back
button returns to the previously selected tab.

A `:tab` segment naming no configured tab SHALL redirect, replacing history, to the default tab's
path rather than rendering an empty pane. The default tab SHALL be the first entry the config
returns, never a hardcoded member, so the config keeps sole ownership of tab order. When the config
returns no tabs at all, the page SHALL render its empty state rather than navigating.

Adding a future tab SHALL require only a new enum member and a new config entry, with no changes to
`SettingsPage`'s rendering logic and no new route registration. The `SettingsPanel` component itself
supports per-item `disabled` rows as a general capability (see `settings-panel-lib`), even though no
current tab entry uses it.

#### Scenario: The route decides which tab renders

- **WHEN** `SettingsPage` renders at `/settings/usage`
- **THEN** the Usage row is selected and the Usage component is rendered

#### Scenario: Selecting a tab changes the URL

- **WHEN** the user selects a different tab
- **THEN** the address bar shows that tab's path, and Back returns to the previous tab rather than
  leaving Settings

#### Scenario: An unknown segment redirects instead of rendering nothing

- **WHEN** the user navigates to `/settings/does-not-exist`
- **THEN** the application redirects, replacing history, to the default tab's path

#### Scenario: A withheld tab redirects

- **WHEN** the `:tab` segment names an enum member whose config entry is absent
- **THEN** the application redirects to the default tab's path rather than rendering an empty pane

#### Scenario: Panel is keyboard- and screen-reader-navigable

- **WHEN** the tab container renders
- **THEN** it delegates to `SettingsPanel`'s vertical ARIA tablist behavior (`role="tablist"`,
  `aria-orientation="vertical"`, `role="tab"` + `aria-selected` per row)

#### Scenario: Every tab id survives the round trip to a path

- **WHEN** each `SettingsTabs` member is turned into a path and resolved back
- **THEN** the original member is recovered, which fails the moment a member is not URL-safe
