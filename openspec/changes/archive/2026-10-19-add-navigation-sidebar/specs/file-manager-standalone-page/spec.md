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
- `sections` lists every tab of `DIAL_FILE_MANAGER_SECTION_TABS` (`my_files`, `shared`, `organization`, in that order) enabled by `fileManagerTabs` (all of them when `fileManagerTabs` is unset), each paired with a translated `rootLabel`. My files and Organization use their tab labels (`dialFileManager.tab.myFiles`, `basic.organization`); Shared uses the shorter `dialFileManager.shared.rootFolder` ("Shared") rather than its tab label `dialFileManager.tab.shared`.
- `sections` is `useMemo`'d on `fileManagerTabs`, the tab labels and `t`.

**Rendering:**

- Renders `DialFileManagerShell` fed by the composer's result, including its `sectionTab`. Below the `desktop` band (1279px and narrower) the shell fills the full page with no additional chrome.
- From 1280px the page frames the shell: the page title `t('dialFileManager.page.title')` as its `h1` in a header row that uses `PAGE_HEADER_ROW_CLASS` (`apps/chat/src/constants/layout.ts`), 32px of horizontal margin, and the shell inside a raised `bg-layer-raised` card with 20px of inner padding. The frame is the same in both navigation layouts.
- For `DialFileManagerVariant.Standalone`, the shell paints its content wrapper and `<DialFileManager>` (search, grid and the rest of the right-hand area) with `bg-layer-base` below the `desktop` band. From 1280px the page passes `surfaceClassName="bg-layer-base desktop:bg-transparent"`, so they are transparent inside the card. The attach modal keeps `bg-layer-sunken`.
- `treeHeaderByTab[All]` is `t(DialFileManagerI18nKeys.MyFilesTreeHeader)`.
- Clears the grid selection whenever the active tab or the composer's `sectionTab` changes.
- Forwards `maxSelectableFileSize` (for existing-file selection and grid `isRowSelectable`; see `dial-file-manager-attach-validation`) and a translated `oversizedUploadMessage` (built from the i18n key `dialFileManager.uploadFileTooLarge`) to `DialFileManagerShell`. The shell forwards them to `<DialFileManager>` as `maxSelectableFileSize` and as `maxFileSize`/`uploadValidationMessages.oversizedFiles` respectively.

**Exclusions:** the page SHALL NOT render `DialPopup` or any attach footer. It SHALL NOT pass `allowedTypes`, `maximumAttachmentsAmount`, `canAttachFolders`, or `onAttach`.

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

#### Scenario: Page content sits on the base layer

- **WHEN** `DialFileManagerPage` is rendered below 1280px
- **THEN** `<DialFileManager>` carries `bg-layer-base` and not `bg-layer-sunken`

#### Scenario: Desktop page is framed

- **WHEN** `DialFileManagerPage` is rendered at 1280px or wider, with either navigation layout
- **THEN** a level-1 heading "File manager" renders above a raised card that holds the file manager, and `<DialFileManager>` is transparent inside it

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
