# User Menu

## Purpose

The avatar dropdown menu on desktop: the identity header, its action items, and the language and theme submenus.

## Overview

The navigation sidebar avatar button opens a dropdown menu giving the user access to theme selection, keyboard shortcut preferences, and Log out. A Logout confirmation dialog guards the logout action.

---

## Requirements

### Requirement: Avatar button opens a dropdown menu (desktop only)

The avatar button in the navigation sidebar SHALL open a `DialDropdown` (`placement="top-end"`, `matchReferenceWidth={false}`) when clicked **on desktop only**. On mobile viewports (`useIsMobile()` returns `true`) `UserMenu` SHALL return `null` — the mobile bottom sheet (`MobileNavBottomSheet`) owns the mobile settings surface instead. The existing `DialTooltip` showing the user email SHALL be retained as the trigger child and SHALL be hidden on mobile (moot because the component returns `null` on mobile, but the `hideTooltip={isMobile}` prop remains). The avatar button SHALL carry `aria-label={t('auth.signedInAs', { email })}`.

State ownership: `isLogoutOpen` managed by `useLogout()` hook inside `UserMenu`. Identity data (`email`, `displayName`, `shortName`, `image`, `isFallbackIconShown`) supplied by `useUserProfile()`. Theme availability and selection supplied by `useThemeOptions()`. The `isSettingsOpen` state is removed.

i18n keys: `auth.logOut`, `auth.signedInAs`

#### Scenario: UserMenu not rendered on mobile
- **WHEN** the viewport is mobile
- **THEN** `UserMenu` renders nothing — settings are accessed through the mobile bottom sheet instead

### Requirement: User identity header

The first menu item SHALL be a non-interactive `DropdownItemType.PlainText` row showing the user's avatar (image or initials fallback) and the user's display name (`user.claims['name']`). The display name SHALL be rendered with `DialEllipsisTooltip` to show the full name on hover when truncated. Header padding SHALL be `px-2 py-1`.

#### Scenario: Identity header is not actionable
- **WHEN** the dropdown is open
- **THEN** its first row shows the avatar and display name as plain text
- **AND** the row is not focusable and activating it neither closes the menu nor triggers an action

### Requirement: Action items

Log out SHALL include a left-aligned icon and label in `dial-small-text`:

- **Log out** — `IconLogout` (16 px, `@tabler/icons-react`), opens `LogoutConfirmationModal`

A `DropdownItemType.Divider` SHALL separate the identity header from the Theme and Keyboard shortcuts items. A second `DropdownItemType.Divider` SHALL separate the preference items from Log out.

#### Scenario: Menu opens on avatar click
- **WHEN** the user clicks the avatar button
- **THEN** the dropdown appears above and to the right with the identity header, Theme item, Keyboard shortcuts item, a divider, and Log out item

#### Scenario: Display name truncates with tooltip
- **WHEN** the user's display name is too long to fit on one line
- **THEN** the name is truncated with an ellipsis and a tooltip shows the full name on hover

#### Scenario: Tooltip suppressed on mobile
- **WHEN** the viewport is mobile
- **THEN** `DialTooltip` on the avatar button is hidden (`hideTooltip={isMobile}`)

#### Scenario: Log out item opens confirmation
- **WHEN** the user clicks Log out
- **THEN** the dropdown closes and the Logout Confirmation modal opens

---

### Requirement: Language submenu item

A **Language** item SHALL appear in the User Menu dropdown immediately below the first divider (between the identity header and the Theme item). It SHALL render with a right-arrow indicator (via `DropdownItem.children`) that reveals a submenu on hover containing one option per supported language. The item label SHALL be `t('settings.language')`. The item icon SHALL be `IconLanguage` (16 px, `@tabler/icons-react`).

i18n keys: `settings.language`

#### Scenario: Language submenu opens on hover
- **WHEN** the user hovers over the Language item in the User Menu
- **THEN** a submenu appears listing all supported language options

#### Scenario: Language item appears between identity header and Theme item
- **WHEN** the User Menu dropdown is open
- **THEN** the menu order is: identity header → divider → Language → Theme → Keyboard Shortcuts → divider → Log out

#### Scenario: Language item is hidden when only one language is available
- **WHEN** only one language is registered in the i18n config
- **THEN** the Language item does NOT appear in the User Menu dropdown

---

### Requirement: Theme submenu item

A **Theme** item SHALL appear in the dropdown below the first divider. It SHALL render with a right-arrow indicator (via `DropdownItem.children`) that reveals a submenu on hover containing three options: **Dark**, **Light**, and **System**.

