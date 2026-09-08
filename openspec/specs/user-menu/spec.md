# User Menu

## Purpose

The avatar dropdown pinned to the bottom of the desktop navigation rail: the identity header, the single-select preference submenus the host supplies, the Settings entry, and Log out.

## Overview

`UserMenu` (`libs/navigation-panel/src/components/UserMenu/UserMenu.tsx`) is a presentational library component. It renders an avatar trigger and a dropdown assembled from three inputs the host passes: `profile`, a `groups` array of single-select preference submenus, and the `onSettings` / `onLogout` callbacks. The library owns the menu's order and dividers; the host (`apps/chat/src/components/Navigation/Navigation.tsx`) owns which groups exist, whether Settings is offered, and every label.

A Logout confirmation dialog guards the logout action.

---

## Requirements

### Requirement: Avatar trigger opens the dropdown

`UserMenu` SHALL render a `<button type="button">` carrying `aria-label={labels.trigger}` — the host passes `t('auth.signedInAs', { email })` — wrapping a `Tooltip` whose content is `profile.email` and whose visibility is controlled by the `isTooltipHidden` prop. The button SHALL open a `Dropdown` with `placement="top-end"` and `matchReferenceWidth={false}`.

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
2. One item per entry of `groups` whose `options` array is non-empty, in the order given, each rendered as a submenu via `DropdownItem.children`.
3. `divider-1` — a single `DropdownItemType.Divider`.
4. `settings` — present only when the host passes `onSettings`.
5. `logout` — always present, last.

There is exactly **one** divider, and it sits **after** the preference groups, separating them from Settings and Log out. A group whose `options` array is empty is dropped entirely, so a host that supplies no groups yields `identity → divider → [settings] → logout`.

#### Scenario: Full desktop order with one preference group
- **GIVEN** the host supplies only the keyboard-shortcut group and passes `onSettings`
- **WHEN** the user opens the dropdown
- **THEN** the items are, in order: identity header, Keyboard shortcuts, a divider, Settings, Log out

#### Scenario: Empty groups are dropped
- **GIVEN** a group is supplied whose `options` array is empty
- **WHEN** the dropdown is rendered
- **THEN** no item is rendered for that group

#### Scenario: Settings is omitted when the host offers no handler
- **GIVEN** the host passes no `onSettings`
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

The host SHALL pass `onSettings` only when the `settingsPageEnabled` feature flag is on, and its handler SHALL navigate to `ROUTES.Settings`. The same flag gates the `labels.settings` string, so the entry never renders without its label.

#### Scenario: Settings navigates to the settings route
- **GIVEN** `settingsPageEnabled` is on
- **WHEN** the user activates the Settings item
- **THEN** the app navigates to `ROUTES.Settings`

#### Scenario: Settings is hidden behind its flag
- **GIVEN** `settingsPageEnabled` is off
- **WHEN** the dropdown is rendered
- **THEN** no Settings item appears

---

### Requirement: Preference groups are supplied by the host

The submenus in the dropdown are not built by `UserMenu`. `useNavigationMenuGroups` (`apps/chat/src/hooks/navigation/useNavigationMenuGroups.tsx`) builds them as `NavigationMenuGroup` values — `{ id, label, icon, options }`, each option carrying `{ id, label, isActive, onSelect }` — and `Navigation` passes the non-`undefined` ones as `groups`.

Every group SHALL be suppressed when `OverlayFeature.HideUserSettings` is enabled.

Two groups exist today:

- **Language** (`id: 'language'`, `IconLanguage`, label `t('settings.language')`) — one option per entry of `SUPPORTED_LANGUAGES`, selecting one calls `changeLanguage(code)`. Built **only when `SUPPORTED_LANGUAGES.length > 1`**.
- **Keyboard shortcuts** (`id: 'keyboard-shortcuts'`, `IconKeyboard`, label `t('settings.keyboardShortcuts')`) — two options bound to `useKeyboardShortcutPreference`. Additionally suppressed by `OverlayFeature.HideKeyboardShortcuts`.

The active option in each group SHALL be visually indicated through `MenuItemLabel`'s `isActive`.

