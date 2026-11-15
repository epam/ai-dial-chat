## ADDED Requirements

### Requirement: List Personal toolset folders
The system SHALL expose `GET /api/v1/toolsets/folders` with optional query `path` (validated with `@IsValidFilePath()`; empty = root). It returns `200` `ResourceFoldersResponseDto { folders: { name, path }[] }`: the FOLDER nodes directly under `toolsets/{sessionBucket}/{path}/`, listed through the DIAL SDK toolset-metadata call. The list is not cached.

- operationId `listToolsetFolders`, normal generated method.
- Errors: `400`, `401`, `502`.
- The route SHALL be registered before `GET /api/v1/toolsets/:toolsetName` so that `folders` is not read as a toolset name.

Example: `GET /api/v1/toolsets/folders` → `200 {"folders":[{"name":"Search","path":"Search"}]}`

#### Scenario: Listing does not collide with toolset lookup
- **WHEN** an authenticated user calls `GET /api/v1/toolsets/folders`
- **THEN** the folder listing is returned, not a toolset lookup for a toolset named `folders`

### Requirement: Create toolset accepts a target folder and create-only
The create toolset body SHALL accept optional `folderPath: string` (`@IsValidFilePath()`) and `createOnly: boolean` (default `false`). The storage path SHALL become `{folderPath}/{name}__{version}`, with each segment encoded. With `createOnly`, the write uses `If-None-Match: *`, and an existing path answers `409`. Without either field, behaviour is unchanged.

#### Scenario: New version is created, never overwritten
- **WHEN** a toolset is created with `{ name: "search", version: "1.1.0", createOnly: true }` and `search__1.1.0` already exists
- **THEN** the response is `409` and the existing toolset is unchanged

### Requirement: Move a toolset to a Personal folder
The system SHALL expose `POST /api/v1/toolsets/:toolsetName/move` with body `MoveResourceDto { folderPath }`. It calls the SDK `moveResource` (`overwrite: false`) to `toolsets/{sessionBucket}/{folderPath}/{leaf}` and returns `200` `ResourceIdResponseDto { id }`. On success it invalidates the toolsets list cache key, the same key create and update invalidate. Hidden auth settings and secrets SHALL be neither read nor logged by the move.

- operationId `moveToolset`.
- Errors: `400`, `401`, `403` (source not in the caller's bucket), `404`, `409` (target exists), `502`.

#### Scenario: Move into a subfolder
- **WHEN** the owner moves `toolsets/b1/search__1.0.0` to `Search`
- **THEN** the response id is `toolsets/b1/Search/search__1.0.0`
