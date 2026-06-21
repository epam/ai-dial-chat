# User Menu — delta spec

## MODIFIED Requirements

### Requirement: Avatar button opens a dropdown menu

The avatar button in the navigation sidebar SHALL open a `DialDropdown` (`placement="top-end"`, `matchReferenceWidth={false}`) when clicked **on desktop only**. On mobile viewports (`useIsMobile()` returns `true`) `UserMenu` SHALL return `null` — the avatar button and `DialDropdown` are not rendered; the mobile bottom sheet (`MobileNavBottomSheet`) owns the mobile settings surface instead. The existing `DialTooltip` showing the user email SHALL be retained as the trigger child on desktop and SHALL be hidden on mobile (moot because the component returns `null` on mobile, but the `hideTooltip={isMobile}` prop remains for forward-compatibility). The avatar button SHALL carry `aria-label={t('auth.signedInAs', { email })}`.

State ownership: `isLogoutOpen` managed by `useLogout()` hook inside `UserMenu` (also used by `Navigation` for the mobile path). `useUserProfile()` supplies identity data. `useThemeOptions()` supplies `hasDark`/`hasLight`/`selectedTheme`/`setTheme`. The `isSettingsOpen` state is removed.

i18n keys: `auth.logOut`, `auth.signedInAs`

#### Scenario: Menu opens on avatar click (desktop)
- **WHEN** the user clicks the avatar button on a desktop viewport
- **THEN** the dropdown appears above and to the right with the identity header, Theme item, Keyboard shortcuts item, a divider, and Log out item

#### Scenario: UserMenu not rendered on mobile
- **WHEN** the viewport is mobile
- **THEN** `UserMenu` renders nothing — settings are accessed through the mobile bottom sheet instead

#### Scenario: Display name truncates with tooltip
- **WHEN** the user's display name is too long to fit on one line
- **THEN** the name is truncated with an ellipsis and a tooltip shows the full name on hover

#### Scenario: Log out item opens confirmation
- **WHEN** the user clicks Log out on desktop
- **THEN** the dropdown closes and the Logout Confirmation modal opens
