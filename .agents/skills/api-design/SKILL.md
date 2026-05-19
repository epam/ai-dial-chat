---
name: api-design
description: Design, review, or change HTTP API contracts for Chat 2.0. Use when adding or modifying REST endpoints, request/response DTOs, status codes, pagination, filtering, API versioning, auth requirements, rate limits, cache behavior, OpenAPI/Swagger docs, or frontend server-api clients.
---

# API Design

Use this skill before implementing or reviewing any HTTP API contract. It adapts general REST API design practices to this repo's Chat 2.0 architecture.

## Start Here

1. Read `openspec/config.yaml` for API architecture, project boundaries, and proposal/spec/task rules.
2. For backend implementation details, read `.agents/skills/nestjs-chat-api/SKILL.md` and `apps/chat-api/AGENTS.md`.
3. Inspect the closest existing endpoint and matching frontend client before designing a new contract:
   - Backend controllers: `apps/chat-api/src/**/**.controller.ts`
   - Backend DTOs: `apps/chat-api/src/**/dto/*.dto.ts`
   - Frontend API helpers: `apps/chat/src/server-api/`
   - Shared interfaces: `libs/chat-shared/`

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
- Frontend impact: typed client helper in `apps/chat/src/server-api/`, shared type in `libs/chat-shared/` if needed, and user-visible i18n strings if errors surface in UI.

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

## Versioning And Compatibility

- Business endpoints are URI-versioned with NestJS controller versioning: `/api/v1/<resource>`.
- Non-breaking changes do not require a new version: adding optional query params, adding response fields, or adding new endpoints.
- Breaking changes require a new versioned controller or endpoint path. Keep the previous version until callers are migrated.
- Proposals/specs must call out frontend migration impact and whether shared types need to change.

## OpenSpec Integration

When writing or reviewing an OpenSpec change that touches API behavior:

- Specs must include method, full versioned path, request body, response body, and error codes.
- Tasks must name concrete files, not vague "update API" wording.
- Include dedicated tasks for backend controller/service tests and frontend API helper updates when applicable.
- Include rate-limit and cache requirements when relevant.
- Reference `apps/chat-api/AGENTS.md` instead of duplicating NestJS implementation rules.

## Avoid

- Returning `200` for error cases.
- Designing backend-only contracts without checking the frontend `server-api` layer.
- Adding unversioned business endpoints.
- Introducing a generic `{ data }` envelope unless the domain already uses it or the change explicitly standardizes responses.
- Mixing API redesign with unrelated implementation refactors.
