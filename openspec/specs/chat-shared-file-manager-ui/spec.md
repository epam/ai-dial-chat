# Spec: chat-shared-file-manager-ui

## Purpose

Specifies the shared UI layer for the file manager extracted into `@epam/ai-dial-chat-shared`: the `FileManagerController` contract, the `DialFileManagerShell` component, operation modals, the attach modal, published styles, package boundaries, and accessibility/RTL/responsive preservation.

## Requirements

### Requirement: Shared file-manager contracts match the current hook and app contracts

`@epam/ai-dial-chat-shared` SHALL export a `FileManagerController` containing
exactly the fields of the current `UseDialFileManagerResult` consumed by
`DialFileManagerShell`, with the same names and types, including its current
`error` and `retry` fields. It SHALL NOT invent `itemsTree`, `onRenameItem`, or
tab fields absent from that result. Tabs, active tab, selection,
destination-picker options, and host integration callbacks SHALL be explicit
component props outside the controller.

The controller's required keys SHALL be exactly the current shell destructure:
`items`, `isLoading`, `error`, `path`, `onPathChange`, `retry`,
`onSearchFiles`, `isSearching`, `searchResults`, `clearSearchResults`,
`expandedPaths`, `loadedPaths`, `onExpandedPathsChange`,
`onFolderPopupPathChange`, `folderPopupLoadingPaths`, `onUploadFiles`,
`onUploadArchive`, `onValidateUpload`, `uploadBatchState`, `cancelUpload`,
`clearUploadBatch`, `onCreateFolder`, `onCreateFolderValidate`,
`onDownloadFiles`, `isDownloading`, `onDeleteFiles`, `isDeleting`,
`onMoveToFiles`, `onRenameValidate`, `isRenaming`, `onCopyFiles`,
`isCopying`, `isMoving`, `cancelCopyMove`, `uploadEnabled`,
`isNewButtonDisabled`, `disabledNewButtonTooltip`, `visibleColumns`,
`dateLocale`, `dateOptions`, `actionLabels`, `sharedWithMeIds`,
`sharedByMePaths`, `onUnshareFiles`, `isUnsharing`, `onRemoveFilesAccess`,
`isRemovingAccess`, `fileMetadata`, `isFileMetadataLoading`, `onGetInfo`, and
`clearMetadata`. Each signature SHALL match `UseDialFileManagerResult`.

The package SHALL also be the canonical source of the current, unchanged
`DialFileManagerActionProfile`, `DialFileManagerVariant`, `FileUploadStatus`,
`FileUploadEntry`, `FileUploadBatchState`, `FileUploadValidationResult`,
`getParentFolderPath`, complete label types, and
`AttachResult { files: DialFile[]; folderPaths: string[] }` contracts.

#### Scenario: Hook result is structurally assignable

- **WHEN** a `UseDialFileManagerResult` value is passed as the controller
- **THEN** TypeScript accepts it without a cast or adapter object

#### Scenario: Tabs remain controlled props

- **WHEN** a host changes the active file-manager tab
- **THEN** `activeTab`, `tabs`, and `onTabChange` flow through shell props and
  no controller-owned tab state is required

#### Scenario: Existing attach result is preserved

- **WHEN** one file and one folder are confirmed in the attach modal
- **THEN** `onAttach` receives `{ files: [DialFile], folderPaths: [string] }`
  with no replacement `paths` or `bucket` shape

### Requirement: The shared shell preserves the current presentation contract

`@epam/ai-dial-chat-shared` SHALL export `DialFileManagerShell` with the current
app shell's complete props and behavior, changing only `hookResult` to
`controller: FileManagerController`. It SHALL preserve listing/search,
breadcrumbs, tabs, selection, new-folder inline editing, copy/move destination
picker, metadata, sharing, upload, browser-download delegation, operation
modals, disabled states, and grid-scroll wiring.

Every user-visible string SHALL come from required typed label props. The shell
SHALL NOT import an app, `react-i18next`, `chat-hooks`, configured API client,
context, router, storage, feature flag, notification transport, or browser URL
policy.

The public props SHALL preserve `labels`, `activeTab`, `tabs`, `onTabChange`,
`selectedPaths`, `onSelectedPathsChange`, `variant`, `actionProfile`, optional
`autoSelectUploadedItems`, `allowedFileTypes`, `maxSelectableFileSize`,
`isRowSelectable`, `getDisabledTooltip`, and
`unsupportedFileTypeTooltip`, with their current types and requiredness.

#### Scenario: Main and destination grids keep distinct API handlers

