## ADDED Requirements

### Requirement: Project access is resolved from the caller's bucket and DIAL Core share permissions

`ProjectAccessService` (`apps/chat-api/src/projects/access/project-access.service.ts`), provided by `ProjectsModule`, SHALL be the only place that decides what a caller may do with a project. It exposes:

- `resolveAccess(project: ParsedProjectId, sessionBucket: string, accessToken: string, signal?: AbortSignal): Promise<ProjectAccess>`, where `ProjectAccess` is `{ canEdit: boolean; canManage: boolean }`;
- `assertCanWrite(project, sessionBucket, accessToken, signal?): Promise<void>`, which throws `ForbiddenException` when `canEdit` is `false`;
- `assertCanManage(project, sessionBucket): void`, which throws `ForbiddenException` when `canManage` is `false`. It needs no Core call.

**The rule, by `resolveProjectSource(project.bucket, sessionBucket)`:**

| Source | `canEdit` | `canManage` | Core calls |
| --- | --- | --- | --- |
| `personal` | `true` | `true` | none |
| `organization` (`PUBLIC_BUCKET`) | `false` | `false` | none: an organization project changes only through publication |
| `shared` | the caller holds `WRITE` on the project | `false` | one `getSharedResources` |

**The shared lookup.** For a `shared` project the service calls `getSharedResources({ body: { resourceTypes: ['PROJECT'], with: 'me' } })` with the caller's token and `signal`. It passes `data.resources` to the pure `resolveSharedProjectPermissions(resources, projectId): ReadonlySet<string>` (`apps/chat-api/src/projects/utils/project-access.util.ts`). That function:

- normalizes each entry's `url` as `mapSharedProject` does: `safeDecodeURIComponent`, then `StringUtils.stripTrailingSlashes`;
- keeps an entry whose normalized url equals `projectId`, or is a folder above it (`projectId` starts with the url followed by `/`). Core unions the permissions of a resource and of its parents (`ShareService.lookupPermissions`), so a share on a grouping folder counts;
- returns the union of the kept entries' `permissions`.

`canEdit` is `permissions.has('WRITE')`. `SHARE` and the rest are ignored: the chat keeps rename, delete, share and publish owner-only, even where Core would allow them.

**Failures.** A Core error, a missing body or a rejected call is passed through `handleDialSdkError` with context `projects.resolveAccess`. `resolveAccess` and `assertCanWrite` therefore reject with the mapped upstream exception: a Core 5xx is `502`, and an unreachable Core or a timeout is `503`. The BFF never turns a failed lookup into its own "no access" `403`, so a temporary Core failure is not reported as missing access. Logs carry the context and the status, never ids, buckets or tokens.

**Caching.** None. Each `resolveAccess` for a shared project makes one lookup, so a revoked share takes effect on the recipient's next request.

**Authorization of callers:** the service does not replace Core's own checks. Every later Core call still runs with the caller's token, so Core refuses a write it does not allow (`403`).

#### Scenario: Owner makes no lookup

- **WHEN** `resolveAccess` runs for `projects/a1b2c3/q4` with session bucket `a1b2c3`
- **THEN** it answers `{ canEdit: true, canManage: true }`, and `getSharedResources` is not called

#### Scenario: Organization project makes no lookup

- **WHEN** `resolveAccess` runs for `projects/public/handbook`
- **THEN** it answers `{ canEdit: false, canManage: false }`, and `getSharedResources` is not called

#### Scenario: Edit share grants canEdit

- **WHEN** a user whose bucket is `a1b2c3` resolves `projects/z9y8x7/research`, and `getSharedResources` lists `projects/z9y8x7/research` with `permissions: ['READ', 'WRITE']`
- **THEN** the answer is `{ canEdit: true, canManage: false }`

#### Scenario: View share does not

- **WHEN** the listed entry for `projects/z9y8x7/research` has `permissions: ['READ']`
- **THEN** the answer is `{ canEdit: false, canManage: false }`

