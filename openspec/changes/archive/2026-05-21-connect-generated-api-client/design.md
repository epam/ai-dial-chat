## Context

`apps/chat` currently calls the backend through four hand-written domain modules (`models.ts`, `deployments.ts`, `conversations.api.ts`, `chat-stream.api.ts`) plus `server-api/base.ts`, which supplies `get`/`post`/`put`/`del` helpers and shared infrastructure: `UnauthorizedError`, `onUnauthorized`, `setCsrfToken`/`getCsrfToken`.

`libs/chat-api-client` (`@epam/chat-api-client`) is already generated from the backend's OpenAPI spec via `npm run openapi`. It exports typed API classes (`ModelsApi`, `DeploymentsApi`, `ConversationsApi`, `AuthApi`, `ThemesApi`, `ChatApi`) built on `runtime.BaseAPI` with a `Configuration` object that accepts `basePath`, `credentials`, `middleware`, and custom `fetchApi`. The generated client is not yet consumed by `apps/chat`.

## Goals / Non-Goals

**Goals**
- Replace direct `get`/`post`/`put`/`del` calls in the three existing domain modules (`models.ts`, `deployments.ts`, `conversations.api.ts`) with the generated API classes.
- Preserve all existing behavior: `credentials: 'include'`, CSRF token forwarding, `UnauthorizedError` + `onUnauthorized` pub/sub, 401 interception.
- Add a telemetry middleware hook via `Configuration.middleware` without changing call-sites.
- Migrate incrementally — one domain at a time; existing behavior must not regress between slices.

**Non-Goals**
- Migrating `chat-stream.api.ts` / the SSE reader. The generated `ChatApi` does not model server-sent events; the manual reader stays until a streaming capability is specified separately.
- Migrating auth call-sites. There is no dedicated auth domain module in `server-api/`; auth endpoints accessed via `ApiEndpoints` constants remain as-is.
- Changing the backend (`apps/chat-api`). If OpenAPI annotation gaps are found during migration they are logged as open questions; fixes are a separate task.
- Introducing a global React Context provider for the API client — module-level singletons are sufficient.
- Migrating `ThemesApi` — theme endpoints are called before React mounts (static asset load); `fetch` is used directly there and is out of scope.

## Decisions

### D1 — Client factory lives in `server-api/api-client.ts`

**Decision**: Create `apps/chat/src/server-api/api-client.ts` that exports a `createApiConfiguration(): Configuration` factory and pre-built singletons for each API class.

**Rationale**: `server-api/` is already the established home for API infrastructure. A factory keeps `Configuration` construction in one place and avoids duplicating `credentials`/`basePath`/middleware across callers. Module-level singletons are idiomatic for stateless HTTP clients.

**Alternative considered**: React Context provider wrapping each API class. Rejected — adds component-tree coupling for code with no UI state.

### D2 — `basePath` defaults to `''` (empty string, same-origin)

**Decision**: Pass `basePath: ''` so all requests are relative (e.g. `/api/v1/models`). The Vite dev proxy forwards `/api/**` to `localhost:5000`.

**Rationale**: The generated `DEFAULT_CONFIG` hardcodes `http://localhost:5000` — unusable in production. An empty basePath makes requests same-origin in all environments without any runtime config.

**Alternative considered**: Reading `window.location.origin`. Unnecessary — relative paths already resolve to the same origin.

### D3 — `credentials: 'include'` set on `Configuration`, not per-request

**Decision**: Set `credentials: 'include'` once in the shared `Configuration` object passed to all generated API classes.

**Rationale**: The `runtime.BaseAPI` forwards `configuration.credentials` to every `fetch` call. This matches the current behavior in `base.ts` where all requests use `credentials: 'include'`.

### D4 — CSRF and 401 handled via `Configuration.middleware`

**Decision**: Implement two middleware objects conforming to `runtime.Middleware` (`{ pre?, post? }`):

1. **`csrfMiddleware`** — `pre` hook: reads `getCsrfToken()` and injects `X-CSRF-Token` header for non-GET requests.
2. **`unauthorizedMiddleware`** — `post` hook: if `response.status === 401`, calls `onUnauthorized` listeners and throws `UnauthorizedError`. This preserves the existing pub/sub contract.

Both are defined in `api-client.ts` and composed into the `Configuration`.

**Rationale**: Centralizing cross-cutting concerns in middleware eliminates the need to duplicate header injection and 401 handling across domain modules. The existing `UnauthorizedError` and `onUnauthorized` exports from `base.ts` are reused directly — no API surface change.

**Alternative considered**: Keeping 401 handling inside each domain wrapper function. Rejected — duplicates logic and diverges from the generated client's middleware model.

### D5 — Telemetry via a named middleware slot

**Decision**: Define an exported `telemetryMiddleware: Middleware` stub in `api-client.ts` (initially a no-op `post` hook that records method + URL + duration). Composed into `Configuration` after the CSRF and 401 middlewares.

**Rationale**: `Configuration.middleware` is an ordered array — appending telemetry last gives it access to the full response. A named export makes it easy to extend or swap the implementation without touching the factory.

### D6 — Domain modules become thin wrappers that delegate to generated classes

**Decision**: Replace the bodies of `models.ts`, `deployments.ts`, `conversations.api.ts` with calls to the corresponding generated API class instances. The function signatures (names, parameters, return types) stay identical so all call-sites inside hooks/components require zero changes.

**Rationale**: Preserving function signatures means the migration is invisible to consumers and can be verified by TypeScript alone (no call-site hunts). The generated classes already return typed DTOs; domain types from `@epam/ai-dial-chat-shared` are kept where they match, or mapped via a one-line cast where the generated DTO is identical in shape.

