## 1. Module scaffold

- [x] 1.1 Create `apps/chat-api/src/prompts/` directory with `prompt.module.ts`, `prompt.controller.ts`, `prompt.service.ts`, and `constants/prompt.constants.ts` (define `PROMPTS_SUBFOLDER = 'prompts'` and sentinel filename `FOLDER_SENTINEL = '.folder'`)
- [x] 1.2 Import `PromptModule` in `AppModule` (`apps/chat-api/src/app/app.module.ts`)

## 2. DTOs

- [x] 2.1 Create `apps/chat-api/src/prompts/dto/prompt-response.dto.ts` — `PromptResponseDto` with fields: `id`, `name`, `description?`, `content`, `folderId`, `createdAt`, `updatedAt`; all decorated with `@ApiProperty`
- [x] 2.2 Create `apps/chat-api/src/prompts/dto/prompt-folder-response.dto.ts` — `PromptFolderResponseDto` with `id` and `name`
- [x] 2.3 Create `apps/chat-api/src/prompts/dto/prompt-list-response.dto.ts` — `PromptListResponseDto` with `prompts: PromptResponseDto[]`, `folders: PromptFolderResponseDto[]`, `sharedWithMe: PromptResponseDto[]`
- [x] 2.4 Create `apps/chat-api/src/prompts/dto/required-prompt-path.dto.ts` — required, allowlisted `path` query DTO for single-get and mutation routes
- [x] 2.5 Create `apps/chat-api/src/prompts/dto/create-prompt.dto.ts` — `CreatePromptDto` with `name` (`@Matches(/^[^/]+$/)`, max 256), `description?` (max 2000), `content` (max 50000), `folderId?` (`@Matches(/^[a-zA-Z0-9 _.\-/]*$/)`)
- [x] 2.6 Create `apps/chat-api/src/prompts/dto/update-prompt.dto.ts` — `UpdatePromptDto` (all fields optional, same constraints as create)
- [x] 2.7 Create `apps/chat-api/src/prompts/dto/move-prompt.dto.ts` — `MovePromptDto` with `targetFolderId` (`@IsString`, `@Matches(/^[a-zA-Z0-9 _.\-/]*$/)`)
- [x] 2.8 Create `apps/chat-api/src/prompts/dto/create-prompt-folder.dto.ts` — `CreatePromptFolderDto` with `name` (`@Matches(/^[^/]+$/)`, max 256) and `parentId?` (`@Matches(/^[a-zA-Z0-9 _.\-/]*$/)`)
- [x] 2.9 Create `apps/chat-api/src/prompts/dto/rename-prompt-folder.dto.ts` — `RenamePromptFolderDto` with `name` (`@Matches(/^[^/]+$/)`, max 256)

## 3. Service — personal prompt CRUD

- [x] 3.1 Implement `PromptService.listPrompts(token, bucket)` — lists all files under `{bucket}/prompts/`, filters sentinels, maps to `PromptResponseDto[]`, derives distinct folder paths into `PromptFolderResponseDto[]`
- [x] 3.2 Implement `PromptService.getSharedPrompts(token, bucket)` — calls DIAL Core shared-resources API for prompt paths; returns `PromptResponseDto[]`, gracefully returns `[]` on non-fatal error
- [x] 3.3 Implement `PromptService.getPrompt(token, bucket, path)` — reads `{bucket}/prompts/{path}.json`, returns `PromptResponseDto`, throws `NotFoundException` if absent
- [x] 3.4 Implement `PromptService.createPrompt(token, bucket, dto)` — derives storage path from `folderId` + `name`, checks for existing file (throws `ConflictException`), writes JSON to DIAL Core, returns `PromptResponseDto` (201)
- [x] 3.5 Implement `PromptService.updatePrompt(token, bucket, path, dto)` — merges fields, handles in-place rename (write new path + delete old, 409 if target exists), updates `updatedAt`, returns `PromptResponseDto`
- [x] 3.6 Implement `PromptService.deletePrompt(token, bucket, path)` — deletes `{bucket}/prompts/{path}.json`, throws `NotFoundException` if absent

## 4. Service — organisation prompts

