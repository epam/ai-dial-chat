# Spec Delta

## MODIFIED Requirements

### Requirement: DialFileManagerShell component contract

`DialFileManagerShell` in `libs/chat-shared/src/file-manager/DialFileManagerShell/DialFileManagerShell.tsx` SHALL be a functional component (its default export is `memo`-wrapped) that accepts `DialFileManagerShellProps`: `controller: FileManagerController` (the structural view contract `UseDialFileManagerResult` satisfies), `labels: DialFileManagerShellLabels` (pre-translated strings), `activeTab`, `tabs`, `onTabChange`, `selectedPaths`, `onSelectedPathsChange`, `variant`, `actionProfile`, and optional host overrides (`autoSelectUploadedItems`, `allowedFileTypes`, `maxSelectableFileSize`, `oversizedUploadMessage`, `isRowSelectable`, `getDisabledTooltip`, `unsupportedFileTypeTooltip`, `treeContainerClassName`, `previewLabel`, `onPreview`, `previewExtensions`). The app adapter `apps/chat/src/components/DialFileManagerShell/DialFileManagerShell.tsx` is a `memo`-wrapped component that takes `hookResult: UseDialFileManagerResult` and forwards it as `controller`. The shell SHALL NOT call `useTranslation` internally — every user-visible string it renders SHALL come from the `labels` prop, resolved by the host (`DialFileManagerModal` or `DialFileManagerPage`).

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

#### Scenario: Shell forwards the preview props

- **WHEN** the shell is rendered with `previewLabel`, `onPreview` and `previewExtensions`
- **THEN** `DialFileManager` receives `onPreview` and `previewExtensions` unchanged, and the grid action labels include Preview labelled with `previewLabel`

#### Scenario: Shell without a preview label offers no Preview

- **WHEN** the shell is rendered without `previewLabel`
- **THEN** the grid action labels do not include Preview

#### Scenario: Shell never calls useTranslation

- **WHEN** the shell module is statically analyzed
- **THEN** it contains no import of `useTranslation` from `react-i18next`
