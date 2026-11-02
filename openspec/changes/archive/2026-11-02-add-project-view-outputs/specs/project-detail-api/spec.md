## MODIFIED Requirements

### Requirement: Per-project endpoints are flag-gated and address a project by its encoded DIAL id

`ProjectsController` (`apps/chat-api/src/projects/projects.controller.ts`) SHALL add seven handlers under its existing class-level `@UseGuards(FeatureGuard)` + `@RequireFeature(FeatureKey.ProjectsEnabled)`:

| Method and path | Handler / `operationId` |
| --- | --- |
| `GET /api/v1/projects/:id` | `getProject` |
| `GET /api/v1/projects/:id/files/:fileName` | `downloadProjectFile` |
| `GET /api/v1/projects/:id/artifacts` | `listProjectArtifacts` |
| `GET /api/v1/projects/:id/artifacts/:fileName` | `downloadProjectArtifact` |
| `GET /api/v1/projects/:id/archive` | `downloadProject` |
| `PUT /api/v1/projects/:id` | `updateProject` |
| `DELETE /api/v1/projects/:id` | `deleteProject` |

**The `:id` parameter.** `:id` is the full DIAL id `projects/{bucket}/{path…}`, URL-encoded into one path segment, as `publish.controller.ts` takes `:entityId`.

- `ProjectIdParamDto` SHALL validate it with `@Matches(/^projects\/[^/\s]+\/[^\r\n]+$/)` and a check that rejects:
  - an empty, `.` or `..` segment;
  - a control character;
  - a trailing `/`.
- The bucket and path are parsed from `:id`, never from the session. Core authorizes every call with the caller's token.

**The `:fileName` parameter.** `ProjectFileParamDto.fileName` SHALL be validated with `IsDialEntityName` (`apps/chat-api/src/common/validators/dial-entity-name.validator.ts`), the rule create applies to context file names. `ProjectArtifactParamDto.fileName` (`apps/chat-api/src/projects/dto/project-id-param.dto.ts`) SHALL apply the same `@IsString()` and `IsDialEntityName` checks to the artifact name; only its Swagger description (a file directly under `artifacts/`) differs.

Every Core call sends `getBearerAuthHeaders(accessToken)` and goes through `DialClientService.client`.

**Feature flag:** `features.projectsEnabled` (env `PROJECTS_ENABLED`, roles `PROJECTS_ENABLED_ROLES`). **RTL impact:** none, this is a backend surface. **i18n impact:** none.

#### Scenario: Flag off rejects every per-project route

- **WHEN** `PROJECTS_ENABLED` is unset and an authenticated user calls any of the seven routes
- **THEN** `FeatureGuard` answers `403` and no DIAL Core call is made

#### Scenario: Path traversal in the id is rejected

- **WHEN** `GET /api/v1/projects/projects%2Fa1b2c3%2F..%2Fother` is called
- **THEN** the response is `400`, and no DIAL Core call is made

#### Scenario: Path traversal in the file name is rejected

- **WHEN** `GET /api/v1/projects/projects%2Fa1b2c3%2Fq4/files/..%2F..%2Fsecret` is called
- **THEN** the response is `400`, and no DIAL Core call is made

#### Scenario: Path traversal in the artifact name is rejected

- **WHEN** `GET /api/v1/projects/projects%2Fa1b2c3%2Fq4/artifacts/..%2Fcontext%2Ftickets.csv` is called
- **THEN** the response is `400`, and no DIAL Core call is made

#### Scenario: Foreign prefix is rejected

- **WHEN** `:id` decodes to `skills/a1b2c3/q4`
- **THEN** the response is `400`

### Requirement: A project snapshot is read from DIAL Core's archive

`ProjectsSnapshotService` (`apps/chat-api/src/projects/snapshot/projects-snapshot.service.ts`) SHALL read a project with `downloadProjectFolder(bucket, encodeDialResourcePath(path), { parseAs: 'stream' })`.

