## REMOVED Requirements

### Requirement: Preference groups are supplied by the host

**Reason**: The mobile sheet that received the keyboard group is replaced by the drawer's user menu.

**Migration**: Replaced by "Preference groups are built by the app and passed by the sidebar".

## MODIFIED Requirements

### Requirement: Avatar trigger opens the dropdown

`UserMenu` SHALL render the kit `Button` carrying `aria-label={labels.trigger}` — the host passes `t('auth.signedInAs', { email })` — with `iconBefore` set to the `UserAvatar` and `tooltipProps={{ tooltip: profile.email, hideTooltip: isTooltipHidden }}`, so the email tooltip is attached to the button itself. The button SHALL open a `Dropdown` with `placement="top-end"` and `matchReferenceWidth={false}`. This is the `UserMenuTriggerVariant.Avatar` trigger, the default when `triggerVariant` is omitted.

`UserMenu` itself has no viewport logic. Placement is the host's: `SidebarNavigation` renders `UserMenu` as `NavigationSidebar`'s `userMenu` slot, in the desktop column and in the mobile drawer. A library host that composes `NavigationPanel` passes it as the rail's `footer`, and one that composes `NavigationSheet` uses the sheet's own profile page.

`UserMenu` SHALL additionally be suppressed by the host when `OverlayFeature.HideUserMenu` is enabled, or when the user is not authenticated.

i18n keys: `auth.signedInAs`, `auth.userAvatar`, `buttons.logOut`, `basic.settings`

#### Scenario: User menu is absent on mobile
- **WHEN** the viewport is mobile
- **THEN** the user menu is in the drawer's footer, so it is reachable only while the drawer is open (the scenario's name predates the drawer)

#### Scenario: Trigger names the signed-in user
- **WHEN** the navigation sidebar is rendered for an authenticated user
- **THEN** a button whose accessible name contains `t('auth.signedInAs', { email })` is present in its footer

### Requirement: Settings entry

When the host passes `onSettings`, `UserMenu` SHALL render a `settings` item with `IconSettings` (`DIAL_ICON_SIZE.SM`, `aria-hidden`, `stroke={DIAL_KIT_ICON_STROKE}`) and the label `labels.settings`, placed between the divider and Log out.

The host SHALL pass `onSettings` unless `OverlayFeature.HideSettingsPage` is enabled, and its handler SHALL open the Settings dialog (it no longer navigates to `ROUTES.Settings`). `labels.settings` (`t('basic.settings')`) is always passed. The same entry is offered in the desktop sidebar and the mobile drawer.

