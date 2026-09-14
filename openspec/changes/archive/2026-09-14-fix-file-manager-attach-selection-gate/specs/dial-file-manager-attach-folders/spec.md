# Delta: dial-file-manager-attach-folders

## ADDED Requirements

### Requirement: Selection changes are gated by isRowSelectable

`FileManagerAttachModal` SHALL re-apply the host-provided `isRowSelectable` predicate to every selection change before forwarding it to `onSelectedPathsChange`, so items that were not clicked manually in the grid — the file manager's auto-select of newly created or uploaded items being the known case — cannot enter the host's selection state unless they would be manually selectable.

A path SHALL be dropped from a selection change when it resolves to no node listed in the controller's `items` or `searchResults`. When no `isRowSelectable` predicate is provided, selection changes SHALL be forwarded unfiltered.

The `isRowSelectable` predicate SHALL be evaluated against a minimal node shape (`path`, `nodeType`, `contentType?`, `contentLength?`) satisfied by both grid rows and `DialFile` controller items, exposed as `FileManagerSelectableNode` from `@epam/ai-dial-chat-shared`.

State ownership: the host continues to own `selectedPaths`; the modal filters before forwarding. RTL: none. Feature flag: none — behavior is conditional on `isRowSelectable` being provided. Memoisation: filtering reuses the existing `filesByPath` `useMemo` index; the handler is a `useCallback`.

#### Scenario: Created folder is not selected when the model cannot attach folders

- **WHEN** `canAttachFolders` is `false`, a folder is created inside the attach modal, and the file manager auto-selects it
- **THEN** `onSelectedPathsChange` receives an empty selection and the Attach button remains disabled

#### Scenario: Folder stays selectable when the model can attach folders

- **WHEN** `canAttachFolders` is `true` and the user manually clicks a non-hidden folder row
- **THEN** the folder enters the selection and can be attached as a folder path

#### Scenario: Allowed file kept while rejected folder dropped from the same change

- **WHEN** a single selection change contains an allowed file path and a folder path rejected by `isRowSelectable`
- **THEN** `onSelectedPathsChange` receives only the allowed file path

#### Scenario: Path with no listed node is dropped

- **WHEN** a selection change contains a path that resolves to no node in `items` or `searchResults`
- **THEN** that path is dropped from the forwarded selection

#### Scenario: No predicate means unfiltered forwarding

- **WHEN** `isRowSelectable` is not provided
- **THEN** selection changes are forwarded to `onSelectedPathsChange` unfiltered
