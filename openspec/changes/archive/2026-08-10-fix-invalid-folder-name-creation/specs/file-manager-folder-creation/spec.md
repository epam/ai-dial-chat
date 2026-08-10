## ADDED Requirements

### Requirement: Folder creation is rejected for invalid names independent of the host UI

`onCreateFolder` (`apps/chat/src/hooks/files/useDialFileMutations.ts`) SHALL independently call `onCreateFolderValidate` with the resolved folder name and parent folder before calling the `POST /api/v1/files/folders` BFF endpoint, and SHALL NOT call it when `onCreateFolderValidate` returns a non-null error — regardless of whether the host `DialFileManager` component already blocked confirmation on that same validation result.

#### Scenario: Enter confirms an invalid folder name

- **WHEN** a user is creating a new folder, types a name that fails validation (empty, contains a forbidden symbol such as `/` or `:`, starts with `.`, equals the reserved marker name, or exceeds 255 characters) so the inline error is shown, and presses Enter to confirm
- **THEN** `onCreateFolder` does not call the `createFolder` BFF endpoint and no folder is created

#### Scenario: Clicking the folder row confirms an invalid folder name

- **WHEN** a user is creating a new folder with an invalid name (as above) and confirms by clicking the folder row instead of pressing Enter
- **THEN** `onCreateFolder` does not call the `createFolder` BFF endpoint and no folder is created

#### Scenario: Valid folder name is created normally

- **WHEN** a user confirms a folder name that passes `onCreateFolderValidate`
- **THEN** `onCreateFolder` calls the `createFolder` BFF endpoint exactly as before this change, and the folder is created

#### Scenario: Parent folder resolution when creating outside the currently browsed folder

- **WHEN** a folder is created from a destination-folder popup browsing a different folder than the outer grid, so no cached sibling list is available for the new folder's actual parent
- **THEN** `onCreateFolder` still runs the empty-name, forbidden-symbol, leading-dot, reserved-name, and length checks against the resolved name
- **AND** the client-side sibling-duplicate check is best-effort only for this case; a genuine conflict is still caught by the BFF's `409` response, exactly as already specified for the existing conflict-check scenario
