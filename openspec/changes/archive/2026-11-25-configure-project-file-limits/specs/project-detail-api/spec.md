## MODIFIED Requirements

### Requirement: A project snapshot is read from DIAL Core's archive

`ProjectsSnapshotService` (`apps/chat-api/src/projects/snapshot/projects-snapshot.service.ts`) SHALL read a project with `downloadProjectFolder(bucket, encodeDialResourcePath(path), { parseAs: 'stream' })`.

**ETag.** The snapshot's `etag` is the response's `ETag` header. A response without `ETag` is an invalid upstream response, `502`.

**Size cap.** `PROJECT_ARCHIVE_READ_MAX_BYTES` is an environment setting that defaults to 64 MiB, Core's default per-project total. When the response's `Content-Length`, or the running byte count while buffering, exceeds it, the read is aborted and the BFF answers `413` with `code: 'project-too-large'`. `validate` (`apps/chat-api/src/config/validation.ts`) fails boot when `PROJECT_CONTEXT_TOTAL_MAX_BYTES` exceeds `PROJECT_ARCHIVE_READ_MAX_BYTES` minus `PROJECT_MANIFEST_MAX_BYTES` (63 MiB of context at the default archive budget).

**Concurrency.** At most `PROJECT_ARCHIVE_READ_CONCURRENCY` (4, in `apps/chat-api/src/projects/constants/project-context.constants.ts`) snapshot reads download and parse an archive at once per BFF process. Edits can retain the archive after the read slot is released while they rebuild the outgoing project. A further read waits for a free slot; its abort signal (deadline or client disconnect) ends the wait without a Core call. Downloads stream and are not limited.

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

**Logging.** `log` and `warn` logs carry counts and byte totals only, never a file name, bucket or content. An unreadable archive is logged with the error's `name` only, because `yauzl`'s messages quote entry file names. At `debug` level (`LOG_LEVEL=debug`, off by default) the snapshot also logs what Core's archive held — the ETag, the archive size, whether `PROJECT.md` parsed, and every entry's path and size. `getProject` does not log Core's item metadata. File content and tokens are never logged at any level.

#### Scenario: Snapshot ETag comes from the archive response

- **WHEN** Core answers the archive with `ETag: "e1"` and entries `PROJECT.md`, `context/tickets.csv` (2,048 bytes) and `context/survey.xlsx` (10,240 bytes)
- **THEN** the snapshot has `etag: "e1"`, and two context files with exactly those sizes

#### Scenario: Oversized archive is refused before buffering

- **WHEN** Core answers with `Content-Length` greater than the configured archive budget
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
