## REMOVED Requirements

### Requirement: User menu shows identity and offers sign-out behind a confirmation

**Reason**: The user menu moved from the rail footer and the mobile sheet into the sidebar footer.

**Migration**: Replaced by "The sidebar's user menu shows identity and offers sign-out behind a confirmation".

## ADDED Requirements

### Requirement: The sidebar's user menu shows identity and offers sign-out behind a confirmation

`apps/chat/src/components/Navigation/SidebarNavigation.tsx` SHALL render the `UserMenu` from `@epam/ai-dial-navigation-panel` in the footer of the sidebar (the desktop column and the mobile drawer), only when `status === 'authenticated'` with a `user` and `OverlayFeature.HideUserMenu` is not set. The menu's trigger is a `Button` showing the avatar and, while the sidebar is expanded, the display name; its accessible name contains `t(AuthI18nKeys.SignedInAs, { email })` (`auth.signedInAs`), and it has an email tooltip; the avatar uses `auth.userAvatar` as its alt text. Its 2.0 `Dropdown` holds the user's identity, the language group (when one is offered), a Settings item (`basic.settings`, omitted when `OverlayFeature.HideSettingsPage` is set), and a Log out item (`ButtonsI18nKeys.LogOut`, `buttons.logOut`).

The Log out entry SHALL call `openLogout()` from `useLogout()`, which opens `LogoutConfirmationModal` (a ui-kit `ConfirmationPopup` with `auth.logOutConfirmTitle`, `auth.logOutConfirmDescription`, and confirm label `buttons.logOut`). Confirming SHALL call `logout()` from `server-api/auth.api.ts`, which sends `fetch(ApiEndpoints.AUTH_LOGOUT, { method: 'POST', credentials: 'include', redirect: 'manual' })` with an `X-CSRF-Token` header when a token is held and always clears the CSRF token afterwards. The modal then logs any request failure via `console.error`, calls `useUser().reset()`, and, outside overlay mode, navigates to `ROUTES.Login`; in overlay mode the current route is kept. There is no HTML form submission.

#### Scenario: Authenticated state shows the user menu

- **WHEN** the user is authenticated with email `u@x.io` and `OverlayFeature.HideUserMenu` is not set
- **THEN** the sidebar footer renders a button whose name contains `auth.signedInAs` interpolated with `u@x.io`, opening a dropdown that contains the Log out item

#### Scenario: Unauthenticated or hidden state omits the menu

- **WHEN** `status` is not `'authenticated'`, or `OverlayFeature.HideUserMenu` is set
- **THEN** no `UserMenu` is rendered

#### Scenario: Log out asks for confirmation first

- **WHEN** the user picks Log out in the `UserMenu`
- **THEN** `LogoutConfirmationModal` opens and no logout request has been sent yet

#### Scenario: Confirming sign-out posts to the BFF and resets the session

- **WHEN** the user confirms in `LogoutConfirmationModal` outside overlay mode
- **THEN** a `fetch` `POST` to `/api/v1/auth/logout` is sent with `credentials: 'include'`, the CSRF token is cleared, `useUser().reset()` is called, and the app navigates to `/login`
- **AND WHEN** the same happens in overlay mode
- **THEN** the app stays on the current route