- Selecting **Dark** SHALL call `setTheme('dark')` immediately (no confirm step).
- Selecting **Light** SHALL call `setTheme('light')` immediately.
- Selecting **System** SHALL call `setTheme('system')`. The `ThemeContext` SHALL then resolve the OS-preferred variant and subscribe to `window.matchMedia('(prefers-color-scheme: dark)')` changes. `ThemeContext` SHALL expose `selectedTheme` (the raw stored preference: `"dark"`, `"light"`, or `"system"`) as a distinct value from `currentTheme` (the resolved variant). The active-indicator in the submenu SHALL use `selectedTheme`.

The active theme option SHALL be visually indicated (e.g., checkmark or bold label). The active indicator SHALL reflect the stored preference (`"dark"`, `"light"`, or `"system"`) — not the resolved theme — so that **Dark** and **System** are never both marked active simultaneously even when the OS is dark.

i18n keys: `settings.theme`, `settings.themeDark`, `settings.themeLight`, `settings.themeSystem`

#### Scenario: Theme submenu opens on hover
- **WHEN** the user hovers over the Theme item
- **THEN** a submenu appears with Dark, Light, and System options

#### Scenario: Selecting Dark applies dark theme immediately
- **WHEN** the user clicks Dark in the Theme submenu
- **THEN** `setTheme('dark')` is called and the theme changes without a confirmation step

#### Scenario: Selecting System follows OS preference
- **WHEN** the user selects System AND the OS is in dark mode
- **THEN** the dark theme is applied

#### Scenario: System theme responds to OS changes
- **WHEN** `preference = 'system'` AND the OS switches from dark to light mode
- **THEN** the application theme switches to light automatically

#### Scenario: Active theme is visually indicated
- **WHEN** the Theme submenu is open
- **THEN** the currently active theme option is visually distinguished from the others

#### Scenario: Dark and System are mutually exclusive indicators when OS is dark
- **GIVEN** the OS color scheme is dark
- **WHEN** the user selects **Dark**
- **THEN** only **Dark** shows the active indicator and **System** does not
- **WHEN** the user then switches to **System**
- **THEN** only **System** shows the active indicator and **Dark** does not

---

### Requirement: Keyboard shortcuts submenu item

A **Keyboard shortcuts** item SHALL appear in the dropdown below the Theme item. It SHALL render with a right-arrow indicator (via `DropdownItem.children`) that reveals a submenu on hover containing two options:

- **Enter — send message, Shift+Enter** (preference value `'enter'`)
- **⌘+Enter — send message, Enter** (preference value `'meta-enter'`; shows "Ctrl" instead of "⌘" on Windows/Linux)

Selecting an option SHALL call `setPreference(value)` from `useKeyboardShortcutPreference`. The active option SHALL be visually indicated.

i18n keys: `settings.keyboardShortcuts`, `settings.shortcutEnter`, `settings.shortcutMetaEnter`

#### Scenario: Keyboard shortcuts submenu opens on hover
- **WHEN** the user hovers over the Keyboard shortcuts item
- **THEN** a submenu appears with the two send-key options

#### Scenario: Selecting an option persists it
- **WHEN** the user clicks a shortcut option
- **THEN** `setPreference` is called with the corresponding value AND the chat input reflects the new shortcut immediately

#### Scenario: Active shortcut is visually indicated
- **WHEN** the Keyboard shortcuts submenu is open
- **THEN** the currently active option is visually distinguished

#### Scenario: Platform-aware modifier key label
- **WHEN** the user is on macOS
- **THEN** the second option label reads "⌘+Enter — send message, Enter — new line"
- **WHEN** the user is on Windows or Linux
- **THEN** the second option label reads "Ctrl+Enter — send message, Enter — new line"

---

### Requirement: Logout confirmation modal

`LogoutConfirmationModal` SHALL render a `DialConfirmationPopup` (default Info variant) with `header={t('auth.logOutConfirmTitle')}`, `description={t('auth.logOutConfirmDescription')}`, and `confirmLabel={t('auth.logOutConfirm')}`. `onConfirm` SHALL set `window.location.href = ApiEndpoints.AUTH_LOGOUT`. `onCancel` and `onClose` SHALL call `onClose` without navigating.

Props: `open`, `onClose`.

i18n keys: `auth.logOutConfirmTitle`, `auth.logOutConfirmDescription`, `auth.logOutConfirm`

#### Scenario: Confirm navigates to logout endpoint
- **WHEN** the user clicks Log out in the confirmation dialog
- **THEN** `window.location.href` is set to `ApiEndpoints.AUTH_LOGOUT`

#### Scenario: Cancel closes without navigating
- **WHEN** the user clicks Cancel or Escape
- **THEN** the modal closes and the user remains on the current page
