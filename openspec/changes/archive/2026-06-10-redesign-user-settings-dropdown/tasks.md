## 1. Storage and Constants

- [x] 1.1 Add `KeyboardShortcut = 'keyboardShortcut'` to `StorageKey` enum in `apps/chat/src/constants/storage.ts`
- [x] 1.2 Remove `SettingsI18nKeys` from `apps/chat/src/constants/translation-keys.ts`
- [x] 1.3 Add new i18n keys to `apps/chat/src/constants/translation-keys.ts`: `settings.theme`, `settings.themeDark`, `settings.themeLight`, `settings.themeSystem`, `settings.keyboardShortcuts`, `settings.shortcutEnter`, `settings.shortcutMetaEnter`
- [x] 1.4 Add all new i18n keys to all locale JSON files under `apps/chat/src/i18n/locales/`

## 2. Keyboard Shortcut Preference Hook

- [x] 2.1 Create `apps/chat/src/hooks/keyboard-shortcut/useKeyboardShortcutPreference.ts` — returns `{ preference: 'enter' | 'meta-enter', setPreference }`, reads/writes `StorageKey.KeyboardShortcut`, defaults to `'enter'`

## 3. Theme Context — System Option

- [x] 3.1 Extend `ThemeContext` in `apps/chat/src/context/ThemeContext.tsx` to accept `'system'` as a valid theme id: when `'system'` is set, resolve to `'dark'` or `'light'` via `window.matchMedia('(prefers-color-scheme: dark)')` and subscribe to OS changes with a `change` listener
- [x] 3.2 Persist `'system'` (not the resolved id) to `StorageKey.Theme` so the system preference is restored on reload

## 4. Conversation Input — sendOnEnter Prop

- [x] 4.1 Add a `sendOnEnter?: 'enter' | 'meta-enter'` prop to `libs/conversation-input/src/components/Input/Input.tsx`
- [x] 4.2 Update the `handleKeyDown` logic at line 274 in `Input.tsx`: when `sendOnEnter === 'meta-enter'`, submit on `(e.metaKey || e.ctrlKey) && e.key === 'Enter'`; when `sendOnEnter === 'enter'` (default), retain current `Enter && !shiftKey` behavior
- [x] 4.3 Pass `sendOnEnter` from `ConversationView` (or wherever `Input` is rendered from `apps/chat`) by reading `useKeyboardShortcutPreference().preference`

## 5. Rebuild UserMenu

- [x] 5.1 Remove `isSettingsOpen` state, `SettingsModal` import, and Settings menu item from `apps/chat/src/components/Navigation/UserMenu.tsx`
- [x] 5.2 Update the identity header item to use `user.claims['name']` (display name) wrapped in `DialEllipsisTooltip` instead of email text
- [x] 5.3 Add Theme submenu item using `DropdownItem.children` with Dark, Light, System options; each option calls `setTheme(id)` immediately; mark the active option visually
- [x] 5.4 Add Keyboard shortcuts submenu item using `DropdownItem.children` with two options mapped to `'enter'` / `'meta-enter'`; use platform-aware modifier label (`navigator.platform` or `navigator.userAgentData`); call `setPreference(value)` on click; mark active option visually
- [x] 5.5 Add a second `DropdownItemType.Divider` between the preference items and Log out
- [x] 5.6 Remove `IconSettings` import from `@tabler/icons-react` in `UserMenu.tsx`

## 6. Delete SettingsModal

- [x] 6.1 Delete `apps/chat/src/components/Settings/SettingsModal.tsx`
- [x] 6.2 Delete the `apps/chat/src/components/Settings/` directory if it is now empty
- [x] 6.3 Remove `settings.title` and `settings.apply` keys from all locale JSON files

## 7. Verification

- [x] 7.1 Run `npm exec nx lint chat` and fix any lint errors
- [x] 7.2 Run `npm exec nx test chat` and confirm all tests pass; update `UserMenu.spec.tsx` for the new menu structure
- [x] 7.3 Run `npm exec nx build chat` and confirm a clean build
