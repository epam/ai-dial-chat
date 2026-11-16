# model-listing Specification

## Purpose

The authenticated model list endpoint and the shared `DialModel` type.

`apps/chat` has no caller for this endpoint today — the frontend reads model
metadata through the deployments endpoints (`deploymentsApi`) instead. The
endpoint and its shared type are still served and still covered by the
requirements below; the `apps/chat/src/server-api/models.ts` helper that used to
front it was removed once it had zero call sites.

## Requirements

### Requirement: Authenticated model list endpoint

The BFF SHALL expose `GET /api/v1/models` that returns the list of DIAL Core deployments visible to the authenticated session user.

The endpoint:

- MUST require a valid BFF session cookie (`SessionGuard`); unauthenticated requests SHALL be rejected with `401 Unauthorized`
- MUST proxy to `GET <DIAL_CORE_URL>/openai/models` (via the `@epam/ai-dial-typescript-sdk` client's `getModels`, see `apps/chat-api/src/models/models.service.ts`) forwarding `Authorization: Bearer <session.at>` as the upstream auth header
- MUST NOT forward the `DIAL_API_KEY` to the client or use it as the upstream credential on this route
- SHALL return `200 OK` with body `{ "data": DialModelDto[] }` (`DialModelListResponseDto` in `apps/chat-api/src/openapi/openapi-response.dto.ts`) mirroring the DIAL Core response shape
- SHALL cache the upstream response server-side for **30 seconds** using cache key `models:list:<user.sub>`; a cache hit MUST NOT re-call DIAL Core
- MUST set `Cache-Control: private, max-age=30` on the HTTP response so browsers and shared proxies do not cache the user-specific list

#### Scenario: Authenticated user receives model list

- **WHEN** a request with a valid session cookie is sent to `GET /api/v1/models`
- **THEN** the BFF returns `200` with `{ "data": [...] }` where each item is a `DialModelDto` object

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

- **WHEN** the upstream request fails without an HTTP response (network error, or an `AbortError` timeout surfaced by the fetch layer; no route-specific timeout variable is configured)
- **THEN** the BFF returns `503 Service Unavailable`

#### Scenario: Upstream returns unexpected 5xx

- **WHEN** DIAL Core responds with a 5xx error (e.g. `500`, `502`)
- **THEN** the BFF returns `502 Bad Gateway`

#### Scenario: Cache hit avoids upstream call

- **WHEN** `GET /api/v1/models` is called twice within 30 seconds for the same authenticated user
- **THEN** only one upstream request is made to DIAL Core; the second response is served from cache

---

### Requirement: DialModel shared type

The `DialModel` and `DialModelListResponse` interfaces SHALL be defined in `libs/chat-shared/src/models/dial-model.ts` and exported from `libs/chat-shared/src/index.ts`. No code imports them today: the BFF types its responses with its own Swagger classes `DialModelDto` / `DialModelListResponseDto` (`apps/chat-api/src/openapi/openapi-response.dto.ts`), and `apps/chat` does not call this endpoint.

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
}
```

Unknown top-level fields from DIAL Core SHALL be preserved (index signature) so clients are not broken by DIAL Core adding fields.

#### Scenario: Type is importable from both backend and frontend

- **WHEN** `apps/chat-api` and `apps/chat` are type-checked
- **THEN** `DialModel` imported from `@epam/ai-dial-chat-shared` would resolve with no type errors (neither project imports it today)

---

### Requirement: Model list omits models hidden through HIDDEN_ENTITY_TAGS

`GET /api/v1/models` SHALL omit every model whose `description_keywords` contains a tag from `HIDDEN_ENTITY_TAGS`. The match SHALL be the exact-string match that sets `isHidden` on `/api/v1/deployments`, so a model is hidden on both routes or on neither. A model whose `description_keywords` is absent or not an array is not hidden. Other entries SHALL stay as Core sends them.

#### Scenario: Hidden model is omitted

- **GIVEN** `HIDDEN_ENTITY_TAGS=HIDDEN`, and DIAL Core lists `gpt-4o` with `description_keywords: ["HIDDEN", "Text"]` and `claude-opus` with `description_keywords: ["Text"]`
- **WHEN** a signed-in user calls `GET /api/v1/models`
- **THEN** the BFF returns `200` with `{ "data": [ { "id": "claude-opus", … } ] }`, and `claude-opus` is exactly as Core sent it

#### Scenario: Any configured tag hides a model

- **GIVEN** `HIDDEN_ENTITY_TAGS=internal,experimental`, and DIAL Core lists `gpt-4o` with `description_keywords: ["experimental"]`
- **WHEN** a signed-in user calls `GET /api/v1/models`
- **THEN** `gpt-4o` is absent from `data`

#### Scenario: Tag match is exact

- **GIVEN** `HIDDEN_ENTITY_TAGS=HIDDEN`, and DIAL Core lists `gpt-4o` with `description_keywords: ["hidden", "HIDDEN-ish"]`
- **WHEN** a signed-in user calls `GET /api/v1/models`
- **THEN** `gpt-4o` is present in `data`

#### Scenario: Deployments still list the hidden model

- **GIVEN** `HIDDEN_ENTITY_TAGS=HIDDEN` and a hidden `gpt-4o` that the user can access
- **WHEN** the user calls `GET /api/v1/deployments`
- **THEN** `gpt-4o` is listed with `isHidden: true`

---

### Requirement: Model list cache holds the filtered list

The hidden-model filter on `GET /api/v1/models` SHALL run before the result is stored under `models:list:<user.sub>` (30-second TTL; expiry is the only invalidation). The tags are read at boot, so changing them takes a BFF restart, which empties the cache.

#### Scenario: Cached list is the filtered list

- **GIVEN** `HIDDEN_ENTITY_TAGS=HIDDEN` and a hidden `gpt-4o` in DIAL Core's list
- **WHEN** the same user calls `GET /api/v1/models` twice within 30 seconds
- **THEN** DIAL Core is called once and neither response contains `gpt-4o`

---

### Requirement: Model list contract is unchanged when no tag is configured

With `HIDDEN_ENTITY_TAGS` unset or empty, `GET /api/v1/models` SHALL behave exactly as before. The OpenAPI operation `listModels` (`ModelsApi.listModels()`), the response DTO `DialModelListResponseDto`, the status codes and the `Cache-Control` header SHALL NOT change. The route is not gated by `ENABLED_FEATURES` and adds no UI, i18n key or metric.

#### Scenario: Empty tag list changes nothing

- **GIVEN** `HIDDEN_ENTITY_TAGS` is unset or empty, and DIAL Core lists `gpt-4o` with `description_keywords: ["HIDDEN"]`
- **WHEN** a signed-in user calls `GET /api/v1/models`
- **THEN** the BFF returns every model DIAL Core returned, `gpt-4o` included, unchanged
