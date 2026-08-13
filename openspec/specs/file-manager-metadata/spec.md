# file-manager-metadata Specification

## Purpose

The file Info action and the metadata popup behind it.

## ADDED Requirements

### Requirement: onGetInfo wired on useDialFileManager

`useDialFileManager` (`apps/chat/src/hooks/files/useDialFileManager.ts`) SHALL expose `onGetInfo(file: DialFile)`, wired to ui-kit's `DialFileManager.onGetInfo` prop, that resolves `file` to its Core-addressable `{ bucket, path }` using the same per-tab resolution already used by `onDownloadFiles` (current user bucket on `my_files`; the item's own normalized bucket for root-level `shared` items; `sharedRootMetaRef`/`resolveOwnerCoords` for nested `shared` folder children; the public bucket on `organization`), then calls the existing `getFileMetadata` server-api wrapper (`apps/chat/src/server-api/files.api.ts`, unchanged by this capability).

**State ownership**: `useDialFileManager` owns `fileMetadata: DialFile | undefined` and `isFileMetadataLoading: boolean`. No new context is introduced.

**Response mapping**: the `FileMetadataResponseDto` returned by `getFileMetadata` is mapped into the same `DialFile`-shaped object the hook already produces for listing rows, so `fileMetadataPopupOptions.fileMetadata` receives a value structurally consistent with any other `DialFile` the popup might otherwise see.

