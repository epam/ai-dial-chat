## Context

The Chat 2.0 BFF (`apps/chat-api`) already proxies DIAL Core for conversations and themes. The session cookie architecture (encrypted JWT, `SessionGuard`) prevents direct browser-to-DIAL communication. We need to extend the same pattern to model listing so the SPA can discover available deployments without ever seeing a DIAL API key.

DIAL Core exposes two Deployment Listing endpoints:

- `GET /openai/models` → `{ data: DialModel[] }`
- `GET /openai/models/{model_name}` → `DialModel`

The BFF must forward the authenticated user's access token (`req.user.at`) as `Authorization: Bearer <at>` on every upstream call. See `apps/chat-api/AGENTS.md` for all NestJS conventions that govern this domain.

## Goals / Non-Goals

**Goals:**

- Expose `GET /api/v1/models` and `GET /api/v1/models/:modelName` behind `SessionGuard`
- Proxy both endpoints to DIAL Core using the caller's session access token
- Apply short-lived server-side caching (30 s list, 60 s single) keyed per-user to avoid hammering DIAL Core on page load
- Define response types mirroring DIAL Core (`DialModel`, `DialModelListResponse`) in `libs/chat-shared`
- Add typed frontend helpers in `apps/chat/src/server-api/models.ts`
- Full Swagger annotations, per-route `@Throttle`, and standard error mapping

**Non-Goals:**

- Model search, filtering, or pagination beyond what DIAL Core returns
- Caching shared across users (responses are user-scoped via access token)
- Mutation endpoints (create, update, delete models)
- Embedding model capability details beyond the raw DIAL Core payload

## Decisions

### D1 — Plain `fetch` over an HTTP client library

**Decision**: Use the same `fetch` + `AbortController` + timeout pattern as `ThemeService`, not an SDK wrapper.

**Rationale**: DIAL Core's OpenAI-compatible endpoints are straightforward JSON GET requests. The `ThemeService` pattern is already reviewed, tested, and understood by the team. Adding `@ai-sdk/openai` or a DIAL SDK for two read-only list endpoints introduces a new dependency with no proportional benefit — and the DIAL SDK's current TypeScript surface for deployment listing is not stable enough to rely on. If the SDK matures and is adopted project-wide, migration is a one-file change.

**Alternatives considered**:

- `@ai-sdk/openai`: Covers chat completions well but wraps deployment listing awkwardly; not the right tool.
- Axios: No advantage over `fetch` with `AbortController` in Node 18+; avoids a dependency.

### D2 — Per-user cache keys

**Decision**: Cache keys include the user's subject (`sub`): `models:list:<sub>` and `models:single:<sub>:<name>`.

**Rationale**: DIAL Core enforces per-user deployment visibility — two users may see different model sets. Sharing a cache entry across users could leak information. TTLs are kept short (30 s / 60 s) to limit staleness after permission changes.

**Alternatives considered**:

- Global (non-user-scoped) cache: Simpler but risks leaking model availability between users with different access levels.
- No cache: Each page load triggers upstream calls; acceptable for low traffic but unnecessary.

### D3 — `DialModel` type in `libs/chat-shared`

**Decision**: Define `DialModel` and `DialModelListResponse` in `libs/chat-shared/src/models.ts` so they are available to both the backend response serialiser and frontend typed helpers without duplicating the shape.

**Rationale**: The type is a pure data interface with no logic. `libs/chat-shared` is the designated home for such shared contracts. Frontend server-api helpers and future components can import directly without an inter-app import.

**Alternatives considered**:

- Define locally in the `models` domain: Simpler but forces the frontend helper to redefine or use `any`.

### D4 — `:modelName` path param validated with allowlist `@Matches`

**Decision**: `GetModelDto` validates `modelName` with `@Matches(/^[a-zA-Z0-9_\-.:@/]+$/)`.

**Rationale**: The param is forwarded into a URL segment sent to an upstream service. An overly permissive param could allow path-traversal or header-injection. The allowlist covers all known DIAL deployment name formats (e.g. `gpt-4o`, `anthropic.claude-3-5`, `@org/model:tag`) while blocking `../`, `%2F`, and whitespace.

### D5 — `SessionGuard` is already global via `APP_GUARD`

**Decision**: No additional guard annotation needed on `ModelsController` — the global guard applies by default.

**Rationale**: `SessionGuard` reads the `IS_PUBLIC_KEY` reflector metadata. New controllers that do not carry `@Public()` are automatically protected. This matches the pattern used by `ConversationsController` and is consistent with AGENTS.md §9.

## Risks / Trade-offs

- **DIAL Core permission granularity** → The BFF caches model lists per user `sub`, but sub-user permission changes (e.g. a model removed mid-session) won't be visible for up to 30 s. Mitigation: keep cache TTL short and document the eventual-consistency window.
- **Access token expiry during cache window** → The cached response was fetched with a token that might be rotated before the cache entry expires. Mitigation: The cache entry stores the model list, not the token; a fresh request will use the refreshed token from the session. The worst case is a 30 s stale list, not a leaked credential.
- **DIAL Core model name format changes** → The allowlist regex in `GetModelDto` must be updated if DIAL Core introduces characters outside `[a-zA-Z0-9_\-.:@/]`. Mitigation: the regex is documented and test-covered so failures are caught early.
- **Shared `DialModel` type drift** → If DIAL Core adds fields, `DialModel` in `chat-shared` must be updated. Mitigation: type the response with `Partial` guards where fields are optional; treat unknown fields as pass-through to avoid breaking clients.
