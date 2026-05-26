# Spec: files-upload-api

## Requirements

---

### Requirement: POST /api/v1/files/upload accepts multipart uploads

The backend SHALL expose `POST /api/v1/files/upload` in `apps/chat-api/src/files/files.controller.ts`. The endpoint accepts a single `multipart/form-data` payload with field name `file`, parsed via `@UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE } }))`. The controller MUST be versioned (`version: '1'`), annotated with `@ApiTags('files')`, and delegate all logic to `FilesService`. On success it returns HTTP 201 with a `FileUploadResponseDto` body: `{ url, name, contentType, contentLength }`.

#### Scenario: Successful upload returns 201

- **WHEN** an authenticated client `POST`s a `multipart/form-data` request with a `file` field
- **THEN** the response status is 201 with `{ url, name, contentType, contentLength }`
- **AND** the file is stored in DIAL Core under `uploads/{yyyy-mm-dd}/{name}`

#### Scenario: Missing file part returns 400

- **WHEN** the request body has no `file` field
- **THEN** the response status is 400

#### Scenario: Oversized file returns 413

- **WHEN** the uploaded file is larger than `MAX_FILE_SIZE`
- **THEN** the response status is 413 and the file is NOT buffered into memory in full

#### Scenario: Unauthenticated request returns 401

- **WHEN** the request has no valid session
- **THEN** the global unauthorized middleware returns HTTP 401

---

### Requirement: Files are stored under per-day folders with dedup

`FilesService` SHALL upload to DIAL Core under the path `uploads/{yyyy-mm-dd}/`, where the date is computed server-side (UTC). When a file with the same name already exists in that folder, the service SHALL append a numeric suffix (`report (1).pdf`, `report (2).pdf`, …) so the returned `url` is unique.

#### Scenario: Date folder is computed server-side

- **WHEN** a file is uploaded
- **THEN** the resulting `url` contains a `uploads/YYYY-MM-DD/` segment matching the current server date

#### Scenario: Filename collision triggers dedup

- **WHEN** a file named `report.pdf` is uploaded into a folder that already contains `report.pdf`
- **THEN** the new file is stored as `report (1).pdf` and the returned `url` reflects the new name

---

### Requirement: FilesModule is registered in the root AppModule

`FilesModule` SHALL be listed in the `imports` array of `apps/chat-api/src/app/app.module.ts`. It MUST declare `FilesController` in `controllers` and `FilesService` in `providers`. The module SHALL import `@nestjs/platform-express`'s `FileInterceptor` (transitively pulling `multer` for multipart parsing).

#### Scenario: Module is wired into the app

- **WHEN** the NestJS application bootstraps
- **THEN** `POST /api/v1/files/upload` is reachable (not 404)

---

### Requirement: Endpoint is described in OpenAPI

The endpoint SHALL be documented in `openapi.json` so the generated `@epam/chat-api-client` exposes `FilesApi.uploadFile(requestParameters: { file: Blob })` returning a `FileUploadResponseDto`. The post-process script (`tools/openapi/postprocess-client.mjs`) SHALL replace the generator's loose `formParams` type with `FormData | URLSearchParams` and cast `formParams as FormData` for the `file` append, so the generated client compiles without `any`.

#### Scenario: Generated client compiles without any

- **WHEN** `libs/chat-api-client` is regenerated
- **THEN** `FilesApi.uploadFile` exists, accepts `{ file: Blob }`, returns `Promise<FileUploadResponseDto>`, and contains no `any` types

---

### Requirement: AttachmentDto matches DIAL Core attachment schema

`apps/chat-api/src/common/dto/attachment.dto.ts` SHALL export `AttachmentDto` whose shape matches DIAL Core's `attachment` schema: `type: string`, `title: string`, `url?: string`, `data?: string`, `reference_type?: string`, `reference_url?: string`, `index?: number`. It is decorated with `class-validator` and `@nestjs/swagger` annotations so it can be embedded inside other DTOs (`SendCompletionDto`, `CreateConversationDto`) via `@ValidateNested({ each: true }) @Type(() => AttachmentDto)`.

#### Scenario: AttachmentDto can be embedded in chat DTOs

- **WHEN** a chat DTO declares `attachments?: AttachmentDto[]`
- **THEN** class-validator validates each item against the AttachmentDto schema

---

### Requirement: Frontend uploads via the generated client

`apps/chat/src/server-api/files.api.ts` SHALL upload files by calling `filesApi.uploadFile({ file })` on the singleton registered in `apps/chat/src/server-api/api-client.ts`. The hand-rolled `post(`...`)` helper SHALL NOT be used for uploads, ensuring CSRF, unauthorized, and telemetry middlewares apply consistently across all endpoints.

#### Scenario: Upload carries CSRF token

- **WHEN** the frontend uploads a file from an authenticated session
- **THEN** the outgoing request carries the `X-CSRF-Token` header from the configured CSRF middleware

#### Scenario: `uploadFile` returns an ApiAttachment

- **WHEN** `uploadFile(file)` resolves
- **THEN** it returns `{ type: file.type, title: response.name, url: response.url }` typed as `ApiAttachment`

#### Scenario: 401 during upload notifies the unauthorized handler

- **WHEN** the upload returns HTTP 401
- **THEN** the unauthorized middleware fires `notifyUnauthorized` and the call throws `UnauthorizedError`
