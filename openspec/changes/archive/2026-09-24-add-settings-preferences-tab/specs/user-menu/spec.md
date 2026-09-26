## MODIFIED Requirements

### Requirement: Preference groups are supplied by the host

The submenus in the dropdown SHALL NOT be built by `UserMenu`. `useNavigationMenuGroups`
(`apps/chat/src/hooks/navigation/useNavigationMenuGroups.tsx`) builds them as `NavigationMenuGroup`
values — `{ id, label, icon, options }`, each option carrying `{ id, label, isActive, onSelect }` —
and `Navigation` passes them to the surface that needs them.

`useNavigationMenuGroups` SHALL return two fields:

- `languageGroup?` (`id: 'language'`, `IconLanguage`, label `t('settings.language')`) — one option
  per entry of `SUPPORTED_LANGUAGES`, selecting one calls `changeLanguage(code)`. Built only when
  `SUPPORTED_LANGUAGES.length > 1` **and** `OverlayFeature.HideUserSettings` is off. `Navigation`
  passes it to the desktop `UserMenu`.
- `keyboardGroup?` (`id: 'keyboard-shortcuts'`, `IconKeyboard`) — the send-on-Enter picker for the
  **mobile `NavigationSheet`**, suppressed by `OverlayFeature.HideUserSettings` or
  `OverlayFeature.HideKeyboardShortcuts`. The sheet keeps it because it has no Settings entry point
  of its own (`Navigation` passes it no `onSettings`), so dropping it would leave mobile users
  unable to change the shortcut at all.

The locale picker is therefore offered on **two** surfaces — this menu and the Preferences tab —
while theme and "Default agent for new chats" are offered only in the Preferences tab. Both language surfaces
write through the same `useLanguage().changeLanguage`, so they cannot disagree; the duplication is
deliberate, so that a multi-locale deployment keeps the quick picker it has always had.

Since `SUPPORTED_LANGUAGES` holds one entry today, `languageGroup` is `undefined` in every shipping
build and the rendered menu is `identity → divider → Settings → Log out`. The field stays wired so
the group appears the moment a second locale is registered.

The `settingsPageEnabled` gating that briefly conditioned these fields is removed along with the
flag; neither field is gated on it.

The active option in the remaining group SHALL be visually indicated through `MenuItemLabel`'s
`isActive`.

i18n keys: `settings.language`, `settings.keyboardShortcuts`, `settings.shortcutEnter`,
`settings.shortcutMetaEnter`

#### Scenario: The user menu offers no submenus while one locale ships
- **GIVEN** `SUPPORTED_LANGUAGES` holds a single entry — the shipping state
- **WHEN** a signed-in user opens the `UserMenu` dropdown
- **THEN** no Language, Keyboard shortcuts, or Theme item appears, and the items are
  `identity → divider → Settings → Log out`

#### Scenario: The user menu offers the language group once a second locale is registered
- **GIVEN** `SUPPORTED_LANGUAGES` holds two or more entries
- **WHEN** a signed-in user opens the `UserMenu` dropdown
- **THEN** a Language item appears above the divider, with one option per entry

#### Scenario: The mobile sheet keeps the keyboard group
- **WHEN** the mobile `NavigationSheet` is opened and the user enters its profile page
- **THEN** a Keyboard shortcuts item is present with its two options

#### Scenario: The keyboard group is not offered in the user menu
- **WHEN** a signed-in user opens the `UserMenu` dropdown
- **THEN** no Keyboard shortcuts item appears — the Preferences tab and the mobile sheet are its
  only surfaces

#### Scenario: Selecting a shortcut option persists it
- **WHEN** the user activates a keyboard-shortcut option in the sheet
- **THEN** `setPreference` is called with the corresponding `SendOnEnter` value and the chat input
  reflects the new shortcut immediately

#### Scenario: Platform-aware modifier key label
- **WHEN** the user is on macOS
- **THEN** the meta option's label interpolates the Command symbol as its modifier
- **WHEN** the user is on Windows or Linux
- **THEN** it interpolates `Ctrl`

#### Scenario: Hiding user settings removes both groups
- **GIVEN** `OverlayFeature.HideUserSettings` is enabled
- **WHEN** navigation renders
- **THEN** both `languageGroup` and `keyboardGroup` are `undefined`; no Language item appears in the
  menu and the sheet offers no Keyboard shortcuts item

#### Scenario: Hiding keyboard shortcuts leaves the language group alone
- **GIVEN** `OverlayFeature.HideKeyboardShortcuts` is enabled and two or more locales are registered
- **WHEN** navigation renders
- **THEN** `keyboardGroup` is `undefined` and `languageGroup` is still built

---

### Requirement: Menu item order

`UserMenu` SHALL assemble its dropdown items in exactly this order:

1. `identity` — a `DropdownItemType.PlainText` row (see below).
2. One item per entry of `groups` whose `options` array is non-empty, in the order given, each
   rendered as a submenu via `DropdownItem.children`.
3. `divider-1` — a single `DropdownItemType.Divider`.
4. `settings` — present only when the host passes `onSettings`.
5. `logout` — always present, last.

There is exactly **one** divider, and it sits **after** the preference groups, separating them from
Settings and Log out. A group whose `options` array is empty is dropped entirely, so a host that
supplies no groups yields `identity → divider → [settings] → logout`.

That no-groups shape is the **only** shape this app produces: `Navigation` supplies no groups and
always supplies `onSettings`, so the rendered menu is always
`identity → divider → Settings → Log out`. `UserMenu` itself is unchanged — it still supports hosts
that pass groups or omit `onSettings`; this app simply exercises neither branch.

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

---

### Requirement: Theme selection is not offered in the user menu

No Theme group SHALL be built. The `TODO` in `useNavigationMenuGroups` that recorded the intent to
reinstate one from `useThemeOptions` SHALL be **deleted**: the intent is discharged elsewhere, by the
theme selector in the Settings page's Preferences tab (`settings-preferences-tab`), which is
`useThemeOptions`' first call site.

The user menu SHALL NOT render a Theme item. `ThemeContext`'s resolved-versus-stored-preference
behaviour continues to be specified by the theming documentation rather than here.

#### Scenario: No Theme item is present
- **WHEN** the dropdown is rendered
- **THEN** no Theme item appears

#### Scenario: The reinstatement TODO no longer exists
- **WHEN** `useNavigationMenuGroups.tsx` is read
- **THEN** it carries no `TODO` about building a theme group, because `useThemeOptions` now has a
  real consumer
