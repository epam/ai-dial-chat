# User Menu

## Overview

The navigation sidebar avatar button opens a dropdown menu giving the user access to Settings and Log out. A Settings modal lets the user switch the application theme. A Logout confirmation dialog guards the logout action.

---

## Requirement: Avatar button opens a dropdown menu

The avatar button in the navigation sidebar SHALL open a `DialDropdown` (`placement="top-end"`, `matchReferenceWidth={false}`) when clicked. The existing `DialTooltip` showing the user email SHALL be retained as the trigger child and SHALL be hidden on mobile (`hideTooltip={isMobile}` via `useIsMobile()`). The avatar button SHALL carry `aria-label={t('auth.signedInAs', { email })}`.

State ownership: local `isSettingsOpen` and `isLogoutOpen` booleans inside `UserMenu`.

i18n keys: `auth.settings`, `auth.logOut`, `auth.signedInAs`

### Requirement: User identity header

The first menu item SHALL be a non-interactive `DropdownItemType.PlainText` row showing the user's avatar (image or initials fallback) and email. Email text SHALL use `dial-small-semi-text` typography. Header padding SHALL be `px-2 py-1`.

### Requirement: Action items

Settings and Log out items SHALL each include a left-aligned icon and label in `dial-small-text`:

- **Settings** — `IconSettings` (16 px, `@tabler/icons-react`), opens `SettingsModal`
- **Log out** — `IconLogout` (16 px, `@tabler/icons-react`), opens `LogoutConfirmationModal`

A `DropdownItemType.Divider` SHALL separate the identity header from the action items.

#### Scenario: Menu opens on avatar click
- **WHEN** the user clicks the avatar button
- **THEN** the dropdown appears above and to the right with the identity header, Settings item, and Log out item

#### Scenario: Tooltip suppressed on mobile
- **WHEN** the viewport is mobile
- **THEN** `DialTooltip` is hidden (`hideTooltip={isMobile}`)

#### Scenario: Settings item opens Settings modal
- **WHEN** the user clicks Settings
- **THEN** the dropdown closes and the Settings modal opens

#### Scenario: Log out item opens confirmation
- **WHEN** the user clicks Log out
- **THEN** the dropdown closes and the Logout Confirmation modal opens

---

## Requirement: Settings modal

`SettingsModal` SHALL render a `DialConfirmationPopup` with `header={t('settings.title')}` and `confirmLabel={t('settings.apply')}`. The body SHALL be wrapped in a `p-4` container. Inside, a `DialFormItem` (label from `settings.theme`) SHALL wrap a `DialSelect` for theme selection.

The `DialSelect` options SHALL come from `useTheme().themes` (memoised, mapped to `{ value: theme.id, label: theme.displayName }`). The `DialSelect` SHALL be `disabled` when `useTheme().isLoading` is `true`.

`pendingTheme` local state (initialised to `useTheme().currentTheme`) controls the select. `setTheme` is called only on Confirm; Cancel/close discards the pending selection.

Props: `open`, `onClose`.

i18n keys: `settings.title`, `settings.theme`, `settings.apply`

#### Scenario: Modal opens with current theme pre-selected
- **WHEN** the Settings modal opens
- **THEN** the `DialSelect` shows the currently active theme

#### Scenario: Theme applies on confirm
- **WHEN** the user clicks Confirm
- **THEN** `setTheme(pendingTheme)` is called and the modal closes

#### Scenario: Cancel discards selection
- **WHEN** the user cancels or closes the modal
- **THEN** `setTheme` is NOT called and the applied theme is unchanged

#### Scenario: Select disabled while loading
- **WHEN** `useTheme().isLoading` is `true`
- **THEN** the `DialSelect` is disabled

---

## Requirement: Logout confirmation modal

`LogoutConfirmationModal` SHALL render a `DialConfirmationPopup` (default Info variant) with `header={t('auth.logOutConfirmTitle')}`, `description={t('auth.logOutConfirmDescription')}`, and `confirmLabel={t('auth.logOutConfirm')}`. `onConfirm` SHALL set `window.location.href = ApiEndpoints.AUTH_LOGOUT`. `onCancel` and `onClose` SHALL call `onClose` without navigating.

Props: `open`, `onClose`.

i18n keys: `auth.logOutConfirmTitle`, `auth.logOutConfirmDescription`, `auth.logOutConfirm`

#### Scenario: Confirm navigates to logout endpoint
- **WHEN** the user clicks Log out in the confirmation dialog
- **THEN** `window.location.href` is set to `ApiEndpoints.AUTH_LOGOUT`

#### Scenario: Cancel closes without navigating
- **WHEN** the user clicks Cancel or Escape
- **THEN** the modal closes and the user remains on the current page
