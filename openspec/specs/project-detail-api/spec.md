# project-detail-api Specification

## Purpose

The per-project BFF endpoints under `/api/v1/projects/:id`: id and file-name validation, the archive snapshot DIAL Core's project metadata cannot replace, `PROJECT.md` parsing, the atomic `If-Match` save with rename by move, conditional delete, streamed downloads, pin side effects and the OpenAPI contract.

## Requirements

### Requirement: Per-project endpoints are flag-gated and address a project by its encoded DIAL id

`ProjectsController` (`apps/chat-api/src/projects/projects.controller.ts`) SHALL add five handlers under its existing class-level `@UseGuards(FeatureGuard)` + `@RequireFeature(FeatureKey.ProjectsEnabled)`:

| Method and path | Handler / `operationId` |
| --- | --- |
| `GET /api/v1/projects/:id` | `getProject` |
| `GET /api/v1/projects/:id/files/:fileName` | `downloadProjectFile` |
| `GET /api/v1/projects/:id/archive` | `downloadProject` |
| `PUT /api/v1/projects/:id` | `updateProject` |
| `DELETE /api/v1/projects/:id` | `deleteProject` |

**The `:id` parameter.** `:id` is the full DIAL id `projects/{bucket}/{path…}`, URL-encoded into one path segment, as `publish.controller.ts` takes `:entityId`.

- `ProjectIdParamDto` SHALL validate it with `@Matches(/^projects\/[^/\s]+\/[^\r\n]+$/)` and a check that rejects:
  - an empty, `.` or `..` segment;
  - a control character;
  - a trailing `/`.
- The bucket and path are parsed from `:id`, never from the session. Core authorizes every call with the caller's token.

**The `:fileName` parameter.** `ProjectFileParamDto.fileName` SHALL be validated with `IsDialEntityName` (`apps/chat-api/src/common/validators/dial-entity-name.validator.ts`), the rule create applies to context file names.

Every Core call sends `getBearerAuthHeaders(accessToken)` and goes through `DialClientService.client`.

**Feature flag:** `features.projectsEnabled` (env `PROJECTS_ENABLED`, roles `PROJECTS_ENABLED_ROLES`). **RTL impact:** none, this is a backend surface. **i18n impact:** none.

#### Scenario: Flag off rejects every per-project route

- **WHEN** `PROJECTS_ENABLED` is unset and an authenticated user calls any of the five routes
- **THEN** `FeatureGuard` answers `403` and no DIAL Core call is made

#### Scenario: Path traversal in the id is rejected

- **WHEN** `GET /api/v1/projects/projects%2Fa1b2c3%2F..%2Fother` is called
- **THEN** the response is `400`, and no DIAL Core call is made

#### Scenario: Path traversal in the file name is rejected

- **WHEN** `GET /api/v1/projects/projects%2Fa1b2c3%2Fq4/files/..%2F..%2Fsecret` is called
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
  - `otherEntries`: every other path, including nested paths under `context/` and `conversations/`.
- **`contentVersion`:** the snapshot SHALL compute a content version over every entry that is not in `conversationEntries`. It is a SHA-256, hex-encoded and quoted like an entity tag (`"…"`), of the lines `{path}\t{crc32}\t{uncompressedSize}`, one per entry, sorted by path. The CRC-32 and size come from the ZIP central directory, so nothing is inflated. A conversation write therefore never changes `contentVersion`, while any write to `PROJECT.md`, `context/` or another non-conversation path does.

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

#### Scenario: A context change changes contentVersion

- **WHEN** two archives differ only in the bytes of `context/tickets.csv`
- **THEN** their `contentVersion`s differ

### Requirement: PROJECT.md is parsed tolerantly and the name always comes from the path

`parseProjectManifest(text)` in `apps/chat-api/src/projects/utils/project-manifest.util.ts` SHALL be the inverse of `buildProjectManifest`:

- **Parsing:** a leading `---` fence, then YAML parsed with `yaml`'s `parse` using the default schema, then the closing `---`.
- **`description`:** read when it is a string, otherwise `''`.
- **Other frontmatter keys:** every key other than `name` and `description` is returned as `extraFrontmatter`. `buildProjectManifest` re-emits them after `name` and `description` when the update path passes them, so a save never drops a key another client wrote; they can never override `name` or `description`. The create path passes none.
- **`instructions`:** the body after the closing fence, with the single blank line `buildProjectManifest` writes removed.
- **Malformed input** (no fence, a YAML error, or a non-object): `description: ''`, `instructions` = the whole text, and one warning without content.
- **Missing manifest:** a project without `PROJECT.md` has `description: ''` and `instructions: ''`.