**ETag.** The snapshot's `etag` is the response's `ETag` header. A response without `ETag` is an invalid upstream response, `502`.

**Size cap.** `PROJECT_ARCHIVE_READ_MAX_BYTES` is a module constant of 64 MiB, Core's default per-project total. When the response's `Content-Length`, or the running byte count while buffering, exceeds it, the read is aborted and the BFF answers `413` with `code: 'project-too-large'`. `validate` (`apps/chat-api/src/config/validation.ts`) fails boot when `PROJECT_CONTEXT_TOTAL_MAX_BYTES` exceeds `PROJECT_ARCHIVE_READ_MAX_BYTES` minus `PROJECT_MANIFEST_MAX_BYTES` (63 MiB), so a project filled to capacity stays readable and editable.

**Concurrency.** At most `PROJECT_ARCHIVE_READ_CONCURRENCY` (4, in `apps/chat-api/src/projects/constants/project-context.constants.ts`) snapshot reads download and parse an archive at once per BFF process, bounding the archive bytes buffered at a time to 4 × `PROJECT_ARCHIVE_READ_MAX_BYTES`. A further read waits for a free slot; its abort signal (deadline or client disconnect) ends the wait without a Core call. Downloads stream and are not limited.

**Parsing.** The buffered archive is opened with `yauzl.fromBufferPromise` (`lazyEntries: true`):

- Every central-directory entry is recorded with its name and uncompressed size, without being inflated.
- An entry whose name is absolute, contains a `..` segment, or contains a backslash makes the archive invalid, `502`.
- `PROJECT.md` is inflated, capped at `PROJECT_MANIFEST_MAX_BYTES` (1 MiB). Above the cap the manifest is treated as absent for display, the snapshot's `hasOversizedManifest` is `true`, and a warning is logged.
- The entries are classified:
  - `PROJECT.md`;
  - `contextFiles`: direct children of `context/`, as `{ name, size }`;
  - `conversationEntries`: direct children of `conversations/` (project conversations, see the `project-conversations-api` capability), as `{ name, size }`. They are never inflated by a read. Only the edit save (`PUT`) inflates them, to carry them into the new version;
  - `artifactEntries`: every path under `artifacts/`, nested paths included, sorted. These are the files the agents of the project's chats write. They are never inflated by a read. Only the edit save (`PUT`) inflates them, to carry them into the new version;
  - `otherEntries`: every other path, including nested paths under `context/` and `conversations/`.
- **`contentVersion`:** the snapshot SHALL compute a content version over every entry that is in neither `conversationEntries` nor `artifactEntries`. It is a SHA-256, hex-encoded and quoted like an entity tag (`"…"`), of the lines `{path}\t{crc32}\t{uncompressedSize}`, one per entry, sorted by path. The CRC-32 and size come from the ZIP central directory, so nothing is inflated. A conversation write or an artifact write therefore never changes `contentVersion`, while any write to `PROJECT.md`, `context/` or another path does.

**Logging.** `log` and `warn` logs carry counts and byte totals only, never a file name, bucket or content. An unreadable archive is logged with the error's `name` only, because `yauzl`'s messages quote entry file names. At `debug` level (`LOG_LEVEL=debug`, off by default) the snapshot also logs what Core's archive held — the ETag, the archive size, whether `PROJECT.md` parsed, and every entry's path and size — and `getProject` logs the item metadata exactly as Core returned it. File content and tokens are never logged at any level.

#### Scenario: Snapshot ETag comes from the archive response

- **WHEN** Core answers the archive with `ETag: "e1"` and entries `PROJECT.md`, `context/tickets.csv` (2,048 bytes) and `context/survey.xlsx` (10,240 bytes)
- **THEN** the snapshot has `etag: "e1"`, and two context files with exactly those sizes

#### Scenario: Oversized archive is refused before buffering

- **WHEN** Core answers with `Content-Length` greater than 64 MiB
- **THEN** the stream is cancelled, and the response is `413` with `code: 'project-too-large'`

#### Scenario: Traversal entry name makes the archive invalid

