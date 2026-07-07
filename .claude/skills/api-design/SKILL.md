---
name: api-design
description: Design, review, or change HTTP API contracts for AI DIAL Chat. Use when adding or modifying REST endpoints, request/response DTOs, status codes, pagination, filtering, API versioning, auth requirements, rate limits, cache behavior, OpenAPI/Swagger docs, or frontend server-api clients.
---

# API Design

Use this skill before implementing or reviewing any HTTP API contract. It defines the
contract-first procedure for this repo. For backend implementation mechanics (DTO/Swagger/SDK
patterns, tests, Nx verification) follow `apps/chat-api/AGENTS.md` — do not restate them here. For library isolation follow the
"Library isolation" section in the root `AGENTS.md`: host/API/transport details stay in apps;
hand-authored `libs/*` receive resolved data, values, or callbacks. Exception: `libs/chat-api-client`
is the generated OpenAPI client.

## Start Here

1. Read `openspec/config.yaml` for API architecture, project boundaries, and proposal/spec/task rules.
2. Inspect the closest existing endpoint and its matching frontend client before designing a new contract:
   - Backend controllers: `apps/chat-api/src/**/**.controller.ts`
   - Backend DTOs: `apps/chat-api/src/**/dto/*.dto.ts`
   - Frontend API helpers: `apps/chat/src/server-api/`
   - Shared interfaces: `libs/chat-shared/`

## Contract Checklist

For every new or changed endpoint, define these before coding:

- Method and full path. Business endpoints are URI-versioned (`/api/v1/<resource>`); infrastructure endpoints stay unversioned (`/api/<resource>`).
- Request shape: path params, query params, body DTO, headers, cookies.
- Success response shape and status code.
- Error status codes and what each means: at least validation/auth/authorization/not found, plus `502` (upstream non-OK), `503` (upstream timeout/unavailable). Never `500` exposing internals.
- Authentication and authorization requirements, including whether the endpoint is explicitly public.
- Rate limiting. Public unauthenticated endpoints should usually tighten the global default.
- Cache behavior when applicable: TTL, invalidation, and key naming (`<domain>:<resource>[:<param>]`).
- Pagination for list endpoints: prefer cursor for large/append-heavy datasets; offset is acceptable for small admin-style or search flows.
- Frontend impact: thin domain wrapper in `apps/chat/src/server-api/` that delegates to generated `@epam/chat-api-client`, shared type in `libs/chat-shared/` if needed, and i18n strings for any errors surfaced in UI.
- Library impact: if a hand-authored lib needs the data/behavior, name the prop/callback/resolved value it receives (see lib-isolation note above).
- Generated client impact: expected SDK class, method name (derived from the controller handler name via `operationIdFactory`), request type, response type, and whether callers need `Raw` access for headers/status.

## Versioning And Compatibility

- Non-breaking changes need no new version: adding optional query params, adding response fields, or adding new endpoints.
- Breaking changes require a new versioned controller or endpoint path. Keep the previous version until callers are migrated.
- Proposals/specs must call out frontend migration impact and whether shared types change.

## OpenSpec Integration

When writing or reviewing an OpenSpec change that touches API behavior:

- Specs must include method, full versioned path, request body, response body, and error codes.
- Tasks must name concrete files, not vague "update API" wording.
- Include dedicated tasks for: Swagger DTO/annotation updates, `npm run openapi`, `npm run openapi:check`, `chat-api-client` build/lint, backend controller/service tests, generated API singleton updates in `apps/chat/src/server-api/api-client.ts`, and frontend wrappers using generated `@epam/chat-api-client`.
- Generated-client frontend usage is required for new or changed business REST endpoints. Direct `base.ts` get/post/put/del usage is allowed only for documented generator gaps, streaming calls, or infrastructure endpoints.
- If endpoint behavior is surfaced through a lib, tasks must keep the generated-client/server-api call in `apps/chat` and pass only resolved data, values, or callbacks into the lib.
- Changes under `libs/chat-api-client` must come from OpenAPI generation (`npm run openapi`, `npm run openapi:sdk`, or the documented check), not manual edits.
- Include rate-limit and cache requirements when relevant.

## Avoid

- Returning `200` for error cases.
- Designing backend-only contracts without checking the frontend `server-api` layer.
- Adding handwritten frontend REST helpers over `base.ts` for business endpoints the generated client can represent.
- Hand-editing generated files under `libs/chat-api-client/src/generated`.
- Adding unversioned business endpoints.
- Introducing a generic `{ data }` envelope unless the domain already uses it or the change explicitly standardizes responses.
- Mixing API redesign with unrelated implementation refactors.
