## ADDED Requirements

### Requirement: A created folder confirms itself

`onCreateFolder` (`apps/chat/src/hooks/files/useDialFileMutations.ts`) SHALL raise a success notification after the `POST /api/v1/files/folders` call resolves and the created folder has been merged into the listing cache, through `useOperationNotification` (see `entity-operation-notifications`) with `NotifiableEntity.Folder` + `EntityOperation.Created` and `name` = the created folder's resolved name.

Today only the failure path notifies (`dialFileManager.folderCreateError`), so a folder created into a collapsed or non-visible parent — from a destination-folder popup, for example — produces no feedback at all.

The notification SHALL NOT be raised when validation rejects the name locally or when the BFF returns `409`; those paths keep their existing inline error and error-toast behaviour.

#### Scenario: Folder created from the grid confirms

- **WHEN** a user confirms a valid new folder name and the create request succeeds
- **THEN** a success notification titled `"Folder created successfully"` is shown, naming the folder

#### Scenario: Folder created from a destination-folder popup confirms

- **WHEN** a folder is created from a destination-folder popup browsing a different folder than the outer grid, and the create request succeeds
- **THEN** the same success notification is shown, even though the new folder is not visible in the outer grid

#### Scenario: Rejected name raises no success notification

- **WHEN** the name fails client-side validation, or the BFF responds `409`
- **THEN** no success notification is raised and the existing inline error / error toast behaviour is unchanged