- **WHEN** the archive contains an entry named `../evil.txt`
- **THEN** the response is `502`, and nothing from the archive is returned

#### Scenario: Archive reads beyond the concurrency limit wait

- **WHEN** five snapshot reads start while four archives are still downloading
- **THEN** the fifth makes no Core call until one of the four finishes
- **AND** when the fifth read's signal aborts while it waits, it fails without a Core call and leaves no slot taken

#### Scenario: Nested context entries are kept but not listed

- **WHEN** the archive contains `context/a/b.csv`
- **THEN** it is not in `contextFiles`, and it is in `otherEntries`

#### Scenario: Conversation entries are classified but not inflated

- **WHEN** the archive contains `PROJECT.md`, `context/tickets.csv` and `conversations/gpt-4o__Q4 summary__1b2c.json` (40,000 bytes)
- **THEN** the conversation is in `conversationEntries` with size 40,000, it is not in `otherEntries`, and only `PROJECT.md` is inflated

#### Scenario: A conversation write does not change contentVersion

- **WHEN** two archives differ only in the bytes of `conversations/gpt-4o__Q4 summary__1b2c.json`
- **THEN** both snapshots have the same `contentVersion` and different `etag`s

#### Scenario: Artifact entries are classified but not inflated

- **WHEN** the archive contains `PROJECT.md`, `artifacts/report.pdf` and `artifacts/run-1/data.csv`
- **THEN** `artifactEntries` is `['artifacts/report.pdf', 'artifacts/run-1/data.csv']`, neither is in `otherEntries`, and only `PROJECT.md` is inflated

#### Scenario: An artifact write does not change contentVersion

- **WHEN** two archives differ only in that the second also contains `artifacts/report.pdf` and `artifacts/run-1/data.csv`
- **THEN** both snapshots have the same `contentVersion` and different `etag`s

#### Scenario: A context change changes contentVersion

- **WHEN** two archives differ only in the bytes of `context/tickets.csv`
- **THEN** their `contentVersion`s differ

### Requirement: PUT /api/v1/projects/:id saves an edit in one atomic Core write

`updateProject` SHALL take `multipart/form-data` through `ProjectContextUploadInterceptor`, with these fields:

- `name`, `description` and `instructions`, as on create (`UpdateProjectDto`);
- `fileNames`: a JSON array paired positionally with the `files` parts, holding the added files only;
- `removedFileNames`: a JSON array of stored context file names.

It also requires an `If-Match` header carrying the `contentVersion` the client read from `GET /api/v1/projects/:id`, not Core's ETag, so a project conversation written in between does not make the save fail. `ProjectsUpdateService` (`apps/chat-api/src/projects/update/projects-update.service.ts`) SHALL:

1. **Require ownership and a single `If-Match`.** Before any Core call:
   - a project whose bucket is not the session bucket is `403` (`ForbiddenException`), matching `canEdit`;
   - an `If-Match` that is not exactly one entity tag — missing, blank, the `*` wildcard, or a comma-separated list (also what two `If-Match` headers become) — is `428`, `code: 'if-match-required'`. Core reads `*` as "any version" and a list as "any of these", so either would make the write unconditional on the version the caller read.
2. **Validate** the text fields and the new files with the same rules, codes and limits as `POST /api/v1/projects`:
   - name rules (`invalid-name`);
   - file-name rules (`invalid-file-name`);
   - extension and signature (`unsupported-file-type`);
   - per-file size (`file-too-large`).
3. **Read the snapshot.** If its `contentVersion` differs from `If-Match`, answer `409` with `code: 'project-changed'`, without writing. If its `hasOversizedManifest` is `true`, answer `413` with `code: 'project-too-large'`, without writing, because rebuilding a `PROJECT.md` the BFF never read would overwrite it.
4. **Compute the resulting context set:** snapshot files, minus `removedFileNames`, plus the new files.
   - A removed name that is not in the snapshot is `400 unknown-file`.
   - A new name equal to a kept file is `400 duplicate-file-name`, so replacing a file requires listing its name in `removedFileNames` as well.
   - The total size above `PROJECT_CONTEXT_TOTAL_MAX_BYTES` is `413 capacity-exceeded`.
   - More than `PROJECT_CONTEXT_MAX_FILES` files is `400 too-many-files`.
