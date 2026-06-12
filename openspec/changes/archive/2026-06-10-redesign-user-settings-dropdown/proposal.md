## Why

The current Settings button opens a separate modal, adding an unnecessary navigation step for simple preferences like theme. Moving settings directly into the user dropdown makes them immediately accessible without leaving context.

## What Changes

- The `SettingsModal` component and its modal flow are removed entirely.
- The user dropdown header changes from showing email to showing the user's **display name**, with `DialEllipsisTooltip` guarding against overflow.
- A **Theme** submenu item replaces the Settings entry. On hover it expands inline to show Dark / Light / System options. System follows OS `prefers-color-scheme`.
- A **Keyboard shortcuts** submenu item is added. On hover it expands to two options controlling whether Enter or ⌘+Enter sends a message.
- A divider separates the two preference items from Log Out.
- The keyboard shortcut preference is persisted to `localStorage` and read by the chat input send-on-enter handler.

## Capabilities

### New Capabilities
- `keyboard-shortcut-preference`: User preference for the keyboard shortcut used to send a message (Enter vs ⌘+Enter), persisted to localStorage and consumed by the chat input.

### Modified Capabilities
- `user-menu`: Menu structure changes — header shows display name with ellipsis tooltip; Settings item replaced by Theme and Keyboard shortcuts submenus; SettingsModal removed; dividers repositioned.

## Impact

- `apps/chat/src/components/Navigation/UserMenu.tsx` — main menu rebuild
- `apps/chat/src/components/Settings/SettingsModal.tsx` — deleted
- `apps/chat/src/context/ThemeContext.tsx` — extend to support a `system` option that follows OS `prefers-color-scheme`
- `apps/chat/src/constants/storage.ts` — new `StorageKey.KeyboardShortcut` entry
- `apps/chat/src/constants/translation-keys.ts` — new i18n keys for Theme submenu labels, keyboard shortcut labels
- Chat input send handler — reads new keyboard shortcut preference
- `openspec/specs/user-menu/spec.md` — delta for modified capability