**Alternative considered**: Importing and calling generated API classes directly in hooks/components. Rejected — bypasses the established `server-api/` abstraction layer and would require touching every hook and component.

### D7 — Use high-level generated methods (not `Raw`) by default

**Decision**: Prefer `modelsApi.listModels()` over `modelsApi.listModelsRaw()`. Use `Raw` only when the response body must be streamed or when `Content-Type` negotiation requires custom handling.

**Rationale**: High-level methods handle JSON deserialization and throw on non-OK responses (the generated `throwIfNullOrUndefined` + `ResponseError`). The `unauthorizedMiddleware` post-hook intercepts 401 before the generated error-throw, ensuring `UnauthorizedError` is always thrown before `ResponseError`.

**Open question OQ-1**: The generated client throws `runtime.ResponseError` for non-2xx, non-401 responses. Currently `base.ts` throws a plain `Error` with the body text. Callers may `instanceof`-check `Error` but not `ResponseError`. Verify no call-site catches the specific error shape before finalizing.

### D8 — `base.ts` is narrowed, not deleted

**Decision**: After all domain modules are migrated, remove `get`/`post`/`put`/`del`, `ApiEndpoints` entries that are no longer referenced, `parseResponse`, `request`, and the `RequestOptions`/`RequestMethod` types. Keep: `UnauthorizedError`, `onUnauthorized`, `setCsrfToken`, `getCsrfToken`, `isValidResponse`, `hasRequiredProperties`.

**Rationale**: `UnauthorizedError` and `onUnauthorized` are referenced in React context and possibly in tests; moving them would require updating many imports. Keeping them in `base.ts` avoids churn. The validation helpers may still be useful independently.

**Note**: `ApiEndpoints.CONVERSATIONS` (used by `chat-stream.api.ts`) must remain until streaming is migrated.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Generated DTO types differ from shared types in `@epam/ai-dial-chat-shared` (e.g. `DialModelDto` vs `DialModel`) | Compare shapes during models pilot (Slice 3). Cast or map where shapes are identical; add an explicit type assertion with a comment where they differ. |
| `runtime.ResponseError` vs plain `Error` — callers catching `Error` will still catch `ResponseError` (it extends `Error`), but `instanceof ResponseError` checks would break if any existed | Grep for `instanceof Error` in call-sites before finalizing Slice 3. No `ResponseError`-specific catches expected. |
| 401 middleware fires before generated client's own error handling | `post` middleware runs before the generated method parses the response — 401 throws `UnauthorizedError` and the generated method never sees the response. This is the desired behavior; confirm in integration test. |
| `streamCompletion` still uses raw `fetch` and `getCsrfToken` from `base.ts` | Explicitly documented as out of scope. `ApiEndpoints.CONVERSATIONS` stays in `base.ts` as long as streaming is unmitigated. |
| `npm run openapi:check` may fail if the generated client is stale | Run `npm run openapi` followed by `npm run openapi:check` as the first verification step. If it fails, fix OpenAPI annotations in `apps/chat-api` before proceeding. |
| TypeScript strict mode: generated `DialModelDto` may have `undefined` fields where the existing code assumes non-null | Checked per domain during migration. Null-coalescing or type guards added conservatively. |

## Migration Plan

Migration is slice-by-slice. Each slice is independently buildable, lintable, and testable. No big-bang replacement.

1. **Slice 1 — Factory**: Add `api-client.ts` with `Configuration`, singletons (`modelsApi`, `deploymentsApi`, `conversationsApi`), CSRF middleware, 401 middleware, telemetry stub. No domain module changes yet. Verification: `nx build chat`, `nx lint chat`.
2. **Slice 2 — Middleware integration test**: Add a Vitest unit test for `api-client.ts` confirming CSRF injection and `UnauthorizedError` throw. Verification: `nx test chat`.
3. **Slice 3 — Models pilot**: Migrate `models.ts`. Verify types align between `DialModelDto` and `DialModel`. Verification: `nx test chat`, `nx lint chat`, `nx build chat`.
4. **Slice 4 — Deployments**: Migrate `deployments.ts`. Compare `Deployment`/`DeploymentListResponse` with generated DTO shapes. Remove local interface definitions if they duplicate generated types.
5. **Slice 5 — Conversations**: Migrate `conversations.api.ts`. CRUD methods map 1:1 to `ConversationsApi`. Verify query-string encoding matches current behavior.
6. **Slice 6 — Narrow `base.ts`**: Remove `get`/`post`/`put`/`del`, unused `ApiEndpoints` entries. Keep infrastructure symbols and `ApiEndpoints.CONVERSATIONS` for `chat-stream.api.ts`.
7. **Slice 7 — Final verification**: Full build, lint, test, openapi:check.

**Rollback**: Each slice is a normal commit. Reverting a slice restores the previous domain module import. No database migrations, no feature flags.

## Open Questions

| ID | Question | Owner | Default if unresolved |
|----|----------|-------|----------------------|
| OQ-1 | Do any `try/catch` blocks in hooks or context code check `error instanceof Error` in a way that would break if `ResponseError` (subclass of `Error`) is thrown? | Implementer, Slice 3 | Assume safe; add grep verification step |
| OQ-2 | Does `apps/chat/package.json` already declare `@epam/chat-api-client` as a dependency, or does it need to be added? | Implementer, Slice 1 | Add explicit dep; verify `nx graph` shows correct edge |
| OQ-3 | `DeploymentsApi` in the generated client — does the generated DTO for deployments match the current `Deployment` / `DeploymentListResponse` shape exactly, or does it include additional fields? | Implementer, Slice 4 | Use generated DTO; remove local interface if shapes are compatible |
