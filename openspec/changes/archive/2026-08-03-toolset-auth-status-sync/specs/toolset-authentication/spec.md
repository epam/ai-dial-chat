## MODIFIED Requirements

### Requirement: Logged-in state and logout
When a toolset is logged in at a credentials level, the system SHALL disable the
authentication type selector and credential fields and SHALL offer a Log out action guarded
by a confirmation dialog that revokes the credentials on confirm and shows a success
notification. On a successful logout, the system SHALL also refetch the shared toolset list,
matching the refresh that already happens on a successful login, so a toolset card's credential
badge outside the editor (e.g. in the Catalog) reflects the logged-out status without requiring
an unrelated navigation or page refresh first.

#### Scenario: Disabled fields when logged in
- **WHEN** the loaded toolset is already logged in
- **THEN** the auth type selector and credential fields are disabled and only Log out is active

#### Scenario: Confirm logout
- **WHEN** a user clicks Log out and confirms the dialog
- **THEN** the system calls the logout endpoint to revoke the credentials, closes the confirm
  dialog, shows a success notification, and refetches the shared toolset list

#### Scenario: Cancel logout
- **WHEN** a user clicks Log out and cancels the dialog
- **THEN** no logout request is sent and the logged-in state is unchanged

#### Scenario: Logout failure
- **WHEN** the logout endpoint call fails
- **THEN** the system shows an error notification, the logged-in state is unchanged, and the
  shared toolset list is not refetched

#### Scenario: Catalog badge reflects a logout performed from the Editor
- **WHEN** a user logs out of a toolset from the Toolset Editor's Auth section and then navigates
  to the Catalog
- **THEN** the toolset's card badge shows the logged-out credential status without requiring a
  separate refresh action
