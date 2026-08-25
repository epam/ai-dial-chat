## ADDED Requirements

### Requirement: Successful create or save confirms itself

`CustomAppEditor` SHALL raise a success notification when a create (`POST /api/v1/applications`) or save (`PATCH /api/v1/applications/:id`) request resolves, before or in the same tick as the navigation to the return URL, through `useOperationNotification` (see `entity-operation-notifications`).

- Create → `NotifiableEntity.CustomApp` + `EntityOperation.Created`, `name` = the application's name.
- Save → `NotifiableEntity.CustomApp` + `EntityOperation.Edited`, same `name`.

Today a successful save only navigates away, so a user who saves and lands back on the catalog has no confirmation that anything was persisted. The failure path is unchanged (see "Save/create failure surfaces API error details"): the error notification with `requestId` stays exactly as specified, and no success notification is raised.

#### Scenario: Create confirms and returns

- **WHEN** a user creates a custom app and the create request succeeds
- **THEN** a success notification titled `"Custom app created successfully"` naming the app is shown and the editor navigates to the return URL

#### Scenario: Save confirms and returns

- **WHEN** a user saves an existing custom app and the PATCH succeeds
- **THEN** a success notification titled `"Custom app edited successfully"` naming the app is shown and the editor navigates to the return URL

#### Scenario: Failed save raises only the error notification

- **WHEN** the create or save request fails
- **THEN** the existing error notification (with the API message and trace id) is shown, the editor stays open, and no success notification is raised
