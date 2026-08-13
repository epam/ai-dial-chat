# model-listing Specification

## Purpose

The authenticated model list endpoint, the shared `DialModel` type, and the frontend server-api helper.

## ADDED Requirements

### Requirement: Authenticated model list endpoint

The BFF SHALL expose `GET /api/v1/models` that returns the list of DIAL Core deployments visible to the authenticated session user.

The endpoint:

- MUST require a valid BFF session cookie (`SessionGuard`); unauthenticated requests SHALL be rejected with `401 Unauthorized`
- MUST proxy to `GET <DIAL_CORE_URL>/openai/models` forwarding `Authorization: Bearer <session.at>` as the upstream auth header
- MUST NOT forward the `DIAL_API_KEY` to the client or use it as the upstream credential on this route
- SHALL return `200 OK` with body `{ "data": DialModel[] }` mirroring the DIAL Core response shape
- SHALL apply per-route rate limiting of **60 req/min per IP** (tighter than the global 100 req/min default) via `@Throttle`
- SHALL cache the upstream response server-side for **30 seconds** using cache key `models:list:<user.sub>`; a cache hit MUST NOT re-call DIAL Core
- MUST set `Cache-Control: private, max-age=30` on the HTTP response so browsers and shared proxies do not cache the user-specific list

#### Scenario: Authenticated user receives model list

- **WHEN** a request with a valid session cookie is sent to `GET /api/v1/models`
- **THEN** the BFF returns `200` with `{ "data": [...] }` where each item is a `DialModel` object

#### Scenario: Unauthenticated request is rejected

- **WHEN** a request to `GET /api/v1/models` is sent without a session cookie
- **THEN** the BFF returns `401 Unauthorized`

#### Scenario: Upstream returns 401

- **WHEN** DIAL Core responds with `401` (e.g. access token expired and refresh failed)
- **THEN** the BFF returns `401 Unauthorized` to the caller

#### Scenario: Upstream returns 403

- **WHEN** DIAL Core responds with `403` (caller has no permission to list models)
- **THEN** the BFF returns `403 Forbidden` to the caller

#### Scenario: Upstream returns 429

- **WHEN** DIAL Core responds with `429 Too Many Requests`
- **THEN** the BFF returns `429 Too Many Requests` to the caller

#### Scenario: Upstream is unreachable or times out

- **WHEN** DIAL Core does not respond within `DIAL_CORE_TIMEOUT_MS` milliseconds
- **THEN** the BFF returns `503 Service Unavailable`

#### Scenario: Upstream returns unexpected 5xx

- **WHEN** DIAL Core responds with a 5xx error (e.g. `500`, `502`)
- **THEN** the BFF returns `502 Bad Gateway`

#### Scenario: Rate limit exceeded

- **WHEN** a caller sends more than 60 requests per minute to this endpoint
- **THEN** the BFF returns `429 Too Many Requests`

#### Scenario: Cache hit avoids upstream call

- **WHEN** `GET /api/v1/models` is called twice within 30 seconds for the same authenticated user
- **THEN** only one upstream request is made to DIAL Core; the second response is served from cache

---

### Requirement: DialModel shared type

The `DialModel` interface and `DialModelListResponse` type SHALL be defined in `libs/chat-shared/src/models.ts` and exported from `libs/chat-shared/src/index.ts`.

`DialModel` MUST include at minimum the fields returned by DIAL Core's `/openai/models` response:

```ts
interface DialModel {
  id: string;
  object: string;
  created?: number;
  owned_by?: string;
  /** DIAL-specific extensions (pass-through) */
  [key: string]: unknown;
}

interface DialModelListResponse {
  data: DialModel[];
  object?: string;
}
```

Unknown top-level fields from DIAL Core SHALL be preserved (index signature) so clients are not broken by DIAL Core adding fields.

#### Scenario: Type is importable from both backend and frontend

- **WHEN** `apps/chat-api` and `apps/chat/src/server-api/models.ts` import `DialModel` from `@epam/ai-dial-chat-shared`
- **THEN** TypeScript compilation succeeds with no type errors

---

### Requirement: Frontend server-api helper for model listing

`apps/chat/src/server-api/models.ts` SHALL export a typed async function `getModels` that:

- Calls `GET /api/v1/models` using the existing `get<DialModelListResponse>` helper from `server-api/base.ts`
- Returns `Promise<DialModelListResponse>`

No direct `fetch` calls are permitted in this helper.

#### Scenario: Helper returns typed list

- **WHEN** `getModels()` is called from a component or hook
- **THEN** the return type is `Promise<DialModelListResponse>` and TypeScript infers `data` as `DialModel[]`
