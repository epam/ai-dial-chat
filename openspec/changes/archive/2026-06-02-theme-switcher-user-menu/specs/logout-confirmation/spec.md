## ADDED Requirements

### Requirement: Logout confirmation dialog
The system SHALL render a `DialConfirmationPopup` (default `Info` variant) with `header` from `auth.logOutConfirmTitle`, `description` from `auth.logOutConfirmDescription`, and `confirmLabel` from `auth.logOutConfirm`. `onConfirm` SHALL navigate the browser to `ApiEndpoints.AUTH_LOGOUT` via `window.location.href`. `onCancel` and `onClose` SHALL close the modal without any action.

State ownership: `LogoutConfirmationModal` receives `open` and `onClose` props.

i18n keys: `auth.logOutConfirmTitle`, `auth.logOutConfirmDescription`, `auth.logOutConfirm`

The `auth.cancel` key is NOT needed — `DialConfirmationPopup` provides its own default cancel label.

#### Scenario: Confirm navigates to logout endpoint
- **WHEN** the user clicks the Log out button in the confirmation dialog
- **THEN** `window.location.href` is set to `ApiEndpoints.AUTH_LOGOUT`
- **AND** the browser navigates to the logout endpoint (302 redirect to IdP or `/`)

#### Scenario: Cancel closes the dialog
- **WHEN** the user clicks Cancel
- **THEN** the modal closes and the user remains on the current page

#### Scenario: Dialog closes on Escape / outside click
- **WHEN** the user presses Escape or clicks outside the modal
- **THEN** the modal closes without triggering logout
