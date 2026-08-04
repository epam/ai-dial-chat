## MODIFIED Requirements

### Requirement: Duplicate is dispatched through the existing onCopyFiles callback

Triggering the Duplicate action SHALL be handled entirely by `@epam/ai-dial-react-file-manager`'s internal `DialFileManager` logic, which computes a same-folder destination and a collision-free name, then calls the app's existing `onCopyFiles(items, destinationFolder)` callback (already wired per [file-manager-copy-move](../../../specs/file-manager-copy-move/spec.md)). This capability SHALL NOT introduce a separate `onDuplicate` callback or a distinct BFF request path — duplicated items flow through the same `POST /api/v1/files/copy` endpoint as an ordinary same-folder copy.

**State ownership**: no new state is introduced in `useDialFileManager`; `isCopying` (from `file-manager-copy-move`) covers the in-flight state for a duplicate the same way it covers an ordinary copy.

#### Scenario: Duplicating a file calls onCopyFiles with a same-folder destination

- **WHEN** the user triggers Duplicate on a single file
- **THEN** `onCopyFiles` is called with one item whose destination folder equals its source folder and whose destination name differs from the source name

#### Scenario: Duplicate reuses the copy BFF endpoint

- **WHEN** a duplicate action completes
- **THEN** the request observed by the BFF is indistinguishable in shape from an ordinary `POST /api/v1/files/copy` request — no `duplicate` flag or separate route is involved

### Requirement: Naming collision avoidance is ui-kit-owned

The destination name for a duplicated file or folder SHALL be computed by `@epam/ai-dial-react-file-manager` against the destination folder's already-loaded listing, using the pattern `"{base} ({n}){ext}"` for files (extension preserved, `n` starting at 1 and incrementing until unused) and `"{name} ({n})"` for folders. This app SHALL NOT implement or duplicate this naming logic.

#### Scenario: First duplicate of a file gets "(1)" suffix

- **WHEN** `report.pdf` exists and has no `report (1).pdf` sibling, and the user duplicates it
- **THEN** the resulting destination name is `report (1).pdf`

#### Scenario: Repeated duplicate increments the suffix

- **WHEN** both `report.pdf` and `report (1).pdf` already exist, and the user duplicates `report.pdf` again
- **THEN** the resulting destination name is `report (2).pdf`

#### Scenario: Folder duplicate uses the folder naming pattern

- **WHEN** the user duplicates a folder named `drafts`
- **THEN** the resulting destination name is `drafts (1)` (no extension handling applied)

#### Scenario: Multi-select duplicate avoids collisions within the batch

- **WHEN** the user selects two files that would otherwise resolve to the same candidate name and duplicates them together
- **THEN** the two duplicated items receive distinct incremented names (e.g. `report (1).pdf` and `report (2).pdf`), not the same name
