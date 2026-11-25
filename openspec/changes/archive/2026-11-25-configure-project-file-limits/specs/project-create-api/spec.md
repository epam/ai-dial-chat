## MODIFIED Requirements

### Requirement: Context files are validated for name, type, size and count before Core is called

`ProjectsService.createProject` SHALL validate the actually received parts before any Core call:

- **Pairing:** `fileNames` must parse to an array of strings whose length equals the number of `files` parts. Otherwise the response is `400 invalid-file-name`.
- **Names:** each file name must pass the project-name rule and must be unique within the request. A failure is `400 invalid-file-name` or `400 duplicate-file-name`, with `field` set to the offending name.
- **Type:** the lower-cased extension of each name must be in `PROJECT_CONTEXT_ALLOWED_EXTENSIONS`. Otherwise the response is `400 unsupported-file-type`. For the built-in types, the content must also match the type's signature: `pdf` starts with `%PDF-`, `xlsx` starts with the ZIP signature `PK\x03\x04`, and `csv` has no NUL byte in its first 8 KiB. A mismatch is also `400 unsupported-file-type`. Any other configured extension is checked by extension only.
- **Per-file size:** any part larger than `PROJECT_CONTEXT_FILE_MAX_BYTES` gives `413 file-too-large`.
- **Total size:** a sum of all part sizes above `PROJECT_CONTEXT_TOTAL_MAX_BYTES` gives `413 capacity-exceeded`.
- **Count:** more than `PROJECT_CONTEXT_MAX_FILES` context files (default 100) gives `400 too-many-files`.

Multipart parsing for this route SHALL run in a route-scoped `ProjectContextUploadInterceptor` (`apps/chat-api/src/projects/project-context-upload.interceptor.ts`). It is modelled on `apps/chat-api/src/skills/import/skill-archive-upload.interceptor.ts` and uses Multer memory storage, with `fileSize` set to `PROJECT_CONTEXT_FILE_MAX_BYTES` and `files` set to `PROJECT_CONTEXT_MAX_FILES`. The interceptor SHALL translate a Multer `LIMIT_FILE_SIZE` or `LIMIT_FILE_COUNT` rejection into the same typed `413 file-too-large` or `400 too-many-files` error, so a client sees one contract whichever layer rejects.

The multipart field size limit SHALL accommodate a compact JSON list of `PROJECT_CONTEXT_MAX_FILES` valid UTF-8 names in both `fileNames` and `removedFileNames`.

#### Scenario: Long filename lists

- **WHEN** the configured count is 4096 and the client sends 4096 valid 255-byte names in a compact JSON list
- **THEN** multipart parsing accepts the full field on create or edit.

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

### Requirement: Project limits are environment-configured and validated at boot

`EnvironmentVariables` (`apps/chat-api/src/config/environment.config.ts`) SHALL declare the following environment variables:

- `PROJECT_CONTEXT_MAX_FILES`: a positive integer, default `100`. The count is published as `config.projectContextMaxFiles`.
- `PROJECT_ARCHIVE_READ_MAX_BYTES`: a positive integer, default `67108864`. It must exceed the total context budget by at least 1 MiB.
- `PROJECT_CONTEXT_FILE_MAX_BYTES`: a positive integer, default `1048576`.
- `PROJECT_CONTEXT_TOTAL_MAX_BYTES`: a positive integer, default `10485760`. It must be at least `PROJECT_CONTEXT_FILE_MAX_BYTES`, or boot fails.
- `PROJECT_CONTEXT_ALLOWED_EXTENSIONS`: a comma-separated list, trimmed, lower-cased, with any leading `.` stripped and empty entries dropped. Each entry must match `^[a-z0-9]{1,16}$`, or boot fails. Unset or empty means `['csv', 'pdf', 'xlsx']`.

The settings are listed in `apps/chat-api/.env.template` and `apps/chat-api/README.md`. The README notes that operators must keep them at or below Core's `complexResource.types.projects` limits (built-in: 5 MiB per file and 64 MiB total).

#### Scenario: Defaults

- **WHEN** none of the project variables is set
- **THEN** the BFF accepts `.csv`, `.pdf` and `.xlsx` files up to 1 MiB each and 10 MiB in total

#### Scenario: Invalid extension list fails boot

- **WHEN** `PROJECT_CONTEXT_ALLOWED_EXTENSIONS=csv,../exe`
- **THEN** environment validation fails at startup and names the variable
