## Why

`apps/chat-api/src/files/batch/files-batch-operations.service.ts` is 803 lines. It is item B4 (P2) of the 2026-10-26 refactoring audit. About 450 of those lines are three near-identical copies of one transfer pipeline:

| Copy   | Batch method  | Per-item dispatch | File method    | Folder method      |
| ------ | ------------- | ----------------- | -------------- | ------------------ |
| Rename | `renameFiles` | `renameItem`      | `renameFileItem` | `renameFolderItem` |
| Copy   | `copyFiles`   | `copyItem`        | `copyFileItem`   | `copyFolderItem`   |
| Move   | `moveFiles`   | `moveItem`        | `moveFileItem`   | `moveFolderItem`   |

The `move` and `copy` file methods differ only in the SDK call (`moveResource` and `copyResource`) and in their labels. `rename` is `move` with `overwrite: false` and its own labels. The three folder methods differ only in their labels and in the guard that only `move` has, which rejects moving a folder into itself.

Every fix to transfer behavior therefore has to be made three times; the 400-conflict probe and the sequential fan-out are past examples. The file also breaks the `files-service-decomposition` rule that no non-test file in `apps/chat-api/src/files/` exceeds about 400 lines.

## What Changes

- **New `FileTransferKind` enum** (`apps/chat-api/src/files/types/file-transfer-kind.enum.ts`) with the members `Rename`, `Copy` and `Move`. It follows the `scheduled-tasks/types/*.enum.ts` pattern.
- **New pure module `batch/file-transfer-strategy.ts`** holding a `FILE_TRANSFER_STRATEGIES` record keyed by `FileTransferKind`. Each entry carries everything that differs between the three operations:
  - the SDK operation (`moveResource` or `copyResource`);
  - the `handleDialSdkError` operation tag (`files.renameItem` and so on);
  - the generic and partial-failure error strings ("Rename failed", "Partial rename" and so on);
  - the log names (`Rename files started`, `renameFileItem failed: …`);
  - whether overwrite is honored (rename always sends `false`);
  - whether a destination inside the source is rejected (move only).

  `getResourceOperationErrorMessage` moves there too, and the three `get<Op>ErrorMessage` wrappers become one function that reads its tag and fallback from the strategy.
- **`FilesBatchOperationsService`** replaces the nine rename/copy/move private methods and the three bodies of the public methods with one private generic pipeline: `transferFiles`, `transferItem`, `transferFileItem`, `transferFolderItem`.
  - `renameFiles`, `copyFiles` and `moveFiles` keep their signatures and become one-line delegations.
  - `resolveTransferErrorMessage`, `runFolderFanOut`, `resourceExists` and the whole delete path stay as they are. The spec cites `resolveTransferErrorMessage` by name.
  - The file shrinks to about 430 lines.

No behavior changes:

- the same DIAL Core calls and bodies;
- the same per-item `error` strings, including `Conflict`, `Forbidden`, `Not found` and the "Cannot move a folder into itself or its subfolders" guard;
- the same sequential child fan-out and parallel top-level items;
- the same log text;
- the same DTOs and OpenAPI.

### Non-goals

- Changing delete. Its per-item contract (`{ path }`, 404-as-success, marker deletion) is different.
- Adding the nested-destination guard to rename. That would be a behavior change: rename keeps the parent folder, so its destination is never inside the source in practice, but the guard is still not added here.
- Unifying the `RenameItemResultDto`/`CopyItemResultDto`/`MoveItemResultDto` classes. They are separate OpenAPI schemas.
- Splitting the 1361-line spec or touching `files-upload.service.ts` (B5).

### Acceptance criteria

- `files-batch-operations.service.ts` contains no method whose name starts with `rename`, `copy` or `move` other than the three public batch methods. It calls `copyResource`/`moveResource` in exactly one place, and the error strings live only in `file-transfer-strategy.ts`.
- The file is under 450 lines.
- `tests/batch/files-batch-operations.service.spec.ts` passes unchanged: all 51 tests, the same assertions and the same mocks.
- New unit tests in `tests/batch/file-transfer-strategy.spec.ts` pin each strategy's labels, SDK operation and flags, and the error-message mapping.
- `npm exec nx test chat-api`, `lint` and `build` pass, and `npm run openapi:check` reports no diff.

### Alternatives considered

1. **Extract only the shared folder tail** (baseline): one helper for "fan out, then aggregate Partial X". Low risk, but the three file methods, three dispatchers and three batch methods stay, and the file stays around 650 lines. Rejected because it does not remove the duplication that causes the triple fixes.
2. **Strategy table plus one generic pipeline inside the service** (chosen). It removes all three copies, keeps the class and its constructor, so the `files-service-decomposition` "independently unit-testable" scenario still needs only three mocks, and it keeps every difference in one reviewable record.
3. **Three `FileTransferStrategy` classes** (a class per operation behind an interface, or Nest providers). Rejected: the differences are data, not behavior, apart from one boolean guard and the SDK operation name. Classes would add three files and DI wiring for no gain.

### Rollback

The change is internal to `chat-api` and preserves behavior. Reverting the commit restores it, with no contract, data or cache migration.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `files-service-decomposition`: the `FilesBatchOperationsService` entry of "Files domain service ownership map" now also states that rename, copy and move share one strategy-driven transfer pipeline keyed by `FileTransferKind`.
- `file-manager-copy-move`: "Folder copy via paginated expansion" cites `renameFolderItem`/`deleteFolderItem` as the sequential-concurrency precedent. That now reads as the shared transfer pipeline's folder step and `deleteFolderItem`, because `renameFolderItem` no longer exists.

## Impact

- **Code:**
  - Rewritten: `apps/chat-api/src/files/batch/files-batch-operations.service.ts`.
  - New: `apps/chat-api/src/files/batch/file-transfer-strategy.ts` and `apps/chat-api/src/files/types/file-transfer-kind.enum.ts`.
- **Tests:** new `apps/chat-api/src/files/tests/batch/file-transfer-strategy.spec.ts`. The existing service spec is unchanged.
- **Unaffected:**
  - the controller, `FilesService`, `files.module.ts`, DTOs, OpenAPI and the generated client;
  - the frontend and libs;
  - env vars (`FILE_TRANSFER_TIMEOUT_MS` is unchanged);
  - i18n: no new strings, and the per-item `error` strings are server-side literals the client already maps;
  - RTL and a11y (there is no UI), feature gating and telemetry;
  - docs: `docs/architecture.md` does not describe the batch internals.