- **WHEN** the shell renders the main grid and opens a destination picker
- **THEN** the main grid receives `useGridEditingScroll`'s handler and the
  destination grid keeps its existing destination-popup handler

#### Scenario: Host behavior is delegated

- **WHEN** a user downloads or mutates a file
- **THEN** the shell invokes the supplied controller/host callback and does not
  construct an endpoint, client, object URL policy, or notification itself

### Requirement: Loader and upload modals preserve their exact inputs

`@epam/ai-dial-chat-shared` SHALL export `OperationLoaderModal` and
`UploadProgressModal` with their current props and behavior. In particular,
`UploadProgressModal` SHALL receive the current `FileUploadBatchState` shape
`{ files: FileUploadEntry[]; isOpen: boolean }` and a ready-to-render
`uploadProgressText: string`; it SHALL NOT require fabricated aggregate count
fields or a text factory.

#### Scenario: Upload state renders from current entries

- **WHEN** a batch contains pending, uploading, completed, and failed entries
- **THEN** the modal renders the same per-file statuses/progress and supplied
  progress text as the current app component

#### Scenario: Cancellation is preserved

- **WHEN** the user activates the modal's cancel control
- **THEN** the supplied cancel callback is called exactly once

### Requirement: The attach modal is reusable and controlled

`@epam/ai-dial-chat-shared` SHALL export `FileManagerAttachModal`, extracted
from the reusable portion of the current app modal. It SHALL receive resolved
labels, controller, tab/selection state, file constraints, attachment counts,
folder policy, error callback, close callback, and attach callback through
typed props. It SHALL preserve file/folder separation, deduplication,
MIME/extension and size validation, maximum-count enforcement, drag/drop,
auto-selection of uploaded items, and disabled/loading behavior.

App configuration, translations, notification rendering, configured file API,
auth, and hook invocation SHALL remain in the app adapter.

#### Scenario: Controlled selection changes

- **WHEN** a user selects or deselects grid rows
- **THEN** the component calls the supplied selection callback and renders the
  next `selectedPaths` value supplied by the host

#### Scenario: Attachment limit is exceeded

- **WHEN** the current attachments plus valid selected files/folders exceed the
  supplied maximum
- **THEN** the component reports the resolved error through the host callback,
  does not call `onAttach`, and keeps the modal usable

### Requirement: Published styles contain the extracted UI utilities

`chat-shared` SHALL include a Tailwind/PostCSS build entry using the repository
preset and content paths for its source and required peer components. Its
package SHALL export `./styles.css` to the actual Vite-emitted
`./dist/index.css`. The packed package SHALL contain that file with the static,
responsive (`mobile`/`desktop`), logical-direction, and state utilities used by
the extracted components. A global Tailwind base reset SHALL NOT be introduced
unless required by an already documented `chat-shared` contract.

#### Scenario: npm consumer imports styles

- **WHEN** a consumer imports `@epam/ai-dial-chat-shared/styles.css` from the
  packed package
- **THEN** resolution succeeds and the file contains representative shell and
  modal utilities rather than an empty or unrelated stylesheet

### Requirement: Package boundaries and peer dependencies remain explicit

`chat-shared` SHALL declare `@epam/ai-dial-react-file-manager` and
`ag-grid-community` as peer dependencies and Vite externals. It SHALL have no
dependency edge or transitive import to `chat-hooks`, `catalog`, a generated
client, or any app project. AG Grid use SHALL be limited to the separately
specified grid-event binding hook; it SHALL NOT be used for rendering, theming,
column construction, or row-model ownership.

#### Scenario: Isolated library build

- **WHEN** `@epam/ai-dial-chat-shared` is built and packed using only declared
  dependencies and peers
- **THEN** the build succeeds, peers are not bundled, and the Nx graph has no
  forbidden reverse edge

### Requirement: Extracted UI preserves accessibility, RTL, and responsive behavior

The shared components SHALL preserve current keyboard operation, focus
restoration, modal dismissal, live loading/progress feedback, and accessible
names. Hidden panels with focusable descendants SHALL use `inert`. Directional
layout SHALL use logical CSS/Tailwind properties and directional icons SHALL
mirror under RTL. Existing mobile-first behavior SHALL use only the repository
`mobile` and `desktop` breakpoints.

#### Scenario: Arabic attach flow

- **WHEN** the attach modal is used under an Arabic `dir="rtl"` document on a
  mobile viewport
- **THEN** logical layout and directional icons flip correctly while keyboard
  order, focus, selection, validation, and attachment results remain unchanged