5. **Pre-check the destination on rename.** When the trimmed name differs from the last path segment, call `listProjectMetadata` for `{parentPath}/{name}` in the same bucket. An existing item or folder is `409` with `code: 'name-taken'` and `field: 'name'`, without writing.
6. **Build one `FormData`:**
   - `PROJECT.md` from `buildProjectManifest({ name: newName, description, instructions, extraFrontmatter })`, where `extraFrontmatter` is the stored manifest's unknown keys;
   - every kept context file, inflated from the snapshot;
   - every new file;
   - every `conversationEntries` file, inflated from the snapshot;
   - every `artifactEntries` path, inflated from the snapshot;
   - every `otherEntries` path, inflated from the snapshot.

   Kept files keep their bytes and path, but not their stored content type, because Core's archive carries none:
   - a kept context file is retyped from its extension, as on create;
   - a `conversationEntries` file is uploaded as `application/json`;
   - an `artifactEntries` file is uploaded with the content type `lookup(path)` from `mime-types` names for its extension, or `application/octet-stream` when it names none. `inferMimeTypeFromPath` is not used, because `@epam/ai-dial-chat-shared` is a frontend lib a `type:backend` project may not import;
   - an `otherEntries` file is uploaded as `application/octet-stream`. This is a known limitation.

   The save never adds, renames or removes an `artifacts/` entry: the chat only reads that folder.
7. **Write once per attempt.** Make one `uploadProjectFolder(bucket, encodeDialResourcePath(path), …)` call with `If-Match: <snapshot etag>`, under `AbortSignal.any([disconnect, AbortSignal.timeout(60_000)])`.
   - On a Core `412`, a write landed between the read and the write, typically a project conversation or an agent's artifact. Go back to step 3 with a fresh snapshot. The new files stay in memory and are not re-sent.
   - When the fresh `contentVersion` still equals `If-Match`, rebuild the `FormData` from the fresh snapshot (so the newer conversation bytes are carried, not the older ones) and write again.
   - At most `PROJECT_WRITE_ATTEMPTS` (3, in `apps/chat-api/src/projects/constants/project-context.constants.ts`) writes are made. A `412` on the last one, or a changed `contentVersion`, is `409 project-changed`.
8. **Move on rename.** The write has committed, so every rename step runs under a fresh `AbortSignal.timeout(30_000)` only — not the client-disconnect signal — and a closed tab cannot stop the rename half-way. Call `moveResource({ body: { sourceUrl, destinationUrl, overwrite: false } })`.
   - On a Core `400`, re-check the destination: when it exists, answer `409 name-taken`.
   - Any other failure (another status, a failed re-check, a network error or the timeout) is `409 project-changed`, so the client reloads and sees the content saved under the old name. A warning without names records that the content was saved under the old name.
9. **Migrate the pin on rename,** immediately after the move succeeds. Call `UserConfigService.replaceProjectPin(oldId, newId, …)`. A failure is logged and does not fail the request.
10. **Read the moved project's ETag** with `listProjectMetadata`, because Core recomputes the marker on copy. A failure is logged as a warning without names and does not fail the request: the response then omits `etag`.

Response: `200` with `UpdateProjectResponseDto { id, name, bucket, path, etag?, isPinned }`; `etag` is absent only when a renamed project's ETag could not be read back. Logs carry the outcome, file counts and byte totals, never names or content.

Example request:

```http
PUT /api/v1/projects/projects%2Fa1b2c3%2Fq4-launch HTTP/1.1
If-Match: "3b8e0c…"
Content-Type: multipart/form-data; boundary=x

--x
Content-Disposition: form-data; name="name"

Q4 launch
--x
Content-Disposition: form-data; name="description"

Bundles the Q4 tickets.
--x
Content-Disposition: form-data; name="instructions"

Explain your reasoning step by step.
--x
Content-Disposition: form-data; name="fileNames"

["retro.pdf"]
--x
Content-Disposition: form-data; name="removedFileNames"

["survey.xlsx"]
--x
Content-Disposition: form-data; name="files"; filename="retro.pdf"
Content-Type: application/pdf

%PDF-…
--x--
```

Example `200` response:

```json
{
  "id": "projects/a1b2c3/Q4 launch",
  "name": "Q4 launch",
  "bucket": "a1b2c3",
  "path": "Q4 launch",
  "etag": "\"b71e\"",
  "isPinned": true
}
```

Status codes:

| Status | When |
| --- | --- |
| `200` | Saved, and moved when renamed. |
| `400` | Invalid field, name or file, `unknown-file`, `duplicate-file-name`, or `too-many-files`. |
| `401` | No valid session. |
| `403` | The flag is off, the project is not in the caller's own bucket, or Core denied write access. |
| `404` | No such project. |
| `409` | `project-changed` (stale `contentVersion`, a write still racing after `PROJECT_WRITE_ATTEMPTS`, or a rename that failed after the content was saved) or `name-taken`. |
| `413` | `file-too-large`, `capacity-exceeded`, or `project-too-large` (the archive, or the stored `PROJECT.md` above `PROJECT_MANIFEST_MAX_BYTES`). |
| `428` | `if-match-required` (missing, `*`, or a list of tags). |
| `429` / `502` / `503` | Upstream. |

Every error code is a `ProjectCreateErrorCode` member. The enum gains `ProjectChanged = 'project-changed'`, `IfMatchRequired = 'if-match-required'`, `ProjectTooLarge = 'project-too-large'` and `UnknownFile = 'unknown-file'`.

**Generated-client impact:** `ProjectsApi.updateProject({ id, ifMatch, name, description, instructions, fileNames, removedFileNames, files })` returning `UpdateProjectResponseDto`. Callers use the normal method.

#### Scenario: Text-only edit is one Core write

- **WHEN** the user changes only the description, with the current `contentVersion`
- **THEN** exactly one `uploadProjectFolder` call is made with `If-Match` equal to the snapshot ETag
- **AND** its parts are the rebuilt `PROJECT.md`, every stored context file, every stored conversation and every stored artifact, and no move is made

#### Scenario: Stale contentVersion is detected before writing

- **WHEN** `If-Match` is `"old"` and the snapshot `contentVersion` is `"new"`
- **THEN** the response is `409` with `code: 'project-changed'`, and no `uploadProjectFolder` call is made

#### Scenario: A chat written while editing does not fail the save

- **WHEN** a project conversation was written after the edit page loaded, so the snapshot `etag` differs from the one the page read but `contentVersion` equals `If-Match`
- **THEN** the save writes with the fresh snapshot ETag and answers `200`

#### Scenario: A conversation write between read and write is retried

- **WHEN** Core answers the first `uploadProjectFolder` call with `412`, and the re-read snapshot has the same `contentVersion` and newer bytes for `conversations/gpt-4o__Q4 summary__1b2c.json`
- **THEN** a second `uploadProjectFolder` call is made with the fresh ETag and the newer conversation bytes, and the response is `200`

#### Scenario: An artifact written while editing does not fail the save

- **WHEN** an agent wrote `artifacts/report.pdf` after the edit page loaded, so the snapshot `etag` differs from the one the page read but `contentVersion` equals `If-Match`
- **THEN** the save answers `200`, and the written `FormData` contains `artifacts/report.pdf` with its stored bytes

#### Scenario: An artifact written between read and write is retried

- **WHEN** Core answers the first `uploadProjectFolder` call with `412`, and the re-read snapshot has the same `contentVersion` and a new `artifacts/summary.md`
- **THEN** a second `uploadProjectFolder` call is made with the fresh ETag and includes `artifacts/summary.md`, and the response is `200`

