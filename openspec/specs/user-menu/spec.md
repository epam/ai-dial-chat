# User Menu

## Purpose

The avatar dropdown pinned to the bottom of the desktop navigation rail: the identity header, the single-select preference submenus the host supplies, the Settings entry, and Log out.

## Overview

`UserMenu` (`libs/navigation-panel/src/components/UserMenu/UserMenu.tsx`) is a presentational library component. It renders an avatar trigger and a dropdown assembled from three inputs the host passes: `profile`, a `groups` array of single-select preference submenus, and the `onSettings` / `onLogout` callbacks. The library owns the menu's order and dividers; the host (`apps/chat/src/components/Navigation/Navigation.tsx`) owns which groups exist, whether Settings is offered, and every label.

A Logout confirmation dialog guards the logout action.

---

## Requirements

### Requirement: Avatar trigger opens the dropdown

`UserMenu` SHALL render the kit `Button` carrying `aria-label={labels.trigger}` — the host passes `t('auth.signedInAs', { email })` — with `iconBefore` set to the `UserAvatar` and `tooltipProps={{ tooltip: profile.email, hideTooltip: isTooltipHidden }}`, so the email tooltip is attached to the button itself. The button SHALL open a `Dropdown` with `placement="top-end"` and `matchReferenceWidth={false}`.

`UserMenu` itself has no viewport logic. Desktop-only placement is the host's: `Navigation` renders `UserMenu` only inside the `!isMobile` branch, as the `NavigationPanel`'s `footer`. On mobile the `NavigationSheet` owns the settings surface instead, and it is passed only the keyboard-shortcut group — the locale picker stays desktop-only.

`UserMenu` SHALL additionally be suppressed by the host when `OverlayFeature.HideUserMenu` is enabled, or when the user is not authenticated.

i18n keys: `auth.signedInAs`, `auth.userAvatar`, `buttons.logOut`, `basic.settings`

#### Scenario: User menu is absent on mobile
- **WHEN** the viewport is mobile
- **THEN** no `UserMenu` is rendered — the navigation sheet is the mobile settings surface

#### Scenario: Trigger names the signed-in user
- **WHEN** the navigation rail is rendered on desktop for an authenticated user
- **THEN** a button whose accessible name is `t('auth.signedInAs', { email })` is present in the rail footer

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

`Navigation` passes `groups={languageGroup ? [languageGroup] : undefined}` — `undefined` in every
shipping build, since only one locale ships — and passes `onSettings` unless
`OverlayFeature.HideSettingsPage` is enabled, so the rendered menu is
`identity → divider → Settings → Log out` (or `identity → divider → Log out` when the overlay hides
the settings page).

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

### Requirement: User identity header

The first item SHALL be a non-interactive `DropdownItemType.PlainText` row showing `AvatarInitials` built from `profile.shortName` alongside `profile.displayName` rendered through `EllipsisTooltip`, so an over-long name truncates and reveals itself on hover.

#### Scenario: Identity header is not actionable
- **WHEN** the dropdown is open
- **THEN** its first row shows the avatar and display name as plain text
- **AND** the row is not focusable and activating it neither closes the menu nor triggers an action

#### Scenario: Display name truncates with tooltip
- **WHEN** the user's display name is too long to fit on one line
- **THEN** the name is truncated with an ellipsis and a tooltip shows the full name on hover

---

### Requirement: Settings entry

When the host passes `onSettings`, `UserMenu` SHALL render a `settings` item with `IconSettings` (`DIAL_ICON_SIZE.SM`, `aria-hidden`, `stroke={DIAL_KIT_ICON_STROKE}`) and the label `labels.settings`, placed between the divider and Log out.

The host SHALL pass `onSettings` unless `OverlayFeature.HideSettingsPage` is enabled, and its handler SHALL navigate to `ROUTES.Settings`. `labels.settings` (`t('basic.settings')`) is always passed. The same handler is also passed to the mobile `NavigationSheet`.

#### Scenario: Settings navigates to the settings route
- **GIVEN** `OverlayFeature.HideSettingsPage` is not enabled
- **WHEN** the user activates the Settings item
- **THEN** the app navigates to `ROUTES.Settings`

#### Scenario: Settings is hidden by the overlay feature
- **GIVEN** `OverlayFeature.HideSettingsPage` is enabled
- **WHEN** the dropdown is rendered
- **THEN** no Settings item appears

---

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
  `OverlayFeature.HideKeyboardShortcuts`. `Navigation` passes it to the sheet as
  `groups={keyboardGroup ? [keyboardGroup] : undefined}`; the sheet also receives the same
  `onSettings` handler as the desktop menu (omitted under `OverlayFeature.HideSettingsPage`).

The locale picker is therefore offered on **two** surfaces — this menu and the Preferences tab —
while theme and "Default agent for new chats" are offered only in the Preferences tab. Both language surfaces
write through the same `useLanguage().changeLanguage`, so they cannot disagree; the duplication is
deliberate, so that a multi-locale deployment keeps the quick picker it has always had.

Since `SUPPORTED_LANGUAGES` holds one entry today, `languageGroup` is `undefined` in every shipping
build and the rendered menu is `identity → divider → Settings → Log out`. The field stays wired so
the group appears the moment a second locale is registered.

The `settingsPageEnabled` gating that briefly conditioned these fields is removed along with the
flag; neither field is gated on it.

The active option of a group SHALL be visually indicated from its `isActive` flag: in the
`UserMenu` dropdown each option is rendered with `mark: MenuItemMark.Check` and
`checked: option.isActive` (a trailing check announced as a radio item); in the sheet's
`OptionListPage` it drives the row's `isCurrent` state.

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

---

### Requirement: Logout confirmation modal

`LogoutConfirmationModal` SHALL render a `ConfirmationPopup` with `header={t(AuthI18nKeys.LogOutConfirmTitle)}`, `description={t(AuthI18nKeys.LogOutConfirmDescription)}` and `confirmLabel={t(ButtonsI18nKeys.LogOut)}`.

Props: `isOpen`, `onClose`.

Confirming SHALL `await logout()` and log and swallow a failure so the client still tears down its session. In overlay mode it SHALL then `reset()` the auth state without navigating. Outside overlay mode it SHALL perform a full document load with `window.location.replace(ROUTES.Login)` instead of a client-side navigate and SHALL skip `reset()` — a fresh `index.html` drops all in-memory state and references the current chunks (Issue #9254), and an `Unauthenticated` status would let `useAuthRedirect` race the navigation with a single-provider SSO redirect. Cancelling and closing SHALL call `onClose` without logging out.

i18n keys: `auth.logOutConfirmTitle`, `auth.logOutConfirmDescription`, `buttons.logOut`

#### Scenario: Confirm logs out and returns to login
- **WHEN** the user confirms in the dialog and the app is not an overlay
- **THEN** `logout()` is awaited and the page is replaced with a full load of `ROUTES.Login` via `window.location.replace`, without calling `reset()`

#### Scenario: Confirm in overlay mode does not navigate
- **GIVEN** the app is running as an overlay
- **WHEN** the user confirms
- **THEN** `logout()` is awaited and the auth state is reset, but no navigation occurs

#### Scenario: A failed logout request still resets the client
- **WHEN** `logout()` rejects
- **THEN** the error is logged and the client still tears down its session — `reset()` in overlay mode, the full `ROUTES.Login` load otherwise

#### Scenario: Cancel closes without logging out
- **WHEN** the user clicks Cancel or presses Escape
- **THEN** the modal closes, `logout()` is not called, and the user remains on the current page
