## MODIFIED Requirements

### Requirement: Keyboard shortcut preference persisted to localStorage

The application SHALL store the user's preferred send-key shortcut under
`StorageKey.KeyboardShortcut` in `localStorage`. Valid values are `'enter'` and `'meta-enter'`. The
default value when no entry exists SHALL be `'enter'`.

A hook `useKeyboardShortcutPreference` SHALL expose `{ preference, setPreference }` where:
- `preference` is `'enter' | 'meta-enter'`
- `setPreference(value)` writes the value to localStorage and updates local state

**Nothing about the storage key, the value grammar, the default, or the cross-instance-sync
guarantee changes in this revision.** What changes is which surfaces write the preference. Two do,
and both go through this one hook:

- **Settings → Preferences tab** (`settings-preferences-tab`) — the desktop home. The Settings page
  is behind no feature flag, so this surface is always reachable.
- **Mobile `NavigationSheet`** — retained because the sheet has no Settings entry point of its own
  (see `user-menu`).

The desktop `UserMenu` submenu that previously wrote the preference is **removed**; the user menu
offers no preference submenus at all.

Because every surface writes through `useKeyboardShortcutPreference`, the cross-instance-sync
scenario below covers both uniformly; no surface needs its own propagation mechanism.

#### Scenario: Default preference when no stored value exists
- **WHEN** `localStorage` has no entry for `StorageKey.KeyboardShortcut`
- **THEN** `useKeyboardShortcutPreference` returns `preference = 'enter'`

#### Scenario: Stored value is loaded on mount
- **WHEN** `localStorage` contains `StorageKey.KeyboardShortcut = 'meta-enter'`
- **THEN** `useKeyboardShortcutPreference` returns `preference = 'meta-enter'`

#### Scenario: Calling setPreference persists and updates the value
- **WHEN** `setPreference('meta-enter')` is called
- **THEN** `localStorage` is updated to `'meta-enter'` AND subsequent reads of `preference` return
  `'meta-enter'`

#### Scenario: Preference change is reflected in all hook instances immediately
- **GIVEN** multiple components each call `useKeyboardShortcutPreference()` (e.g. the Preferences
  tab and the chat input)
- **WHEN** `setPreference` is called in one instance (e.g. the user selects a new option in the
  Preferences tab)
- **THEN** all other mounted instances update their `preference` value on the same render cycle — no
  page reload and no navigation is required

#### Scenario: Writing from the Preferences tab reaches the chat input
- **GIVEN** a chat input is mounted
- **WHEN** the user changes the shortcut in Settings → Preferences and returns to the chat
- **THEN** the chat input honours the new shortcut, with no reload

#### Scenario: Writing from the mobile sheet still works
- **GIVEN** the viewport is mobile
- **WHEN** the user changes the shortcut from the `NavigationSheet`
- **THEN** the preference is persisted and applied exactly as before this change