#### Scenario: Artifacts keep their content type through an edit

- **WHEN** the snapshot contains `artifacts/report.pdf`, `artifacts/run-1/deck.pptx` and `artifacts/raw.unknownext`, and the user saves a description change
- **THEN** they are written at the same paths with their original bytes and the types `application/pdf`, `application/vnd.openxmlformats-officedocument.presentationml.presentation` and `application/octet-stream`

#### Scenario: Concurrent content edit between read and write

- **WHEN** Core answers `uploadProjectFolder` with `412`, and the re-read snapshot's `contentVersion` differs from `If-Match`
- **THEN** the response is `409` with `code: 'project-changed'`, and no further write is made

#### Scenario: Write attempts are bounded

- **WHEN** Core answers all three `uploadProjectFolder` calls with `412`
- **THEN** the response is `409` with `code: 'project-changed'`, and no fourth call is made

#### Scenario: Replacing a file keeps capacity honest

- **WHEN** `tickets.csv` (2 KiB) is in `removedFileNames` and a new `tickets.csv` (3 KiB) is uploaded
- **THEN** the capacity check uses the 3 KiB size, and the written set contains the new file only

#### Scenario: Removing an unknown file

- **WHEN** `removedFileNames` contains `missing.csv`, and the snapshot has no such context file
- **THEN** the response is `400` with `code: 'unknown-file'`

#### Scenario: Capacity is enforced against stored files

- **WHEN** the stored files total 9.5 MiB and a 1 MiB file is added with the default 10 MiB capacity
- **THEN** the response is `413` with `code: 'capacity-exceeded'`

#### Scenario: Rename moves the project and its pin

- **WHEN** a pinned project `projects/a1b2c3/q4` is saved with name `Q4 launch`, and no project of that name exists
- **THEN** the content is written to `q4`, then moved to `projects/a1b2c3/Q4 launch`
- **AND** `replaceProjectPin` is called with the old and new ids, and the response has the new `id` and `isPinned: true`

#### Scenario: Rename onto a taken name

- **WHEN** a project named `Handbook` already exists in the same folder, and the user renames to `Handbook`
- **THEN** the response is `409` with `code: 'name-taken'` and `field: 'name'`, and no `uploadProjectFolder` or move call is made

#### Scenario: Other clients' files survive a save

- **WHEN** the snapshot contains `notes/readme.txt` and the user saves a description change
- **THEN** the written `FormData` contains `notes/readme.txt` with its original bytes

#### Scenario: Missing If-Match

- **WHEN** `PUT /api/v1/projects/:id` is called without `If-Match`
- **THEN** the response is `428` with `code: 'if-match-required'`, and no DIAL Core call is made

#### Scenario: Wildcard or multi-tag If-Match

- **WHEN** `PUT /api/v1/projects/:id` is called with `If-Match: *` or `If-Match: "e1", "e2"`
- **THEN** the response is `428` with `code: 'if-match-required'`, and no DIAL Core call is made

#### Scenario: Another user's project is refused before Core

- **WHEN** `PUT /api/v1/projects/projects%2Fz9y8x7%2Fresearch` is called by a user whose bucket is `a1b2c3`
- **THEN** the response is `403`, and no DIAL Core call is made

#### Scenario: Oversized stored PROJECT.md is not overwritten

- **WHEN** the stored `PROJECT.md` exceeds `PROJECT_MANIFEST_MAX_BYTES`
- **THEN** the response is `413` with `code: 'project-too-large'`, and no `uploadProjectFolder` call is made

#### Scenario: Rename whose ETag read-back fails

- **WHEN** the move succeeds and the destination's `listProjectMetadata` fails or rejects
- **THEN** the pin is migrated, and the response is `200` with the new `id` and no `etag`

#### Scenario: Move fails after the write

- **WHEN** the content write succeeds and Core answers the move with `503`
- **THEN** the response is `409` with `code: 'project-changed'`, the pin is not migrated, and a warning records that the content was saved under the old name

