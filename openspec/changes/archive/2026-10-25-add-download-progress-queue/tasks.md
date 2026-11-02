Slicing strategy: **vertical**. The single-file download path works end to end through the shared queue first (slices 1–4), then archives, the estimate and polish widen it (slice 5). The kit ring is a separate, additive slice (6) that chat picks up with a kit bump.

## 1. Transport: cancellable archive and progress-counting response (chat-hooks)

- [x] 1.1 Add `signal?: AbortSignal` to `DialFilesApi.downloadArchive` in `libs/chat-hooks/src/files/dial-files-api.ts`, and forward it as `downloadArchiveRaw(params, { signal })` in `libs/chat-hooks/src/files/create-files-api.ts`
- [x] 1.2 Add `withDownloadProgress(response, onBytes)` in a new `libs/chat-hooks/src/files/download-progress.ts`. It pipes `response.body` through a byte-counting `TransformStream` and returns a new `Response` with the same headers and status; without a body, it returns the response unchanged
- [x] 1.3 Add a neutral `resolveTransferFailureReason` alias next to `resolveUploadFailureReason` in `libs/chat-hooks/src/files/dial-file-manager-mapping.util.ts`, and a helper that turns a non-OK fetch `Response` into an error carrying it. A fetch `TypeError` maps to `Network`
- [x] 1.4 Architecture guard: the new code reads only the injected `DialFilesApi` result and `Response` headers and body. No `/api` paths, no generated-client import outside `create-files-api.ts`, no browser download APIs
- [x] 1.5 Unit tests: `libs/chat-hooks/src/files/tests/download-progress.spec.ts` (bytes counted, headers kept, missing body passes through) and `libs/chat-hooks/src/files/tests/create-files-api.spec.ts` (the archive signal is forwarded)

Verification: `npm run test:file -- libs/chat-hooks/src/files/tests/download-progress.spec.ts libs/chat-hooks/src/files/tests/create-files-api.spec.ts libs/chat-hooks/src/files/tests/dial-file-manager-mapping.util.spec.ts`

## 2. Model: download entries (chat-shared)

- [x] 2.1 Add `FileDownloadStatus` (`Downloading`, `Completed`, `Failed`, `Cancelled`), `FileDownloadEntry` (`{ id; name; status; percent?; failureReason?: FileUploadFailureReason }`) and `FileDownloadBatchState` to `libs/chat-shared/src/file-manager/upload-batch.ts`; document that `FileUploadFailureReason` applies to both kinds
- [x] 2.2 Add `downloadBatchState`, `cancelDownloadFile`, `cancelAllDownloads` and `clearDownloadBatch` to the controller contract in `libs/chat-shared/src/file-manager/file-manager-controller.ts`
- [x] 2.3 Unit tests in `libs/chat-shared/src/file-manager/tests/upload-batch.spec.ts` for any new helpers (e.g. an `isDownloadInProgress` mirror of `isUploadInProgress`)

Verification: `npm run test:file -- libs/chat-shared/src/file-manager/tests/upload-batch.spec.ts`

## 3. Hook: non-blocking `onDownloadFiles` (chat-hooks)

- [x] 3.1 In `libs/chat-hooks/src/files/useDialFileMutations/useDialFileMutations.ts`, replace the `isDownloading` flag flow:
  - keep a `FileDownloadBatchState` and a ref `Map<id, AbortController>`;
  - `onDownloadFiles` adds an entry after the destination resolves (a dismissed picker adds none) and runs the transfer without awaiting it in the caller;
  - wrap the response with `withDownloadProgress`;
  - the total is `Content-Length` for a single file;
  - updates are coalesced per animation frame;
  - settle the entry as `Completed` (keeping the success notification), `Failed` (with a reason, keeping the error notification) or `Cancelled` (no notification)
- [x] 3.2 Expose `downloadBatchState`, `cancelDownloadFile`, `cancelAllDownloads` and `clearDownloadBatch`. Derive `isDownloading` from the batch
- [x] 3.3 Remove `isDownloading` from `isAnyOperationInProgress` in `libs/chat-hooks/src/files/useDialFileManager/useDialFileManager.ts`. Pass the new fields through `useDialFileManager` and `libs/chat-hooks/src/files/useDialFileManagerSections/useDialFileManagerSections.ts`
- [x] 3.4 Unit tests in `libs/chat-hooks/src/files/useDialFileMutations/tests/` (or the existing mutations spec):
  - a download adds an in-progress entry and returns at once;
  - percent tracks `Content-Length`;
  - success settles the entry and raises the success event;
  - failure records a reason and raises the error event;
  - cancel aborts the signal, settles `Cancelled` and raises no event;
  - a dismissed picker adds no entry;
  - `isAnyOperationInProgress` stays false while downloading

Verification: `npm run test:file -- libs/chat-hooks/src/files/useDialFileMutations libs/chat-hooks/src/files/useDialFileManager`

## 4. Shell: one shared queue, no download overlay (chat-shared + app)

