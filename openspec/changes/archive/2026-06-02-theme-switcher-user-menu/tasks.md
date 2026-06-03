## 1. i18n Keys

- [x] 1.1 Add `auth.settings`, `auth.logOut`, `auth.logOutConfirmTitle`, `auth.logOutConfirmDescription`, `auth.logOutConfirm` and `settings.apply` to `apps/chat/src/i18n/locales/en.json`
- [x] 1.2 Add `settings.title`, `settings.theme` to `apps/chat/src/i18n/locales/en.json`

## 2. LogoutConfirmationModal

- [x] 2.1 Create `apps/chat/src/components/LogoutConfirmation/LogoutConfirmationModal.tsx` — `DialConfirmationPopup` (default Info variant) with `header={t('auth.logOutConfirmTitle')}`, `description={t('auth.logOutConfirmDescription')}`, `confirmLabel={t('auth.logOutConfirm')}`
- [x] 2.2 Wire `onConfirm` to `window.location.href = ApiEndpoints.AUTH_LOGOUT`
- [x] 2.3 Wire `onCancel` and `onClose` to the `onClose` prop

## 3. SettingsModal

- [x] 3.1 Create `apps/chat/src/components/Settings/SettingsModal.tsx` — `DialConfirmationPopup` with `header={t('settings.title')}`, `confirmLabel={t('settings.apply')}`
- [x] 3.2 Add `pendingTheme` local state initialised to `useTheme().currentTheme` on open; wire `DialSelect` value to `pendingTheme`, `onChange` updates `pendingTheme` only
- [x] 3.3 Map `useTheme().themes` to `{ value: theme.id, label: theme.displayName }` options via `useMemo`
- [x] 3.4 Wire `onConfirm` to call `setTheme(pendingTheme)` then `onClose`; wire `onCancel`/`onClose` to `onClose` without calling `setTheme`
- [x] 3.5 Disable `DialSelect` when `useTheme().isLoading` is `true`

## 4. UserMenu Dropdown

- [x] 4.1 Add `isSettingsOpen` and `isLogoutOpen` local state to `apps/chat/src/components/Navigation/UserMenu.tsx`
- [x] 4.2 Wrap the existing `DialTooltip` + avatar button in `DialDropdown` (`placement="top-end"`, `matchReferenceWidth={false}`) — keep `DialTooltip` intact as the trigger child; do not remove it
- [x] 4.3 Add user identity header row (avatar + email) as a non-interactive element in the menu using `renderOverlay` or a custom item renderer
- [x] 4.4 Add Settings and Log out `DropdownItem` entries wired to `setIsSettingsOpen(true)` and `setIsLogoutOpen(true)`
- [x] 4.5 Render `<SettingsModal open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />` inside `UserMenu`
- [x] 4.6 Render `<LogoutConfirmationModal open={isLogoutOpen} onClose={() => setIsLogoutOpen(false)} />` inside `UserMenu`
- [x] 4.7 Set `aria-label` on the avatar button to `t('auth.signedInAs', { email })`

## 5. Verification

- [x] 5.1 Run `npm exec nx lint chat` and fix any errors
- [x] 5.2 Run `npm exec nx typecheck chat` (or `build chat`) and fix any type errors
- [x] 5.3 Manually verify: open menu, open Settings, change theme — confirm theme updates immediately
- [x] 5.4 Manually verify: open menu, click Log out, cancel — confirm no navigation; confirm navigates on confirm
