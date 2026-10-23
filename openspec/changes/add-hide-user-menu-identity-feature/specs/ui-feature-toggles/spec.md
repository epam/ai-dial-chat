## ADDED Requirements

### Requirement: hide-user-menu-identity removes the identity row from the user menu

When `isEnabled('hide-user-menu-identity')` is `true`, `SidebarNavigation` SHALL pass `isIdentityHidden` to `UserMenu`, in the desktop column and in the mobile drawer. The menu's dropdown then omits its identity row (avatar initials and display name). Preference submenus, Settings and Log out SHALL stay. The trigger SHALL keep its avatar, display name and accessible name.

The key is a modifier key, absent from `DEFAULT_ENABLED_UI_FEATURES`, and `KNOWN_UI_FEATURES` SHALL accept it. It exists for embeds whose sidebar trigger already shows the user's name, where repeating it at the top of a small menu is noise. Unlike `hide-user-menu`, it keeps Log out. It changes presentation only and SHALL NOT be treated as an authorization control.

`hide-user-menu` takes precedence: when it is on, there is no user menu and this key has no effect. On mobile, `hide-navigation-menu` also removes the menu, and this key has no effect there either.

**Accessibility:** The removed row was non-interactive plain text, so no focus stop disappears. The user's identity stays exposed through the trigger's accessible name and email tooltip.

**i18n impact:** None.

#### Scenario: hide-user-menu-identity removes the identity row on desktop

- **GIVEN** the viewport is desktop and the user is authenticated
- **WHEN** `isEnabled('hide-user-menu-identity')` is `true` and the user opens the sidebar's user menu
- **THEN** the dropdown shows no avatar-and-name row and no leading divider, and it still offers Settings and Log out

#### Scenario: hide-user-menu-identity removes the identity row in the mobile drawer

- **GIVEN** the viewport is mobile, the drawer is open and `hide-navigation-menu` is off
- **WHEN** `isEnabled('hide-user-menu-identity')` is `true` and the user opens the drawer's user menu
- **THEN** the dropdown shows no avatar-and-name row, and it still offers Log out

#### Scenario: The key is off by default

- **WHEN** no source enables `hide-user-menu-identity`
- **THEN** the user menu's dropdown starts with the identity row, followed by a divider

#### Scenario: hide-user-menu still removes the whole menu

- **WHEN** `isEnabled('hide-user-menu')` and `isEnabled('hide-user-menu-identity')` are both `true`
- **THEN** no user menu is rendered in the sidebar or the drawer
