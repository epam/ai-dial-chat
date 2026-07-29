## ADDED Requirements

### Requirement: Prompt folders are virtual path prefixes with sentinel files

A prompt folder is not a first-class DIAL Core entity. It is represented as a path prefix shared by one or more prompts. To support empty folders and make them listable, the service writes a sentinel file `{bucket}/prompts/{folderPath}/.folder` when a folder is explicitly created and removes it when the folder is deleted. The `GET /api/v1/prompts` list endpoint filters out `.folder` files from the `prompts` array and synthesises `PromptFolderResponseDto` entries from the distinct path prefixes found in the listing.

#### Scenario: Sentinel file is excluded from prompt list

- **WHEN** DIAL Core contains `{bucket}/prompts/Work/.folder`
- **THEN** `GET /api/v1/prompts` includes `Work` in `folders` but does NOT include a `PromptResponseDto` with name `.folder` in `prompts`

#### Scenario: Folder appears in list without sentinel when non-empty

- **WHEN** a prompt exists at `Work/AI/my-prompt` and no sentinel exists at `Work/.folder` or `Work/AI/.folder`
- **THEN** `GET /api/v1/prompts` includes both `Work` and `Work/AI` in `folders`

---

### Requirement: POST /api/v1/prompts/folders creates an empty folder

The backend SHALL expose `POST /api/v1/prompts/folders` in `PromptController` (`version: '1'`). The body is `CreatePromptFolderDto`:

```
{
  "name":     "<string @IsString @MinLength(1) @MaxLength(256) @Matches(/^[^/]+$/)>",
  "parentId": "<string | undefined @IsString @Matches(/^[a-zA-Z0-9 _.\-/]*$/) @IsOptional>"
}
```

The service:
1. Derives the full folder path: `{parentId ? parentId + '/' : ''}{name}`.
2. Rejects with 409 if a sentinel already exists at that path.
3. Writes the sentinel file `{sessionBucket}/prompts/{folderPath}/.folder` (empty content) to DIAL Core.
4. Returns HTTP 201 with `PromptFolderResponseDto`: `{ "id": "<folderPath>", "name": "<name>" }`.

Rate limiting: `@Throttle({ default: { limit: 20, ttl: 60000 } })`.

Error codes:
- `400 Bad Request` — DTO validation fails (name contains `/`, or disallowed characters)
- `401 Unauthorized` — missing or invalid session
- `409 Conflict` — folder already exists at that path
- `502 Bad Gateway` — DIAL Core write failed
- `500 Internal Server Error` — unexpected failure

#### Scenario: Creating a root folder returns 201

- **WHEN** `POST /api/v1/prompts/folders` is called with `{ "name": "Work" }`
- **THEN** the response is 201 with `{ "id": "Work", "name": "Work" }`
- **AND** a sentinel file `{bucket}/prompts/Work/.folder` exists in DIAL Core

#### Scenario: Creating a nested folder returns 201

- **WHEN** `POST /api/v1/prompts/folders` is called with `{ "name": "AI", "parentId": "Work" }`
- **THEN** the response is 201 with `{ "id": "Work/AI", "name": "AI" }`

#### Scenario: Duplicate folder returns 409

- **WHEN** `POST /api/v1/prompts/folders` is called for a path whose sentinel already exists
- **THEN** the response is 409

---

### Requirement: PUT /api/v1/prompts/folders?path= renames a folder

The backend SHALL expose `PUT /api/v1/prompts/folders` with a required `path` query parameter. The body is `RenamePromptFolderDto`:

```
{
  "name": "<string @IsString @MinLength(1) @MaxLength(256) @Matches(/^[^/]+$/)>"
}
```

The service:
1. Verifies the folder exists (at least one file with the given path prefix, or a sentinel at that path).
2. Rejects with 409 if the new path (parent unchanged, new name) already exists.
3. Moves all DIAL Core files under `{bucket}/prompts/{oldPath}/` to `{bucket}/prompts/{newPath}/` using parallel write + delete pairs.
4. Updates sentinels accordingly.
5. Returns HTTP 200 with `PromptFolderResponseDto` for the renamed folder.

Error codes:
- `400 Bad Request` — DTO validation fails
- `401 Unauthorized` — missing or invalid session
- `404 Not Found` — no folder exists at the given path
- `409 Conflict` — target folder name already exists
- `502 Bad Gateway` — DIAL Core operation failed
- `500 Internal Server Error` — unexpected failure

#### Scenario: Renaming a folder updates all prompt paths

