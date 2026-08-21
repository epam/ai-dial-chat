## MODIFIED Requirements

### Requirement: Every completed entity operation raises exactly one success notification

A user-initiated operation that mutates or exports an entity SHALL raise exactly one success notification when it completes successfully. The operation matrix below is exhaustive for this capability; a `—` means the operation does not exist in the product today and no notification is expected until it does.

| Entity | Created | Edited / saved | Deleted | Downloaded | Publish requested | Unpublished | Other |
|---|---|---|---|---|---|---|---|
| Prompt (`PromptEditor`, catalog details) | required | required | required | **new** | required | specified only (see below) | — |
| Quick app (`AppsEditor`) | **new** | **new** | required (catalog) | — | required (catalog) | specified only | — |
| Custom app (`CustomAppEditor`) | **new** | **new** | required (catalog) | — | required (catalog) | specified only | — |
| Toolset (`ToolsetEditor`) | **new** | **new** | required (catalog) | — | required (catalog) | specified only | — |
| Model / Skill (catalog details) | required (Skill only, via archive import and any other Skill-create path) | — | required | — | required | specified only | — |
| Conversation | not notified (see exclusions) | **new** (rename), **new** (duplicate) | required | required (export) | required | specified only | import, delete-all, unshare, revoke: required |
| File | — | **new** (rename) | required | **new** (single, and a plural count for a multi-item selection) | — | — | upload, copy, move: required |
| Folder | **new** | **new** (rename) | required | **new** (archive) | — | — | copy, move: required |

`required` = already implemented, copy realigned by this change. `**new**` = added by this change.

Exclusions, which SHALL NOT raise a success notification:

- Creating a conversation — a new chat is started constantly and a toast per creation is noise.
- Selecting, opening, or navigating to an entity.
- Any operation that fails, partially fails, or is cancelled by the user; those keep their existing error/warning notifications unchanged.
- Scheduled task operations, which keep their current notification behaviour.

#### Scenario: Downloading a prompt confirms the download

- **WHEN** a user downloads a prompt from the catalog details panel and the file is written to disk
- **THEN** a success notification titled `"Prompt downloaded successfully"` is shown with the body naming the prompt

#### Scenario: Saving a toolset confirms before navigating away

- **WHEN** a user clicks Save & Exit in the toolset editor and the create or update request succeeds
- **THEN** a success notification is shown and the editor navigates to the return URL — the notification is not lost by the navigation

#### Scenario: Duplicating a conversation confirms the copy

- **WHEN** a user duplicates a conversation and the duplicate is created
- **THEN** a success notification titled `"Conversation duplicated successfully"` is shown

#### Scenario: Creating a folder confirms the creation

- **WHEN** a user confirms a valid new folder name in the file manager and the create request succeeds
- **THEN** a success notification titled `"Folder created successfully"` is shown

#### Scenario: Starting a new conversation stays silent

- **WHEN** a user starts a new conversation
- **THEN** no success notification is shown

#### Scenario: A failed operation raises no success notification

- **WHEN** any operation in the matrix rejects
- **THEN** only the existing error notification is shown, with its `requestId` behaviour unchanged, and no success notification is raised

#### Scenario: Importing a Skill archive confirms creation

- **WHEN** a user uploads a Skill ZIP archive from the Catalog and the archive is imported successfully
- **THEN** a success notification titled `"Skill created successfully"` is shown, naming the new Skill
