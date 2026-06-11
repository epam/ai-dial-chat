## ADDED Requirements

### Requirement: Keyboard shortcut preference persisted to localStorage

The application SHALL store the user's preferred send-key shortcut under `StorageKey.KeyboardShortcut` in `localStorage`. Valid values are `'enter'` and `'meta-enter'`. The default value when no entry exists SHALL be `'enter'`.

A hook `useKeyboardShortcutPreference` SHALL expose `{ preference, setPreference }` where:
- `preference` is `'enter' | 'meta-enter'`
- `setPreference(value)` writes the value to localStorage and updates local state

#### Scenario: Default preference when no stored value exists
- **WHEN** `localStorage` has no entry for `StorageKey.KeyboardShortcut`
- **THEN** `useKeyboardShortcutPreference` returns `preference = 'enter'`

#### Scenario: Stored value is loaded on mount
- **WHEN** `localStorage` contains `StorageKey.KeyboardShortcut = 'meta-enter'`
- **THEN** `useKeyboardShortcutPreference` returns `preference = 'meta-enter'`

#### Scenario: Calling setPreference persists and updates the value
- **WHEN** `setPreference('meta-enter')` is called
- **THEN** `localStorage` is updated to `'meta-enter'` AND subsequent reads of `preference` return `'meta-enter'`

---

### Requirement: Chat input respects the keyboard shortcut preference

The chat input send handler SHALL read `useKeyboardShortcutPreference` and apply the following rules:

- When `preference = 'enter'`: pressing **Enter** (without Shift/Ctrl/Meta) SHALL submit the message; pressing **Shift+Enter** SHALL insert a newline.
- When `preference = 'meta-enter'`: pressing **⌘+Enter** (macOS) or **Ctrl+Enter** (Windows/Linux) SHALL submit the message; pressing bare **Enter** SHALL insert a newline.

#### Scenario: Enter sends when preference is enter
- **WHEN** `preference = 'enter'` AND the user presses Enter without modifier keys
- **THEN** the message is submitted

#### Scenario: Shift+Enter inserts newline when preference is enter
- **WHEN** `preference = 'enter'` AND the user presses Shift+Enter
- **THEN** a newline is inserted and the message is NOT submitted

#### Scenario: Meta+Enter sends when preference is meta-enter
- **WHEN** `preference = 'meta-enter'` AND the user presses ⌘+Enter (macOS) or Ctrl+Enter (Windows/Linux)
- **THEN** the message is submitted

#### Scenario: Bare Enter inserts newline when preference is meta-enter
- **WHEN** `preference = 'meta-enter'` AND the user presses Enter without modifier keys
- **THEN** a newline is inserted and the message is NOT submitted