#### Scenario: Client disconnect after the write does not stop the rename

- **WHEN** the client disconnects after the content write committed
- **THEN** the move is still sent with a signal that is not aborted

## ADDED Requirements

### Requirement: GET /api/v1/projects/:id/artifacts lists a project's outputs newest first

`ProjectsController` SHALL expose `listProjectArtifacts` at `GET /api/v1/projects/:id/artifacts`, with `@Header('Cache-Control', 'private, no-store')`. It delegates to `ProjectArtifactsListService.listArtifacts(project, accessToken)` (`apps/chat-api/src/projects/artifacts/projects-artifacts-list.service.ts`), which SHALL:

- call `listProjectFileMetadata(bucket, encodeDialResourcePath(path), 'artifacts/', { params: { query: { limit: 1000, recursive: false, token? } } })` with `getBearerAuthHeaders(accessToken)`, following `nextToken` until it is empty;
- keep only items with `nodeType === 'ITEM'` and a non-empty `name`, so nested folders and their files are not listed;
- sort newest first by `updatedAt` (a missing one counts as `0`), then by name;
- return every item, without pagination, because DIAL Core caps a project at 1,000 files;
- answer an empty list when Core answers `404` (the project has no `artifacts/` folder yet);
- map other failures through `handleDialSdkError`. A `403` in the caller's own bucket, which is Core masking a missing project, is `404`.

Any caller who can read the project may call it. Core authorizes the listing with the caller's token, and no ownership check is made. The flag is the controller's `FeatureGuard` (`FeatureKey.ProjectsEnabled`). No BFF cache is used, so a listing taken right after a write reflects it. Logs carry the count only, never names.

Response DTOs (`apps/chat-api/src/projects/dto/project-artifact-list-response.dto.ts`) are classes with `@ApiProperty` on every field:

- `ProjectArtifactListResponseDto { items: ProjectArtifactItemDto[] }`;
- `ProjectArtifactItemDto { name: string; updatedAt?: number; author?: string }`, where `updatedAt` is in epoch milliseconds and the optional fields are omitted when Core sends none.

Example request:

```http
GET /api/v1/projects/projects%2Fa1b2c3%2Fq4-launch/artifacts HTTP/1.1
```

Example `200` response:

```json
{
  "items": [
    { "name": "summary.md", "updatedAt": 1793606400000, "author": "Jane Doe" },
    { "name": "report.pdf", "updatedAt": 1793520000000, "author": "Jane Doe" }
  ]
}
```

Status codes:

| Status | When |
| --- | --- |
| `200` | The outputs. A project without `artifacts/` lists none. |
| `400` | Invalid `:id`. |
| `401` | No valid session. |
| `403` | The flag is off, or Core denied read access. |
| `404` | No such project. |
| `429` / `502` / `503` | Upstream (`@ApiDialCoreErrors()`). |

**Generated-client impact:** `ProjectsApi.listProjectArtifacts({ id })` returns `ProjectArtifactListResponseDto`, and the client exports `ProjectArtifactListResponseDto` and `ProjectArtifactItemDto`. Callers use the normal (non-`Raw`) method.

#### Scenario: Outputs are listed newest first

- **WHEN** Core lists `report.pdf` (`updatedAt` 100), `summary.md` (`updatedAt` 300) and `deck.pptx` (`updatedAt` 200) under `artifacts/`
- **THEN** the response `items` are `summary.md`, `deck.pptx`, `report.pdf`, in that order

#### Scenario: Nested folders are not listed

- **WHEN** Core lists the item `report.pdf` and the folder `run-1/` under `artifacts/`
- **THEN** the response lists only `report.pdf`

#### Scenario: A project without outputs

- **WHEN** Core answers `listProjectFileMetadata` for `artifacts/` with `404`
- **THEN** the response is `200` with `{ "items": [] }`

#### Scenario: Listing follows Core's pages

