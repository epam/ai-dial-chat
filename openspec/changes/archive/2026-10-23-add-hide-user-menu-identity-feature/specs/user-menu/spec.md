## MODIFIED Requirements

### Requirement: Menu item order

`UserMenu` SHALL assemble its dropdown items in exactly this order:

1. `identity` — a `DropdownItemType.PlainText` row (see below), present unless the host passes
   `isIdentityHidden`.
2. One item per entry of `groups` whose `options` array is non-empty, in the order given, each
   rendered as a submenu via `DropdownItem.children`.
3. `divider-1` — a single `DropdownItemType.Divider`, present only when at least one item (the
   identity row or a group) precedes it.
4. `settings` — present only when the host passes `onSettings`.
5. `logout` — always present, last.

There is at most **one** divider, and it sits **after** the preference groups, separating them from
Settings and Log out. The dropdown SHALL NOT open on a divider. A group whose `options` array is
empty is dropped entirely, so a host that supplies no groups yields
`identity → divider → [settings] → logout`. A host that also passes `isIdentityHidden` yields
`[settings] → logout`.

`Navigation` passes `groups={languageGroup ? [languageGroup] : undefined}` — `undefined` in every
shipping build, since only one locale ships — and passes `onSettings` unless
`OverlayFeature.HideSettingsPage` is enabled, so the rendered menu is
`identity → divider → Settings → Log out` (or `identity → divider → Log out` when the overlay hides
the settings page). With `OverlayFeature.HideUserMenuIdentity` enabled it is `Settings → Log out`
(or `Log out` alone).

#### Scenario: Desktop order in this app
- **WHEN** a signed-in user opens the dropdown
- **THEN** the items are, in order: identity header, a divider, Settings, Log out

#### Scenario: Empty groups are dropped
- **GIVEN** a group is supplied whose `options` array is empty
- **WHEN** the dropdown is rendered
- **THEN** no item is rendered for that group

#### Scenario: Settings is omitted when the host offers no handler
- **GIVEN** a host passes no `onSettings`
- **WHEN** the dropdown is rendered
- **THEN** no Settings item appears and Log out immediately follows the divider

#### Scenario: Hidden identity with no groups drops the divider
- **GIVEN** a host passes `isIdentityHidden` and no non-empty group
- **WHEN** the dropdown is rendered
- **THEN** the items are, in order: Settings (when `onSettings` is passed), Log out, with no divider

#### Scenario: Hidden identity with groups keeps the divider
- **GIVEN** a host passes `isIdentityHidden` and one non-empty group
- **WHEN** the dropdown is rendered
- **THEN** the items are, in order: the group's submenu, a divider, Settings (when `onSettings` is passed), Log out

---

### Requirement: User identity header

Unless the host passes `isIdentityHidden`, the first item SHALL be a non-interactive `DropdownItemType.PlainText` row showing `AvatarInitials` built from `profile.shortName` alongside `profile.displayName` rendered through `EllipsisTooltip`, so an over-long name truncates and reveals itself on hover.

`UserMenuProps` SHALL accept `isIdentityHidden?: boolean`, defaulting to `false`. When it is `true`, the identity row SHALL NOT be rendered. The trigger is unaffected: it keeps its avatar, its `Profile` display name, its email tooltip and its accessible name. `UserMenu` does not read overlay features itself. `SidebarNavigation` passes `isIdentityHidden` as `useUiFeature(OverlayFeature.HideUserMenuIdentity)`, in the desktop column and in the mobile drawer.

#### Scenario: Identity header is not actionable
- **WHEN** the dropdown is open
- **THEN** its first row shows the avatar and display name as plain text
- **AND** the row is not focusable and activating it neither closes the menu nor triggers an action

#### Scenario: Display name truncates with tooltip
- **WHEN** the user's display name is too long to fit on one line
- **THEN** the name is truncated with an ellipsis and a tooltip shows the full name on hover

#### Scenario: The host hides the identity header
- **GIVEN** `UserMenu` renders with `isIdentityHidden`
- **WHEN** the dropdown is open
- **THEN** no row shows the avatar initials or the display name
- **AND** the trigger still shows the avatar (and, for `UserMenuTriggerVariant.Profile`, the display name) and keeps its accessible name
