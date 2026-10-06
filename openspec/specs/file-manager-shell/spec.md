# file-manager-shell Specification

## Purpose

Specifies `DialFileManagerShell` (`libs/chat-shared/src/file-manager/DialFileManagerShell/DialFileManagerShell.tsx`, exported from `@epam/ai-dial-chat-shared/file-manager`, with a thin app adapter at `apps/chat/src/components/DialFileManagerShell/DialFileManagerShell.tsx`) — the host-agnostic file-browsing/CRUD rendering surface extracted from `DialFileManagerModal` — and the `variant`/`actionProfile` options on `useDialFileManager` (`libs/chat-hooks/src/files/useDialFileManager/useDialFileManager.ts (@epam/ai-dial-chat-hooks)`) that let multiple hosts (the attach modal `DialFileManagerModal` and the standalone `DialFileManagerPage`) reuse the same grid/tree/toolbar option-bag assembly, upload transfer queue, operation overlays, and error/retry panel without duplicating that implementation per host.
## Requirements
### Requirement: DialFileManagerShell component contract

`DialFileManagerShell` in `libs/chat-shared/src/file-manager/DialFileManagerShell/DialFileManagerShell.tsx` SHALL be a functional component (its default export is `memo`-wrapped) that accepts `DialFileManagerShellProps`: `controller: FileManagerController` (the structural view contract `UseDialFileManagerResult` satisfies), `labels: DialFileManagerShellLabels` (pre-translated strings), `activeTab`, `tabs`, `onTabChange`, `selectedPaths`, `onSelectedPathsChange`, `variant`, `actionProfile`, and optional host overrides (`autoSelectUploadedItems`, `allowedFileTypes`, `maxSelectableFileSize`, `oversizedUploadMessage`, `isRowSelectable`, `getDisabledTooltip`, `unsupportedFileTypeTooltip`). The app adapter `apps/chat/src/components/DialFileManagerShell/DialFileManagerShell.tsx` is a `memo`-wrapped component that takes `hookResult: UseDialFileManagerResult` and forwards it as `controller`. The shell SHALL NOT call `useTranslation` internally — every user-visible string it renders SHALL come from the `labels` prop, resolved by the host (`DialFileManagerModal` or `DialFileManagerPage`).

The shell owns rendering: the `DialFileManager` (`@epam/ai-dial-react-file-manager`) prop assembly (grid/tree/toolbar/bulk option bags, search props, tab-specific and search empty states, `autoSelectUploadedItems`, forbidden-symbols wiring), the ui-kit `TransferQueue` for upload batches, the `aria-live` spinner overlay for download/delete/rename/unshare/remove-access, the `OperationLoaderModal` for copy/move, and the `role="alert"` error/retry panel with a `PrimaryButton` wired to `controller.retry`.

The shell SHALL NOT render `DialPopup`, any attach footer, or accept attach-only props (`allowedTypes`, `maximumAttachmentsAmount`, `canAttachFolders`, `onAttach`) — those remain host-owned.

#### Scenario: Shell renders file manager grid from hook result

- **WHEN** a host renders `<DialFileManagerShell controller={...} labels={...} ... />` (or the app adapter with `hookResult={...}`) with a non-empty `items` array in the controller
- **THEN** the shell renders `DialFileManager` with `items`, `path`, and the assembled grid/tree/toolbar option bags derived from the controller

#### Scenario: Shell shows error/retry panel on load failure

- **WHEN** `controller.error` is non-null
- **THEN** the shell renders a `role="alert"` panel containing `labels.errorMessage` and a button labeled `labels.retryLabel` that calls `controller.retry` on click

#### Scenario: Shell shows the upload transfer queue during an upload batch

- **WHEN** `controller.uploadBatchState` is non-null
- **THEN** the shell renders `TransferQueue` with items from `toUploadQueueItems(uploadBatchState.files)`, `onCancelItem` wired to `controller.cancelUploadFile`, and `onClose` calling `controller.cancelUpload` then `controller.clearUploadBatch`

#### Scenario: Shell never calls useTranslation

- **WHEN** the shell module is statically analyzed
- **THEN** it contains no import of `useTranslation` from `react-i18next`

### Requirement: useDialFileManager variant and actionProfile options

`UseDialFileManagerOptions` (in `libs/chat-hooks/src/files/useDialFileManager/useDialFileManager.ts (@epam/ai-dial-chat-hooks)`) SHALL accept an optional `variant: DialFileManagerVariant` (`Attach = 'attach'`, `Standalone = 'standalone'`, `FolderPicker = 'folder-picker'`; default `Attach`) and an optional `actionProfile: DialFileManagerActionProfile` (`Attach = 'attach'`, `Browse = 'browse'`, `Full = 'full'`). Both enums live in `libs/chat-shared/src/file-manager/file-manager-variant.ts`. When `actionProfile` is omitted it is derived by `deriveActionProfile` (`libs/chat-hooks/src/files/file-manager-variant.ts`): `Attach` → `Attach`, `Standalone` → `Browse`, `FolderPicker` → `Full`.

