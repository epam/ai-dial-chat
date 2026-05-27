---
name: nestjs-chat-api
description: Build, review, or modify the NestJS backend in apps/chat-api. Use when working on NestJS controllers, services, DTOs, guards, auth, cookies, config, Swagger, rate limiting, DIAL Core integrations, backend tests, or any files under apps/chat-api/**. Prefer @epam/ai-dial-typescript-sdk for DIAL Core calls.
---

# NestJS Chat API

Use this skill for backend work in `apps/chat-api`. It is a router to the repository-specific NestJS rules; do not replace those rules with generic NestJS defaults.

## Start Here

1. Read `openspec/config.yaml` for workspace architecture, commands, aliases, and project boundaries.
2. Read `apps/chat-api/AGENTS.md`; it is the source of truth for NestJS conventions in this app.
3. If adding or changing an HTTP API contract, read `.agents/skills/api-design/SKILL.md` before implementation.
4. Read the nearest reference implementation before editing:
   - Controller pattern: `apps/chat-api/src/themes/theme.controller.ts`
   - Service pattern: `apps/chat-api/src/themes/theme.service.ts`
   - DIAL SDK client pattern: `apps/chat-api/src/app/app.service.ts`
   - DTO pattern: `apps/chat-api/src/themes/dto/get-theme-icon.dto.ts`
   - Env validation: `apps/chat-api/src/config/environment.config.ts` and `apps/chat-api/src/config/validation.ts`
   - Cross-cutting interceptor: `apps/chat-api/src/common/interceptors/metrics.interceptor.ts`
   - Auth/cookie work: inspect the relevant `apps/chat-api/src/auth/**` concern first

## Local Patterns To Preserve

- Domain code lives directly under `apps/chat-api/src/<domain>/`; do not introduce a generic `modules/` wrapper.
- Business endpoints use URI versioning: `@Controller({ path: '<resource>', version: '1' })` and route as `/api/v1/<resource>`.
- Infrastructure endpoints such as health stay unversioned under `/api/<resource>`.
- Controllers stay thin, use DTOs, include Swagger annotations for every response status, and delegate business logic to services.
- DTOs use `class-validator` plus Swagger metadata. Apply allowlist `@Matches` validation for values used in paths, URL segments, headers, logs, cookies, or response content.
- Services use Nest `Logger`, typed `ConfigService<EnvironmentVariables>`, typed HTTP exceptions, timeout-aware outbound calls, and cache keys in the documented format.
- DIAL Core integrations should use `@epam/ai-dial-typescript-sdk` through the shared `AppService` SDK client. Use raw `fetch` only for non-DIAL upstreams or when the SDK does not expose the required DIAL operation, and document that exception.
- Cookie and auth changes must preserve `HttpOnly`, `Secure`, `SameSite`, token secrecy, CSRF requirements, and log redaction rules from `apps/chat-api/AGENTS.md`.

## Implementation Workflow

1. Keep changes in thin slices. Prefer one endpoint, guard, service behavior, or DTO contract at a time.
2. If adding or changing env vars, update `EnvironmentVariables`, validation, docs, and examples as required by `apps/chat-api/AGENTS.md`.
3. If adding DIAL Core calls, prefer SDK methods and handle `SDKResponse<T>` success/error branches explicitly. Pass per-request auth headers from the BFF session when user-scoped data is required; do not expose DIAL credentials to the browser.
4. If adding or changing a controller endpoint, treat OpenAPI as part of the implementation:
   - Use request DTO classes with `class-validator` and `@ApiProperty`/`@ApiPropertyOptional` on every field.
   - Use response DTO classes for JSON success responses; do not rely on TypeScript interfaces or description-only `@ApiResponse`.
   - Add `@ApiOperation`, `@ApiResponse` for every status, and `@ApiParam`/`@ApiQuery` when a param is not fully described by a DTO.
   - Name the controller handler as the desired generated SDK method (`listModels`, `getCurrentUser`, `createConversation`).
   - Run `npm run openapi`, inspect generated method/type names, then run `npm run openapi:check`.
   - Ensure frontend callers use the generated API via `apps/chat/src/server-api/api-client.ts` and domain wrappers, unless a documented generator gap requires an exception.
5. If adding public API behavior, add or update controller/service tests. Use `supertest` for request-level behavior and mock outbound clients or SDK methods.
6. Use Nx for verification:
   - `npm exec nx test chat-api`
   - `npm exec nx lint chat-api`
   - `npm exec nx build chat-api` when Nest startup, bundling, config, or module wiring is affected
   - `npm exec nx build chat-api-client -- --skip-nx-cache` and `npm exec nx lint chat-api-client` when endpoint contracts changed

## Avoid

- Generic NestJS examples that conflict with this repo's layout or versioning.
- Using raw `fetch` for DIAL Core endpoints when `@epam/ai-dial-typescript-sdk` supports the operation.
- Reading `process.env` directly in services.
- Returning `null` or `undefined` to signal service failures.
- Missing `@ApiResponse` entries for thrown exceptions.
- Description-only success `@ApiResponse` entries that generate `void`/`any` client methods.
- Anonymous request/response types or interfaces in controller contracts; Swagger needs classes.
- Logging tokens, cookies, API keys, passwords, request bodies from auth flows, or other secrets.
