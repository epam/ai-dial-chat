## MODIFIED Requirements

### Requirement: Logout confirmation modal

`LogoutConfirmationModal` SHALL render a `ConfirmationPopup` with these props:

- `header={t(AuthI18nKeys.LogOutConfirmTitle)}`
- `description={t(AuthI18nKeys.LogOutConfirmDescription)}`
- `confirmLabel={t(ButtonsI18nKeys.LogOut)}`

Props: `isOpen`, `onClose`.

Confirming SHALL run `performLogout`, which lives in `useLogout` (`apps/chat/src/hooks/logout/useLogout.ts`) so that the unsaved-changes flow can reuse it. `performLogout` SHALL:

1. `await logout()`, logging and swallowing any failure so the client still tears down its session.
2. In overlay mode, `reset()` the auth state without navigating.
3. Outside overlay mode, perform a full document load with `window.location.replace(ROUTES.Login)` instead of a client-side navigate, and skip `reset()`. Two reasons:
   - A fresh `index.html` drops all in-memory state and references the current chunks (Issue #9254).
   - An `Unauthenticated` status would let `useAuthRedirect` race the navigation with a single-provider SSO redirect.

Cancelling and closing SHALL call `onClose` without logging out.

The Log out entry of `UserMenu` and `NavigationSheet` SHALL open this modal only while no builder has unsaved changes (`useUnsavedChanges().hasUnsavedChanges` is `false`). While a builder is dirty, Log out SHALL instead open the shared "Discard unsaved changes?" dialog (see `builder-unsaved-changes-guard`):

- **Keep editing** cancels the logout.
- **Discard changes** runs `performLogout` directly, without this modal and without the browser's native unload prompt.

i18n keys: `auth.logOutConfirmTitle`, `auth.logOutConfirmDescription`, `buttons.logOut`

#### Scenario: Confirm logs out and returns to login
- **WHEN** the user confirms in the dialog and the app is not an overlay
- **THEN** `logout()` is awaited and the page is replaced with a full load of `ROUTES.Login` via `window.location.replace`, without calling `reset()`

#### Scenario: Confirm in overlay mode does not navigate
- **GIVEN** the app is running as an overlay
- **WHEN** the user confirms
- **THEN** `logout()` is awaited and the auth state is reset, but no navigation occurs

#### Scenario: A failed logout request still resets the client
- **WHEN** `logout()` rejects
- **THEN** the error is logged and the client still tears down its session — `reset()` in overlay mode, the full `ROUTES.Login` load otherwise

#### Scenario: Cancel closes without logging out
- **WHEN** the user clicks Cancel or presses Escape
- **THEN** the modal closes, `logout()` is not called, and the user remains on the current page

#### Scenario: Unsaved builder changes are asked about first
- **WHEN** a builder has unsaved changes and the user activates Log out
- **THEN** the "Discard unsaved changes?" dialog opens instead of this modal; Keep editing leaves the user signed in, and Discard changes logs out without opening this modal
