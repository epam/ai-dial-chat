## Context

`DeploymentsContext` is already the app-level provider for deployment data consumed by conversation and catalog surfaces. It currently loads chat deployments and application schemas in parallel, enriches application icons from schemas, and exposes:

- `items: DeploymentItemDto[]`
- `schemas: ApplicationSchemaSummaryDto[]`
- selection/configuration state for the active chat deployment

The repository also has a dedicated toolsets API path:

- Backend: `apps/chat-api/src/toolsets/toolsets.controller.ts`
- Frontend adapter: `apps/chat/src/server-api/toolsets.ts`

Catalog should compose deployments and toolsets at the app edge, not inside `libs/catalog` and not through deployment filtering.

## Decisions

### Decision 1 — Keep `items` as chat deployments only

`items` remains the data source for model selection and conversation flows. It continues to be loaded with `getDeployments([ListDeploymentsInterfaceTypeEnum.Chat])`.

Why: adding toolsets to `items` would leak catalog-only entities into chat selection surfaces.

### Decision 2 — Add separate `toolsets` context field

`DeploymentsContextType` gets a new `toolsets: DialToolsetDto[]` field. `DeploymentsProvider` calls `listToolsets()` alongside deployments and schemas using `Promise.allSettled`.

Why: the catalog can consume one app-level context while preserving separate source contracts.

### Decision 3 — Toolset loading failure is non-fatal

If `listToolsets()` rejects, the provider logs a warning and keeps `toolsets` as `[]`. Deployment loading errors still set `error` because chat deployments are required for the main conversation flow.

Why: catalog can still show models/applications even if toolsets are unavailable, matching the existing schema fallback pattern.

### Decision 4 — Map toolsets to catalog items in `apps/chat`

Add an app-level mapper from `DialToolsetDto` to `CatalogItem` using `CatalogEntityType.Toolset`. The mapper stays outside `libs/catalog` so generated API DTOs and host integration details do not enter hand-authored libs.

### Decision 5 — Enrich toolsets with user config metadata at the backend edge

`ToolsetsService` keeps DIAL Core toolset data cached without user-specific ownership fields, then enriches list/get responses with `isInstalled` and `isMy` after cache reads. `isInstalled` comes from `UserConfigService.getInstalledIds(...).toolsets`; `isMy` follows the deployments pattern by checking the current session bucket against id/path segments.

Why: ownership and installed state are user-scoped, while the cached DIAL Core toolset payload is only user/session-scoped by access token and should not hard-code bucket-derived fields before cache reuse.

### Decision 6 — Reuse installed user config for toolset favorites

`useFavoriteApplications` loads both `deployments.installed` and `toolsets.installed` into the catalog favorite id set. `CatalogView` routes favorite toggles by catalog entity type: deployments/applications use the deployments installed endpoint, while toolsets use the toolsets installed endpoint.

Why: catalog favorites already represent installed entities, and user config already has separate installed sections for deployments and toolsets.

## Risks / Trade-offs

- **Context grows broader** — `DeploymentsContext` now carries catalog toolsets as well as deployments. This is acceptable because it already feeds catalog surfaces and keeps fetching at the app edge.
- **Partial catalog data** — toolsets can be absent when their API fails while deployments still render. This is preferred over blocking the whole catalog.
- **Favorite routing** — catalog favorite toggles now branch by entity type. Tests cover that toolsets use the toolset installed endpoint so deployment favorites remain unchanged.

## Verification

- `npm exec nx test chat`
- `npm exec nx lint chat`
- `npm exec nx test chat-api`
- `npm run openapi:check`

## Open Questions

_(none)_