- [x] 4.1 Implement `PromptService.listPublicPrompts(token)` — lists `public/prompts/` from DIAL Core, returns `PromptListResponseDto` (without `sharedWithMe`)
- [x] 4.2 Implement `PromptService.getPublicPrompt(token, path)` — reads `public/prompts/{path}.json`, throws `NotFoundException` if absent

## 5. Service — folder operations

- [x] 5.1 Implement `PromptService.createFolder(token, bucket, dto)` — derives folder path, checks sentinel existence (throws `ConflictException`), writes sentinel file, returns `PromptFolderResponseDto`
- [x] 5.2 Implement `PromptService.renameFolder(token, bucket, path, dto)` — verifies folder exists (files present or sentinel), checks target absence (throws `ConflictException`), moves all files under old prefix to new prefix in parallel (write+delete), returns updated `PromptFolderResponseDto`
- [x] 5.3 Implement `PromptService.deleteFolder(token, bucket, path)` — lists all files under prefix, throws `NotFoundException` if none, deletes all in parallel
- [x] 5.4 Implement `PromptService.movePrompt(token, bucket, path, dto)` — reads source, derives target path, checks for conflict, writes to target + deletes source, returns updated `PromptResponseDto`

## 6. Controller

- [x] 6.1 Implement `PromptController` with `@Controller({ path: 'prompts', version: '1' })`, `@ApiTags('prompts')`, and inject `PromptService`
- [x] 6.2 Add separate `GET /` list and `GET /item?path=` single-get handlers with distinct operationIds and response DTOs
- [x] 6.3 Add `POST /` handler → `createPrompt`, `@Throttle({ default: { limit: 30, ttl: 60000 } })`, responses 201/400/401/409/502
- [x] 6.4 Add `PUT /` handler with required `path` query → `updatePrompt`, responses 200/400/401/404/409/502
- [x] 6.5 Add `DELETE /` handler with required `path` query → `deletePrompt`, `@HttpCode(204)`, responses 204/400/401/404/502
- [x] 6.6 Add separate `GET /public` list and `GET /public/item?path=` single-get handlers with distinct operationIds and response DTOs
- [x] 6.7 Add `POST /folders` handler → `createFolder`, `@Throttle({ default: { limit: 20, ttl: 60000 } })`, responses 201/400/401/409/502
- [x] 6.8 Add `PUT /folders` handler with required `path` query → `renameFolder`, responses 200/400/401/404/409/502
- [x] 6.9 Add `DELETE /folders` handler with required `path` query → `deleteFolder`, `@HttpCode(204)`, responses 204/400/401/404/502
- [x] 6.10 Add `POST /move` handler with required `path` query → `movePrompt`, responses 200/400/401/404/409/502

## 7. Share endpoint update

- [x] 7.1 Update `@ApiOperation.description` on `POST /api/v1/share` in `apps/chat-api/src/share/share.controller.ts` to mention prompts alongside conversations and catalog entities

## 8. Tests

- [x] 8.1 Write unit tests for `PromptService` covering: list (empty + populated), getPrompt (found + not found), createPrompt (success + conflict), updatePrompt (in-place update + rename + conflict), deletePrompt (success + not found)
- [x] 8.2 Write unit tests for folder operations: createFolder (success + conflict), renameFolder (success + conflict + not found), deleteFolder (success + not found), movePrompt (success + conflict + not found)
- [x] 8.3 Write unit tests for public prompt methods: listPublicPrompts, getPublicPrompt (found + not found)
- [x] 8.4 Write e2e / supertest tests for `PromptController`: happy-path for all 11 endpoints, 400 on invalid DTOs, 401 when unauthenticated
- [x] 8.5 Add regression coverage for missing required paths, path traversal, metadata pagination, sentinel-only folders, upstream existence-check failures, and partial mutation failures

## 9. Generated client

- [x] 9.1 Run `npm run openapi` to regenerate `libs/chat-api-client` from the updated Swagger spec
- [x] 9.2 Run `npm run openapi:check` and resolve any schema drift
- [x] 9.3 Run `npm exec nx build chat-api` and `npm exec nx lint chat-api` — fix any TypeScript or lint errors
- [x] 9.4 Run `npm exec nx test chat-api` — all tests pass
