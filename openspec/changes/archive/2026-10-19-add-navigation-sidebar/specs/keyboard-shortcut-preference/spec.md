## REMOVED Requirements

### Requirement: Keyboard shortcut preference persisted to localStorage

**Reason**: The mobile sheet that wrote the preference is replaced by the drawer menu.

**Migration**: Replaced by "Keyboard shortcut preference is persisted to localStorage".

## ADDED Requirements

### Requirement: Keyboard shortcut preference is persisted to localStorage

The application SHALL store the user's preferred send-key shortcut under
`StorageKey.KeyboardShortcut` (`'keyboardShortcut'`) in `localStorage`. Valid values are the `SendOnEnter`
enum members from `@epam/ai-dial-conversation-input`: `SendOnEnter.Enter` (`'enter'`) and
`SendOnEnter.MetaEnter` (`'meta-enter'`). The default value when no entry exists (or the stored value is
anything other than `'meta-enter'`) SHALL be `'enter'`.

A hook `useKeyboardShortcutPreference` SHALL expose `{ preference, setPreference }` where:
- `preference` is a `SendOnEnter` value
- `setPreference(value)` writes the value to localStorage, updates local state and dispatches a
  window `keyboard-shortcut-preference-change` event that every other mounted instance listens to

**Nothing about the storage key, the value grammar, the default, or the cross-instance-sync
guarantee changes in this revision.** What changes is which surfaces write the preference. Two do,
and both go through this one hook:

- **Settings → Preferences** (`settings-preferences-tab`) — the Settings dialog opened from the
  sidebar's user menu and the Settings page's Preferences tab, which share one set of fields. The
  Settings page is behind no feature flag; only the overlay host can hide it
  (`OverlayFeature.HideSettingsPage`).
- **The mobile drawer's user menu** — a quick shortcut next to its Settings entry. The keyboard
  group is built by `useNavigationMenuGroups` and `SidebarNavigation` passes it only to the menu
  of the mobile drawer.

Both surfaces omit the keyboard-shortcut control when the overlay host sets
`OverlayFeature.HideUserSettings` or `OverlayFeature.HideKeyboardShortcuts`.

The desktop `UserMenu` receives only the language group, which is omitted while
`SUPPORTED_LANGUAGES` holds a single locale, so it offers no keyboard-shortcut submenu.

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

#### Scenario: Writing from the mobile drawer menu works
- **GIVEN** the viewport is mobile
- **WHEN** the user changes the shortcut from the drawer's user menu
- **THEN** the preference is persisted and applied exactly as from the Preferences tab
