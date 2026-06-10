## Context

The current user settings surface is a two-step interaction: open the dropdown → click Settings → configure in a modal → confirm. The modal holds only a single theme selector. Two settings (theme and send-key shortcut) are now required, and the modal pattern scales poorly for inline, immediately-reversible choices.

The `DialDropdown` UI kit component accepts `DropdownItem.children` to render nested submenu items on hover — this directly enables a flyout-submenu pattern with zero additional dependencies.

Current storage: `StorageKey.Theme` persists the active theme id. No keyboard shortcut preference exists yet.

## Goals / Non-Goals

**Goals:**
- Remove `SettingsModal` entirely
- Show user display name (with truncation tooltip) in the dropdown header
- Theme choice available as an inline hover submenu (Dark / Light / System)
- Keyboard shortcut choice available as an inline hover submenu (Enter-send vs ⌘+Enter-send)
- Keyboard shortcut preference persisted to localStorage and read by the chat input send handler
- System theme follows OS `prefers-color-scheme` and reacts to OS changes at runtime

**Non-Goals:**
- Changing the `LogoutConfirmationModal` or logout flow
- Adding more settings items to the dropdown
- Per-conversation keyboard shortcut overrides
- Server-side persistence of preferences

## Decisions

### Decision: Use `DropdownItem.children` for submenus, not a custom overlay

The `DialDropdown` `DropdownItem` type has a `children` field that renders a nested flyout on hover. This avoids a custom popover, keeps the implementation inside the existing dropdown, and uses the UI kit's built-in positioning and keyboard navigation.

Alternative considered: render a custom hover popover via `renderOverlay` — rejected because it duplicates positioning logic already in the kit.

### Decision: Display name in header, not email

The proposal requests "user name" in the header. The user context exposes `user.claims['name']` (full display name) and `user.claims['email']`. The header switches to `claims['name']` with `DialEllipsisTooltip`. The existing initials/avatar logic is unchanged.

Alternative: keep email — rejected per explicit product requirement.

### Decision: Hardcode Dark / Light / System theme options; do not enumerate API themes in the submenu

The API can return arbitrary theme configurations, but the product UX calls for exactly three well-known options. The submenu items are fixed labels mapped to the `'dark'`, `'light'`, and `'system'` keys. `ThemeContext.setTheme` is extended to accept `'system'` as a valid value; the context resolves it to the OS-preferred theme ID and subscribes to `window.matchMedia('(prefers-color-scheme: dark)')` changes.

Alternative: enumerate API themes dynamically — rejected because the API list is open-ended and doesn't include a first-class "system" entry.

### Decision: Keyboard shortcut stored as `'enter' | 'meta-enter'` in localStorage

Two values: `'enter'` (Enter sends, Shift+Enter inserts newline) and `'meta-enter'` (⌘/Ctrl+Enter sends, Enter inserts newline). Default: `'enter'`. The chat input `keydown` handler reads `StorageKey.KeyboardShortcut` on each keystroke via a custom hook (`useKeyboardShortcutPreference`) rather than subscribing to storage events, because the preference changes infrequently and a re-read on each key press is negligible cost.

Alternative: React context for the preference — viable, but adds boilerplate for a single scalar value. localStorage read is simpler and keeps the preference orthogonal to auth/theme state.

### Decision: Remove `SettingsModal` and `SettingsI18nKeys` entirely

No remaining consumer exists after this change. Deleting is cleaner than deprecating.

## Risks / Trade-offs

- **Theme API shape assumption** → The design assumes themes named `'dark'` and `'light'` exist in the API response. If the deployment uses different IDs, the System option will silently fall back to the API's first theme. Mitigation: the `ThemeContext` falls back to `config.themes[0].id` for the OS-preferred branch, and logs a warning if the expected ID is absent.
- **Submenu UX on touch/mobile** → `DropdownItem.children` flyout opens on hover; touch devices have no hover. The existing mobile detection (`useIsMobile`) is used to suppress the dropdown's tooltip trigger, but the nested items may be unreachable on touch. Mitigation: this is a known UI kit limitation; a dedicated mobile settings sheet is out of scope for this change.
- **`DialEllipsisTooltip` requires a finite container width** → The header row must not be `width: auto` or `min-content`. Mitigation: constrain the header item to the dropdown's max-width via `max-w-full` so the tooltip calculates truncation correctly.

## Migration Plan

1. Delete `SettingsModal.tsx` and remove all imports.
2. Remove `SettingsI18nKeys` from translation constants; update locale JSON files to remove `settings.*` keys.
3. Extend `StorageKey` with `KeyboardShortcut`.
4. Extend `ThemeContext` with system-theme logic.
5. Rebuild `UserMenu` with the new submenu items.
6. Update chat input to read `StorageKey.KeyboardShortcut`.
7. Add new i18n keys to all locale files.

Rollback: revert is a straight git revert; no data migration is needed because the new localStorage key is additive and the old theme key is untouched.

## Open Questions

- Should the keyboard shortcut label use platform-aware "⌘" (macOS) vs "Ctrl" (Windows/Linux)? Likely yes — use `navigator.platform` or `navigator.userAgentData` to pick the modifier label at render time.