i18n keys: `settings.language`, `settings.keyboardShortcuts`, `settings.shortcutEnter`, `settings.shortcutMetaEnter`

#### Scenario: Language group is absent while only one locale ships
- **GIVEN** `SUPPORTED_LANGUAGES` holds a single entry
- **WHEN** the dropdown is rendered
- **THEN** no Language item appears

This is the shipping state today: `SUPPORTED_LANGUAGES` contains only `{ code: 'en', nativeName: 'English' }`, so no build currently renders a Language item. A test that asserts the entry's presence, or that asserts a locale round-trip through it, cannot pass until a second locale is registered.

#### Scenario: Language group appears once a second locale is registered
- **GIVEN** `SUPPORTED_LANGUAGES` holds two or more entries
- **WHEN** the dropdown is rendered
- **THEN** a Language item appears above the divider, with one option per entry

#### Scenario: Selecting a shortcut option persists it
- **WHEN** the user activates a keyboard-shortcut option
- **THEN** `setPreference` is called with the corresponding `SendOnEnter` value and the chat input reflects the new shortcut immediately

#### Scenario: Platform-aware modifier key label
- **WHEN** the user is on macOS
- **THEN** the meta option's label interpolates the Command symbol as its modifier
- **WHEN** the user is on Windows or Linux
- **THEN** it interpolates `Ctrl`

#### Scenario: Hiding user settings removes every group
- **GIVEN** `OverlayFeature.HideUserSettings` is enabled
- **WHEN** the dropdown is rendered
- **THEN** neither the Language nor the Keyboard shortcuts item appears

#### Scenario: Hiding keyboard shortcuts leaves the other groups untouched
- **GIVEN** only `OverlayFeature.HideKeyboardShortcuts` is enabled
- **WHEN** the dropdown is rendered
- **THEN** no Keyboard shortcuts item appears, and every other group the host would otherwise supply is unaffected

Note that "unaffected" is not the same as "rendered": with a single locale shipping, the Language group is absent for its own reason, independently of this flag.

---

### Requirement: Theme selection is not offered in the user menu

No Theme group is built today. `useNavigationMenuGroups` carries an explicit `TODO` recording the intent to reinstate one from `useThemeOptions`, which still exposes `hasDark`, `hasLight`, `selectedTheme`, `setTheme` and `themes` for that purpose. Only the light theme ships, so a Theme submenu would offer a single option.

Until that group is built, the user menu SHALL NOT render a Theme item, and the resolved-versus-stored-preference behaviour of `ThemeContext` is specified by the theming documentation rather than here.

#### Scenario: No Theme item is present
- **WHEN** the dropdown is rendered
- **THEN** no Theme item appears

---

### Requirement: Logout confirmation modal

`LogoutConfirmationModal` SHALL render a `ConfirmationPopup` with `header={t(AuthI18nKeys.LogOutConfirmTitle)}`, `description={t(AuthI18nKeys.LogOutConfirmDescription)}` and `confirmLabel={t(ButtonsI18nKeys.LogOut)}`.

Props: `isOpen`, `onClose`.

Confirming SHALL `await logout()`, log and swallow a failure so the client still tears down its session, `reset()` the auth state, and — unless the app is running as an overlay — navigate to `ROUTES.Login`. Cancelling and closing SHALL call `onClose` without logging out.

i18n keys: `auth.logOutConfirmTitle`, `auth.logOutConfirmDescription`, `buttons.logOut`

#### Scenario: Confirm logs out and returns to login
- **WHEN** the user confirms in the dialog and the app is not an overlay
- **THEN** `logout()` is awaited, the auth state is reset, and the app navigates to `ROUTES.Login`

#### Scenario: Confirm in overlay mode does not navigate
- **GIVEN** the app is running as an overlay
- **WHEN** the user confirms
- **THEN** `logout()` is awaited and the auth state is reset, but no navigation occurs

#### Scenario: A failed logout request still resets the client
- **WHEN** `logout()` rejects
- **THEN** the error is logged and the auth state is still reset

#### Scenario: Cancel closes without logging out
- **WHEN** the user clicks Cancel or presses Escape
- **THEN** the modal closes, `logout()` is not called, and the user remains on the current page
