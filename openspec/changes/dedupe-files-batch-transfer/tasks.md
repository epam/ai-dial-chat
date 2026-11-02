Slicing: risk-first, then vertical. First the pure strategy module and its unit tests pin every per-operation difference. Then the service moves onto the shared pipeline one operation at a time: move, which has the most variants (overwrite and the nested guard), then copy, then rename. The unchanged service spec must stay green after each slice. All paths are under `apps/chat-api/src/files/`. Relative imports are extensionless. No file outside `files/` changes except this change's OpenSpec folder.

Deviation recorded at apply time: slices 2–4 were applied in one edit and verified together. The unchanged service spec passed (51 tests), and so did the new strategy spec. The shared `TransferItem`, `TransferItemResult` and `TransferCall` types live in `file-transfer-strategy.ts`, to keep the service near 500 lines.

## 1. Strategy module

- [x] 1.1 Create `types/file-transfer-kind.enum.ts` with `FileTransferKind { Rename = 'rename', Copy = 'copy', Move = 'move' }` and a JSDoc summary.
- [x] 1.2 Create `batch/file-transfer-strategy.ts`:
  - the `FileTransferStrategy` interface (design D1) with JSDoc on each field;
  - `FILE_TRANSFER_STRATEGIES`, with values taken from the Context table in design.md;
  - the moved private `getResourceOperationErrorMessage`, unchanged;
  - the exported `getTransferErrorMessage(strategy, error, response?)`.
- [x] 1.3 Add `tests/batch/file-transfer-strategy.spec.ts`. It asserts each kind's SDK operation, tag, labels, `honorsOverwrite` and `rejectsNestedDestination`, and that `getTransferErrorMessage` maps 409/403/404 to `Conflict`/`Forbidden`/`Not found` and anything else to the kind's `failedError`.

Verification: `npm run test:file -- apps/chat-api/src/files/tests/batch/file-transfer-strategy.spec.ts`

## 2. Shared pipeline, move first

- [x] 2.1 In `batch/files-batch-operations.service.ts`:
  - add the shared `TransferItem`/`TransferItemResult` shapes and the private `transferFiles`, `transferItem`, `transferFileItem` and `transferFolderItem` (design D2/D3). `transferFileItem` calls `this.dialClient.client[strategy.sdkOperation]` through a narrow local call type;
  - point `moveFiles` at `transferFiles(FileTransferKind.Move, …)`;
  - delete `moveItem`, `moveFileItem`, `moveFolderItem` and `getMoveErrorMessage`.

Verification: `npm run test:file -- apps/chat-api/src/files/tests/batch/files-batch-operations.service.spec.ts`

## 3. Copy

- [x] 3.1 Point `copyFiles` at `transferFiles(FileTransferKind.Copy, …)`. Delete `copyItem`, `copyFileItem`, `copyFolderItem` and `getCopyErrorMessage`.

Verification: `npm run test:file -- apps/chat-api/src/files/tests/batch/files-batch-operations.service.spec.ts`

## 4. Rename

- [x] 4.1 Point `renameFiles` at `transferFiles(FileTransferKind.Rename, …)`. Delete `renameItem`, `renameFileItem`, `renameFolderItem`, `getRenameErrorMessage` and the now-unused module-level `getResourceOperationErrorMessage`.

Verification: `npm run test:file -- apps/chat-api/src/files/tests/batch/files-batch-operations.service.spec.ts apps/chat-api/src/files/tests/batch/file-transfer-strategy.spec.ts`

## 5. Close

- [x] 5.1 Remove unused imports. Confirm the service file is about 500 lines (the target was revised from under 450, see design Goals), that `copyResource`/`moveResource` appear in it only through `strategy.sdkOperation`, and that the strings "Rename failed", "Copy failed", "Move failed" and "Partial …" appear only in `file-transfer-strategy.ts`.
- [x] 5.2 Confirm `git diff --stat` shows `tests/batch/files-batch-operations.service.spec.ts`, `files.service.ts`, `files.module.ts`, the controller and every DTO unchanged.
- [x] 5.3 `npm exec nx run-many -- -t test lint build -p chat-api --excludeTaskDependencies --parallel=1` passes.
- [x] 5.4 `npm run openapi:check` reports no diff, and `npm run validate:specs` passes.
- [ ] 5.5 Run `npm run verify:full` once.

## 6. Follow-up (out of scope)

- [ ] 6.1 Propose `extract-archive-upload-service` (refactoring plan B5, `files-upload.service.ts` at 751 lines).