The project `name` SHALL always be the last segment of the path, as in the listing (`apps/chat-api/src/projects/projects.mapper.ts`). The frontmatter `name` is never read for display.

#### Scenario: Round trip

- **WHEN** `parseProjectManifest(buildProjectManifest({ name: 'Q4', description: 'a: b\n---', instructions: '## Steps\n1. Go' }))` is called
- **THEN** it returns `description: 'a: b\n---'` and `instructions: '## Steps\n1. Go'`

#### Scenario: Unknown frontmatter keys survive an edit

- **WHEN** the stored `PROJECT.md` frontmatter is `name: q4`, `description: old`, `owner: research`, and the user saves a new description
- **THEN** the written `PROJECT.md` frontmatter is `name: q4`, `description: new`, `owner: research`, in that order

#### Scenario: Missing PROJECT.md falls back

- **WHEN** the snapshot of `projects/a1b2c3/marketing/q4-launch` has no `PROJECT.md`
- **THEN** `getProject` returns `name: 'q4-launch'`, `description: ''` and `instructions: ''`

#### Scenario: Frontmatter name differs from the path

- **WHEN** `PROJECT.md` has `name: Old` and the path is `projects/a1b2c3/New`
- **THEN** `getProject` returns `name: 'New'`

### Requirement: GET /api/v1/projects/:id returns one project's details

