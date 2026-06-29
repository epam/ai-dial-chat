## Context

The BFF already proxies DIAL Core for models (`GET /api/v1/models`), applications, and a unified deployments listing (`GET /api/v1/deployments`). Toolsets appear in the unified list as summary-only `DeploymentItemDto` rows; catalog entity-detail views need the full upstream toolset payload (transport, allowed tools, auth settings, etc.). Usage/spent limits are not available on any existing endpoint — DIAL Core exposes them at `GET /v1/deployments/{deployment_name}/limits`.

All new routes sit behind the global `SessionGuard`; upstream calls use `Authorization: Bearer <session.at>`. Reference implementations: `apps/chat-api/src/models/models.controller.ts`, `apps/chat-api/src/models/models.service.ts`, `apps/chat-api/src/deployments/deployments.controller.ts`. NestJS conventions: `apps/chat-api/AGENTS.md`.

## Goals / Non-Goals

**Goals:**

- Expose `GET /api/v1/toolsets` and `GET /api/v1/toolsets/:toolsetName` mirroring DIAL Core `/openai/toolsets` endpoints via SDK `getToolSets()` / `getToolset()`
- Expose `GET /api/v1/deployments/:deploymentName/limits` mirroring DIAL Core `/v1/deployments/{deployment_name}/limits` via SDK `getDeploymentLimits()`
- OpenAPI DTOs, Swagger annotations, per-route `@Throttle(60/min)`, standard error mapping
- Unit + integration tests; OpenAPI regen + thin `server-api` wrappers (no UI)

**Non-goals:** toolset CRUD, toolset auth ops, tool listing, changes to unified deployments listing, limits mutation, aggregated limits, feature flags / i18n.

## Decisions

### D1 — New `toolsets` domain (mirror `models`)

**Decision:** Add `apps/chat-api/src/toolsets/` with `ToolsetsController`, `ToolsetsService extends AppService`, `ToolsetsModule`, and `GetToolsetDto` (same allowlist regex as `GetModelDto`).

**Rationale:** Toolsets are a distinct DIAL Core resource with their own OpenAI-compatible paths. A dedicated domain matches the models/applications split and keeps Swagger tags clean.

**Alternatives considered:**

- Extend `deployments` controller: Would mix unified-list normalization with raw upstream pass-through shapes.
- Embed toolset detail in `GET /api/v1/deployments/:name`: Breaks the established pattern of dedicated list + lookup endpoints.

### D2 — Limits under `deployments` at `/:deploymentName/limits`

**Decision:** Add `getDeploymentLimits` handler to `DeploymentsController` at `GET :deploymentName/limits`. SDK method: `getDeploymentLimits(deploymentName, { headers })`.

**Rationale:** 1:1 with DIAL Core path; works for models, applications, and toolsets without a separate top-level resource. Prefer over `GET /api/v1/models/:modelName/limits`, which would falsely imply models-only scope.

**Alternatives considered:**

- `GET /api/v1/models/:modelName/limits`: Narrower naming; rejected because limits apply to any deployment type.
- Top-level `GET /api/v1/limits/:name`: No upstream equivalent; adds indirection.

### D3 — SDK methods and handler naming

| BFF route | SDK method | Controller handler | OpenAPI operationId |
|-----------|------------|--------------------|---------------------|
| `GET /api/v1/toolsets` | `getToolSets()` | `listToolsets` | `listToolsets` |
| `GET /api/v1/toolsets/:toolsetName` | `getToolset(name)` | `getToolset` | `getToolset` |
| `GET /api/v1/deployments/:deploymentName/limits` | `getDeploymentLimits(name)` | `getDeploymentLimits` | `getDeploymentLimits` |

Handler names become generated SDK method names via `operationIdFactory`.

### D4 — Response DTOs in `openapi-response.dto.ts`

**Decision:** Define `DialToolsetDto`, `DialToolsetAuthSettingsDto`, `DialToolsetListResponseDto`, `LimitStatsDto`, and `DeploymentLimitsResponseDto` in `apps/chat-api/src/openapi/openapi-response.dto.ts`. Frontend wrappers import types from `@epam/chat-api-client` (current pattern — see `apps/chat/src/server-api/models.ts`).

**Rationale:** Strong Swagger metadata for OpenAPI regen; avoids duplicating shapes in `chat-shared` when the generated client is the frontend contract.

### D5 — Toolset cache: 30 s list / 60 s single

**Decision:** Cache keys `toolsets:list:<sub>` (TTL 30 s) and `toolsets:single:<sub>:<toolsetName>` (TTL 60 s). Response headers `Cache-Control: private, max-age=30|60`.

**Invalidation:** TTL-only; no explicit invalidation events. Same eventual-consistency trade-off as models.

### D6 — Limits: no server-side cache

**Decision:** `getDeploymentLimits` MUST NOT use `CACHE_MANAGER`. Set `Cache-Control: private, no-store`.

**Rationale:** Usage stats are real-time; caching would show stale spent counts. Every request hits DIAL Core.

### D7 — `auth_settings` pass-through with secret redaction

**Decision:** Proxy `auth_settings` fields returned by DIAL Core as-is **except** strip `client_secret` if present before serializing the response. DIAL Core's documented toolset response does not include `client_secret`; this is defense-in-depth.

**Rationale:** The SPA needs OAuth metadata (endpoints, scopes, auth status) to render toolset detail and drive sign-in UX in a future change. Redacting a secret that should never appear upstream prevents accidental leakage if DIAL Core adds it later.

**Alternatives considered:**

- Full pass-through: Simpler but risky if upstream ever returns secrets.
- Redact all of `auth_settings`: Would break future OAuth UI that needs client_id and endpoints.

### D8 — Path param validation (shared allowlist)

**Decision:** `:toolsetName` and `:deploymentName` use `@Matches(/^[a-zA-Z0-9_\-.:@]+$/)` — same as models. Slash-containing names must be URL-encoded (`%2F`) by the caller.

### D9 — Route ordering in `DeploymentsController`

**Decision:** Register `GET :deploymentName/limits` alongside existing `GET :deployment/configuration`. Both are multi-segment static suffix routes; no conflict with `GET /` list handler.

## Risks / Trade-offs

- **Stale toolset metadata (30–60 s cache)** → Acceptable for catalog browsing; document TTL in spec. Permission revocations may lag briefly.
- **SDK `getToolSets` naming** → SDK uses camelCase `getToolSets` (capital S); document exact method name in specs to avoid confusion with `getToolsets`.
- **Limits upstream 404 semantics** → DIAL Core returns 404 when limits are not configured for a deployment; map to `NotFoundException`.
- **No SDK gap for toolset listing** → If SDK version lacks `getToolSets`, fall back to documented raw fetch with `AbortController` + `DIAL_CORE_TIMEOUT_MS` and note the exception in service JSDoc (same escape hatch as AGENTS.md §4).

## Migration Plan

1. Implement backend domains (toolsets slice, then limits slice) with tests.
2. Run `npm run openapi && npm run openapi:check`; build/lint `chat-api-client`.
3. Add `server-api` wrappers.
4. Deploy — additive only; no env var changes expected.

**Rollback:** Remove `toolsets` module, revert limits handler, regenerate OpenAPI. No client-breaking changes.

## Open Questions

_(none — limits path, cache policy, and auth_settings redaction are decided above)_