- [x] 4.1 Add `toTransferQueueItems(uploadBatch, downloadBatch, failureMessages)` in `libs/chat-shared/src/file-manager/upload-queue.ts`: upload rows first, then download rows; ids prefixed `upload:` / `download:`; `Downloading` maps to in-progress
- [x] 4.2 Add labels to `libs/chat-shared/src/file-manager/labels.ts`:
  - optional `getTransferQueueTitle({ uploads, downloads })`, falling back to `getUploadQueueTitle(total)`;
  - optional `downloadQueueLabels` (cancel and progress aria labels);
  - document that `uploadFailureMessages` applies to both kinds
- [x] 4.3 In `libs/chat-shared/src/file-manager/DialFileManagerShell/DialFileManagerShell.tsx`:
  - render one `TransferQueue` while either batch is open;
  - route cancel by id prefix;
  - on close, cancel both kinds and clear both batches;
  - compose per-row aria wording by kind;
  - drop the downloading branch of `resolveOverlayAriaLabel`
- [x] 4.4 Unit tests: `libs/chat-shared/src/file-manager/tests/upload-queue.spec.ts` (mixed rows, order, prefixes, download status mapping) and the shell spec under `libs/chat-shared/src/file-manager/DialFileManagerShell/tests/`:
  - one queue for both kinds;
  - cancel routing;
  - close aborts both;
  - no overlay while downloading;
  - all queried by role and name
- [x] 4.5 App labels in `apps/chat/src/hooks/files/useUploadQueueLabels.ts`: `getTransferQueueTitle` (upload / download / transfer title by counts) and `downloadQueueLabels`. Both pages pick them up through the existing label spreads in `apps/chat/src/pages/DialFileManagerPage/DialFileManagerPage.tsx` and `apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx`

Verification: `npm run test:file -- libs/chat-shared/src/file-manager/tests/upload-queue.spec.ts libs/chat-shared/src/file-manager/DialFileManagerShell apps/chat/src/pages/DialFileManagerPage apps/chat/src/components/DialFileManagerModal`, then `npm run verify:changed`

## 5. Archives: estimated progress and cancel

- [x] 5.1 In `onDownloadFiles`, for an archive:
  - pass the entry's signal to `downloadArchive`;
  - estimate the total as `sum(contentLength)` only when every selected item is an `ITEM` with a numeric `contentLength`;
  - cap `percent` at 99 until the stream ends;
  - leave it unset when there's no estimate (folders)
- [x] 5.2 Unit tests in the mutations spec:
  - an archive of sized files caps at 99, then completes at 100;
  - a selection with a folder has no percent;
  - archive cancel aborts the `downloadArchive` signal

Verification: `npm run test:file -- libs/chat-hooks/src/files/useDialFileMutations`, then `npm run verify:changed`

## 6. Kit: determinate ring in the queue row (`@epam/ai-dial-ui-kit`, separate PR)

- [x] 6.1 In `c:\projects\ai-dial-ui-kit` `src/components/New/TransferQueue/TransferQueueRow.tsx`, render a determinate SVG ring at `DIAL_ICON_SIZE.SM` (`role="progressbar"`, `aria-valuenow`, `aria-label={labels.itemProgressAriaLabel(name)}`) for an in-progress row with a numeric `percent`; keep the `Spinner` otherwise. Cancel on hover and focus stays in the same cell
- [x] 6.2 Kit spec in `src/components/New/TransferQueue/TransferQueue.spec.tsx` (ring with value when `percent` is set, spinner without), a story, and a `CHANGELOG.md` entry (Added)
- [ ] 6.3 After the kit is released, bump `@epam/ai-dial-ui-kit` in chat (every manifest, the READMEs citing the range, the lockfile, `npm run docs:install-matrix`)

Verification (kit): `npx vitest run src/components/New/TransferQueue`

## 7. Strings, docs and close-out

- [x] 7.1 Add the i18n keys to `apps/chat/src/i18n/locales/en.json` and `DialFileManagerI18nKeys` in `apps/chat/src/constants/translation-keys.ts`: `dialFileManager.downloadQueueTitle_one` / `_other`, `transferQueueTitle_one` / `_other`, `downloadQueueCancelFileAriaLabel`, `downloadQueueFileProgressAriaLabel`, `transferQueueProgressAriaLabel`
- [x] 7.2 RTL check: the queue and its rows use logical placement (`inset-e-4`), the ring isn't mirrored, and no physical classes are introduced
- [x] 7.3 Docs:
  - `libs/chat-shared/README.md` (upload queue section → transfer queue, new types, labels, `toTransferQueueItems`);
  - `libs/chat-hooks/README.md` (download batch fields, `downloadArchive` signal);
  - run `npm run validate:docs` and `npm run validate:specs`
- [ ] 7.4 Close with `npm run verify:full`

## 8. Follow-ups (out of scope, record only)

- [ ] 8.1 Remove the deprecated `DialFileManagerShellLabels.downloadingLabel` together with the `downloadingLabel` prop of `apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx`, its callers (`ConversationView`, `NewConversationComposer`, `SkillFileSystemModal`, `useApplicationAvatarPicker`) and the `builder-form` `AvatarPickerModal` labels, and the `dialFileManager.downloading` key
