## Why

The current `GET /api/v1/catalog` endpoint fetches models and applications from DIAL Core via two separate calls (`/openai/models` and `/openai/applications`) and merges them client-side — excluding toolsets entirely. DIAL Core `0.1.0-dev.16` introduced `GET /v1/deployments`, a unified listing endpoint that returns models, applications, and toolsets in a single call, with server-side `interface_type` filtering (`chat | embeddings | mcp | custom_ui | all`). Adopting it removes the manual merge, exposes the full deployment surface including toolsets and interface-type filtering, and eliminates the now-redundant catalog layer entirely.

## What Changes

- **New** `GET /api/v1/deployments` endpoint proxying DIAL Core `GET /v1/deployments`, with optional `interface_type` query parameter (multi-value).
- **New** `DeploymentsModule` / `DeploymentsService` / `DeploymentsController` in `apps/chat-api/src/deployments/`.
- **New** `DeploymentItemDto` union DTO (`model | application | toolset`) with `type` discriminator.
- **New** frontend `server-api/deployments.api.ts` wrapper and `DeploymentsContext` replacing `CatalogContext`.
- **Removed** `CatalogModule`, `CatalogService`, `CatalogFilterService`, `CatalogController` and all their DTOs from `apps/chat-api/src/catalog/`.
- **Removed** `CatalogContext`, `useCatalog`, `server-api/catalog.ts`, `CatalogItemDto` from `apps/chat/src/`.
- **Removed** `catalog` tag from `openapi.config.ts`; `GET /api/v1/catalog` is no longer served.
- **Modified** `model-selector-in-chat-input` openspec `unified-catalog/spec.md` updated to reference `GET /api/v1/deployments` / `DeploymentsContext` / `useDeployments()`.
- SDK dependency updated from `@epam/ai-dial-typescript-sdk@0.1.0-dev.5` to `0.1.0-dev.16` (already installed).

## Capabilities

### New Capabilities

- `deployments-api`: Backend `GET /api/v1/deployments` endpoint — proxies DIAL Core `/v1/deployments`, supports `interface_type` filtering, caches per-user, returns `{ deployments: DeploymentItemDto[] }`.
- `deployments-context`: Frontend `DeploymentsContext` and `useDeployments()` hook — replaces `CatalogContext` as the source of deployment items for the conversation model selector.

### Modified Capabilities

- `unified-catalog`: The `CatalogContext` requirement in `openspec/changes/model-selector-in-chat-input/specs/unified-catalog/spec.md` changes — the provider SHALL fetch from `GET /api/v1/deployments` (via `getDeployments()`) instead of `GET /api/v1/catalog`, and the context SHALL expose `DeploymentItemDto[]` instead of `CatalogItemDto[]`. The context is renamed `DeploymentsContext` / `useDeployments()`.

## Impact

- **Backend**: New `apps/chat-api/src/deployments/` domain replaces `apps/chat-api/src/catalog/`. `AppModule` loses `CatalogModule`, gains `DeploymentsModule`.
- **Frontend**: `CatalogContext.tsx` replaced by `DeploymentsContext.tsx`; `server-api/catalog.ts` replaced by `server-api/deployments.api.ts`; `ConversationRoute` and `ConversationView` updated to use `useDeployments()`.
- **Generated client**: `npm run openapi` removes `CatalogApi` / `CatalogItemDto`, produces new `DeploymentsApi` class with `DeploymentItemDto` / `DeploymentsResponseDto`.
- **SDK**: `@epam/ai-dial-typescript-sdk` bumped to `0.1.0-dev.16` (already installed).
- **Openspec**: `openspec/changes/model-selector-in-chat-input/specs/unified-catalog/spec.md` updated to reference the deployments API.
