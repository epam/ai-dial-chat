## ADDED Requirements

### Requirement: POST /api/v1/projects creates a project in the caller's bucket

The BFF SHALL expose `POST /api/v1/projects` on `ProjectsController` (`apps/chat-api/src/projects/projects.controller.ts`):

- The handler is `createProject`, with OpenAPI `operationId: 'createProject'`, `@HttpCode(201)` and `@ApiConsumes('multipart/form-data')`.
- It inherits the controller-level `FeatureGuard` + `@RequireFeature(FeatureKey.ProjectsEnabled)`.
- It reads `{ at, bucket }` from the `SessionUser` and always creates the project at the root of that bucket, at `projects/{bucket}/{name}`. The request has no bucket or path field.
- The controller stays thin. It aborts the upstream call when the request emits `close`, the way `SkillsController.createSkill` does, and it delegates to `ProjectsService.createProject`.

The request is `multipart/form-data`, validated by `CreateProjectDto`, which uses `class-validator` + `@ApiProperty` on every field:

| Field | Required | Rule |
| --- | --- | --- |
| `name` | yes | the project-name rule in "Project names are validated with the DIAL entity-name allowlist" |
| `description` | no | string, at most 4,000 code points, defaults to `''` |
| `instructions` | no | string, at most 32,000 code points, defaults to `''` |
| `fileNames` | no | a JSON-encoded array of strings, positionally paired with the repeated `files` parts, defaults to `'[]'` |
| `files` | no | the repeated binary parts. They are read by `ProjectContextUploadInterceptor`, not modelled on the DTO |

Unknown fields are rejected by the global `ValidationPipe` (`forbidNonWhitelisted`). `fileNames` is authoritative for each file's name. A part's own multipart `filename` is never used, because browsers and parsers can mangle non-ASCII and separator characters. This is the same reason `CreateSkillDto.filePaths` exists.

A success returns `201` with `CreateProjectResponseDto` (`id`, `name`, `bucket`, `path`, optional `etag`) and `Cache-Control: no-store`.

Example request (multipart parts shown as fields):

```text
name=Q4 launch
description=Bundles the Q4 support tickets and survey results.
instructions=## Approach\nExplain your reasoning step by step.
fileNames=["tickets.csv","survey.xlsx"]
files=<tickets.csv bytes>
files=<survey.xlsx bytes>
```

Example response:

```json
{
  "id": "projects/a1b2c3/Q4 launch",
  "name": "Q4 launch",
  "bucket": "a1b2c3",
  "path": "Q4 launch",
  "etag": "9f2c0e1d"
}
```

**Feature flag:** `projectsEnabled` (`PROJECTS_ENABLED`, roles via `PROJECTS_ENABLED_ROLES`). **Authorization:** any authenticated session user for whom the flag resolves `true`. No other role is required. The write uses the caller's own token, so Core's bucket permissions apply. **Cache:** none. The #9596 listing is uncached, so there is nothing to invalidate.

#### Scenario: Name-only create

- **WHEN** an authenticated user with the flag on posts `name=Handbook` and nothing else
- **THEN** the BFF calls `uploadProjectFolder(bucket, 'Handbook', …)` once with a single `PROJECT.md` part, and responds `201` with `{ id: 'projects/{bucket}/Handbook', name: 'Handbook', bucket, path: 'Handbook' }`

#### Scenario: Full create stores every field and file

- **WHEN** the user posts a name, a description, instructions, `fileNames=["tickets.csv"]` and one `files` part
- **THEN** the single upstream call carries `PROJECT.md` and `context/tickets.csv` with the exact received bytes, and a following `GET /api/v1/projects` lists the project as a personal project

#### Scenario: Flag off

- **WHEN** `projectsEnabled` resolves `false` for the caller
- **THEN** `FeatureGuard` responds `403` and DIAL Core is never called

#### Scenario: Unauthenticated

- **WHEN** the request has no valid session
- **THEN** the response is `401` and DIAL Core is never called

### Requirement: The project is stored as PROJECT.md plus a context folder

DIAL Core imposes no layout on a project: `ProjectHandler` validates nothing and stores no metadata. The BFF SHALL therefore write this layout, which the chat owns:

