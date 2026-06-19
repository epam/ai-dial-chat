# Spec: File Manager Upload

## State ownership

`useDialFileManager` (`apps/chat/src/hooks/files/useDialFileManager.ts`) owns all upload state. No new React Context is introduced.

New state fields added to the hook:

```ts
const [uploadBatchState, setUploadBatchState] = useState<FileUploadBatchState | null>(null);
const uploadAbortControllerRef = useRef<AbortController | null>(null);
```

Derived callbacks exposed in `UseDialFileManagerResult`:
- `onUploadFiles(files, destinationFolder)` — starts a new upload batch
- `onValidateUpload(files, existingFiles, destinationFolder)` — validates names before upload
- `cancelUpload()` — aborts in-flight uploads

---

## API endpoint

### Reused: `POST /api/v1/files`

No changes to the existing contract (see `openspec/specs/file-upload/spec.md`).

- **operationId**: `uploadFile` (existing)
- **Generated SDK method**: `filesApi.uploadFile({ file, bucket, path })` (existing)
- **Frontend wrapper**: `uploadFile(bucket, path, file, options?)` in `apps/chat/src/server-api/files.api.ts`
- **Progress transport**: when `options.onProgress` is provided, the wrapper uses `uploadFileWithProgress()` (`XMLHttpRequest` → `POST /api/v1/files` with the same multipart fields: `file`, `bucket`, `path`). Otherwise it uses `filesApi.uploadFile()` (fetch via generated client).
- **Generator gap**: None for JSON response — returns `{ url: string }`. Progress requires the hand-authored XHR wrapper because fetch does not expose upload events.

For cancellation, both transport paths accept `signal?: AbortSignal`.

---

## FileUploadStatus enum

Defined in `apps/chat/src/hooks/files/useDialFileManager.ts` (co-located, or extracted to `apps/chat/src/components/DialFileManagerModal/types/`):

```ts
enum FileUploadStatus {
  Queued = 'queued',
  Uploading = 'uploading',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
}
```

---

## Upload concurrency

`UPLOAD_CONCURRENCY = 3` (constant in `useDialFileManager`). Up to three files upload simultaneously; remaining files stay `Queued` until a slot opens.

---

## Validation (`onValidateUpload`)

Called by `DialFileManager` before invoking `onUploadFiles`.

```ts
onValidateUpload: async (
  files: DialUploadFileItem[],
  existingFiles: DialFile[],
  _destinationFolder: string,
): Promise<FileUploadValidationResult>
```

- Checks each file name against `existingFiles` (case-insensitive).
- Returns the ui-kit `FileUploadValidationResult` type indicating which files have name conflicts.
- Does **not** call the BFF — purely client-side against the cached item list.
- If the ui-kit surfaces a conflict warning and the user proceeds, `onUploadFiles` receives only the user-confirmed files.

---

## Upload progress UI