#### Scenario: Settings navigates to the settings route
- **GIVEN** `OverlayFeature.HideSettingsPage` is not enabled
- **WHEN** the user activates the Settings item
- **THEN** the Settings dialog opens (the scenario's name predates the dialog)

#### Scenario: Settings is hidden by the overlay feature
- **GIVEN** `OverlayFeature.HideSettingsPage` is enabled
- **WHEN** the dropdown is rendered
- **THEN** no Settings item appears

## ADDED Requirements

### Requirement: Profile and compact trigger variants

`UserMenu` SHALL accept `triggerVariant?: UserMenuTriggerVariant`. The string enum has the members `Avatar = 'avatar'` (default), `Profile = 'profile'` and `Compact = 'compact'`.

The `Profile` trigger SHALL render:
- the `UserAvatar`;
- `profile.displayName`, truncated with an ellipsis tooltip when it overflows;
- a chevron that points up while the dropdown is open and down otherwise. It is decorative and `aria-hidden`; the open state is exposed by the trigger's `aria-expanded`.

The `Compact` trigger SHALL render the `UserAvatar` alone in a 40px pill, without the 60px square wrapper of the `Avatar` trigger.

Both SHALL keep the email tooltip and dropdown items of the `Avatar` trigger, and open the dropdown with `placement="top-start"`. `Compact` SHALL keep `aria-label={labels.trigger}`. `Profile` SHALL carry no `aria-label`: its accessible name is the visible `profile.displayName` followed by `labels.trigger` as visually hidden text, and its avatar has an empty `alt`, so the name a voice-control user reads off the screen activates it (WCAG 2.5.3). `UserMenuTriggerVariant` SHALL be exported from `@epam/ai-dial-navigation-panel`.

**RTL:** the trigger lays out with logical properties, so the name follows the avatar in reading order. The chevron is vertical and is not mirrored.

#### Scenario: Expanded sidebar footer shows the user's name

- **WHEN** `UserMenu` renders with `triggerVariant={UserMenuTriggerVariant.Profile}` for a user whose display name is "Natalia Sudko"
- **THEN** the trigger shows the avatar and "Natalia Sudko", and its accessible name is "Natalia Sudko" followed by `t('auth.signedInAs', { email })`

#### Scenario: Collapsed sidebar footer shows the avatar alone

- **WHEN** `UserMenu` renders with `triggerVariant={UserMenuTriggerVariant.Compact}`
- **THEN** the trigger shows only the avatar, its accessible name is still `t('auth.signedInAs', { email })`, and the dropdown opens at the start edge

#### Scenario: Default trigger is unchanged

- **WHEN** `UserMenu` renders without `triggerVariant`
- **THEN** it renders the avatar-only trigger with `placement="top-end"`, exactly as before

### Requirement: Preference groups are built by the app and passed by the sidebar

The submenus in the dropdown SHALL NOT be built by `UserMenu`. `useNavigationMenuGroups`
(`apps/chat/src/hooks/navigation/useNavigationMenuGroups.tsx`) builds them as `NavigationMenuGroup`
values — `{ id, label, icon, options }`, each option carrying `{ id, label, isActive, onSelect }` —
and `SidebarNavigation` passes them to the menu.

`useNavigationMenuGroups` SHALL return two fields:

- `languageGroup?` (`id: 'language'`, `IconLanguage`, label `t('settings.language')`) — one option
  per entry of `SUPPORTED_LANGUAGES`, selecting one calls `changeLanguage(code)`. Built only when
  `SUPPORTED_LANGUAGES.length > 1` **and** `OverlayFeature.HideUserSettings` is off. `SidebarNavigation`
  passes it to the user menu at every width.
- `keyboardGroup?` (`id: 'keyboard-shortcuts'`, `IconKeyboard`) — the send-on-Enter picker for the
  **mobile drawer's menu**, suppressed by `OverlayFeature.HideUserSettings` or
  `OverlayFeature.HideKeyboardShortcuts`. `SidebarNavigation` passes `[languageGroup, keyboardGroup]`
  (those that exist) on a mobile viewport and `[languageGroup]` on desktop.

The locale picker is therefore offered on **two** surfaces — this menu and the Preferences fields —
while theme and "Default agent for new chats" are offered only in the Preferences fields. Both language surfaces
write through the same `useLanguage().changeLanguage`, so they cannot disagree; the duplication is
deliberate, so that a multi-locale deployment keeps the quick picker it has always had.

Since `SUPPORTED_LANGUAGES` holds one entry today, `languageGroup` is `undefined` in every shipping
build and the rendered menu is `identity → divider → Settings → Log out`. The field stays wired so
the group appears the moment a second locale is registered.

The `settingsPageEnabled` gating that briefly conditioned these fields is removed along with the
flag; neither field is gated on it.

The active option of a group SHALL be visually indicated from its `isActive` flag: in the
`UserMenu` dropdown each option is rendered with `mark: MenuItemMark.Check` and
`checked: option.isActive` (a trailing check announced as a radio item).

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

#### Scenario: The mobile drawer's menu has the keyboard group
- **WHEN** a signed-in user opens the `UserMenu` dropdown in the mobile drawer
- **THEN** a Keyboard shortcuts item is present with its two options

#### Scenario: The desktop menu has no keyboard group
- **WHEN** a signed-in user opens the `UserMenu` dropdown in the desktop sidebar
- **THEN** no Keyboard shortcuts item appears — the Preferences fields are its only surface there

#### Scenario: Selecting a shortcut option persists it
- **WHEN** the user activates a keyboard-shortcut option in the drawer's menu
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
  menu and the drawer's menu offers no Keyboard shortcuts item

#### Scenario: Hiding keyboard shortcuts leaves the language group alone
- **GIVEN** `OverlayFeature.HideKeyboardShortcuts` is enabled and two or more locales are registered
- **WHEN** navigation renders
- **THEN** `keyboardGroup` is `undefined` and `languageGroup` is still built
