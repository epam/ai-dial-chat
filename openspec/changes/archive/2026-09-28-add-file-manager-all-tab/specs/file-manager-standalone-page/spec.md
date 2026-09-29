## MODIFIED Requirements

### Requirement: DialFileManagerPage component

`apps/chat/src/pages/DialFileManagerPage/DialFileManagerPage.tsx` SHALL be a top-level `FC` that does the following.

**Inputs:**

- Resolves `bucket` via `useUser()` from `apps/chat/src/context/auth/UserContext.tsx` (`user?.bucket ?? ''`, matching the attach modal's existing pattern).
- Reads `maxSelectableFileSize` from `useAppConfig().config.maxAttachmentFileSizeBytes`.
- Reads `fileManagerTabs` from `useAppConfig().config.fileManagerTabs`.

**Tabs:**

- Tracks the active tab via `useDialFileManagerTabs(tabLabels, DialFileManagerTabs.All)`, filtered through `useDialFileManagerTabConfig(…, fileManagerTabs)`.
- `tabLabels[All]` is `t(DialFileManagerI18nKeys.TabAll)`.

**File manager composition:**

- Calls `useDialFileManagerSections({ …hostOptions, bucket, activeTab, sections, variant: DialFileManagerVariant.Standalone, actionProfile: DialFileManagerActionProfile.Full, forbiddenSymbolsRegExp })` from `@epam/ai-dial-chat-hooks` in place of a single `useDialFileManager`.
- `sections` lists every source tab (`my_files`, `shared`, `organization`, in that order) enabled by `fileManagerTabs`, each paired with its translated tab label as `rootLabel`. The label keys are `dialFileManager.tab.myFiles`, `dialFileManager.tab.shared` and `basic.organization`.
- `sections` is `useMemo`'d on `fileManagerTabs` and `t`.

**Rendering:**

- Renders `DialFileManagerShell` fed by the composer's result, including its `sectionTab`, filling the full page with no additional chrome.
- `treeHeaderByTab[All]` is `t(DialFileManagerI18nKeys.MyFilesTreeHeader)`.
- Clears the grid selection whenever the active tab or the composer's `sectionTab` changes.
- Forwards `maxSelectableFileSize` (for existing-file selection and grid `isRowSelectable`; see `dial-file-manager-attach-validation`) and a translated `oversizedUploadMessage` (built from the i18n key `dialFileManager.uploadFileTooLarge`) to `DialFileManagerShell`. The shell forwards them to `<DialFileManager>` as `maxSelectableFileSize` and as `maxFileSize`/`uploadValidationMessages.oversizedFiles` respectively.

**Exclusions:** the page SHALL NOT render `DialPopup`, any attach footer, or a page title/header. It SHALL NOT pass `allowedTypes`, `maximumAttachmentsAmount`, `canAttachFolders`, or `onAttach`.

#### Scenario: Page opens on the All tab

- **WHEN** `DialFileManagerPage` mounts with the default `fileManagerTabs` (`['all', 'my_files', 'shared', 'organization']`)
- **THEN** the active tab is `DialFileManagerTabs.All`, and the All chip is rendered first and pressed
- **AND** the grid shows the root of `My files` (`path === '/My files'` for the `en` label)

#### Scenario: Root listing loads without user interaction

- **WHEN** `DialFileManagerPage` mounts
- **THEN** the root folder listing for the user's bucket is fetched and rendered without the user navigating or clicking anything

#### Scenario: No attach affordances are rendered

- **WHEN** `DialFileManagerPage` is rendered
- **THEN** there is no "Attach" button, no attach footer, and no attach-selection-limit messaging anywhere on the page

#### Scenario: Tabs and CRUD match the attach modal

- **WHEN** a user switches between My files, Shared with me, and Organization tabs on the standalone page
- **THEN** the same columns, dates, and per-tab actions (upload, delete, rename, download) appear as they do in the attach modal for the same tab

#### Scenario: Deployment without all opens on My files

- **WHEN** `fileManagerTabs` is `['my_files', 'shared', 'organization']`
- **THEN** no All chip is rendered, and the page opens on `DialFileManagerTabs.MyFiles` via the tab-config correction

#### Scenario: Standalone page enforces the same size limit as the attach modal

- **WHEN** `useAppConfig().config.maxAttachmentFileSizeBytes` resolves to `536870912`
- **THEN** `DialFileManagerPage` passes `maxSelectableFileSize: 536870912` into `DialFileManagerShell`
- **AND** an existing file in storage larger than that is not selectable in the standalone page's grid, matching the attach modal's `isRowSelectable` behavior
- **AND** a freshly-picked local file larger than that is rejected by the ui-kit's own `maxFileSize` check before `onUploadFiles` or any `POST /api/v1/files` request

#### Scenario: Size limit falls back to the default before AppConfig loads

- **WHEN** `DialFileManagerPage` mounts before `AppConfig`'s initial fetch has resolved
- **THEN** `maxSelectableFileSize` is `536870912` (the `AppConfig` default), not `undefined`, so the page never briefly renders without a size restriction
