## ADDED Requirements

### Requirement: Avatar button opens a dropdown menu
The navigation sidebar avatar button SHALL open a `DialDropdown` menu positioned above and to the right (`placement="top-end"`) of the avatar when clicked. The menu SHALL contain three sections: a user identity header, a Settings item, and a Log out item. `matchReferenceWidth` SHALL be `false`. The existing `DialTooltip` showing the user email SHALL be retained, wrapping the avatar button inside the `DialDropdown` trigger child. The `DialTooltip` SHALL be hidden on mobile (`hideTooltip={isMobile}` via `useIsMobile()`).

State ownership: local `useState` inside `UserMenu` for `isSettingsOpen` and `isLogoutOpen`.

i18n keys: `auth.settings`, `auth.logOut`

Accessibility: the avatar button SHALL have `aria-label` set to the value of `auth.signedInAs` interpolated with the user email.

#### Scenario: Menu opens on avatar click
- **WHEN** the user clicks the avatar button
- **THEN** a dropdown menu appears above and to the right of the avatar
- **AND** the menu contains the user's avatar and name/email, a Settings item, and a Log out item

#### Scenario: Menu closes on outside click
- **WHEN** the dropdown is open and the user clicks outside the menu
- **THEN** the dropdown closes

#### Scenario: Settings item opens Settings modal
- **WHEN** the user clicks the Settings item in the dropdown
- **THEN** the dropdown closes and the Settings modal opens

#### Scenario: Log out item opens confirmation dialog
- **WHEN** the user clicks the Log out item in the dropdown
- **THEN** the dropdown closes and the Logout Confirmation modal opens

#### Scenario: Tooltip is suppressed on mobile
- **WHEN** the user is on a mobile viewport
- **THEN** the `DialTooltip` on the avatar button is hidden (`hideTooltip={isMobile}`)

### Requirement: User identity header in dropdown
The dropdown menu SHALL render a non-interactive header row (`DropdownItemType.PlainText`) showing the user's avatar (image or initials fallback) and email. This row SHALL NOT be a clickable menu item. The email text SHALL use `dial-small-semi-text` typography. The header padding SHALL be `px-2 py-1`.

i18n keys: none (email is dynamic data)

#### Scenario: Header displays user email
- **WHEN** the dropdown menu is open
- **THEN** the first row shows the user's avatar and email address in a non-interactive header

### Requirement: Dropdown menu item styling
Each action item (Settings, Log out) SHALL include a left-aligned icon and text styled with `dial-small-text`:
- Settings item: `IconSettings` (16 px) from `@tabler/icons-react`
- Log out item: `IconLogout` (16 px) from `@tabler/icons-react`