#### Scenario: A folder share counts

- **WHEN** `getSharedResources` lists `projects/z9y8x7/team/` with `permissions: ['READ', 'WRITE']`, and the project is `projects/z9y8x7/team/research`
- **THEN** `canEdit` is `true`

#### Scenario: A sibling with a common prefix does not count

- **WHEN** `getSharedResources` lists `projects/z9y8x7/research-old` with `WRITE`, and the project is `projects/z9y8x7/research`
- **THEN** `canEdit` is `false`

#### Scenario: Encoded url is matched decoded

- **WHEN** the listed url is `projects/z9y8x7/Q4%20launch` with `WRITE`, and the project id is `projects/z9y8x7/Q4 launch`
- **THEN** `canEdit` is `true`

#### Scenario: A failed lookup is not a 403

- **WHEN** `getSharedResources` answers `503` during `assertCanWrite`
- **THEN** it rejects with `BadGatewayException` (`502`), not `ForbiddenException`

#### Scenario: An unreachable Core is a 503

- **WHEN** the `getSharedResources` call rejects with a network error during `assertCanWrite`
- **THEN** it rejects with `ServiceUnavailableException` (`503`)

## MODIFIED Requirements

### Requirement: GET /api/v1/projects/:id returns one project's details

`getProject` SHALL call two things concurrently under one signal that combines `AbortSignal.timeout(PROJECT_READ_TIMEOUT_MS)` (30,000 ms), the client-disconnect signal the controller passes (aborted on the request's `close`, as for create and update), and a sibling-failure controller:

- `listProjectMetadata(bucket, encodeDialResourcePath(path))`;
- the snapshot.

When either call rejects, the sibling-failure controller aborts with that error, so the other call stops (in particular, the archive stops buffering) and rejects with the same already-mapped exception rather than logging a second upstream failure.

**Metadata outcomes:**

- A metadata answer with `nodeType: 'FOLDER'` (a grouping folder) is `404`.
- Core `404` from either call is `404`. Core `403` is `403`.
- Other failures go through `handleDialSdkError` with context `projects.getProject`.

**`source`, `canEdit` and `canManage`:**

- `source` is `personal` when the bucket equals `SessionUser.bucket`, `organization` when it equals `PUBLIC_BUCKET`, and `shared` otherwise.
- `canEdit` and `canManage` come from `ProjectAccessService.resolveAccess` (see "Project access is resolved from the caller's bucket and DIAL Core share permissions"). For a `shared` project its lookup runs concurrently with the two reads, under the same combined signal, but outside the sibling-failure controller: a failed lookup does not fail the read. It is logged at `warn` (no ids), and the response carries `canEdit: false` and `canManage: false`, so the project opens read-only.
- `canManage` implies `canEdit`.

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
- `canEdit: boolean`: whether the caller may change the project's instructions and context files and write its conversations. It is `true` in the caller's own bucket, and for a project shared with them with `WRITE`;
- `canManage: boolean`: whether the caller may rename, delete, share and publish the project. It is `true` only in the caller's own bucket.

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
  "canEdit": true,
  "canManage": true
}
```

Example `200` response for a recipient who accepted an Edit link:

```json
{
  "id": "projects/z9y8x7/research",
  "name": "research",
  "bucket": "z9y8x7",
  "path": "research",
  "source": "shared",
  "description": "",
  "instructions": "Cite the source of every figure.",
  "contextFiles": [],
  "etag": "\"41aa\"",
  "contentVersion": "\"7c02d1…\"",
  "conversationCount": 0,
  "canEdit": true,
  "canManage": false
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

**Generated-client impact:** `ProjectsApi.getProject({ id })` returning `ProjectDetailsDto`, which gains the required `canManage: boolean`. Callers use the normal method.

#### Scenario: Personal project is editable and manageable

- **WHEN** a user reads a project in their own bucket
- **THEN** the response is `200` with `source: 'personal'`, `canEdit: true` and `canManage: true`, and `getSharedResources` is not called

#### Scenario: Conversations are counted, not returned

- **WHEN** the project holds three files under `conversations/`
- **THEN** the response has `conversationCount: 3`, and no conversation name or content

#### Scenario: View-only shared project is read-only

- **WHEN** a user reads `projects/z9y8x7/shared-research`, owned by another user and shared with them with `permissions: ['READ']`
- **THEN** the response is `200` with `source: 'shared'`, `canEdit: false` and `canManage: false`

#### Scenario: Shared project with edit access

- **WHEN** a user reads `projects/z9y8x7/shared-research`, shared with them with `permissions: ['READ', 'WRITE']`
- **THEN** the response is `200` with `source: 'shared'`, `canEdit: true` and `canManage: false`

#### Scenario: Organization project is read-only

- **WHEN** a user reads `projects/public/handbook`
- **THEN** the response is `200` with `source: 'organization'`, `canEdit: false` and `canManage: false`, and `getSharedResources` is not called

#### Scenario: A failed permission lookup opens the project read-only

- **WHEN** a user reads a shared project, and `getSharedResources` answers `503` while the metadata and the snapshot succeed
- **THEN** the response is `200` with `canEdit: false` and `canManage: false`, and the snapshot read is not aborted

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

1. **Require access and a single `If-Match`.** In this order:
   - **Rename needs `canManage`.** A trimmed name that differs from the last path segment, from a caller for whom `ProjectAccessService.assertCanManage` fails (the project is not in their bucket), is `403` (`ForbiddenException`), before any Core call. Only the owner renames: Core's move needs `ALL` (`READ` + `WRITE` + `SHARE`) on the source, and a share link grants `READ` + `WRITE`.
   - **A single `If-Match`.** An `If-Match` that is not exactly one entity tag — missing, blank, the `*` wildcard, or a comma-separated list (also what two `If-Match` headers become) — is `428`, `code: 'if-match-required'`, before any Core call. Core reads `*` as "any version" and a list as "any of these", so either would make the write unconditional on the version the caller read.
   - **Write access.** `ProjectAccessService.assertCanWrite`:
     - an own project passes with no Core call;
     - an organization project is `403` with no Core call;
     - a shared project without `WRITE` is `403` after the one `getSharedResources` lookup, and before any snapshot read or write;
     - a failed lookup is the mapped upstream error.
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
   - an `artifactEntries` file is uploaded with the content type `getArtifactContentType(path)` (`apps/chat-api/src/projects/utils/project-manifest.util.ts`) gives it: `text/typescript` for `.ts`, `.mts` and `.cts`, where mime-db would say `video/mp2t`; otherwise `lookup(path)` from `mime-types`; else `application/octet-stream`. `inferMimeTypeFromPath` is not used, because `@epam/ai-dial-chat-shared` is a frontend lib a `type:backend` project may not import;
   - an `otherEntries` file is uploaded as `application/octet-stream`. This is a known limitation.

   The save never adds, renames or removes an `artifacts/` entry: the chat only reads that folder.
7. **Write once per attempt.** Make one `uploadProjectFolder(bucket, encodeDialResourcePath(path), …)` call with `If-Match: <snapshot etag>`, under `AbortSignal.any([disconnect, AbortSignal.timeout(60_000)])`. The bucket is the project's, so an editor's save writes into the owner's bucket with the editor's token.
   - On a Core `412`, a write landed between the read and the write, typically a project conversation or an agent's artifact. Go back to step 3 with a fresh snapshot. The new files stay in memory and are not re-sent.
   - When the fresh `contentVersion` still equals `If-Match`, rebuild the `FormData` from the fresh snapshot (so the newer conversation bytes are carried, not the older ones) and write again.
   - At most `PROJECT_WRITE_ATTEMPTS` (3, in `apps/chat-api/src/projects/constants/project-context.constants.ts`) writes are made. A `412` on the last one, or a changed `contentVersion`, is `409 project-changed`.
8. **Move on rename.** The write has committed, so every rename step runs under a fresh `AbortSignal.timeout(30_000)` only — not the client-disconnect signal — and a closed tab cannot stop the rename half-way. Call `moveResource({ body: { sourceUrl, destinationUrl, overwrite: false } })`.
   - On a Core `400`, re-check the destination: when it exists, answer `409 name-taken`.
   - Any other failure (another status, a failed re-check, a network error or the timeout) is `409 project-changed`, so the client reloads and sees the content saved under the old name. A warning without names records that the content was saved under the old name.
9. **Migrate the pin on rename,** immediately after the move succeeds. Call `UserConfigService.replaceProjectPin(oldId, newId, …)`. A failure is logged and does not fail the request.
10. **Read the moved project's ETag** with `listProjectMetadata`, because Core recomputes the marker on copy. A failure is logged as a warning without names and does not fail the request: the response then omits `etag`.

Response: `200` with `UpdateProjectResponseDto { id, name, bucket, path, etag?, isPinned }`; `etag` is absent only when a renamed project's ETag could not be read back. `isPinned` is the caller's own pin. Logs carry the outcome, file counts and byte totals, never names or content.

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
| `403` | The flag is off; the caller may not write to the project (`canEdit: false`); a caller other than the owner changed the name; or Core denied write access. |
| `404` | No such project. |
| `409` | `project-changed` (stale `contentVersion`, a write still racing after `PROJECT_WRITE_ATTEMPTS`, or a rename that failed after the content was saved) or `name-taken`. |
| `413` | `file-too-large`, `capacity-exceeded`, or `project-too-large` (the archive, or the stored `PROJECT.md` above `PROJECT_MANIFEST_MAX_BYTES`). |
| `428` | `if-match-required` (missing, `*`, or a list of tags). |
| `429` / `502` / `503` | Upstream, including a failed permission lookup. |

Every error code is a `ProjectCreateErrorCode` member. The enum gains `ProjectChanged = 'project-changed'`, `IfMatchRequired = 'if-match-required'`, `ProjectTooLarge = 'project-too-large'` and `UnknownFile = 'unknown-file'`.

**Generated-client impact:** `ProjectsApi.updateProject({ id, ifMatch, name, description, instructions, fileNames, removedFileNames, files })` returning `UpdateProjectResponseDto`. Callers use the normal method. Neither the request nor the response changes shape.

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
- **THEN** they are written at the same paths with their original bytes and the types `application/pdf`, `application/vnd.openxmlformats-officedocument.presentationml.presentation` and `application/octet-stream`, and `artifacts/script.ts` as `text/typescript`

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

#### Scenario: An editor saves content into the owner's project

- **WHEN** `PUT /api/v1/projects/projects%2Fz9y8x7%2Fresearch` is called by a user whose bucket is `a1b2c3`, with the name `research` unchanged and new instructions, and `getSharedResources` lists the project with `permissions: ['READ', 'WRITE']`
- **THEN** one `uploadProjectFolder` call is made for bucket `z9y8x7` with the caller's token, no move is made, and the response is `200`

#### Scenario: An editor cannot rename

- **WHEN** the same user sends the name `Research 2025` for `projects/z9y8x7/research`
- **THEN** the response is `403`, and no DIAL Core call is made

#### Scenario: A view-only recipient's save is refused

- **WHEN** `PUT /api/v1/projects/projects%2Fz9y8x7%2Fresearch` is called by a user whose bucket is `a1b2c3`, and `getSharedResources` lists the project with `permissions: ['READ']`
- **THEN** the response is `403`, the only Core call is `getSharedResources`, and no snapshot read or `uploadProjectFolder` call is made

#### Scenario: An organization project is refused before Core

- **WHEN** `PUT /api/v1/projects/projects%2Fpublic%2Fhandbook` is called with the stored name
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