**Memoisation**: `onGetInfo` SHALL be a `useCallback` with dependencies `[bucket, items, sharedRootMetaRef]` (or the equivalent set already used by `onDownloadFiles`'s resolution).

#### Scenario: Requesting info for a my_files item resolves the current user's bucket

- **WHEN** `onGetInfo` is called with a file row from the `my_files` tab
- **THEN** `getFileMetadata` is called with the current user's bucket and the file's relative path

#### Scenario: Requesting info for a nested shared item resolves the owner's bucket

- **WHEN** `onGetInfo` is called with a file row nested inside a shared folder on the `shared` tab
- **THEN** `getFileMetadata` is called with the owner bucket resolved via `sharedRootMetaRef`/`resolveOwnerCoords`, not the current user's bucket

#### Scenario: Loading state is set during the request

- **WHEN** `onGetInfo` is called
- **THEN** `isFileMetadataLoading` is `true` until the `getFileMetadata` call resolves or rejects

#### Scenario: Metadata request failure surfaces via notification

- **WHEN** `getFileMetadata` rejects
- **THEN** `onNotification` is called once with `NotificationVariant.Error` and a dedicated info-error message, and `isFileMetadataLoading` returns to `false`

---

### Requirement: clearMetadata resets hook state

`useDialFileManager` SHALL expose `clearMetadata(): void`, passed as `fileMetadataPopupOptions.clearMetadata`, that resets `fileMetadata` to `undefined` and `isFileMetadataLoading` to `false`. Ui-kit calls this when the metadata popup closes.

#### Scenario: Closing the popup clears metadata state

- **WHEN** `clearMetadata` is invoked
- **THEN** `fileMetadata` becomes `undefined` and a subsequent popup open shows a fresh loading state rather than stale data from the previous item

---

### Requirement: fileMetadataPopupOptions carries data and translated labels

`DialFileManagerShell` SHALL pass `fileMetadataPopupOptions={{ fileMetadata, loading: isFileMetadataLoading, clearMetadata, header, nameLabel, pathLabel, modifiedDateLabel, sizeLabel, authorLabel }}` to `DialFileManager`, matching the installed `@epam/ai-dial-react-file-manager`'s `FileMetadataPopupOptions` shape (`fileMetadata?: DialFile; loading?: boolean; clearMetadata?: () => void; header?: ReactNode; nameLabel?: string; pathLabel?: string; modifiedDateLabel?: string; sizeLabel?: string; authorLabel?: string`). The six label fields SHALL each be sourced from a translated `DialFileManagerShellLabels` field (`metadataHeader`, `metadataNameLabel`, `metadataPathLabel`, `metadataModifiedDateLabel`, `metadataSizeLabel`, `metadataAuthorLabel`), resolved by the host via `t()` — never a raw string literal and never left unset to fall back on the package's hardcoded English defaults.

#### Scenario: Popup options contain data and label fields

- **WHEN** `DialFileManagerShell` builds `fileMetadataPopupOptions`
- **THEN** the object contains `fileMetadata`, `loading`, `clearMetadata`, `header`, `nameLabel`, `pathLabel`, `modifiedDateLabel`, `sizeLabel`, and `authorLabel`, with the six label fields populated from translated strings

---

### Requirement: Info action is grid-only, file-only, and Full-profile-only

`gridOptions.actionLabels` SHALL include `DialFileManagerActions.Info` for a row when `row.nodeType !== DialFileNodeType.FOLDER` AND `actionProfile === DialFileManagerActionProfile.Full`, on all three tabs (`my_files`, `shared`, `organization`). `Info` is read-only and is NOT additionally gated on `uploadEnabled`/WRITE permission. `treeOptions.actionLabels` and `bulkActionsToolbarOptions.actionLabels` SHALL NOT include `Info` — the installed ui-kit exposes no tree or bulk-toolbar surface for this action.

#### Scenario: Info shown for a file row on my_files with Full profile

- **WHEN** the active tab is `my_files`, the row is a file, and `actionProfile` is `Full`
- **THEN** `gridOptions.actionLabels` includes `DialFileManagerActions.Info`

#### Scenario: Info shown for a file row on shared and organization tabs with Full profile

- **WHEN** the active tab is `shared` or `organization`, the row is a file, and `actionProfile` is `Full`
- **THEN** `gridOptions.actionLabels` includes `DialFileManagerActions.Info`

#### Scenario: Info hidden for folder rows regardless of profile

- **WHEN** the row's `nodeType` is `folder`
- **THEN** `gridOptions.actionLabels` does NOT include `DialFileManagerActions.Info`, even if `actionProfile` is `Full`

#### Scenario: Info hidden when actionProfile is Browse or Attach

- **WHEN** `actionProfile` is `Browse` or `Attach`
- **THEN** `gridOptions.actionLabels` does NOT include `DialFileManagerActions.Info`, regardless of tab or row type

#### Scenario: Info never appears in tree or bulk toolbar actionLabels

- **WHEN** any tab is active and `actionProfile` is `Full`
- **THEN** `treeOptions.actionLabels` and `bulkActionsToolbarOptions.actionLabels` do NOT include `DialFileManagerActions.Info`

---

### Requirement: Folder metadata is unsupported in this capability

`onGetInfo` SHALL NOT be invoked for folder rows (enforced by the action-visibility rule above, which hides `Info` for folders — there is no additional runtime guard inside `onGetInfo` itself since the action is never reachable for a folder row through the ui-kit UI in this capability).

#### Scenario: Folder rows never trigger a metadata request

- **WHEN** a user browses a tab containing folders
- **THEN** no folder row exposes an `Info` action, and `getFileMetadata` is never called with a folder path

---

### Requirement: i18n keys for the Info action label and metadata popup labels

The key `dialFileManager.infoAction` SHALL be added to `apps/chat/src/i18n/locales/en.json`, with a matching `DialFileManagerI18nKeys.InfoAction` member in `apps/chat/src/constants/translation-keys.ts`. Six additional keys SHALL be added for the metadata popup's own labels: `dialFileManager.metadataHeader`, `dialFileManager.metadataNameLabel`, `dialFileManager.metadataPathLabel`, `dialFileManager.metadataModifiedDateLabel`, `dialFileManager.metadataSizeLabel`, `dialFileManager.metadataAuthorLabel`, each with a matching `DialFileManagerI18nKeys` member (`MetadataHeader`, `MetadataNameLabel`, `MetadataPathLabel`, `MetadataModifiedDateLabel`, `MetadataSizeLabel`, `MetadataAuthorLabel`). A `dialFileManager.getInfoError` key (`DialFileManagerI18nKeys.GetInfoError`) SHALL be added for the metadata-request-failure notification.

#### Scenario: Info action label is translated

- **WHEN** the `Info` action is rendered in the grid
- **THEN** its label is produced via `t(DialFileManagerI18nKeys.InfoAction)`, never a raw string literal

#### Scenario: Metadata popup labels are translated

- **WHEN** `DialFileManagerShell` builds `fileMetadataPopupOptions`
- **THEN** `header`, `nameLabel`, `pathLabel`, `modifiedDateLabel`, `sizeLabel`, and `authorLabel` are each produced via `t()` against their respective `DialFileManagerI18nKeys` member, never a raw string literal

---

### Requirement: No feature-flag gating

Metadata viewing SHALL NOT be gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES` — consistent with the other file-manager actions, which ship unconditionally to users whose `actionProfile` allows the action. Visibility is gated only by `actionProfile` (`Full`) and row type (file, not folder).

#### Scenario: Info is available without a feature flag

- **WHEN** a user has `actionProfile: Full` and views a file row
- **THEN** the `Info` action is available without checking any `ENABLED_FEATURES` entry
