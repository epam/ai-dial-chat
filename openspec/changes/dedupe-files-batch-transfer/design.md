## Context

`FilesBatchOperationsService` (`apps/chat-api/src/files/batch/files-batch-operations.service.ts`, 803 lines) serves `POST /api/v1/files/{delete,rename,copy,move}` through the `FilesService` facade. Its constructor takes `DialClientService`, `ConfigService` and `FilesListingService`. Two shared helpers already exist: `runFolderFanOut`, which expands a folder and runs its children sequentially, and `resolveTransferErrorMessage`, which maps a failure and probes for a conflict when DIAL Core answers 400 to a non-overwriting transfer.

Everything else is three copies of the same pipeline.

| Aspect                      | Rename                     | Copy                       | Move                                                    |
| --------------------------- | -------------------------- | -------------------------- | ------------------------------------------------------- |
| SDK call                    | `moveResource`             | `copyResource`             | `moveResource`                                          |
| `overwrite` sent            | always `false`             | `item.overwrite === true`  | `item.overwrite === true`                               |
| SDK error tag               | `files.renameItem`         | `files.copyItem`           | `files.moveItem`                                        |
| Item failure                | `Rename failed`            | `Copy failed`              | `Move failed`                                           |
| Folder partial failure      | `Partial rename`           | `Partial copy`             | `Partial move`                                          |
| Batch log prefix            | `Rename files …`           | `Copy files …`             | `Move files …`                                          |
| Per-item log name           | `renameFileItem …`         | `copyFileItem …`           | `moveFileItem …`                                        |
| Destination inside source   | allowed                    | allowed                    | rejected: `Cannot move a folder into itself or its subfolders`, logged as `moveFolderItem rejected: …` |

The result DTOs (`RenameItemResultDto`, `CopyItemResultDto`, `MoveItemResultDto`) have the same fields: `sourcePath`, `destinationPath`, `success` and `error?`. They are separate classes because each is its own OpenAPI schema.

The spec (`tests/batch/files-batch-operations.service.spec.ts`, 51 tests) drives only the public methods, with a mocked `dialClient.client` and `FilesListingService`. It never calls a private method.

## Goals / Non-Goals

**Goals:**

- One implementation of the rename/copy/move pipeline, with every per-operation difference in one typed record.
- Byte-identical behavior: the same calls, bodies, error strings, log text and ordering.
- The service file under 450 lines, and the existing spec unchanged.

**Non-Goals:**

- Delete. Its result shape and semantics differ, as the proposal records.
- New behavior for rename, such as the nested-destination guard.
- Changes to DTOs, OpenAPI, the controller, `FilesService` or the module.

## Decisions

### D1. Differences are data: `FileTransferKind` plus `FILE_TRANSFER_STRATEGIES`

`apps/chat-api/src/files/types/file-transfer-kind.enum.ts`:

```ts
/** Batch file operation that relocates or duplicates a resource through DIAL Core. */
export enum FileTransferKind {
  Rename = 'rename',
  Copy = 'copy',
  Move = 'move',
}
```

`apps/chat-api/src/files/batch/file-transfer-strategy.ts`:

```ts
export interface FileTransferStrategy {
  /** DIAL Core SDK operation that performs one file transfer. */
  sdkOperation: 'moveResource' | 'copyResource';
  /** `handleDialSdkError` operation tag. */
  operationTag: string;
  /** Batch log prefix, e.g. "Rename" → "Rename files started". */
  batchLabel: string;
  /** Per-item log name, e.g. "rename" → "renameFileItem failed". */
  logName: string;
  /** Per-item `error` when no specific status applies. */
  failedError: string;
  /** Folder `error` when some children failed. */
  partialError: string;
  /** False for rename: the request DTO has no `overwrite`, and DIAL Core always gets `false`. */
  honorsOverwrite: boolean;
  /** True for move: a destination at or inside the source folder is rejected. */
  rejectsNestedDestination: boolean;
}

export const FILE_TRANSFER_STRATEGIES: Record<FileTransferKind, FileTransferStrategy>;

export const getTransferErrorMessage: (
  strategy: FileTransferStrategy,
  error: unknown,
  response?: { status: number },
) => string;
```

`getResourceOperationErrorMessage` moves into this module unchanged, as a private helper. `getTransferErrorMessage` replaces the three `get<Op>ErrorMessage` wrappers by passing `strategy.operationTag` and `strategy.failedError`.

