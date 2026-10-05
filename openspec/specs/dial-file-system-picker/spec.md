# dial-file-system-picker Specification

## Purpose

Attaching files from the DIAL file system through the file-manager modal, both in the composer and while editing a message.

> **Sync note (2026-07-23):** The "read-only" framing below was inaccurate.
> `DialFileManagerModal` (attach picker, `actionProfile = Attach`) intentionally
> allows Upload, Create folder, Delete, Rename, and Download — only Move, Copy,
> and permission-management actions are excluded. The requirements below were
> rewritten to match this actual, intended behavior.

## Requirements

### Requirement: Show DIAL file system button in attachment menu

The chat input's `+` attachment menu SHALL include a "DIAL file system" item (i18n key `conversation.attachMenuDialFileSystem`) appended after the existing "Attach file" item, on both mobile (bottom-sheet) and desktop (dropdown).

- `AddAttachmentButton` in `libs/conversation-input` SHALL accept `extraMenuItems?: ExtraMenuItem[]` and merge them after the default "Attach file" item.
- `InputProps` SHALL expose `onDialFileSystemClick?: () => void` and `dialFileSystemLabel?: string`.
- `ConversationInputProps` SHALL expose the same two props and forward them to `Input`.
- When `onDialFileSystemClick` is absent, the menu item SHALL NOT be rendered.
- **i18n key**: `conversation.attachMenuDialFileSystem` (English: `"DIAL file system"`)
- **Memoisation**: `extraMenuItems` array and the `dialFileSystemMenuItem` derived from it MUST be `useMemo`-stabilised in `Input.tsx` to avoid re-rendering the dropdown on every keystroke.
- **Feature flag**: Not gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES` in this slice.

#### Scenario: DIAL file system item appears in desktop dropdown

- **GIVEN** `onDialFileSystemClick` is provided to `ConversationInput`
- **WHEN** the user clicks the `+` trigger button on a desktop viewport
- **THEN** a dropdown appears with two items: "Attach file" and "DIAL file system" in that order

#### Scenario: DIAL file system item appears in mobile bottom-sheet

- **GIVEN** `onDialFileSystemClick` is provided and the viewport is mobile
- **WHEN** the user taps the `+` trigger button
- **THEN** a bottom-sheet opens with both items in that order

#### Scenario: DIAL file system item absent when prop not provided

- **GIVEN** `onDialFileSystemClick` is not passed to `ConversationInput`
- **WHEN** the user opens the attachment menu
- **THEN** only "Attach file" appears; "DIAL file system" is absent

---

### Requirement: DIAL file system button available while editing a message

The edit-message attach (+) menu (`EditMessageInput`, rendered while a message is in edit mode) SHALL offer the same "DIAL file system" item as the new-message composer, using the same `DialFileManagerModal` instance.

- `EditMessageInputProps` SHALL expose `onDialFileSystemClick?: () => void` and `dialFileSystemLabel?: string`, with the same absent-means-not-rendered contract as `InputProps`/`ConversationInputProps`.
- `ConversationView` SHALL wire the edit-mode handler to the same `isDialFileManagerOpen` state and `DialFileManagerModal` instance used by the new-message composer — no second modal instance is created for editing.
- Files attached while editing SHALL be routed to the message currently being edited via `pendingAttachments`/`onPendingAttachmentsConsumed` on `EditMessageInput`, gated so they are never delivered to the new-message composer's draft while an edit is in progress, and vice versa.

#### Scenario: DIAL file system item appears while editing

- **GIVEN** a message is in edit mode and `onDialFileSystemClick` is provided to `EditMessageInput`
- **WHEN** the user clicks the `+` trigger button in the edit action row
- **THEN** the menu shows "Attach file" and "DIAL file system" in that order, matching the new-message composer

#### Scenario: Files attached during edit go to the edited message only

- **GIVEN** a message is in edit mode and the user opens the DIAL file system modal from the edit action row
- **WHEN** the user selects files and clicks Attach
- **THEN** the selected files appear in the edited message's attachment tray
- **THEN** the new-message composer's draft attachments are unaffected

---

### Requirement: Open FileManager in modal

The system SHALL open a modal (title `"Attach files"`, i18n key `basic.attachFiles`) when the user selects "DIAL file system" from the attachment menu. The app's `DialFileManagerModal` (`apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx`) builds the translated labels and the picker state (`useFileAttachmentPicker` from `@epam/ai-dial-chat-hooks`) and renders `FileManagerAttachModal` from `@epam/ai-dial-chat-shared/file-manager`, which renders the ui-kit 2.0 `Popup` with `DialFileManagerShell` (and through it `DialFileManager` from `@epam/ai-dial-react-file-manager`) as its body.

- Modal state (`isDialFileManagerOpen`) is owned by `ConversationView` for an existing conversation and by `NewConversationComposer` (through `useDialFileManagerState`) for a new chat; both lazy-load `DialFileManagerModal` via `React.lazy` + `Suspense`.
- `Popup` is used with `size={PopupSize.Lg}` and `className="flex !h-[min(800px,100dvh)] w-full flex-col !bg-layer-sunken"`, matching the legacy file-manager modal's 800px cap and overriding the ui-kit's desktop auto-height. No `closeOnOutsideClick` prop is passed.
- The Attach button is the popup's single `mainButtons` entry (`ButtonVariant.Primary`).
- Closing the modal does NOT modify `message` text or the local `attachments` list in `Input`.
- The popup body wrapper uses `flex h-full min-h-0 flex-col`; the shell's file-manager wrapper and `DialFileManager` use `grow`. Row count SHALL NOT resize the modal.
- For the Attach variant, `DialFileManager.gridClassName` SHALL be `"size-full gap-6 px-6 py-4"` (other variants use `"size-full"`) and `gridOptions.additionalGridOptions.domLayout` SHALL be `"normal"` so the AG Grid viewport consumes the available manager height instead of using row-driven auto-height.

#### Scenario: Opening the modal

- **GIVEN** the user is on the conversation page and the input is not disabled
- **WHEN** the user clicks "DIAL file system" in the attachment menu
- **THEN** a modal with title "Attach files" opens; `DialFileManager` is rendered inside it

#### Scenario: Closing the modal

- **GIVEN** the DIAL file system modal is open
- **WHEN** the user clicks the close button
- **THEN** the modal closes; the message draft and any existing attachments are unchanged

---

### Requirement: Load files through `useDialFileManager`

The system SHALL load listings through `useDialFileManager` in `libs/chat-hooks/src/files/useDialFileManager/useDialFileManager.ts` (`@epam/ai-dial-chat-hooks`). The hook takes an injected, already-configured `filesApi` plus `bucket`, `rootLabel`, `activeTab`, `variant`, `actionProfile`, `labels` and notification callbacks, and composes the listing (`useDialFileListing`), upload, mutation, sharing and metadata sub-hooks into one controller result consumed by `DialFileManagerShell`. Listing is owned by `useDialFileListing` (`libs/chat-hooks/src/files/useDialFileListing/useDialFileListing.ts`), which:

- Fetches the current folder for the active tab (for My files, `DialFilesApi.listFiles` for `bucket` and the current folder path) inside a `useEffect` with a `cancelled` flag.
- Caches each visited folder response by API path and rebuilds an accumulated `DialFile[]` hierarchy so loaded parent and sibling folders remain available during navigation.
- Exposes, among other fields, `items`, `isLoading`, `error`, `path`, `onPathChange` and `retry`, which `useDialFileManager` passes through.
- On unmount or dependency change, sets `cancelled = true` to prevent `setState` after unmount.
- `retryCounter` (internal number state) is incremented by `retry()` to re-trigger the `useEffect`.
- On a `404` for a non-root folder, falls back to the parent folder instead of surfacing an error.

**State owner**: `useDialFileManager` / `useDialFileListing` (not a React Context — single modal instance scope).

**Server API**: the app supplies `filesApi` as `dialFilesApiAdapter` (`apps/chat/src/server-api/dial-files-api.adapter.ts`, a `DialFilesApi` over the generated `@epam/ai-dial-chat-api-client` client) via `useDialFileManagerHostOptions`; the hooks never construct a client. No direct `fetch`, no `base.ts` helpers, and no hardcoded `/api/v1/files/list` string.

**Memoisation**: `onPathChange` MUST be wrapped in `useCallback`; `items` reference is stable between re-renders when the data has not changed.

**i18n keys**: None — the hook returns raw error information; the modal translates it.

**Feature flag**: None.

**Cache**: Per-modal, in-memory folder cache with no TTL. It is discarded when the modal unmounts and refreshed when a folder is revisited or retry is requested.

#### Scenario: Revisiting a loaded folder serves the accumulated hierarchy

- **WHEN** the user opens a subfolder and then navigates back to its parent
- **THEN** the parent and its siblings are still present in `items` without a second `listFiles` call for the parent path

#### Scenario: Unmounting mid-request sets no state

- **WHEN** the modal unmounts while a `listFiles` request is still in flight
- **THEN** the `cancelled` flag suppresses the state update and no React unmounted-update warning is produced

---

### Requirement: Select and attach DIAL files with scoped mutation actions

`DialFileManager` SHALL be rendered with `actionProfile = DialFileManagerActionProfile.Attach`. This profile scopes down — but does not eliminate — mutation actions: Upload, Create folder, Delete, Rename, and Download remain reachable so the user can manage files while picking what to attach; Move, Copy, and permission-management actions are excluded because they imply a destination/ownership context the attach flow does not have.

`DialFileManagerShell` always passes `onMoveToFiles`, `onCopyFiles`, `onUnshareFiles`, `onRemoveFilesAccess` and `onGetInfo` from the controller. Under `actionProfile = Attach` their actions are hidden by leaving their entries out of `actionLabels`: Copy/Move/Duplicate via `isCopyMoveDuplicateAllowed`, Unshare/Remove access via `isShareActionsAllowed` (both in `libs/chat-hooks/src/files/dial-file-manager-path.util.ts`), and Info is labelled only for `DialFileManagerActionProfile.Full`.

`DialFileManagerShell` SHALL pass, among others, the following props wired from the `useDialFileManager` controller:

| Prop | Value |
|------|-------|
| `items` | `useDialFileManager().items` |
| `path` | `useDialFileManager().path` |
| `onPathChange` | `useDialFileManager().onPathChange` |
| `filesLoading` | `useDialFileManager().isLoading` |
| `selectedPaths` | controlled modal selection |
| `onSelectedPathsChange` | updates controlled modal selection |
| `gridOptions.selectionMode` | `GridSelectionMode.MULTIPLE` |
| `uploadEnabled` | computed by `useDialFileManager` from active tab and write permission (e.g. `true` on the "My files" tab when the user has write access; `false` on read-only tabs such as Organization or the Shared root) — never hardcoded |
| `onUploadFiles` / `onUploadArchive` / `onValidateUpload` | wired; reachable via the toolbar "New" action when `uploadEnabled` is `true` |
| `onCreateFolder` / `onCreateFolderValidate` | wired; reachable via the toolbar "New" action alongside upload |
| `onDeleteFiles` / `deleteConfirmationOptions` | wired; reachable as a row/bulk action on the "My files" tab |
| `onRenameValidate` | wired; reachable as a row action when `uploadEnabled` is `true` |
| `onDownloadFiles` | wired; reachable as a row/bulk action unconditionally |
| `emptyStateTitle` / `emptyStateDescription` | from the shell's empty-state selection (see the empty-state requirement) |

`bulkActionsToolbarOptions` derives from the same `actionLabels`, so the hidden actions above are absent there too.

Only rows with `nodeType === DialFileNodeType.ITEM` SHALL be selectable for attaching. The modal footer SHALL contain an "Attach" primary button (i18n key `dialFileManager.attach`) disabled while no files are selected or files are loading. Selecting the Attach button attaches the current selection; it does not depend on whether Upload/Create-folder/Delete/Rename/Download were used beforehand in the same session.

When the user clicks "Attach":

- selected `DialFile` items are converted at the app edge to generic `Attachment` values;
- DIAL storage URLs are preserved or constructed as `files/{bucket}/{path}`;
- the modal closes;
- attachments appear in the existing input attachment tray;
- `onUploadAttachment` is not called for these already-uploaded files;
- duplicate attachment IDs are not added twice.

The library contract is `pendingAttachments?: Attachment[]` plus `onPendingAttachmentsConsumed?: () => void`. It contains no DIAL bucket, path, API client, or app-context knowledge.

#### Scenario: Attach selected files

- **GIVEN** two file rows are selected and no folder row is selectable
- **WHEN** the user clicks "Attach"
- **THEN** both files appear in the message attachment tray, the modal closes, and neither file is uploaded again

#### Scenario: Root load success

- **GIVEN** the modal is opened and `bucket = "my-bucket"`
- **WHEN** `listFiles({ bucket: 'my-bucket', path: '' })` resolves with items
- **THEN** `DialFileManager` renders those items in the grid; `filesLoading` is `false`

---

### Requirement: Navigate folders

When the user clicks a folder in `DialFileManager`, `onPathChange` SHALL fire with the folder's new path. The hook then updates `folderPath`, triggers a new `listFiles` call for the subfolder, and the grid updates.

- `onPathChange(nextPath)` strips the virtual root prefix and maps back to the BFF `path` parameter.
- Navigation into a subfolder resets `isLoading` to `true` and `error` to `null`.

#### Scenario: Folder navigation

- **GIVEN** the modal shows the root folder with a subfolder named "reports"
- **WHEN** the user clicks the "reports" folder
- **THEN** `onPathChange` fires, `listFiles({ bucket, path: 'reports/' })` is called, and the grid updates to show "reports/" contents

---

### Requirement: Handle loading, empty, error, and retry states

The modal SHALL render a distinct loading, empty, and error state, and the error state SHALL offer a retry that re-issues the listing request.

**Loading state**
- `filesLoading={true}` is passed to `DialFileManager`, which renders a built-in skeleton.
- i18n key: none needed — `DialFileManager` handles the skeleton UI internally.

**Tabs**
- The modal opens on the All tab (`initialTab: DialFileManagerTabs.All`) and offers the All, My files, Shared and Organization tabs, filtered by the app config's `fileManagerTabs`.

**Empty folder state**
- When `items.length === 0 && !isLoading && !error`, `DialFileManager` shows an empty state chosen by `DialFileManagerShell`: an empty search shows `searchEmptyStateTitle` (`basic.noResults`); an empty subfolder shows `folderEmptyStateTitle` (i18n key `dialFileManager.empty`, English: `"This folder is empty"`) with an empty description; a tab root shows that tab's entry from `emptyStateByTab` (`dialFileManager.myFiles.emptyStateTitle`/`emptyStateDescription` for My files and All, and the matching `dialFileManager.shared.*` and `dialFileManager.organization.*` keys).

**Error state**
- When `error != null`, the modal body renders a `role="alert"` error card with the message (i18n key `dialFileManager.error`) and a retry button (i18n key `dialFileManager.retry`).
- `DialFileManager` is NOT rendered during the error state.
- Clicking retry calls `useDialFileManager().retry()`, which increments `retryCounter`, causing the `useEffect` to re-run.

**Retry success**
- After retry, if the fetch succeeds, the error card disappears and `DialFileManager` renders the items.

#### Scenario: Loading state

- **GIVEN** the modal just opened
- **WHEN** `listFiles` has not yet resolved
- **THEN** `filesLoading={true}` is passed and `DialFileManager` shows a loading skeleton

#### Scenario: Empty folder

- **GIVEN** the current subfolder has no items
- **WHEN** `listFiles` returns `{ items: [] }`
- **THEN** `DialFileManager` shows the empty state with title "This folder is empty"

#### Scenario: Load failure with retry

- **GIVEN** `listFiles` rejects (e.g., network error or `5xx`)
- **WHEN** the error occurs
- **THEN** an error card with `role="alert"` is shown; a "Retry" button is visible
- **WHEN** the user clicks "Retry"
- **THEN** `useDialFileManager` re-fetches; if successful, the error card disappears and items render

---

### Requirement: Preserve existing attach files behavior

The existing "Attach file" menu item and device-file-picker behavior MUST be unmodified:

- `onAttachClick` still triggers `fileInputRef.current?.click()`.
- `attachLabel` and `addMenuLabel` props are unchanged.
- Existing tests for `AddAttachmentButton` and `Input` continue to pass.
- No existing `InputProps` / `ConversationInputProps` are removed or have their types narrowed.

#### Scenario: Existing attach still works

- **GIVEN** the user opens the attachment menu
- **WHEN** the user clicks "Attach file"
- **THEN** the device file picker opens (unchanged behavior)

---

### Requirement: Scoped mutation actions available

The `DialFileManager` rendered in this modal SHALL expose only a subset of mutation actions, gated by `actionProfile = Attach`:

**Reachable** (row, bulk, and/or toolbar action, subject to tab/permission as noted above):

- Upload (toolbar "New" action, when `uploadEnabled` is `true`)
- Create folder (toolbar "New" action, when `uploadEnabled` is `true`)
- Delete (row/bulk action on the "My files" tab)
- Rename (row action, when `uploadEnabled` is `true`)
- Download (row/bulk action, unconditional)

**NOT reachable** (handlers are still passed, but the actions are excluded from `actionLabels` / `bulkActionsToolbarOptions`):

- Move
- Copy
- Manage permissions (including unshare / remove access)
- Get info

#### Scenario: Upload and create-folder are available on My files with write access

- **GIVEN** the file manager modal is open on the "My files" tab and the user has write access to the current folder
- **THEN** the toolbar's "New" action offers both "Upload" and "Create folder"

#### Scenario: Move, copy, and permission management are absent

- **GIVEN** the file manager modal is open with files displayed, on any tab
- **THEN** no move option, copy option, or manage-permissions option is visible or reachable via keyboard, regardless of selection

---

### Requirement: i18n, Accessibility, RTL, and Responsive Behavior

The picker SHALL be fully translated, keyboard-operable, direction-agnostic, and usable at both mobile and desktop widths.

**i18n keys** (all in `apps/chat/src/i18n/locales/en.json`):

| Key | English |
|-----|---------|
| `conversation.attachMenuDialFileSystem` | `"DIAL file system"` |
| `basic.attachFiles` | `"Attach files"` |
| `dialFileManager.attach` | `"Attach"` |
| `dialFileManager.empty` | `"This folder is empty"` |
| `dialFileManager.error` | `"Failed to load files"` |
| `dialFileManager.retry` | `"Retry"` |
| `dialFileManager.hiddenFiles` | `"Hidden files"` |
| `dialFileManager.showHiddenFiles` | `"Show hidden files"` |
| `dialFileManager.hideHiddenFiles` | `"Hide hidden files"` |
| `dialFileManager.itemsSelected_one` | `"item selected"` |
| `dialFileManager.itemsSelected_other` | `"items selected"` |

All `aria-label` values in `DialFileManagerModal` go through `t()`. No English strings are hardcoded in the app component.

**Accessibility**:
- `Popup` provides `role="dialog"`, labelled by the title (`ariaLabel={title}`). No extra ARIA needed on the container.
- Error card: `role="alert"` so screen readers announce the failure.
- Retry button: focusable `Button` with a visible text label.
- Focus is trapped inside `Popup` while open (ui-kit built-in).
- Keyboard navigation: `DialFileManager` provides built-in keyboard support for tree and grid navigation.

**RTL**:
- All directional Tailwind classes in `DialFileManagerModal` use logical properties (`ms-*`, `ps-*`, `start-*`, `text-start`).
- No physical `left-*` / `right-*` in `DialFileManagerModal`.
- `Popup` and `DialFileManager` inherit `dir` from `<html>` and handle RTL internally.
- `ExtraMenuItem.icon` (`IconFile`) is symmetric; it does not need RTL mirroring.

**Responsive**:
- `Popup` with `size={PopupSize.Lg}` renders full-width on small viewports and a centered constrained dialog on wider ones (ui-kit behavior).
- The popup height is capped with `min(800px, 100dvh)`.
- Only project-defined Tailwind breakpoints (`mobile`, `desktop`) are used for any custom overrides.
- `sm:` / `md:` / `lg:` / `xl:` Tailwind prefixes are NOT introduced.

**Memoisation**:
- `extraMenuItems` array in `Input.tsx`: `useMemo` (stabilises reference across renders).
- `onPathChange` in `useDialFileManager`: `useCallback`.
- `retry` in `useDialFileManager`: `useCallback`.

**Observability / Telemetry**: No new metrics or analytics events required. The existing `MetricsInterceptor` on `GET /api/v1/files/list` tracks request duration automatically.

#### Scenario: Every user-visible string is translated

- **WHEN** `DialFileManagerModal` is rendered
- **THEN** each label and `aria-label` resolves through `t()` against the listed keys, with no hardcoded English in the app component

#### Scenario: A load failure is announced and retryable

- **WHEN** `listFiles` rejects
- **THEN** an error card with `role="alert"` is rendered and its Retry button is reachable by keyboard

#### Scenario: Layout follows the writing direction

- **WHEN** the document is rendered with `dir="rtl"`
- **THEN** the modal's spacing and alignment flip through logical properties, with no physical `left-*` / `right-*` class involved

---

### Requirement: DialFileManagerModal attach callback

The `onAttach` callback of `DialFileManagerModal` SHALL accept an `AttachResult` object instead of a plain `DialFile[]` array:

```ts
interface AttachResult {
  files: DialFile[];     // selected files (MIME/hidden/size validated)
  folderPaths: string[]; // selected folder paths (empty when canAttachFolders is false)
}

interface Props {
  // ... existing props ...
  onAttach: (result: AttachResult) => void;

  // New optional props added in this change:
  allowedTypes?: string[];          // MIME types (e.g. ['image/*', 'application/pdf']); empty = allow all
  maxSelectableFileSize?: number;   // bytes; undefined = no limit
  maximumAttachmentsAmount?: number; // count; undefined or 0 = no limit
  canAttachFolders?: boolean;        // default false
  allowedTypesLabel?: string;        // optional override for the type label in header description
}
```

All in-repo callers of `DialFileManagerModal` SHALL accept `AttachResult`: `ConversationView`, `NewConversationComposer` (via `useDialFileManagerState`), `SkillFileSystemModal`, and `useApplicationAvatarPicker`.

#### Scenario: Callers receive AttachResult on attach

- **WHEN** user selects files and clicks Attach in `DialFileManagerModal`
- **THEN** the `onAttach` callback is called with `{ files: DialFile[], folderPaths: string[] }`

#### Scenario: Backwards compatibility — folderPaths is always present

- **WHEN** `canAttachFolders` is `false` (default)
- **THEN** `onAttach` is called with `folderPaths: []` so callers do not need to null-check
