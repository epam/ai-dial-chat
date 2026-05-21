## Why

`apps/chat/src/server-api/` consists of hand-rolled `get`/`post`/`put`/`del` helpers and hard-coded endpoint string constants. The backend already exposes a fully-documented OpenAPI spec, and `@epam/chat-api-client` is generated from it. Continuing to maintain two parallel representations of the same contract creates drift, duplicates request wiring, and loses the type-safety that the generated client provides for free.

## What Changes

- **New**: A client configuration factory in `apps/chat/src/server-api/api-client.ts` that creates a `Configuration` instance with `credentials: 'include'`, relative `basePath`, CSRF-header middleware, 401-interception middleware, and optional telemetry middleware.
- **New**: Thin domain wrappers that delegate to the appropriate generated API class (`ModelsApi`, `DeploymentsApi`, `ConversationsApi`) instead of calling `get`/`post`/`put`/`del` directly.
- **Removed (incrementally)**: Direct imports of `get`, `post`, `put`, `del` from `base.ts` in domain modules once each domain is migrated.
- **Reduced**: `ApiEndpoints` enum — entries can be removed as each domain module stops referencing them. The enum itself stays until all callsites are migrated.
- **Kept**: `UnauthorizedError`, `onUnauthorized`, `setCsrfToken`/`getCsrfToken` — these are surfaced in React context; they remain in `base.ts` and are re-used by the new middleware layer.
- **Kept**: `streamCompletion` in `chat-stream.api.ts` — the generated `ChatApi` does not support SSE streaming natively; the manual SSE reader stays until a streaming capability is specified separately.
- **No backend changes** unless OpenAPI annotation gaps are discovered during migration (tracked as open questions in design.md).

## Capabilities

### New Capabilities

- `generated-api-client-integration`: Configuration factory, middleware pipeline (CSRF, 401, telemetry), and incremental migration of all domain modules from manual helpers to the generated client.

### Modified Capabilities

- *(none — no existing spec-level behavior changes; this is an implementation-layer migration)*

## Impact

- **`apps/chat/src/server-api/`**: The three existing domain modules (`models.ts`, `deployments.ts`, `conversations.api.ts`) are migrated. `base.ts` is narrowed to infrastructure only (`UnauthorizedError`, `onUnauthorized`, `setCsrfToken`/`getCsrfToken`).
- **`libs/chat-api-client`**: Read-only; no changes to generated code. `npm run openapi` regenerates it; `npm run openapi:check` validates it is up to date.
- **No shared libs (`libs/chat-shared`, `libs/conversation-input`) are changed** — types consumed from those libs remain as-is.
- **`@epam/chat-api-client`** becomes a direct dependency of `apps/chat` (it may already be listed; verify in `apps/chat/package.json`).
- **Test surface**: Unit tests in `apps/chat` that mock `server-api/base.ts` helpers will need to mock the generated API classes instead — covered in migration tasks.