`UploadProgressModal` in `apps/chat/src/components/DialFileManagerModal/UploadProgressModal.tsx` — visual parity with legacy [`FilesUploadingModal`](https://github.com/epam/ai-dial-chat/blob/development/apps/chat/src/components/FileManager/FilesUploadingModal.tsx).

**Props interface:**
```ts
interface Props {
  batchState: FileUploadBatchState;
  uploadProgressTitle: string;
  uploadProgressText: string;
  cancelLabel: string;
  onCancel: () => void;
}
```

**Behavior:**
- Opens when `uploadBatchState` is set (non-null).
- Fixed-width popup (`400px`), `dividers={false}`, `closeOnOutsideClick={false}`, `hideClose`.
- Header: title + pre-computed summary text (`{{done}} of {{total}} complete`; `done` = files whose status is not `Uploading`).
- Each row: `DialFileName` + optional progress bar when `entry.percent` is defined. No status chip, no numeric `%` label.
- Footer: single **Cancel** button. Calls `cancelUpload()` then clears `uploadBatchState`.
- When the batch settles (`Completed`, `Failed`, or `Cancelled` for all files), `useDialFileManager` auto-clears `uploadBatchState` (legacy auto-dismiss).
- Internal state still uses `FileUploadStatus` for orchestration; only the progress bar is surfaced in the modal UI.
- QA hooks: `data-qa="uploading-indicator"` on the bar, `data-qa="uploading-items-count"` on the summary.

**Parent wiring (`DialFileManagerModal`):**
- Computes `uploadProgressText` via `useTranslation` and passes it with `buttons.cancel` as `cancelLabel`.
- No `useTranslation` inside `UploadProgressModal` (lib boundary pattern).

---

## i18n keys

| Key | English |
|-----|---------|
| `dialFileManager.upload` | `"Upload files"` |
| `dialFileManager.uploadProgressTitle` | `"Uploading files"` |
| `dialFileManager.uploadProgressSummary` | `"{{done}} of {{total}} complete"` |
| `dialFileManager.uploadConflict` | `"A file with this name already exists"` |
| `buttons.cancel` | `"Cancel"` (reused common key for modal footer) |

All `dialFileManager.*` keys go in `apps/chat/src/i18n/locales/en.json`. Summary and cancel label are resolved in `DialFileManagerModal` and passed as props to `UploadProgressModal`.

---

## Cache invalidation

After the upload batch settles (all files `Completed`, `Failed`, or `Cancelled`), `useDialFileManager` calls:

```ts
setCache((prev) => {
  const next = new Map(prev);
  next.delete(destinationApiPath); // invalidate only the affected folder
  return next;
});
setRetryCounter((c) => c + 1); // re-fetch current folder
```

---

## RTL / direction impact

- `UploadProgressModal` uses symmetric layout (filename + full-width bar); no directional icons.
- Cancel button is symmetric — no mirroring needed.

---

## Accessibility

- Progress bars expose `role="progressbar"` with `aria-valuenow/min/max`.
- Cancel button has a visible text label (`buttons.cancel`).
- Focus is trapped inside `DialPopup` while open (ui-kit built-in).

---

## Memoisation

- `onUploadFiles` wrapped in `useCallback` in `useDialFileManager`.
- `onValidateUpload` wrapped in `useCallback`.
- `cancelUpload` wrapped in `useCallback`.

---

## Feature flag

Not gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES`.

---

## Rate limiting

Reuses `POST /api/v1/files` limit: `@Throttle({ default: { limit: 20, ttl: 60000 } })`. With `UPLOAD_CONCURRENCY = 3`, a single user uploading a 20-file batch uses 20 slots in 60 seconds — exactly at the limit. This is acceptable; larger batches will queue on the frontend.

---

## Scenarios

### Scenario: Upload a single file successfully

- **GIVEN** the user is on the root folder
- **WHEN** the user clicks "Upload files", selects `report.pdf`, and confirms
- **THEN** `onUploadFiles([{ name: 'report.pdf', fileContent: File }], '/All files')` is called
- **AND** `uploadBatchState` is set with one entry `{ name: 'report.pdf', status: FileUploadStatus.Queued }`
- **AND** `UploadProgressModal` opens showing the file name (no status label)
- **AND** the file transitions through internal `Uploading` with a progress bar, then `Completed`
- **AND** `POST /api/v1/files` is called with `{ bucket, path: 'report.pdf', file }` via the XHR progress transport
- **AND** after completion the root folder cache is invalidated and re-fetched
- **AND** the modal auto-closes when the batch settles

---

### Scenario: Upload multiple files

- **GIVEN** the user selects 5 files
- **WHEN** `onUploadFiles` is called
- **THEN** the first 3 files transition to "Uploading" simultaneously; the remaining 2 stay "Queued"
- **AND** as each file completes, the next queued file starts
- **AND** all 5 files eventually reach "Completed" or "Failed"

---

### Scenario: Upload into a nested folder

- **GIVEN** the user is browsed into `/All files/reports/2026/`
- **WHEN** the user uploads `q1.pdf`
- **THEN** `onUploadFiles` receives `destinationFolder = '/All files/reports/2026/'`
- **AND** the hook strips the root prefix and derives `apiPath = 'reports/2026/'`
- **AND** `POST /api/v1/files` is called with `{ bucket, path: 'reports/2026/q1.pdf', file }`

---

### Scenario: Duplicate filename conflict

- **GIVEN** the current folder already contains `notes.txt`
- **WHEN** the user selects a local file also named `notes.txt`
- **THEN** `onValidateUpload` detects the conflict and returns a `FileUploadValidationResult` indicating the conflict
- **AND** the ui-kit shows the conflict to the user before calling `onUploadFiles`
- **AND** the user must explicitly confirm or cancel; no silent overwrite occurs

---

### Scenario: Partial upload failure

- **GIVEN** the user uploads 3 files; the second fails with a `502` from the BFF
- **WHEN** the batch completes
- **THEN** files 1 and 3 reach `Completed` internally; file 2 reaches `Failed`
- **AND** the folder cache is still invalidated and re-fetched (successfully uploaded files appear)
- **AND** the modal auto-closes when the batch settles

---

### Scenario: Upload cancellation

- **GIVEN** an upload batch of 4 files is in progress (2 uploading, 2 queued)
- **WHEN** the user clicks **Cancel**
- **THEN** `cancelUpload()` is called; the `AbortController` is aborted
- **AND** the 2 in-flight requests receive an abort signal and reject
- **AND** the 2 in-flight files transition to "Cancelled"; the 2 queued files also transition to "Cancelled"
- **AND** no further `POST /api/v1/files` requests are issued
- **AND** the folder cache is invalidated (any files that completed before cancellation are visible)

---

### Scenario: Unsupported file type / invalid name

- **GIVEN** `allowedFileTypes` is not set (all types allowed by default)
- **WHEN** the user selects any file
- **THEN** no type rejection occurs at the BFF level (the BFF does not validate MIME type; `FILE_UPLOAD_MAX_BYTES` enforces size only)

---

### Scenario: File size exceeded

- **GIVEN** the user selects a file larger than `FILE_UPLOAD_MAX_BYTES` (default 512 MB)
- **WHEN** `POST /api/v1/files` receives the request
- **THEN** multer rejects the request; the BFF returns `413 Payload Too Large`
- **AND** the file entry transitions to `Failed` internally; the modal auto-closes when the batch settles

---

### Scenario: Existing Attach behavior unchanged

- **GIVEN** the upload modal is added alongside the existing Attach footer
- **WHEN** the user selects files and clicks "Attach" (no upload action taken)
- **THEN** the existing attach flow is unchanged; `UploadProgressModal` is not shown; no upload is triggered

---

### Scenario: Unsupported mutation actions remain absent

- **GIVEN** the file manager modal is open
- **THEN** no delete, rename, move, copy, share, or permissions management UI is visible or reachable
