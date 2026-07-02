## Problem

The catalog surface needs to show toolsets, but the implementation must not source catalog toolsets from `GET /api/v1/deployments?interface_type=mcp`. Toolsets already have their own backend domain and generated frontend adapter:

- `apps/chat-api/src/toolsets/toolsets.controller.ts` exposes `GET /api/v1/toolsets`
- `apps/chat/src/server-api/toolsets.ts` exposes `listToolsets()`
- `apps/chat-api/src/deployments/deployments.controller.ts` remains the source for chat-capable model/application deployments used by the conversation model selector

Using the deployments listing for catalog toolsets duplicates responsibility and makes the frontend depend on deployment filtering semantics instead of the dedicated toolsets API.

## Solution

Extend `apps/chat/src/context/DeploymentsContext.tsx` so it loads toolsets in parallel with chat deployments and application schemas:

- chat deployments from `getDeployments([ListDeploymentsInterfaceTypeEnum.Chat])`
- application schemas from `getApplicationSchemas()`
- toolsets from `listToolsets()`

Expose the toolsets as a separate `toolsets: DialToolsetDto[]` field on `DeploymentsContextType`. Keep `items` as the chat deployment list used by conversation/model-selection flows.

Update `apps/chat/src/components/CatalogView/CatalogView.tsx` so the catalog items are built from:

- deployment catalog items mapped from `items`
- toolset catalog items mapped from `toolsets`

The catalog library remains host-agnostic. REST paths, generated clients, and toolset API knowledge stay in `apps/chat/src/server-api` and app-level context/mappers.

Extend the toolsets backend response contract to expose the same user-context metadata catalog already expects from deployments:

- `isInstalled` from `userConfig.toolsets.installed`
- `isMy` from the current session bucket appearing in the toolset id/path

Use the existing user-config installed toolsets section for catalog favorites. Installed toolsets must render as favorites, and toggling a toolset favorite must update the toolsets installed endpoint rather than the deployments installed endpoint.

## Non-Goals

- Do not add toolsets to the catalog by calling `GET /api/v1/deployments?interface_type=mcp`.
- Do not move toolset fetching into `libs/catalog`.
- Do not change model selection behavior; only chat deployments remain selectable for conversations.

## Acceptance Criteria

- `DeploymentsContextType` exposes `toolsets: DialToolsetDto[]`.
- `DeploymentsProvider` calls `listToolsets()` in parallel with deployments and schemas.
- A toolsets fetch failure logs a warning, leaves `toolsets` empty, and does not fail deployment loading.
- `CatalogView` includes `CatalogEntityType.Toolset` items mapped from context toolsets.
- `CatalogView` passes a translated Toolsets tab label.
- Toolsets expose `isInstalled` and `isMy` in the backend OpenAPI contract.
- Installed toolsets from user config render as catalog favorites.
- Toolset favorite toggles persist through the user-config toolsets installed endpoint.
- Existing conversation/model selector consumers keep using `items` and do not receive toolsets through the deployment selector.
- Tests cover context toolset loading/fallback, backend ownership enrichment, catalog inclusion, and toolset favorite routing.

## Alternatives Considered

- Use `GET /api/v1/deployments?interface_type=mcp` for catalog toolsets. Rejected because the repo already has a dedicated toolsets controller and frontend adapter, and catalog toolsets should use that source of truth.

## Rollback / Compatibility

This is a compatible extension to the toolsets response and frontend context shape. Rollback is to remove `toolsets` from `DeploymentsContext`, remove the `listToolsets()` call, remove `isInstalled` / `isMy` enrichment from toolset responses, and return `CatalogView` to deployment-only favorites/items.
