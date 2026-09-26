# reusable-file-attachment-workflow Specification

## Purpose

TBD - created by archiving change `extract-reusable-chat-workflows`. Update
Purpose after archive.

## Requirements

### Requirement: Attachment picker state is a reusable composition

`@epam/ai-dial-chat-hooks/file-manager` SHALL export `useFileAttachmentPicker` and named public options/result types. It SHALL compose existing file-manager hooks and own active tab, selected paths and row eligibility. It SHALL accept configured file-manager options, allowed tabs, translated tab/root labels and attachment constraints. Its returned controller and picker fields SHALL compose with the existing `FileManagerAttachModal` without casts, parent providers or raw AG Grid types. Existing `UseDialFileManagerResult` and `FileManagerController` contracts SHALL remain unchanged.

#### Scenario: Host wires the existing modal

- **WHEN** a minimal host supplies configured file operations, tab labels and attachment constraints
- **THEN** the public hook supplies the controller, selection and tab callbacks required by the existing shared modal without copying a selection state machine

#### Scenario: Selection is isolated between tabs

- **WHEN** the host changes selection and then switches tab
- **THEN** incoming selection sets are defensively copied and tab switching clears selection before the next tab is used

### Requirement: Eligibility reuses canonical validation

The picker SHALL derive hidden-path, MIME, file-size and folder eligibility using canonical library helpers. Missing or empty MIME restrictions SHALL allow all types; wildcards SHALL be supported. Missing MIME/size metadata SHALL retain current permissive behavior, and files exactly at the size limit SHALL remain eligible. Folder selection SHALL be controlled by the supplied policy. Derived predicates and callbacks SHALL be memoized against their inputs.

#### Scenario: Eligibility matrix

- **WHEN** rows include a hidden file, a disallowed MIME type, an oversized file, an exact-limit file and a folder
- **THEN** hidden, MIME-invalid and oversized rows are ineligible, the exact-limit file remains eligible subject to other rules, and the folder follows the host's folder-selection setting

#### Scenario: Automatic upload selection uses the same rules

- **WHEN** auto-selection is enabled and uploaded items are offered for selection
- **THEN** the existing shared modal applies the same eligibility predicate rather than bypassing it or retaining invalid selections

### Requirement: Final attachment behavior keeps one owner

`FileManagerAttachModal` SHALL remain the owner of final hidden/MIME filtering, ancestor-folder and descendant-file deduplication, attachment count enforcement, and loading/operation disablement. The new hook SHALL supply policy, not implement another final attach handler. The host SHALL keep its folder-path resolver, notifications, translated description/labels and composer integration. The final `AttachResult` SHALL retain `files` and `folderPaths` and existing semantics.

#### Scenario: Folder overlap and count limit

- **WHEN** selection includes a folder, its child folder/file and independent files
- **THEN** the shared modal deduplicates descendants and checks existing plus resulting attachment count before calling the host
- **AND** an exceeded limit reports the count through the existing callback without attaching

#### Scenario: Busy state and unsupported files

- **WHEN** the controller is loading or mutating, or final selection includes unsupported files
- **THEN** the existing modal preserves its busy Attach disablement and unsupported-file filtering/notification behavior

#### Scenario: Host path and presentation policy

- **WHEN** a host returns normalized folder paths and supplies its own labels, notifications and tabs
- **THEN** the library forwards those integration results without constructing host URLs, reading app configuration or introducing translation keys

### Requirement: Parent adopts the composition without adding a new UI surface

The parent `DialFileManagerModal` SHALL delegate picker state and eligibility to the public hook while retaining its app adapters and existing shared modal. It SHALL preserve current close/reopen behavior, permissions, upload controls, accessible busy/error states, focus handling and RTL/mobile layout. No new backend contract, cache, telemetry or feature flag SHALL be introduced.

#### Scenario: Existing parent attachment flow

- **WHEN** the user chooses files from personal, shared or organization tabs
- **THEN** existing permission and attachment rules still apply and the app does not maintain a parallel picker state implementation
