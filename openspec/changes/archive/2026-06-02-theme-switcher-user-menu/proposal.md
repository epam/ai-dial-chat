## Why

The user avatar in the navigation sidebar has no interactive menu, making it impossible for users to access settings or log out without a dedicated page. Adding a dropdown with Settings and Log out gives users a discoverable, standard entry point for these actions.

## What Changes

- The user avatar button in the navigation sidebar becomes a dropdown trigger
- Clicking the avatar opens a menu (above/right) showing: user name + avatar header, Settings item, Log out item
- **Settings** opens a modal where the user can switch between available themes (Dark/Light)
- **Log out** shows a confirmation dialog; on confirm, redirects to `/api/v1/auth/logout` (302 → IdP logout or `/`)
- New i18n keys added for all new UI text

## Capabilities

### New Capabilities

- `user-menu`: Dropdown menu on the nav avatar button with user identity header, Settings, and Log out items
- `settings-modal`: Modal dialog allowing the user to select an application theme via a dropdown
- `logout-confirmation`: Confirmation dialog before performing logout via redirect to `/api/v1/auth/logout`

### Modified Capabilities

<!-- No existing spec-level requirements are changing -->

## Impact

- **Modified**: `apps/chat/src/components/Navigation/UserMenu.tsx` — replaces tooltip-only avatar with `DialDropdown`
- **New**: `apps/chat/src/components/Settings/SettingsModal.tsx` — theme picker modal
- **New**: `apps/chat/src/components/LogoutConfirmation/LogoutConfirmationModal.tsx` — logout confirm dialog
- **Modified**: `apps/chat/src/i18n/locales/en.json` — new `auth.*` and `settings.*` keys
- **Dependencies**: `@epam/ai-dial-ui-kit` (`DialDropdown`, `DialPopup`, `DialSelect`, `PopupSize`), `useTheme()` hook, `ApiEndpoints.AUTH_LOGOUT` constant
- No new backend endpoints; no breaking API changes
