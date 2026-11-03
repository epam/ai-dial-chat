## Context

`FilesUploadService` (`apps/chat-api/src/files/upload/files-upload.service.ts`, 812 lines) takes `DialClientService` and `ConfigService`. It is used by:

- `FilesService` (the facade): `uploadFile` and `uploadArchive`;
- `FilesFolderService`: `uploadFile` for the zero-byte marker;
- `tests/files.controller.spec.ts`, which builds a real `FilesService` around a real `FilesUploadService`.

The file holds these parts:

| Part                  | Members                                                                                                                                                                                                                       | Approx. lines |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------: |
| Upload input types    | `StagedUploadFile`, `BufferedUploadFile`, `StreamedUploadFile`, `UploadedFile`, `UploadedArchiveFile`                                                                                                                         |            45 |
| Single-file read      | `getUploadedFileSize`, `readExactly`, `readUploadedFile`, `UPLOAD_ABORT_MESSAGES`, `uploadFile`                                                                                                                               |           160 |
| Transport             | `StreamUploadOptions`, `uploadFileStream`, `buildMultipartEnvelope`, `createMultipartFileStream`, `buildDialUploadUrl`                                                                                                        |           140 |
| Archive pure helpers  | `ArchiveEntryPathResult`, `ArchiveFileEntry`, `splitFilePath`, `buildDeduplicatedFileName`, `buildDeduplicatedFilePath`, `isConflictError`, `decodeArchiveEntryName`, `resolveArchiveEntryPath`, the two constants |           110 |
| Archive pipeline      | `uploadArchive`, `extractAndUploadArchive`, `uploadArchiveEntryWithDeduplicatedName`, `stageArchiveEntryToTemp`, `uploadArchiveEntryFromTemp`, `removeArchiveUploadTempDirectory`                                         |           300 |
| Shared abort check    | `throwIfArchiveUploadAborted`, called by the archive pipeline and also by `uploadFileStream`                                                                                                                                 |             5 |

The spec (`tests/upload/files-upload.service.spec.ts`, 1103 lines) builds the service through `makeService(configOverrides)`, which returns `{ service, sdkClient, fetchCore }`. Its `uploadArchive` and `resolveArchiveEntryPath` blocks call `service.uploadArchive` and `service.resolveArchiveEntryPath`.

## Goals / Non-Goals

**Goals:** one owner for archive upload, one for the transport and a pure module for the helpers, with identical behavior, unchanged test assertions and both service files within the size limits in the proposal.

**Non-Goals:** behavior or limit changes, controller changes, moving archive download, or new tests beyond the moved ones.

## Decisions

### D1. `FilesArchiveUploadService` depends on `FilesUploadService`, not on `DialClientService`

```ts
@Injectable()
export class FilesArchiveUploadService {
  constructor(
    private readonly configService: ConfigService<EnvironmentVariables>,
    private readonly filesUploadService: FilesUploadService,
  ) {}
  uploadArchive(bucket, destinationPath, archiveFile, token): Promise<UploadArchiveResponseDto>;
}
```

Every archive entry already goes through `uploadFileStream`, by way of `uploadArchiveEntryFromTemp`. Injecting the upload service keeps a single DIAL Core upload path, with the create-only header, 412 → 409 and error mapping, and the dependency points one way. `FilesFolderService` sets the precedent: it injects `FilesUploadService` for its marker write.

`uploadFileStream` becomes public, with JSDoc that names both callers. Its signature and defaults (`createOnly = true`, `encodePath = encodeDialFilePath`) stay as they are, so archive entries keep create-only uploads and plain-name encoding. `StreamUploadOptions` is exported.

### D2. Pure helpers go to `upload/archive-upload.ts`

These move unchanged, as exported arrow functions:

- `resolveArchiveEntryPath(entryFileName): ArchiveEntryPathResult`. It was a public method; `this` was never used.
- `decodeArchiveEntryName(rawFileName)`.
- `buildDeduplicatedFilePath(path, index)`, with private `splitFilePath`/`buildDeduplicatedFileName`.
- `isConflictError(err)`.
- `throwIfArchiveUploadAborted(signal)`.
- `ARCHIVE_ENTRY_CONFLICT_RETRY_LIMIT`, exported for the service. `DIAL_RESOURCE_SEGMENT_BYTE_LIMIT` stays private.

`ArchiveEntryPathResult` is exported. `ArchiveFileEntry` moves to the archive service, which is its only user.

`throwIfArchiveUploadAborted` stays named as it is and keeps its 503 `Archive upload timed out`, because `uploadFileStream` calls it too and changing the message for single-file uploads would be a behavior change. The transport imports it from `archive-upload.ts`, and that is the only edge from the transport back into the archive module. A rename would be a separate change; it is recorded as a follow-up.

### D3. The facade and the module

- `FilesService` gains `private readonly filesArchiveUploadService: FilesArchiveUploadService` as its last constructor parameter. Appending it keeps every existing positional call site valid apart from the arity: the one in `tests/files.controller.spec.ts` gets one more `unused`.
- `FilesService.uploadArchive` delegates to the new service. Its signature is unchanged.
- `files.module.ts` adds `FilesArchiveUploadService` to `providers`.
- `UploadedArchiveFile` stays exported from `files-upload.service.ts`, where `files.service.ts` and the controller import it, so neither import changes.

### D4. Tests move as blocks

- `describe('resolveArchiveEntryPath')` moves to `tests/upload/archive-upload.spec.ts`. The only edit is `service.resolveArchiveEntryPath(` → `resolveArchiveEntryPath(`; the cases and expectations are the same.
- `describe('uploadArchive')` moves to `tests/upload/files-archive-upload.service.spec.ts`, together with the archive-building helpers it uses (`archiver`, the raw-ZIP `crc32` builders and the local HTTP server helpers). Its setup builds `FilesUploadService` exactly as `makeService` does and wraps it in `FilesArchiveUploadService`, returning `{ service, sdkClient, fetchCore }` so the test bodies stay unchanged. A helper that both files use is copied, not exported from a spec.

Log lines keep their text. The logger context for archive lines changes from `FilesUploadService` to `FilesArchiveUploadService`, as in earlier splits. The specs spy on `Logger.prototype` or nothing, so this has no test impact.

## Risks / Trade-offs

- **Two copies of test helpers** (ZIP builders) in two spec files. Accepted: specs must not import each other. If the duplication grows, a `tests/upload/archive-fixtures.ts` can follow.
- **The transport imports `throwIfArchiveUploadAborted` from the archive module** (D2). Accepted; it is recorded as a follow-up.
- **The `FilesService` constructor grows to eight parameters.** Accepted: the facade is the composition point by design (`files-service-decomposition`).

## Migration Plan

This is an internal refactor and needs no deploy step. Rollback is reverting the commit.

## Open Questions

None.
