## ADDED Requirements

### Requirement: List Personal application folders
The system SHALL expose `GET /api/v1/applications/folders` with optional query `path` (validated with `@IsValidFilePath()`; empty or omitted = root). It returns the FOLDER nodes directly under `applications/{sessionBucket}/{path}/`, listed through the DIAL SDK application-metadata call. Response `200`: `ResourceFoldersResponseDto { folders: { name: string; path: string }[] }`, where `path` is relative to the bucket. The folder list is not cached.

- Generated client: operationId `listApplicationFolders`. Frontend callers use the normal (non-`Raw`) method through `apps/chat/src/server-api/applications.ts`.
- Errors: `400` invalid path, `401` no session, `502` upstream failure.
- Authorization: any authenticated session. Only the caller's own bucket is listed.

Example: `GET /api/v1/applications/folders?path=Design` → `200 {"folders":[{"name":"Audit Agents","path":"Design/Audit Agents"}]}`

#### Scenario: Listing the root
- **WHEN** an authenticated user calls `GET /api/v1/applications/folders`
- **THEN** the response lists only folder nodes at the root of the user's applications bucket

#### Scenario: Path traversal is rejected
- **WHEN** the caller passes `path=../other`
- **THEN** the response is `400` and no upstream call is made

### Requirement: Create application accepts a target folder
`POST /api/v1/applications` (`CreateApplicationBodyDto`) SHALL accept optional `folderPath: string` (validated with `@IsValidFilePath()`). The storage path SHALL become `{folderPath}/{name}__{version}`, with each segment encoded through `encodeDialResourcePath`. `createOnly` candidates (`name-2__version`, …) are tried inside the same folder. Omitting `folderPath` keeps today's root path.

#### Scenario: Create-only write into a folder
- **WHEN** a custom app is saved as new version `1.1.0` with `{ folderPath: "Design", createOnly: true }`
- **THEN** the application is created at `applications/{bucket}/Design/{name}__1.1.0`, or the response is `409` when that path is taken

### Requirement: Move an application to a Personal folder
The system SHALL expose `POST /api/v1/applications/:applicationName/move` with body `MoveResourceDto { folderPath: string }`. It calls the SDK `moveResource` with `overwrite: false` from the application's current resource URL to `applications/{sessionBucket}/{folderPath}/{leaf}`, where `leaf` is the current last segment. Response `200`: `ResourceIdResponseDto { id }`, the new full id. On success it SHALL invalidate `applications:list:{userSub}`.

- operationId `moveApplication`.
- Errors: `400` invalid body, `401`, `403` source not in the caller's bucket, `404` source missing, `409` target exists, `502`.

Example: `POST /api/v1/applications/applications%2Fb1%2Fagent__1.0.0/move` `{"folderPath":"Design"}` → `200 {"id":"applications/b1/Design/agent__1.0.0"}`

#### Scenario: Move into a subfolder
- **WHEN** the owner moves `applications/b1/agent__1.0.0` to `Design`
- **THEN** the response id is `applications/b1/Design/agent__1.0.0`, and the old id no longer resolves

#### Scenario: Target exists
- **WHEN** an application with the same leaf already exists in the target folder
- **THEN** the response is `409` and the source is unchanged

### Requirement: Fork and commit an application version
The system SHALL expose two endpoints.

**Fork.** `POST /api/v1/applications/:applicationName/versions` with body `ForkApplicationVersionDto { version: string; folderPath: string }`. `version` uses the existing version allowlist `@Matches`, and `folderPath` uses `@IsValidFilePath()`. The BFF SDK-copies (`copyResource`, `overwrite: false`) the stored application to `applications/{sessionBucket}/{folderPath}/{name}__{version}`, then sets `displayVersion` to `version` on the copy. Response `201`: `ResourceIdResponseDto { id }`. It returns `409` when the target exists.

**Commit.** `POST /api/v1/applications/:applicationName/versions/commit` with body `CommitApplicationVersionDto { snapshotId: string }`. `snapshotId` must be an `applications/{sessionBucket}/…` id, else `403`. The BFF reads both applications with their ETags, then:

1. writes the snapshot's body to the source path with the source's `displayVersion`, using `If-Match`;
2. writes the source's previous body to the snapshot path with the snapshot's `displayVersion`, using `If-Match`.

Response `200`: `ResourceIdResponseDto { id: snapshotId }`. It returns `409` when either ETag changed between the read and the write.

Both endpoints:

- invalidate `applications:list:{userSub}` on success;
- have operationIds `forkApplicationVersion` and `commitApplicationVersion`;
- can return `400`, `401`, `403`, `404`, `409` and `502`;
- log failures with `Logger` and never log bodies or tokens.

Example: `POST …/applications%2Fb1%2Fagent__1.0.0/versions` `{"version":"1.1.0","folderPath":""}` → `201 {"id":"applications/b1/agent__1.1.0"}`

#### Scenario: Fork creates a snapshot with the new version
- **WHEN** the owner forks `agent__1.0.0` to version `1.1.0` at the root
- **THEN** `applications/{bucket}/agent__1.1.0` exists with `displayVersion` `1.1.0` and the same body as the stored `agent__1.0.0`

#### Scenario: Commit swaps the bodies
- **GIVEN** a snapshot `agent__1.1.0` forked before the embedded editor saved edits to `agent__1.0.0`
- **WHEN** commit runs with that snapshot id
- **THEN** `agent__1.1.0` holds the edited body with version `1.1.0`, and `agent__1.0.0` holds the pre-edit body with version `1.0.0`

#### Scenario: Concurrent change aborts commit
- **WHEN** either application's ETag changed after commit read it
- **THEN** the response is `409`