`getProject` SHALL call two things concurrently under one signal that combines `AbortSignal.timeout(PROJECT_READ_TIMEOUT_MS)` (30,000 ms), the client-disconnect signal the controller passes (aborted on the request's `close`, as for create and update), and a sibling-failure controller:

- `listProjectMetadata(bucket, encodeDialResourcePath(path))`;
- the snapshot.

When either call rejects, the sibling-failure controller aborts with that error, so the other call stops (in particular, the archive stops buffering) and rejects with the same already-mapped exception rather than logging a second upstream failure.

**Metadata outcomes:**

- A metadata answer with `nodeType: 'FOLDER'` (a grouping folder) is `404`.
- Core `404` from either call is `404`. Core `403` is `403`.
- Other failures go through `handleDialSdkError` with context `projects.getProject`.

**`source` and `canEdit`:**

- `source` is `personal` when the bucket equals `SessionUser.bucket`, `organization` when it equals `PUBLIC_BUCKET`, and `shared` otherwise.
- `canEdit` is `source === 'personal'`.

**Caching.** The response carries `Cache-Control: private, no-store`. There is no server cache, so there is no key, TTL or invalidation.

`ProjectDetailsDto` SHALL be a class with Swagger metadata on every field:

- `id`, `name`, `bucket`, `path`, `parentPath?`;
- `source: ProjectSource`;
- `author?`, `createdAt?`, `updatedAt?`;
- `description`, `instructions`;
- `contextFiles: ProjectContextFileDto[]`, where each item is `{ name: string; size: number }`, sorted by name;
- `etag`: Core's aggregate ETag of the version read. It changes on every write, conversation writes included;
- `contentVersion`: the snapshot's `contentVersion`. It is the value `PUT` and `DELETE` take in `If-Match`;
- `conversationCount: number`: the number of `conversationEntries`. The publish panel's chats warning and the delete confirmation use it;
- `canEdit: boolean`.

Conversation content is never part of this response. The project page lists conversations through `GET /api/v1/projects/:id/conversations`.

Example request:

```http
GET /api/v1/projects/projects%2Fa1b2c3%2Fmarketing%2Fq4-launch HTTP/1.1
Cookie: <session cookie>
```

Example `200` response:

```json
{
  "id": "projects/a1b2c3/marketing/q4-launch",
  "name": "q4-launch",
  "bucket": "a1b2c3",
  "path": "marketing/q4-launch",
  "parentPath": "marketing",
  "source": "personal",
  "author": "jane.doe",
  "createdAt": 1790000000000,
  "updatedAt": 1791234567000,
  "description": "Bundles the Q4 support tickets and survey results.",
  "instructions": "## Approach\nExplain your reasoning step by step.",
  "contextFiles": [
    { "name": "survey.xlsx", "size": 10240 },
    { "name": "tickets.csv", "size": 2048 }
  ],
  "etag": "\"9f2c\"",
  "contentVersion": "\"3b8e0c…\"",
  "conversationCount": 3,
  "canEdit": true
}
```

Status codes:

| Status | When |
| --- | --- |
| `200` | The project was read. |
| `400` | `:id` is invalid. |
| `401` | No valid session. |
| `403` | The flag is off, or Core denied read access. |
| `404` | No such project, or the id names a grouping folder. |
| `413` | `project-too-large`. |
| `429` / `502` / `503` | As derived by `handleDialSdkError`. |

**Generated-client impact:** `ProjectsApi.getProject({ id })` returning `ProjectDetailsDto`. Callers use the normal method.

#### Scenario: Personal project is editable

- **WHEN** a user reads a project in their own bucket
- **THEN** the response is `200` with `source: 'personal'` and `canEdit: true`

#### Scenario: Conversations are counted, not returned

- **WHEN** the project holds three files under `conversations/`
- **THEN** the response has `conversationCount: 3`, and no conversation name or content

#### Scenario: Shared project is read-only

- **WHEN** a user reads `projects/z9y8x7/shared-research`, owned by another user and shared with them
- **THEN** the response is `200` with `source: 'shared'` and `canEdit: false`

#### Scenario: Unknown project

- **WHEN** Core answers the metadata call with `404`
- **THEN** the response is `404`

#### Scenario: Grouping folder is not a project

- **WHEN** `listProjectMetadata` answers with a `FOLDER` node for the id
- **THEN** the response is `404`

#### Scenario: Upstream timeout

- **WHEN** the archive read exceeds the deadline
- **THEN** the response is `503`

#### Scenario: A failed metadata read stops the archive read

- **WHEN** the metadata call answers `404` while the archive is still downloading
- **THEN** the response is `404`, and the archive read's signal is aborted

#### Scenario: Client disconnect ends both reads

- **WHEN** the client closes the request while `getProject` is reading
- **THEN** the signal of both Core calls is aborted

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
   - every `otherEntries` path, inflated from the snapshot.

   Kept files keep their bytes and path, but not their stored content type, because Core's archive carries none:
   - a kept context file is retyped from its extension, as on create;
   - a `conversationEntries` file is uploaded as `application/json`;
   - an `otherEntries` file is uploaded as `application/octet-stream`. This is a known limitation.
7. **Write once per attempt.** Make one `uploadProjectFolder(bucket, encodeDialResourcePath(path), …)` call with `If-Match: <snapshot etag>`, under `AbortSignal.any([disconnect, AbortSignal.timeout(60_000)])`.
   - On a Core `412`, a write landed between the read and the write, typically a project conversation. Go back to step 3 with a fresh snapshot. The new files stay in memory and are not re-sent.
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
- **AND** its parts are the rebuilt `PROJECT.md`, every stored context file and every stored conversation, and no move is made

#### Scenario: Stale contentVersion is detected before writing

- **WHEN** `If-Match` is `"old"` and the snapshot `contentVersion` is `"new"`
- **THEN** the response is `409` with `code: 'project-changed'`, and no `uploadProjectFolder` call is made

#### Scenario: A chat written while editing does not fail the save

- **WHEN** a project conversation was written after the edit page loaded, so the snapshot `etag` differs from the one the page read but `contentVersion` equals `If-Match`
- **THEN** the save writes with the fresh snapshot ETag and answers `200`

#### Scenario: A conversation write between read and write is retried

- **WHEN** Core answers the first `uploadProjectFolder` call with `412`, and the re-read snapshot has the same `contentVersion` and newer bytes for `conversations/gpt-4o__Q4 summary__1b2c.json`
- **THEN** a second `uploadProjectFolder` call is made with the fresh ETag and the newer conversation bytes, and the response is `200`

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

### Requirement: DELETE /api/v1/projects/:id deletes a project conditionally

`deleteProject` SHALL, before any Core call, refuse a project whose bucket is not the session bucket with `403` (`ForbiddenException`), and require an `If-Match` that is exactly one entity tag, answering `428 if-match-required` when it is missing, `*` or a comma-separated list. The tag is the project's `contentVersion`, as for `PUT`. It then:

1. Reads the snapshot. A `contentVersion` that differs from `If-Match` is `409 project-changed`, without deleting.
2. Calls `deleteProjectFolder(bucket, encodeDialResourcePath(path), { headers: { 'If-Match': <snapshot etag> } })`.
   - Core `412` (a conversation write landed in between) goes back to step 1, at most `PROJECT_WRITE_ATTEMPTS` times in total, then `409 project-changed`.
   - `404` is `404`.
   - Other errors go through `handleDialSdkError` with context `projects.deleteProject`.

Deleting a project deletes its `conversations/` with it. On success it calls `UserConfigService.removeProjectPin(id, …)` as a best effort, and answers `204`.

Example request:

```http
DELETE /api/v1/projects/projects%2Fa1b2c3%2Fq4-launch HTTP/1.1
If-Match: "3b8e0c…"
```

Status codes:

| Status | When |
| --- | --- |
| `204` | Deleted. |
| `400` | Invalid `:id`. |
| `401` | No valid session. |
| `403` | The flag is off, the project is not in the caller's own bucket, or Core denied access. |
| `404` | No such project. |
| `409` | `project-changed`. |
| `428` | `if-match-required` (missing, `*`, or a list of tags). |
| `429` / `502` / `503` | Upstream. |

**Generated-client impact:** `ProjectsApi.deleteProject({ id, ifMatch })`, returning `void`.

#### Scenario: Delete with the current contentVersion

- **WHEN** a pinned project is deleted with its current `contentVersion`
- **THEN** the response is `204`, its conversations are gone with it, and its id is no longer in `projects.pinnedIds`

#### Scenario: A chat written before delete does not block it

- **WHEN** a project conversation was written after the page loaded, and `contentVersion` is unchanged
- **THEN** `deleteProjectFolder` is called with the fresh snapshot ETag, and the response is `204`

#### Scenario: Delete of another user's project

- **WHEN** `DELETE /api/v1/projects/projects%2Fz9y8x7%2Fresearch` is called by a user whose bucket is `a1b2c3`
- **THEN** the response is `403`, and no DIAL Core call is made

#### Scenario: Delete with a wildcard If-Match

- **WHEN** `DELETE` is called with `If-Match: *`
- **THEN** the response is `428` with `code: 'if-match-required'`, and no DIAL Core call is made

#### Scenario: Delete with a stale contentVersion

- **WHEN** the snapshot's `contentVersion` differs from `If-Match`
- **THEN** the response is `409` with `code: 'project-changed'`, no `deleteProjectFolder` call is made, and the pin is unchanged

### Requirement: Project and context-file downloads stream through the BFF

`downloadProject` SHALL stream `downloadProjectFolder` (`parseAs: 'stream'`) to the client, and `downloadProjectFile` SHALL stream `downloadProjectFile(bucket, path, 'context/' + fileName)`. Both follow `SkillsController.downloadSkill`:

- They register a disconnect abort before awaiting Core, and pipe with `pipeline(Readable.fromWeb(stream), res)`, destroying the response on a pipe error.
- A 60-second deadline applies only until Core's response headers arrive (`503` when it passes); the timer is cleared then, so a slow client is not cut off mid-body. A client disconnect still aborts the body.
- They forward only `content-type` and `etag` from Core.
- They set `Content-Disposition: attachment; filename*=UTF-8''<encoded>` (`{name}.zip` for the archive, the file name for a context file), `X-Content-Type-Options: nosniff` and `Cache-Control: private, no-store`.
- Upstream `404` is `404`, and an empty-body error is treated as a failure.

Swagger declares `@ApiProduces('application/zip')` for the archive and `application/octet-stream` for files.

**Generated-client impact:** the generator emits `Blob | void`, so `downloadProjectRaw` and `downloadProjectFileRaw` are used. The frontend wrappers return the raw `Response` for `triggerBrowserDownload`.

#### Scenario: Archive download

- **WHEN** `GET /api/v1/projects/projects%2Fa1b2c3%2Fq4-launch/archive` is called
- **THEN** the response streams Core's ZIP with `Content-Disposition: attachment; filename*=UTF-8''q4-launch.zip`

#### Scenario: Context file is never served inline

- **WHEN** a context file is downloaded
- **THEN** the response carries `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`

#### Scenario: Missing file

- **WHEN** Core answers `downloadProjectFile` with `404`
- **THEN** the response is `404`

#### Scenario: A slow download is not cut off

- **WHEN** Core answers with headers within the deadline and the client takes longer than 60 seconds to read the body
- **THEN** the Core request is not aborted

### Requirement: Per-project endpoints document every status in OpenAPI

Each new handler SHALL declare:

- `@ApiOperation` with its `operationId`;
- `@ApiParam` metadata for `:id` and `:fileName`;
- `@ApiHeader` `If-Match` (required) on `updateProject` and `deleteProject`;
- an `@ApiResponse` for every status in its table, with a `type` on JSON successes and errors (`ProjectCreateErrorDto` for coded errors);
- `@ApiDialCoreErrors()`.

After the change, `npm run openapi` and `npm run openapi:check` SHALL pass, and `libs/chat-api-client` SHALL build and lint.

**Observability:** no new metric is added. The routes are covered by `MetricsInterceptor`. Domain logs at `log`/`warn` never include tokens, ETags, bucket ids, file names or content; the `debug` logs of Core's project metadata and archive entries (see the snapshot requirement) include ETags, ids and paths but never tokens or file content.

#### Scenario: Generated client exposes the operations

- **WHEN** `npm run openapi` runs
- **THEN** `ProjectsApi` has `getProject`, `updateProject`, `deleteProject`, `downloadProjectRaw` and `downloadProjectFileRaw`, and exports `ProjectDetailsDto`, `ProjectContextFileDto` and `UpdateProjectResponseDto`
