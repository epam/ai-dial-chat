## ADDED Requirements

---

### Requirement: File upload endpoint

`apps/chat-api` SHALL expose `POST /api/v1/files/upload` that accepts a single `multipart/form-data` payload with field name `file`, uploads the file to the authenticated user's DIAL Core bucket under `uploads/{yyyy-mm-dd}/`, and returns a JSON body `{ url, name, contentType, contentLength }`.

#### Scenario: Successful upload

- **WHEN** an authenticated client `POST`s a `multipart/form-data` request with a `file` field
- **THEN** the endpoint returns HTTP 201 (or 200) with `{ url, name, contentType, contentLength }` and the file is stored in DIAL Core under `uploads/{yyyy-mm-dd}/{name}`

#### Scenario: Missing file part

- **WHEN** the request body has no `file` field
- **THEN** the endpoint returns HTTP 400

#### Scenario: File exceeds size limit

- **WHEN** the uploaded file is larger than `MAX_FILE_SIZE`
- **THEN** the endpoint returns HTTP 413 without buffering the full file into memory

#### Scenario: Filename collision is deduplicated

- **WHEN** a file with the same name already exists in `uploads/{yyyy-mm-dd}/`
- **THEN** the service appends a numeric suffix (e.g. `report (1).pdf`) so the returned `url` is unique

#### Scenario: Unauthenticated request

- **WHEN** the request has no valid session
- **THEN** the endpoint returns HTTP 401 (the global unauthorized middleware applies)

---

### Requirement: File upload OpenAPI documentation

The endpoint SHALL be described in `openapi.json` so the generated `@epam/chat-api-client` produces a `FilesApi.uploadFile(requestParameters: { file: Blob })` method.

#### Scenario: Generated client compiles

- **WHEN** `libs/chat-api-client` is regenerated
- **THEN** `FilesApi.uploadFile` exists and accepts `{ file: Blob }`
- **AND** the post-processor patches `formParams` to `FormData | URLSearchParams` so no `any` remains

---

### Requirement: Frontend uploads via the generated client

`apps/chat/src/server-api/files.api.ts` SHALL call `filesApi.uploadFile({ file })` from the singleton registered in `api-client.ts`, not a hand-rolled `post` helper, so CSRF and unauthorized middleware apply automatically.

#### Scenario: Upload triggers CSRF middleware

- **WHEN** the frontend uploads a file
- **THEN** the request carries the CSRF token from the configured middleware

#### Scenario: Upload returns `ApiAttachment`

- **WHEN** `uploadFile(file)` resolves
- **THEN** the returned object has `{ type: file.type, title: response.name, url: response.url }`