The module is pure, with no Nest and no I/O, so `file-transfer-strategy.spec.ts` can pin every entry and the 409/403/404/fallback mapping without the service.

Enum placement follows the `scheduled-tasks/types/*.enum.ts` precedent. `files/` has no `types/` folder yet; this change creates it. The existing `dto/dial-file-node-type.ts` enum stays where it is, because it is part of the DTO contract.

### D2. One generic pipeline in the service, public methods delegate

All of these are private:

```ts
transferFiles<TResult extends TransferItemResult>(kind, items: TransferItem[], at): Promise<{ results: TResult[] }>
transferItem(kind, item, at): Promise<TransferItemResult>
transferFileItem(kind, bucket, sourcePath, destPath, overwrite, at): Promise<TransferItemResult>
transferFolderItem(kind, bucket, sourceFolderPath, destFolderPath, overwrite, at): Promise<TransferItemResult>
```

`TransferItem` is the shared input shape: `{ bucket; sourcePath; destinationPath; nodeType; overwrite? }`. All three item DTOs satisfy it structurally, with `RenameItemDto` simply lacking `overwrite`. `TransferItemResult` is `{ sourcePath; destinationPath; success; error? }`. All three result DTOs are assignable to and from it, so each public method returns its own response DTO type without a cast.

`transferItem` computes `overwrite = strategy.honorsOverwrite && item.overwrite === true`. That reproduces rename's constant `false` and copy/move's `=== true`.

`transferFileItem` calls `this.dialClient.client[strategy.sdkOperation]({ headers, body: { sourceUrl, destinationUrl, overwrite }, signal })`. Both SDK operations take the same request shape, which the existing code already relies on. The call is typed through a narrow local signature rather than `as never`.

`transferFolderItem` applies the nested-destination guard only when `strategy.rejectsNestedDestination` is set. It keeps the guard's exact comment, log line and error string.

`renameFiles`, `copyFiles` and `moveFiles` keep their signatures, JSDoc and DTO types:

```ts
async copyFiles(items: CopyItemDto[], at: string): Promise<CopyFilesResponseDto> {
  return this.transferFiles(FileTransferKind.Copy, items, at);
}
```

### D3. Log text is reproduced from the strategy, character for character

The batch lines are `${batchLabel} files started: batchSize=…` and `${batchLabel} files completed: batchSize=…, successCount=…, failedCount=…`. All three operations already use the `successCount`/`failedCount` wording; delete's `success=`/`failed=` stays untouched.

The per-item lines are `${logName}FileItem failed: …` and `${logName}FileItem exception: …`, and the guard line is `moveFolderItem rejected: …`.

Specs require the batch start and end lines with `batchSize`, `successCount` and `failedCount` (`file-manager-rename-api`, `file-manager-copy-move`). The new strategy spec asserts the labels that produce them.

### D4. Keep `resolveTransferErrorMessage`'s name and contract

`file-manager-rename-api` and `file-manager-copy-move` cite `FilesBatchOperationsService.resolveTransferErrorMessage` by name. Its `TransferFailure` argument keeps the `mapStatus`/`fallback` pair, which callers fill from the strategy: `mapStatus: (e, r) => getTransferErrorMessage(strategy, e, r)` and `fallback: strategy.failedError`. Its body is unchanged.

### D5. Tests

The existing service spec runs unchanged as the behavior proof for all three operations. It is the acceptance gate.

The new `tests/batch/file-transfer-strategy.spec.ts` covers:

- each kind's SDK operation, labels and flags;
- `getTransferErrorMessage` mapping 409 → `Conflict`, 403 → `Forbidden`, 404 → `Not found`, and anything else → that kind's `failedError`.

Test names describe observable outcomes.

## Risks / Trade-offs

- **Indexing the SDK client by a string key** loses per-operation typing. Mitigation: `sdkOperation` is a two-member literal union, and both operations share a request type. A local `TransferCall` type pins the parameter and result shape, and the service spec mocks both calls.
- **A behavior difference hidden in a copy is missed.** Mitigation: the Context table was built from a line-by-line read of all six methods. The spec has separate rename, copy and move file/folder suites (`renameFiles — single file (renameFileItem)` and so on) that must pass unchanged.
- **The describe titles in the existing spec still name the removed methods** (`renameFileItem`, `copyFolderItem` and so on). Accepted: renaming them would edit the spec, which this change keeps byte-identical. They read as the operation and path being tested.

## Migration Plan

This is an internal refactor and needs no deploy step. Rollback is reverting the commit.

## Open Questions

None.
