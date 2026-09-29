## ADDED Requirements

### Requirement: Attach pickers never offer the All tab

`useFileAttachmentPicker` (`libs/chat-hooks/src/files/useFileAttachmentPicker/useFileAttachmentPicker.ts`), and through it `DialFileManagerModal` and every other attach/file picker built on it, SHALL remove `DialFileManagerTabs.All` from its tab list regardless of `allowedTabs`. The reason is that it composes a single-source `useDialFileManager`. Its initial-tab and active-tab fallback priority SHALL remain `my_files` → `shared` → `organization`, with `all` never selected.

`fetchByTab` (`libs/chat-hooks/src/files/dial-file-manager-mapping.util.ts`) SHALL reject with an `Error` when called with `DialFileManagerTabs.All`, so a wiring mistake cannot silently list My files.

#### Scenario: Default config shows three tabs in the attach modal

- **WHEN** `DialFileManagerModal` opens with `fileManagerTabs` of `['all', 'my_files', 'shared', 'organization']`
- **THEN** `treeOptions.tabs` is My files, Shared with me, Organization, with no All chip
- **AND** the active tab is `DialFileManagerTabs.MyFiles`

#### Scenario: initialTab of All is corrected

- **WHEN** a host calls `useFileAttachmentPicker` with `initialTab: DialFileManagerTabs.All`
- **THEN** the returned `activeTab` resolves to the first enabled source tab in the priority `my_files` → `shared` → `organization`

#### Scenario: fetchByTab refuses All

- **WHEN** `fetchByTab(filesApi, DialFileManagerTabs.All, bucket, '', new Map())` is called
- **THEN** the returned promise rejects with an `Error`, and no `DialFilesApi` method is called
