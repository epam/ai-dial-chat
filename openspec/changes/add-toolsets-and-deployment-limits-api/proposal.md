## Why

The SPA and catalog need full toolset metadata (transport, allowed tools, auth settings, etc.) and per-deployment usage limits, but the BFF today only exposes summary toolset rows inside `GET /api/v1/deployments` and has no limits endpoint at all. Catalog entity-detail views cannot render toolset pages or show spent/limit stats without dedicated BFF proxies that keep DIAL credentials server-side, mirroring the established models pattern.

## What Changes

- New `toolsets` domain under `apps/chat-api/src/toolsets/` with two authenticated endpoints:
  - `GET /api/v1/toolsets` — list toolsets, proxied from `GET /openai/toolsets` via `client.getToolsets()`
  - `GET /api/v1/toolsets/:toolsetName` — single toolset detail, proxied from `GET /openai/toolsets/{toolset_name}` via `client.getToolset(toolsetName)`
- Both toolset endpoints follow the models pattern: `SessionGuard`, Bearer session token upstream, `@Throttle(60/min)`, server-side cache (30 s list / 60 s single), `Cache-Control: private`, error mapping via `mapDialHttpStatus` / `handleDialFetchError`, path param validation `@Matches(/^[a-zA-Z0-9_\-.:@]+$/)`
- New deployment limits handler under the existing `deployments` domain:
  - `GET /api/v1/deployments/:deploymentName/limits` — spent/limit stats, proxied from `GET /v1/deployments/{deployment_name}/limits`
  - **No server-side cache** (real-time usage); `Cache-Control: private, no-store`
- OpenAPI DTOs for toolset and limits response shapes; regenerate `@epam/chat-api-client`
- Thin frontend `server-api` wrappers in `apps/chat/src/server-api/` (no UI in this change)
- Unit + integration tests for all three endpoints

**Non-goals:** toolset CRUD, toolset auth sign-in/out ops, tool listing, changes to unified deployments listing, limits mutation, aggregated cross-deployment limits, feature flags / i18n.

## Capabilities

### New Capabilities

- `toolset-listing`: BFF proxy `GET /api/v1/toolsets` returning `{ data: DialToolset[] }` for the authenticated session user
- `toolset-lookup`: BFF proxy `GET /api/v1/toolsets/:toolsetName` returning a single `DialToolset` with full metadata
- `deployment-limits-api`: BFF proxy `GET /api/v1/deployments/:deploymentName/limits` returning spent/limit stats per deployment (models, applications, toolsets)

### Modified Capabilities

_(none — `GET /api/v1/deployments` unified listing and existing model/application endpoints remain unchanged)_

## Impact

- **New files**: `apps/chat-api/src/toolsets/` (controller, service, module, DTOs, tests)
- **Modified**: `apps/chat-api/src/deployments/` — new limits handler + service method + DTOs + tests
- **Modified**: `apps/chat-api/src/app/app.module.ts` — register `ToolsetsModule`
- **New OpenAPI DTOs**: `DialToolsetDto`, `DialToolsetListResponseDto`, `DeploymentLimitsResponseDto`, nested `LimitStatsDto`
- **New frontend wrappers**: `apps/chat/src/server-api/toolsets.ts`, `apps/chat/src/server-api/deployment-limits.ts` (or extend existing deployments wrapper)
- **OpenAPI regen**: `npm run openapi && npm run openapi:check`; `chat-api-client` build/lint
- **Reference implementations**: `apps/chat-api/src/models/models.controller.ts`, `apps/chat-api/src/models/models.service.ts`, `openspec/specs/model-listing/spec.md`, `openspec/specs/model-lookup/spec.md`
- **Rollback**: additive endpoints only — revert domain modules + OpenAPI regen; no breaking changes to existing clients
