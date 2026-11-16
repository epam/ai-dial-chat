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

**The `:fileName` parameter of a context file.** `ProjectFileParamDto.fileName` SHALL be validated with `IsDialEntityName` (`apps/chat-api/src/common/validators/dial-entity-name.validator.ts`), the rule create applies to context file names. A context file is always one segment directly under `context/`.

**The `:fileName` parameter of an output.** `ProjectArtifactParamDto.fileName` (`apps/chat-api/src/projects/dto/project-id-param.dto.ts`) is a path relative to `artifacts/`, URL-encoded into one path segment as `:id` is. Express decodes it once, so `run-1%2Fdata.csv` arrives as `run-1/data.csv`. It SHALL be validated with `@IsString()` and `@IsSafeDialRelativePath()`, which:

- splits the value on `/` and requires every segment to pass `isSafeDialPathSegment`, the stored-path rule. A segment therefore SHALL NOT be empty, `.`, `..` or another reserved name, and SHALL NOT contain `\`, `%`, a control or a bidi character. An empty segment also covers a leading `/`, a trailing `/` and `//`;
- caps each segment at `DIAL_PATH_SEGMENT_MAX_BYTES` (1,024) UTF-8 bytes and the whole path at 4,096.

The stored-path rule replaces `IsDialEntityName` here because outputs are written by agents, not typed by users. It accepts every name the entity-name rule accepts.

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

- **WHEN** `GET /api/v1/projects/projects%2Fa1b2c3%2Fq4/artifacts/..%2Fcontext%2Ftickets.csv` or `…/artifacts/run-1%2F..%2Fx` is called
- **THEN** the response is `400`, and no DIAL Core call is made

#### Scenario: Malformed artifact paths are rejected

- **WHEN** `:fileName` decodes to `/report.pdf`, `run-1/`, `run-1//data.csv`, `run-1\data.csv` or `report%20v2.md`
- **THEN** the response is `400`, and no DIAL Core call is made

#### Scenario: Foreign prefix is rejected

- **WHEN** `:id` decodes to `skills/a1b2c3/q4`
- **THEN** the response is `400`

### Requirement: GET /api/v1/projects/:id/artifacts/:fileName streams one output

`ProjectsController` SHALL expose `downloadProjectArtifact` at `GET /api/v1/projects/:id/artifacts/:fileName`, taking `ProjectArtifactParamDto`. `:fileName` is the output's path relative to `artifacts/`: a direct child (`report.pdf`) or a nested path (`run-1/data.csv`, sent as `run-1%2Fdata.csv`). The handler streams `ProjectsDownloadService.downloadArtifact(project, fileName, accessToken, callerBucket)` through the same `streamDownload` helper as `downloadProjectFile`.

`downloadArtifact` SHALL call `downloadProjectFile(bucket, encodeDialResourcePath(path), encodeDialResourcePath('artifacts/' + fileName), { parseAs: 'stream' })` through the shared `download` helper. `encodeDialResourcePath` encodes each segment and keeps the `/` between them. The route therefore has the same behaviour as a context-file download:

- a 60-second deadline until Core's response headers arrive, after which a slow client is not cut off;
- only `content-type` and `etag` forwarded from Core;
- `Content-Disposition: attachment` with the ASCII fallback and the RFC 5987 `filename*`, `X-Content-Type-Options: nosniff` and `Cache-Control: private, no-store`. The disposition name SHALL be the last segment of `fileName`;
- Core's `404`, or its `403` in the caller's own bucket, answered as `404`.

Any caller who can read the project may call it. Swagger declares `@ApiProduces('application/octet-stream')`, `@ApiParam` for `:id` and `:fileName`, `@ApiDialCoreErrors()`, and an `@ApiResponse` for `200` (binary), `400`, `401`, `403`, `404`, `502` and `503`. The `:fileName` `@ApiParam` describes a path relative to `artifacts/`, URL-encoded into one segment, with the example `run-1%2Fdata.csv`.

Example request:

```http
GET /api/v1/projects/projects%2Fa1b2c3%2Fq4-launch/artifacts/run-1%2Fdata.csv HTTP/1.1
```

Example `200` response headers:

```http
HTTP/1.1 200 OK
Content-Type: text/csv
Content-Disposition: attachment; filename="data.csv"; filename*=UTF-8''data.csv
X-Content-Type-Options: nosniff
Cache-Control: private, no-store
```

**Generated-client impact:** the generator emits `Blob | void`, so callers use `ProjectsApi.downloadProjectArtifactRaw({ id, fileName })`. Its signature does not change, and it encodes `fileName` into one segment. Only the param description changes, so `npm run openapi` regenerates the client. The canvas, the attachment tile and playback reach the route by URL through the app's `resolveProjectFileDownloadUrl` (see the `project-view-ui` and `project-conversations-ui` capabilities), so `ProjectsApiClient` gains no download method.

After the change, `npm run openapi` and `npm run openapi:check` SHALL pass, and `libs/chat-api-client` SHALL build and lint.

#### Scenario: An output is downloaded as an attachment

- **WHEN** `GET /api/v1/projects/projects%2Fa1b2c3%2Fq4-launch/artifacts/report.pdf` is called and Core streams the file with `Content-Type: application/pdf`
- **THEN** the response streams it with `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="report.pdf"; filename*=UTF-8''report.pdf` and `X-Content-Type-Options: nosniff`
- **AND** Core was asked for `artifacts/report.pdf` of `projects/a1b2c3/q4-launch`

#### Scenario: A nested output is downloaded under its own name

- **WHEN** `GET /api/v1/projects/projects%2Fa1b2c3%2Fq4-launch/artifacts/run-1%2Fdata.csv` is called
- **THEN** Core is asked for `artifacts/run-1/data.csv` of `projects/a1b2c3/q4-launch`
- **AND** the response carries `Content-Disposition: attachment; filename="data.csv"; filename*=UTF-8''data.csv`

#### Scenario: An output name an agent wrote with a colon

- **WHEN** `:fileName` decodes to `run-1/summary: final.md`
- **THEN** Core is asked for `artifacts/run-1/summary%3A%20final.md`, and the file streams with `200`

#### Scenario: A missing output

- **WHEN** Core answers `downloadProjectFile` with `404`
- **THEN** the response is `404`

#### Scenario: A context file cannot be reached through the artifacts route

- **WHEN** `:fileName` decodes to `../context/tickets.csv`
- **THEN** the response is `400`, and no DIAL Core call is made
- **AND** `context/tickets.csv` is requested as `artifacts/context/tickets.csv`, a path inside `artifacts/`, never as the context file

#### Scenario: A reader of a shared project can download an output

- **WHEN** a user whose bucket is `z9y8x7` downloads `report.pdf` from `projects/a1b2c3/q4-launch`, which is shared with them
- **THEN** the Core call is made with that user's token and the file streams with `200`

#### Scenario: Generated client exposes the artifact operations

- **WHEN** `npm run openapi` runs
- **THEN** `ProjectsApi` has `listProjectArtifacts` and `downloadProjectArtifactRaw`, and `downloadProjectArtifactRaw` still takes `{ id, fileName }`
