# model-lookup Specification

## Purpose

The authenticated model lookup endpoint, its path-parameter validation, and the frontend server-api helper.

## ADDED Requirements

### Requirement: Authenticated model lookup endpoint

The BFF SHALL expose `GET /api/v1/models/:modelName` that returns a single DIAL Core deployment by name for the authenticated session user.

The endpoint:

- MUST require a valid BFF session cookie (`SessionGuard`); unauthenticated requests SHALL be rejected with `401 Unauthorized`
- MUST proxy to `GET <DIAL_CORE_URL>/openai/models/{modelName}` forwarding `Authorization: Bearer <session.at>` as the upstream auth header
- MUST NOT forward the `DIAL_API_KEY` to the client or use it as the upstream credential on this route
- SHALL return `200 OK` with a `DialModel` object body on success
- SHALL return `404 Not Found` when DIAL Core responds with `404`
- SHALL apply per-route rate limiting of **60 req/min per IP** via `@Throttle`
- SHALL cache the upstream response server-side for **60 seconds** using cache key `models:single:<user.sub>:<modelName>`; a cache hit MUST NOT re-call DIAL Core
- MUST set `Cache-Control: private, max-age=60` on the HTTP response

#### Scenario: Authenticated user retrieves a model by name

- **WHEN** a request with a valid session cookie is sent to `GET /api/v1/models/gpt-4o`
- **THEN** the BFF returns `200` with the corresponding `DialModel` JSON object

#### Scenario: Unauthenticated request is rejected

- **WHEN** a request to `GET /api/v1/models/gpt-4o` is sent without a session cookie
- **THEN** the BFF returns `401 Unauthorized`

#### Scenario: Model not found

- **WHEN** DIAL Core responds with `404` for the requested model name
- **THEN** the BFF returns `404 Not Found`

#### Scenario: Upstream returns 401

- **WHEN** DIAL Core responds with `401`
- **THEN** the BFF returns `401 Unauthorized` to the caller

#### Scenario: Upstream returns 403

- **WHEN** DIAL Core responds with `403`
- **THEN** the BFF returns `403 Forbidden` to the caller

#### Scenario: Upstream returns 429

- **WHEN** DIAL Core responds with `429 Too Many Requests`
- **THEN** the BFF returns `429 Too Many Requests` to the caller

#### Scenario: Upstream is unreachable or times out

- **WHEN** DIAL Core does not respond within `DIAL_CORE_TIMEOUT_MS` milliseconds
- **THEN** the BFF returns `503 Service Unavailable`

#### Scenario: Upstream returns unexpected 5xx

- **WHEN** DIAL Core responds with a 5xx error
- **THEN** the BFF returns `502 Bad Gateway`

#### Scenario: Rate limit exceeded

- **WHEN** a caller sends more than 60 requests per minute to this endpoint
- **THEN** the BFF returns `429 Too Many Requests`

#### Scenario: Cache hit avoids upstream call

- **WHEN** `GET /api/v1/models/gpt-4o` is called twice within 60 seconds for the same user
- **THEN** only one upstream request is made to DIAL Core; the second response is served from cache

---

### Requirement: Model name path parameter validation

The `:modelName` path parameter MUST be validated with an allowlist regex to prevent path-traversal and injection.

Allowed characters: `[a-zA-Z0-9_\-.:@]` (covers known DIAL deployment name formats including dotted names like `anthropic.claude-3-5` and at-prefixed names like `@model`). Slash-separated namespaced names must be URL-encoded by the caller (`/` → `%2F`) before being sent as the path param.

Any character outside the allowlist SHALL cause the BFF to return `400 Bad Request` before making any upstream call.

#### Scenario: Valid model name passes validation

- **WHEN** the path param is `gpt-4o`, `anthropic.claude-3-5`, or `@org/model:tag`
- **THEN** the request proceeds to upstream proxying

#### Scenario: Invalid model name is rejected

- **WHEN** the path param contains `../`, `%2F`, whitespace, or other disallowed characters
- **THEN** the BFF returns `400 Bad Request` without calling DIAL Core

---

### Requirement: Frontend server-api helper for model lookup

`apps/chat/src/server-api/models.ts` SHALL export a typed async function `getModel` that:

- Accepts `modelName: string`
- Calls `GET /api/v1/models/${modelName}` using the existing `get<DialModel>` helper from `server-api/base.ts`
- Returns `Promise<DialModel>`

No direct `fetch` calls are permitted in this helper.

#### Scenario: Helper returns typed single model

- **WHEN** `getModel('gpt-4o')` is called
- **THEN** the return type is `Promise<DialModel>` and TypeScript infers all `DialModel` fields