- **WHEN** Core's first page carries `nextToken: 't1'` and the second carries none
- **THEN** two Core calls are made, the second with `token: 't1'`, and the response holds the items of both

#### Scenario: A reader of a shared project can list outputs

- **WHEN** a user whose bucket is `z9y8x7` lists the outputs of `projects/a1b2c3/q4-launch`, which is shared with them
- **THEN** the BFF makes the Core call with that user's token, without an ownership check, and answers `200`

### Requirement: GET /api/v1/projects/:id/artifacts/:fileName streams one output

`ProjectsController` SHALL expose `downloadProjectArtifact` at `GET /api/v1/projects/:id/artifacts/:fileName`, taking `ProjectArtifactParamDto`. It streams `ProjectsDownloadService.downloadArtifact(project, fileName, accessToken, callerBucket)` through the same `streamDownload` helper as `downloadProjectFile`.

`downloadArtifact` SHALL call `downloadProjectFile(bucket, encodeDialResourcePath(path), encodeDialResourcePath('artifacts/' + fileName), { parseAs: 'stream' })` through the shared `download` helper. It therefore has the same behaviour as a context-file download:

- a 60-second deadline until Core's response headers arrive, after which a slow client is not cut off;
- only `content-type` and `etag` forwarded from Core;
- `Content-Disposition: attachment` with the ASCII fallback and the RFC 5987 `filename*`, `X-Content-Type-Options: nosniff` and `Cache-Control: private, no-store`;
- Core's `404`, or its `403` in the caller's own bucket, answered as `404`.

Any caller who can read the project may call it. Swagger declares `@ApiProduces('application/octet-stream')`, `@ApiParam` for `:id` and `:fileName`, `@ApiDialCoreErrors()`, and an `@ApiResponse` for `200` (binary), `400`, `401`, `403`, `404`, `502` and `503`.

Example request:

```http
GET /api/v1/projects/projects%2Fa1b2c3%2Fq4-launch/artifacts/report.pdf HTTP/1.1
```

Example `200` response headers:

```http
HTTP/1.1 200 OK
Content-Type: application/pdf
Content-Disposition: attachment; filename="report.pdf"; filename*=UTF-8''report.pdf
X-Content-Type-Options: nosniff
Cache-Control: private, no-store
```

**Generated-client impact:** the generator emits `Blob | void`, so callers use `ProjectsApi.downloadProjectArtifactRaw({ id, fileName })`. The project view's canvas reaches the route by URL through `resolveDialUrl` (see the `project-view-ui` capability), so `ProjectsApiClient` gains no download method.

After the change, `npm run openapi` and `npm run openapi:check` SHALL pass, and `libs/chat-api-client` SHALL build and lint.

#### Scenario: An output is downloaded as an attachment

- **WHEN** `GET /api/v1/projects/projects%2Fa1b2c3%2Fq4-launch/artifacts/report.pdf` is called and Core streams the file with `Content-Type: application/pdf`
- **THEN** the response streams it with `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="report.pdf"; filename*=UTF-8''report.pdf` and `X-Content-Type-Options: nosniff`
- **AND** Core was asked for `artifacts/report.pdf` of `projects/a1b2c3/q4-launch`

#### Scenario: A missing output

- **WHEN** Core answers `downloadProjectFile` with `404`
- **THEN** the response is `404`

#### Scenario: A context file cannot be reached through the artifacts route

- **WHEN** `:fileName` decodes to `../context/tickets.csv` or `context/tickets.csv`
- **THEN** the response is `400`, and no DIAL Core call is made

#### Scenario: A reader of a shared project can download an output

- **WHEN** a user whose bucket is `z9y8x7` downloads `report.pdf` from `projects/a1b2c3/q4-launch`, which is shared with them
- **THEN** the Core call is made with that user's token and the file streams with `200`

#### Scenario: Generated client exposes the artifact operations

- **WHEN** `npm run openapi` runs
- **THEN** `ProjectsApi` has `listProjectArtifacts` and `downloadProjectArtifactRaw`