- **WHEN** `PUT /api/v1/prompts/folders?path=Work` is called with `{ "name": "Projects" }`
- **AND** prompts exist at `Work/task1` and `Work/AI/task2`
- **THEN** the response is 200 with `{ "id": "Projects", "name": "Projects" }`
- **AND** the prompts are now at `Projects/task1` and `Projects/AI/task2`
- **AND** `Work` no longer appears in `GET /api/v1/prompts` `folders`

#### Scenario: Rename to existing name returns 409

- **WHEN** a folder named `Projects` already exists at root
- **AND** `PUT /api/v1/prompts/folders?path=Work` is called with `{ "name": "Projects" }`
- **THEN** the response is 409

---

### Requirement: DELETE /api/v1/prompts/folders?path= deletes a folder and its contents

The backend SHALL expose `DELETE /api/v1/prompts/folders` with a required `path` query parameter. The service deletes all DIAL Core files under `{bucket}/prompts/{path}/` (including nested sub-folders and their sentinels) using parallel delete calls. Returns HTTP 204 No Content. If no files exist under the path, returns 404.

Error codes:
- `400 Bad Request` — `path` fails validation
- `401 Unauthorized`
- `404 Not Found` — no folder or prompts at the given path
- `502 Bad Gateway` — DIAL Core delete failed
- `500 Internal Server Error` — unexpected failure

#### Scenario: Deleting a folder removes all contents

- **WHEN** `DELETE /api/v1/prompts/folders?path=Work` is called
- **AND** prompts exist at `Work/task1` and `Work/AI/task2`
- **THEN** the response is 204
- **AND** none of those files exist in DIAL Core
- **AND** `GET /api/v1/prompts` no longer includes `Work` or `Work/AI` in `folders`

#### Scenario: Deleting non-existent folder returns 404

- **WHEN** `DELETE /api/v1/prompts/folders?path=nonexistent` is called
- **THEN** the response is 404

---

### Requirement: POST /api/v1/prompts/move?path= moves a prompt to a different folder

The backend SHALL expose `POST /api/v1/prompts/move` with a required `path` query parameter. The body is `MovePromptDto`:

```
{
  "targetFolderId": "<string @IsString @Matches(/^[a-zA-Z0-9 _.\-/]*$/)>"
}
```

`targetFolderId` may be an empty string (moves the prompt to root).

The service:
1. Reads the prompt at `{sessionBucket}/prompts/{path}.json`.
2. Derives the new path: `{targetFolderId ? targetFolderId + '/' : ''}{lastName}` where `lastName` is the last segment of the current path.
3. Rejects with 409 if the new path already exists.
4. Writes to the new path and deletes the old path. Updates `updatedAt`.
5. Returns HTTP 200 with `PromptResponseDto` reflecting the new path.

Error codes:
- `400 Bad Request` — DTO validation fails
- `401 Unauthorized`
- `404 Not Found` — no prompt at the source path
- `409 Conflict` — a prompt already exists at the target path
- `502 Bad Gateway`
- `500 Internal Server Error`

#### Scenario: Moving a prompt into a subfolder

- **WHEN** `POST /api/v1/prompts/move?path=greeting` is called with `{ "targetFolderId": "Work" }`
- **THEN** the response is 200 with `id: "Work/greeting"` and `folderId: "Work"`
- **AND** the prompt no longer exists at `greeting` in DIAL Core

#### Scenario: Moving a prompt to root

- **WHEN** `POST /api/v1/prompts/move?path=Work/greeting` is called with `{ "targetFolderId": "" }`
- **THEN** the response is 200 with `id: "greeting"` and `folderId: ""`

#### Scenario: Move conflict returns 409

- **WHEN** `POST /api/v1/prompts/move?path=greeting` is called with `{ "targetFolderId": "Work" }`
- **AND** `Work/greeting` already exists
- **THEN** the response is 409

---

### Requirement: Generated client folder-endpoint SDK methods

After implementation `npm run openapi` SHALL produce these SDK methods:

| HTTP | Path | operationId | Generated SDK method |
|------|------|-------------|----------------------|
| POST | /api/v1/prompts/folders | `createPromptFolder` | `createPromptFolder` |
| PUT | /api/v1/prompts/folders | `renamePromptFolder` | `renamePromptFolder` |
| DELETE | /api/v1/prompts/folders | `deletePromptFolder` | `deletePromptFolder` |
| POST | /api/v1/prompts/move | `movePrompt` | `movePrompt` |

RTL / direction impact: none (backend only).
Feature flag gating: none.
Observability: log `WARN` for each DIAL Core error with bucket, path prefix, and operation name.