`actionLabels` SHALL be built per tab from the resolved profile: `Download` always; on My files `Delete`, plus `Rename` when `uploadEnabled`, plus `Copy`/`Move`/`Duplicate` when `uploadEnabled` and `isCopyMoveDuplicateAllowed(profile)` (false for `Attach`), plus `RemoveAccess` when `isShareActionsAllowed(profile)` (only `Full`); on Shared `Unshare` only for `Full`; and `Info` on every tab only for `Full`. `DialFileManagerModal` passes `Attach`/`Attach`; `DialFileManagerPage` passes `Standalone`/`Full`.

#### Scenario: Default variant resolves to the attach profile

- **WHEN** `useDialFileManager` is called without `variant` or `actionProfile`
- **THEN** the hook uses `DialFileManagerVariant.Attach` and `DialFileManagerActionProfile.Attach`, so My files exposes no `Copy`/`Move`/`Duplicate`/`RemoveAccess`/`Info` labels

#### Scenario: Full profile adds share and info actions

- **WHEN** `useDialFileManager` is called with `actionProfile: DialFileManagerActionProfile.Full` on the My files tab with `uploadEnabled`
- **THEN** `actionLabels` includes `Copy`, `Move`, `Duplicate`, `RemoveAccess` and `Info` in addition to `Download`, `Delete` and `Rename`

### Requirement: Standalone variant triggers listing load on mount

When `variant === 'standalone'`, `useDialFileManager` SHALL fetch the initial folder listing on mount without requiring any user navigation, using the same load effect that already runs on mount for other variants (`folderPath` starts at `''`, so the listing effect in `libs/chat-hooks/src/files/useDialFileListing/useDialFileListing.ts` fires immediately whenever `isActive` is true).

#### Scenario: Standalone hook fetches root listing on mount

- **WHEN** a component calls `useDialFileManager({ bucket, variant: 'standalone' })` and mounts
- **THEN** `listFiles` (or the tab-appropriate list function) is called with the root path before any user interaction

### Requirement: Shell gates per-tab UI on the controller's sectionTab

`FileManagerController` (`libs/chat-shared/src/file-manager/file-manager-controller.ts`) SHALL declare an optional `sectionTab?: DialFileManagerTabs`, documented as the source tab of the browsed folder and never `All`. `UseDialFileManagerResult` SHALL remain structurally assignable to `FileManagerController`.

`DialFileManagerShell` SHALL compute `gateTab = controller.sectionTab ?? activeTab` and use `gateTab` for:

- the upload-archive toolbar gate (`gateTab === DialFileManagerTabs.MyFiles`, together with the existing variant, profile and `uploadEnabled` conditions)
- the root empty state (`labels.emptyStateByTab[gateTab]`)
- the grid-editing-scroll reset

`activeTab` SHALL remain the value passed as `treeOptions.activeTab` and the key for `labels.treeHeaderByTab`. In Attach mode the visible tree header SHALL be null, while `treeOptions.tabsAriaLabel` SHALL receive that label; the standalone header remains visible. `DialFileManagerShellLabels.treeHeaderByTab` and `.emptyStateByTab` stay `Record<DialFileManagerTabs, …>`, so hosts supply an `all` entry.

#### Scenario: Upload-archive entry on the All tab inside My files

- **WHEN** the shell renders with `activeTab === All`, `controller.sectionTab === MyFiles`, `variant === Standalone`, `actionProfile === Full` and `uploadEnabled === true`
- **THEN** the upload-archive toolbar entry is present

#### Scenario: Upload-archive entry hidden on the All tab inside Organization

- **WHEN** the shell renders with `activeTab === All` and `controller.sectionTab === Organization`
- **THEN** the upload-archive toolbar entry is absent

#### Scenario: Root empty state follows the section

- **WHEN** `activeTab === All`, `controller.sectionTab === Shared`, the path is `/Shared` and there are no items
- **THEN** the empty state renders `labels.emptyStateByTab[Shared]`

#### Scenario: Strip still shows All pressed

- **WHEN** `activeTab === All` and `controller.sectionTab === Shared`
- **THEN** `treeOptions.activeTab` is `All`, and the standalone tree header is `labels.treeHeaderByTab[All]`; Attach uses the same text as `tabsAriaLabel` with no visible header

#### Scenario: Controllers without sectionTab behave as before

- **WHEN** the attach modal renders the shell with a plain `useDialFileManager` result (no `sectionTab`)
- **THEN** every gate uses `activeTab`, exactly as before this change

