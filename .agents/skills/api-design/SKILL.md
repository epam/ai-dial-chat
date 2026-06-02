---
name: api-design
description: Design, review, or change HTTP API contracts for AI DIAL Chat. Use when adding or modifying REST endpoints, request/response DTOs, status codes, pagination, filtering, API versioning, auth requirements, rate limits, cache behavior, OpenAPI/Swagger docs, or frontend server-api clients.
---

# API Design

Use this skill before implementing or reviewing any HTTP API contract. It adapts general REST API design practices to this repo's AI DIAL Chat architecture.

## Start Here

1. Read `openspec/config.yaml` for API architecture, project boundaries, and proposal/spec/task rules.
2. For backend implementation details, read `.agents/skills/nestjs-chat-api/SKILL.md` and `apps/chat-api/AGENTS.md`.
3. Inspect the closest existing endpoint and matching frontend client before designing a new contract:
   - Backend controllers: `apps/chat-api/src/**/**.controller.ts`
   - Backend DTOs: `apps/chat-api/src/**/dto/*.dto.ts`
   - Frontend API helpers: `apps/chat/src/server-api/`
   - Shared interfaces: `libs/chat-shared/`
4. If a UI lib consumes the behavior, design the app-level adapter explicitly. API paths,
   generated clients, server-api wrappers, auth/session/cookie/env details, feature flags,
   routing/navigation, storage keys/schemas, analytics/telemetry/logging clients, SDK setup,
   platform bridges, and download/upload URL construction stay in apps, not in `libs/*`.
   Exception: `libs/chat-api-client` is the generated OpenAPI client package and may contain
   generated endpoint paths, DTOs, runtime transport code, and OpenAPI artifacts.

## Contract Checklist

For every new or changed endpoint, define these before coding:

- Method and full path, including version for business endpoints: `/api/v1/<resource>`.
- Whether the endpoint is business or infrastructure. Infrastructure endpoints stay unversioned under `/api/<resource>`.
- Request shape: path params, query params, body DTO, headers, cookies.
- Success response shape and status code.
- Error status codes and what each means: at least validation/auth/authorization/not found/upstream/fallback where relevant.
- Authentication and authorization requirements, including whether the endpoint is explicitly public.
- Rate limiting requirements. Public unauthenticated endpoints should usually tighten the global default.
- Cache behavior when applicable: TTL, invalidation, and key naming (`<domain>:<resource>[:<param>]`).
- Frontend impact: thin domain wrapper in `apps/chat/src/server-api/` that delegates to generated `@epam/chat-api-client`, shared type in `libs/chat-shared/` if needed, and user-visible i18n strings if errors surface in UI.
- Library impact: if a hand-authored lib needs the data or behavior, define the prop/callback/resolved value it receives. Do not put endpoint paths, generated clients, server-api imports, app/backend DTO dependencies, or any other host-owned integration details inside hand-authored `libs/*`. `libs/chat-api-client` is the generated OpenAPI-client exception.
- Generated client impact: expected SDK class, method name, request type, response type, and whether callers need `Raw` access for headers/status. The SDK method name comes from the controller handler name via `operationIdFactory`.
- OpenAPI annotation plan: request DTO class, response DTO class, path/query param metadata, and success/error `@ApiResponse` coverage.

## URL And Method Rules

- Use nouns for resources, lowercase and kebab-case for multi-word paths.
- Prefer plural resource names for collections (`/api/v1/conversations`).
- Use query params for filtering, sorting, pagination, and optional selectors.
- Use nested resources only when ownership is clear and useful (`/api/v1/conversations/:id/messages`).
- Use verb-like action endpoints sparingly, only for domain actions that do not map cleanly to CRUD (`/api/v1/auth/refresh`).
- Use semantic HTTP methods:
  - `GET` for reads.
  - `POST` for creation or non-idempotent actions.
  - `PUT` for full replacement.
  - `PATCH` for partial updates.
  - `DELETE` for removal.

## Status Codes

- `200` for successful reads and updates with a response body.
- `201` for created resources when creation is represented as a resource.
- `204` for successful operations with no response body.
- `400` for malformed input or DTO validation failures.
- `401` for missing or invalid authentication.
- `403` for authenticated callers without permission.
- `404` for missing resources.
- `409` for state conflicts or duplicate resources.
- `429` for rate-limit failures.
- `502` for upstream non-OK responses.
- `503` for upstream timeout or temporary unavailability.
- `500` only for unexpected server failures; do not expose internals.

## Response Shape

- Follow the existing endpoint's shape when extending a domain. Do not introduce a new envelope style in a single endpoint.
- For new list endpoints, define pagination explicitly. Prefer cursor pagination for large or append-heavy datasets; offset pagination is acceptable for small admin-style lists or search-like flows.
- Response bodies must not leak tokens, cookies, stack traces, upstream internals, or persistence-only fields.
- Add or update Swagger decorators in NestJS controllers for every success and error status.
- JSON success responses need `type` or `schema`; description-only `@ApiResponse` entries generate weak SDK methods.
- Use DTO classes for request/response schemas. TypeScript interfaces and anonymous object types are erased at runtime and do not produce useful Swagger metadata.

## Versioning And Compatibility

- Business endpoints are URI-versioned with NestJS controller versioning: `/api/v1/<resource>`.
- Non-breaking changes do not require a new version: adding optional query params, adding response fields, or adding new endpoints.
- Breaking changes require a new versioned controller or endpoint path. Keep the previous version until callers are migrated.
- Proposals/specs must call out frontend migration impact and whether shared types need to change.

## OpenSpec Integration

When writing or reviewing an OpenSpec change that touches API behavior:

- Specs must include method, full versioned path, request body, response body, and error codes.
- Tasks must name concrete files, not vague "update API" wording.
- Include dedicated tasks for Swagger DTO/annotation updates, `npm run openapi`, `npm run openapi:check`, `chat-api-client` build/lint, backend controller/service tests, generated API singleton updates in `apps/chat/src/server-api/api-client.ts`, and frontend wrappers that use generated `@epam/chat-api-client`.
- Generated-client frontend usage is required for new or changed business REST endpoints. Direct `base.ts` get/post/put/del usage is allowed only for documented generator gaps, streaming calls, or infrastructure endpoints.
- If endpoint behavior is surfaced through a lib component, tasks must keep the generated-client/server-api call and any related host/external integration in `apps/chat`, then pass only resolved data, resolved values, or callbacks into the lib.
- Changes under `libs/chat-api-client` must come from OpenAPI generation (`npm run openapi`, `npm run openapi:sdk`, or the specific documented check), not manual edits to generated files.
- Include rate-limit and cache requirements when relevant.
- Reference `apps/chat-api/AGENTS.md` instead of duplicating NestJS implementation rules.

## Avoid

- Returning `200` for error cases.
- Designing backend-only contracts without checking the frontend `server-api` layer.
- Adding new handwritten frontend REST helpers over `base.ts` for business endpoints when the generated client can represent the contract.
- Adding host-owned integration details to hand-authored `libs/*`, including `/api` URL construction, generated API clients, `server-api` imports, backend DTO imports, auth/session/cookie/env knowledge, feature flags, routing/navigation, analytics/telemetry/logging clients, storage keys/schemas, SDK setup, platform bridges, or app-specific URL schemes.
- Hand-editing generated files under `libs/chat-api-client/src/generated`.
- Adding unversioned business endpoints.
- Introducing a generic `{ data }` envelope unless the domain already uses it or the change explicitly standardizes responses.
- Mixing API redesign with unrelated implementation refactors.
