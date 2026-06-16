## MODIFIED Requirements

### Requirement: Avatar button opens a dropdown menu

The avatar button in the navigation sidebar SHALL open a `DialDropdown` (`placement="top-end"`, `matchReferenceWidth={false}`) when clicked. The existing `DialTooltip` showing the user email SHALL be retained as the trigger child and SHALL be hidden on mobile (`hideTooltip={isMobile}` via `useIsMobile()`). The avatar button SHALL carry `aria-label={t('auth.signedInAs', { email })}`.

State ownership: local `isLogoutOpen` boolean inside `UserMenu`. The `isSettingsOpen` state is removed.

i18n keys: `auth.logOut`, `auth.signedInAs`

#### Requirement: User identity header

The first menu item SHALL be a non-interactive `DropdownItemType.PlainText` row showing the user's avatar (image or initials fallback) and the user's display name (`user.claims['name']`). The display name SHALL be rendered with `DialEllipsisTooltip` to show the full name on hover when truncated. Header padding SHALL be `px-2 py-1`.

#### Scenario: Menu opens on avatar click
- **WHEN** the user clicks the avatar button
- **THEN** the dropdown appears above and to the right with the identity header, Theme item, Keyboard shortcuts item, a divider, and Log out item

#### Scenario: Display name truncates with tooltip
- **WHEN** the user's display name is too long to fit on one line
- **THEN** the name is truncated with an ellipsis and a tooltip shows the full name on hover

#### Scenario: Tooltip suppressed on mobile
- **WHEN** the viewport is mobile
- **THEN** `DialTooltip` on the avatar button is hidden (`hideTooltip={isMobile}`)

---

### Requirement: Theme submenu item

A **Theme** item SHALL appear in the dropdown below the first divider. It SHALL render with a right-arrow indicator (via `DropdownItem.children`) that reveals a submenu on hover containing three options: **Dark**, **Light**, and **System**.

- Selecting **Dark** SHALL call `setTheme('dark')` immediately (no confirm step).
- Selecting **Light** SHALL call `setTheme('light')` immediately.
- Selecting **System** SHALL call `setTheme('system')`. The `ThemeContext` SHALL then resolve the OS-preferred variant and subscribe to `window.matchMedia('(prefers-color-scheme: dark)')` changes.

The active theme option SHALL be visually indicated (e.g., checkmark or bold label).

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

## REMOVED Requirements

### Requirement: Settings modal

**Reason**: The Settings modal is replaced by inline submenu items in the dropdown. The single-setting modal added an unnecessary navigation step.

**Migration**: Theme is now set via the Theme submenu in the dropdown. The `SettingsModal` component, `SettingsI18nKeys`, and the `isSettingsOpen` state in `UserMenu` are deleted. The `settings.title` and `settings.apply` i18n keys are removed from all locale files.

#### Scenario: Settings item opens Settings modal

**REMOVED** — the Settings dropdown item no longer exists; replaced by Theme submenu.

---

### Requirement: Action items (Settings entry)

**Reason**: The Settings entry in the action items list is replaced by the Theme and Keyboard shortcuts submenus.

**Migration**: Remove the Settings item (`key: 'settings'`) and the `isSettingsOpen` state from `UserMenu`. The `IconSettings` import from `@tabler/icons-react` is no longer needed.

#### Scenario: Settings item opens Settings modal

**REMOVED** — see above.