- `PROJECT.md` at the project root. It starts with a `---`-fenced YAML frontmatter holding `name` (the project name) and `description` (the possibly empty description). It is serialized with the `yaml` package, so quotes, colons, newlines and leading `#` are escaped instead of breaking the document. The frontmatter is followed by a blank line and the instructions text verbatim, with no trimming, as the markdown body.
- Every context file at `context/{fileName}`.

The BFF builds `PROJECT.md` itself. The client never sends a manifest. A name-only project is the single `PROJECT.md`, which satisfies Core's `At least one file is required` rule. The manifest builder lives in a project-domain helper, `apps/chat-api/src/projects/utils/project-manifest.util.ts`, exporting `PROJECT_MANIFEST_FILE`, `PROJECT_CONTEXT_FOLDER` and `buildProjectManifest`, and it has a co-located spec.

#### Scenario: Manifest round-trips special characters

- **WHEN** the description is `Line 1\nkey: "value" # not a comment`
- **THEN** parsing the produced `PROJECT.md` frontmatter with `yaml` yields exactly that description, and the body after the frontmatter equals the submitted instructions byte for byte

#### Scenario: Empty optional fields

- **WHEN** only a name is submitted
- **THEN** the frontmatter has `name` and `description: ""`, and the body is empty

### Requirement: Project names are validated with the DIAL entity-name allowlist

A project name SHALL be accepted only when all of these hold:

- It is non-empty and has no leading or trailing whitespace. The BFF does not trim silently.
- It is at most 255 UTF-8 bytes.
- It contains none of the characters in the BFF's DIAL entity-name deny set: `: ; , = / \ { } % & "`, tab, NUL, and the bidi controls U+200E, U+200F, U+202A–U+202E and U+2066–U+2069. This is the set `notAllowedSymbolsRegex` in `apps/chat-api/src/conversations/utils/conversation.utils.ts` defines. It is exported from one shared module, `apps/chat-api/src/common/validators/dial-entity-name.validator.ts`, and the conversation code imports it from there, so the two copies never drift.
- It contains no other control character (`\p{Cc}`).
- It is not `.` or `..`, and not one of Core's reserved names `v`, `files`, `.dial-resource` or `.dial-folder`.

`CreateProjectDto` only bounds `name` as a non-empty string. `ProjectsCreateService` applies `isValidDialEntityName` from that module before any Core call, because a `ValidationPipe` failure cannot carry a domain code. A failure is `400` with `code: 'invalid-name'` and `field: 'name'`.

#### Scenario: Path traversal in the name

- **WHEN** `name` is `../other` or `a/b`
- **THEN** the response is `400` with `code: 'invalid-name'`, and DIAL Core is never called

#### Scenario: Reserved and control-character names

- **WHEN** `name` is `files`, `.dial-resource`, `a\u0000b` or `a‮b`
- **THEN** the response is `400` with `code: 'invalid-name'`

#### Scenario: Unicode name is allowed

- **WHEN** `name` is `Отчёт Q4 — 2026`
- **THEN** the name is accepted and percent-encoded for the Core path by `encodeDialResourcePath`

#### Scenario: Name too long

- **WHEN** `name` is 256 ASCII characters
- **THEN** the response is `400` with `code: 'invalid-name'`

### Requirement: Context files are validated for name, type, size and count before Core is called

`ProjectsService.createProject` SHALL validate the actually received parts before any Core call:

- **Pairing:** `fileNames` must parse to an array of strings whose length equals the number of `files` parts. Otherwise the response is `400 invalid-file-name`.
- **Names:** each file name must pass the project-name rule and must be unique within the request. A failure is `400 invalid-file-name` or `400 duplicate-file-name`, with `field` set to the offending name.
- **Type:** the lower-cased extension of each name must be in `PROJECT_CONTEXT_ALLOWED_EXTENSIONS`. Otherwise the response is `400 unsupported-file-type`. For the built-in types, the content must also match the type's signature: `pdf` starts with `%PDF-`, `xlsx` starts with the ZIP signature `PK\x03\x04`, and `csv` has no NUL byte in its first 8 KiB. A mismatch is also `400 unsupported-file-type`. Any other configured extension is checked by extension only.
- **Per-file size:** any part larger than `PROJECT_CONTEXT_FILE_MAX_BYTES` gives `413 file-too-large`.
- **Total size:** a sum of all part sizes above `PROJECT_CONTEXT_TOTAL_MAX_BYTES` gives `413 capacity-exceeded`.
- **Count:** more than 100 context files (`PROJECT_CONTEXT_MAX_FILES`, a BFF constant below Core's 1,000-file project limit) gives `400 too-many-files`.

Multipart parsing for this route SHALL run in a route-scoped `ProjectContextUploadInterceptor` (`apps/chat-api/src/projects/project-context-upload.interceptor.ts`). It is modelled on `apps/chat-api/src/skills/import/skill-archive-upload.interceptor.ts` and uses Multer memory storage, with `fileSize` set to `PROJECT_CONTEXT_FILE_MAX_BYTES` and `files` set to `PROJECT_CONTEXT_MAX_FILES`. The interceptor SHALL translate a Multer `LIMIT_FILE_SIZE` or `LIMIT_FILE_COUNT` rejection into the same typed `413 file-too-large` or `400 too-many-files` error, so a client sees one contract whichever layer rejects.

#### Scenario: Unsupported type

- **WHEN** a file is named `notes.docx`, and `docx` is not in the allowed extensions
- **THEN** the response is `400` with `code: 'unsupported-file-type'` and `field: 'notes.docx'`

#### Scenario: Renamed binary is rejected

- **WHEN** a file is named `report.pdf` but its bytes do not start with `%PDF-`
- **THEN** the response is `400` with `code: 'unsupported-file-type'`

#### Scenario: Oversized file is rejected by the parser

- **WHEN** one part is 1 byte over `PROJECT_CONTEXT_FILE_MAX_BYTES`
- **THEN** the response is `413` with `code: 'file-too-large'`, and DIAL Core is never called

#### Scenario: Capacity overflow

- **WHEN** every part is within the per-file limit, but their sum exceeds `PROJECT_CONTEXT_TOTAL_MAX_BYTES`
- **THEN** the response is `413` with `code: 'capacity-exceeded'`

#### Scenario: Path traversal in a file name

- **WHEN** `fileNames` contains `../PROJECT.md` or `sub/file.csv`
- **THEN** the response is `400` with `code: 'invalid-file-name'`

#### Scenario: Mismatched pairing

- **WHEN** `fileNames` lists two names but one `files` part is received
- **THEN** the response is `400` with `code: 'invalid-file-name'`

### Requirement: Creation is one atomic create-only Core call

`ProjectsService.createProject` SHALL call `dialClient.client.uploadProjectFolder(bucket, encodeDialResourcePath(name), …)` exactly once:

- The body is a `FormData` with one `file` part per stored file, whose part filename is the relative path (`PROJECT.md`, `context/{fileName}`).
- The call sends `If-None-Match: '*'` and no `If-Match`. Like `createSkill`, this needs a documented cast, because the SDK types declare only `If-Match`. The verified Core behaviour is that omitting both headers is an unconditional upsert, and the SDK's "omit to create" comment is wrong.
- The upstream signal combines the client-disconnect signal with a 60-second timeout.

Errors are mapped as follows:

- Core `412` becomes `409 Conflict` with `code: 'name-taken'` and `field: 'name'`.
- Any other Core error status goes through `mapDialHttpStatus` / `handleDialSdkError` from `apps/chat-api/src/common/dial/dial-error.mapper.ts`: `400`/`403`/`404`/`413` pass through as typed Nest exceptions, other HTTP failures become `502`, and network errors or the timeout become `503`.

Logs carry only the outcome, the file count and the total bytes. They never carry the project name, file names, the description, the instructions or the token.

#### Scenario: Duplicate name

- **WHEN** a project with the same name already exists in the caller's bucket, and Core answers `412`
- **THEN** the response is `409` with `code: 'name-taken'` and `field: 'name'`, and the existing project is unchanged

#### Scenario: Create-only header is sent

- **WHEN** a valid create request reaches Core
- **THEN** the upstream request has `If-None-Match: *` and no `If-Match` header

#### Scenario: Core unavailable

- **WHEN** the Core call fails with a network error or the timeout
- **THEN** the response is `503`, and nothing about the request body is logged

#### Scenario: Core server error

- **WHEN** Core answers `500`
- **THEN** the response is `502`

### Requirement: Create errors carry a typed code

Every domain rejection from `createProject` SHALL use the Nest exception envelope, extended as `ProjectCreateErrorDto` (`statusCode`, `message`, `error`, optional `code`, optional `field`). `code` is the string enum `ProjectCreateErrorCode` in `apps/chat-api/src/projects/types/project-create-error-code.enum.ts`, published with `enumName: 'ProjectCreateErrorCode'`:

- `InvalidName = 'invalid-name'`
- `NameTaken = 'name-taken'`
- `InvalidFileName = 'invalid-file-name'`
- `DuplicateFileName = 'duplicate-file-name'`
- `UnsupportedFileType = 'unsupported-file-type'`
- `FileTooLarge = 'file-too-large'`
- `CapacityExceeded = 'capacity-exceeded'`
- `TooManyFiles = 'too-many-files'`

This follows `ScheduledTaskValidationErrorDto`. Plain `ValidationPipe` failures with no domain meaning (for example an unknown field) have no `code`.

#### Scenario: Error body shape

- **WHEN** a request fails with a duplicate name
- **THEN** the body is `{ "statusCode": 409, "message": "A project with this name already exists", "error": "Conflict", "code": "name-taken", "field": "name" }`

### Requirement: createProject is documented in OpenAPI and exposed through the generated client

The handler SHALL have:

- an `@ApiBody` multipart schema listing `name` (required), `description`, `instructions`, `fileNames`, and `files` (an array of binary);
- `@ApiDialCoreErrors()`;
- an `@ApiResponse` for `201` (`type: CreateProjectResponseDto`) and for `400`, `401`, `403`, `409` and `413` (each with `type: ProjectCreateErrorDto` where a body is returned), plus `502` and `503`.

`npm run openapi` regenerates `libs/chat-api-client`, so that `ProjectsApi.createProject({ name, description, instructions, fileNames, files })` exists along with the `CreateProjectResponseDto`, `ProjectCreateErrorDto` and `ProjectCreateErrorCode` models. `npm run openapi:check` passes. The app calls the normal generated method, not a `Raw` variant, raw `fetch` or a `base.ts` helper.

#### Scenario: Generated client has the operation

- **WHEN** the client is regenerated
- **THEN** `libs/chat-api-client/src/generated/src/apis/ProjectsApi.ts` exports a `createProject` method whose request parameters include `name`, `description`, `instructions`, `fileNames` and `files`

### Requirement: Project limits are environment-configured and validated at boot

`EnvironmentVariables` (`apps/chat-api/src/config/environment.config.ts`) SHALL declare three optional variables:

- `PROJECT_CONTEXT_FILE_MAX_BYTES`: a positive integer, default `1048576`.
- `PROJECT_CONTEXT_TOTAL_MAX_BYTES`: a positive integer, default `10485760`. It must be at least `PROJECT_CONTEXT_FILE_MAX_BYTES`, or boot fails.
- `PROJECT_CONTEXT_ALLOWED_EXTENSIONS`: a comma-separated list, trimmed, lower-cased, with any leading `.` stripped and empty entries dropped. Each entry must match `^[a-z0-9]{1,16}$`, or boot fails. Unset or empty means `['csv', 'pdf', 'xlsx']`.

All three are listed in `apps/chat-api/.env.template` and `apps/chat-api/README.md`. The README notes that operators must keep them at or below Core's `complexResource.types.projects` limits (built-in: 5 MiB per file and 64 MiB total).

#### Scenario: Defaults

- **WHEN** none of the three variables is set
- **THEN** the BFF accepts `.csv`, `.pdf` and `.xlsx` files up to 1 MiB each and 10 MiB in total

#### Scenario: Invalid extension list fails boot

- **WHEN** `PROJECT_CONTEXT_ALLOWED_EXTENSIONS=csv,../exe`
- **THEN** environment validation fails at startup and names the variable
